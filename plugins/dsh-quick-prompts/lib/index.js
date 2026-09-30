import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
//#region src/runner.ts
const OUTPUT_LIMIT = 2e5;
var ProjectRunner = class {
	disposed = false;
	jobs = /* @__PURE__ */ new Map();
	restarts = /* @__PURE__ */ new Map();
	snapshot(cwd) {
		return this.jobs.get(cwd)?.state;
	}
	start(cwd, command) {
		if (this.disposed) throw new Error("运行服务正在关闭。");
		if (this.jobs.get(cwd)?.state.status === "running" || this.jobs.get(cwd)?.state.status === "stopping") throw new Error("项目已在运行，请先停止。");
		if (!command.trim() || command.length > 16e3 || command.includes("\0")) throw new Error("请输入有效的启动命令。");
		for (const [key, job] of this.jobs) if (this.jobs.size >= 16 && !["running", "stopping"].includes(job.state.status)) this.jobs.delete(key);
		if (this.jobs.size >= 16 && !this.jobs.has(cwd)) throw new Error("运行项目过多，请先停止其他项目。");
		const state = {
			command,
			status: "running",
			output: "",
			exitCode: null,
			truncated: false
		};
		const child = spawn("/bin/zsh", ["-c", command], {
			cwd,
			detached: true,
			env: {
				...process.env,
				TERM: "dumb",
				FORCE_COLOR: "0"
			},
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let finish;
		const job = {
			state,
			child,
			done: new Promise((resolve) => {
				finish = resolve;
			})
		};
		this.jobs.set(cwd, job);
		const append = (text) => {
			state.output += stripVTControlCharacters(text);
			if (state.output.length > OUTPUT_LIMIT) {
				state.output = state.output.slice(-2e5);
				state.truncated = true;
			}
		};
		child.stdout?.setEncoding("utf8");
		child.stderr?.setEncoding("utf8");
		child.stdout?.on("data", append);
		child.stderr?.on("data", append);
		child.on("error", (error) => {
			append(`\n${error.message}\n`);
			state.status = "error";
			finish();
		});
		child.on("close", (code) => {
			this.signal(job, "SIGKILL");
			state.exitCode = code;
			if (state.status !== "error" && state.status !== "stopping") state.status = "exited";
			finish();
		});
		return state;
	}
	restart(cwd, command) {
		const pending = this.restarts.get(cwd);
		if (pending) return pending;
		if (!command.trim() || command.length > 16e3 || command.includes("\0")) return Promise.reject(/* @__PURE__ */ new Error("请先保存有效的启动命令。"));
		const operation = (async () => {
			await this.stop(cwd);
			return this.start(cwd, command);
		})();
		this.restarts.set(cwd, operation);
		operation.finally(() => {
			if (this.restarts.get(cwd) === operation) this.restarts.delete(cwd);
		}).catch(() => {});
		return operation;
	}
	signal(job, signal) {
		if (!job.child.pid) return;
		try {
			process.kill(-job.child.pid, signal);
		} catch (error) {
			if (error.code !== "ESRCH") throw error;
		}
	}
	async stop(cwd) {
		const job = this.jobs.get(cwd);
		if (!job || !["running", "stopping"].includes(job.state.status)) return;
		if (job.stop) return job.stop;
		job.state.status = "stopping";
		job.stop = (async () => {
			this.signal(job, "SIGTERM");
			await new Promise((resolve) => setTimeout(resolve, 1200));
			this.signal(job, "SIGKILL");
			await job.done;
			if (job.state.status === "stopping") job.state.status = "exited";
		})();
		return job.stop;
	}
	killAll() {
		this.disposed = true;
		for (const job of this.jobs.values()) if (["running", "stopping"].includes(job.state.status)) this.signal(job, "SIGKILL");
	}
	async dispose() {
		this.disposed = true;
		await Promise.all([...this.jobs.keys()].map((key) => this.stop(key)));
	}
};
//#endregion
//#region src/prompt-store.ts
/** Serialize only configuration mutations; status requests never wait on disk. */
var PromptStore = class {
	queue = Promise.resolve();
	file;
	constructor(file) {
		this.file = file;
	}
	async read() {
		await this.queue;
		return this.readFile();
	}
	async readFile() {
		try {
			const value = JSON.parse(await readFile(this.file, "utf8"));
			if (!Array.isArray(value)) throw new Error("快捷任务配置格式错误。");
			return value;
		} catch (error) {
			if (error.code === "ENOENT") return [];
			throw error;
		}
	}
	update(change) {
		const result = this.queue.then(async () => {
			const items = await this.readFile();
			change(items);
			await mkdir(dirname(this.file), {
				recursive: true,
				mode: 448
			});
			await writeFile(this.file + ".tmp", JSON.stringify(items), { mode: 384 });
			await rename(this.file + ".tmp", this.file);
			return items;
		});
		this.queue = result.catch(() => {});
		return result;
	}
};
//#endregion
//#region src/index.ts
const name = "dsh-quick-prompts";
const inject = [
	"webServer",
	"connection",
	"sessions"
];
function validatePrompt(value) {
	if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 100) throw new Error("名称不能为空，且不能超过 100 字。");
	if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 32e3) throw new Error("提示词不能为空，且不能超过 32,000 字。");
	const mode = value.mode ?? "chat";
	if (![
		"chat",
		"agent",
		"shell"
	].includes(String(mode))) throw new Error("执行方式无效。");
	if (mode === "shell" && (value.text.length > 16e3 || value.text.includes("\0"))) throw new Error("Shell 命令无效或过长。");
	let selection;
	if (mode === "agent" && value.selection !== void 0) {
		const item = value.selection;
		if (!item || typeof item.provider !== "string" || !item.provider || typeof item.model !== "string" || !item.model || item.provider.length > 200 || item.model.length > 200) throw new Error("模型配置无效。");
		if (item.reasoningEffort !== void 0 && (typeof item.reasoningEffort !== "string" || item.reasoningEffort.length > 100)) throw new Error("思考强度无效。");
		selection = {
			provider: item.provider,
			model: item.model,
			...item.reasoningEffort === void 0 ? {} : { reasoningEffort: item.reasoningEffort }
		};
	}
	return {
		name: value.name.trim(),
		text: value.text,
		...value.mode === void 0 ? {} : { mode: String(mode) },
		...selection ? { selection } : {}
	};
}
function apply(ctx) {
	const runner = new ProjectRunner();
	const cwdFor = async (id) => {
		if (typeof id !== "string" || !id) throw new Error("请先选择会话。");
		const live = ctx.get("sessions").list().find((s) => (s.id ?? s.header.id) === id)?.header;
		const persistence = ctx.get("sessionPersistence");
		const header = live ?? (await persistence?.stat(id))?.header;
		if (!header || header.id !== id || !header.cwd) throw new Error("会话没有有效工作目录。");
		return realpath(header.cwd);
	};
	ctx.effect(() => {
		const cleanup = () => runner.killAll();
		process.on("exit", cleanup);
		process.on("SIGTERM", cleanup);
		process.on("SIGINT", cleanup);
		return async () => {
			await runner.dispose();
			process.off("exit", cleanup);
			process.off("SIGTERM", cleanup);
			process.off("SIGINT", cleanup);
		};
	});
	const server = ctx.get("webServer");
	const directory = join(homedir(), ".dsh");
	const store = new PromptStore(join(directory, "quick-prompts.json"));
	const send = (res, status, body) => {
		res.statusCode = status;
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(JSON.stringify(body));
	};
	ctx.effect(() => server.register({
		kind: "exact",
		path: "/dsh-quick-prompts",
		handler: async (req, res) => {
			const fence = ctx.get("connection");
			const denied = fence?.requestRejection({ headers: req.headers });
			if (!fence || denied !== void 0) {
				send(res, denied ?? 403, { error: "访问被拒绝。" });
				return;
			}
			if (req.method !== "POST" || String(req.headers["content-type"]).split(";")[0]?.trim() !== "application/json") {
				send(res, 400, { error: "需要 JSON POST 请求。" });
				return;
			}
			try {
				let size = 0;
				const chunks = [];
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 16e4) {
						send(res, 413, { error: "提示词过长。" });
						return;
					}
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if ([
					"workspace",
					"run",
					"status",
					"stop"
				].includes(body.action)) {
					const cwd = await cwdFor(body.sessionId);
					if (body.action === "workspace") {
						send(res, 200, { cwd });
						return;
					}
					if (body.action === "run") {
						const prompt = (await store.read()).find((p) => p.id === body.id);
						if (!prompt || prompt.mode !== "shell") throw new Error("终端任务不存在。");
						runner.start(cwd, prompt.text);
					}
					if (body.action === "stop") await runner.stop(cwd);
					const state = runner.snapshot(cwd) ?? {
						status: "idle",
						output: "",
						exitCode: null
					};
					send(res, 200, {
						cwd,
						...state,
						...body.includeOutput === false ? { output: "" } : {}
					});
					return;
				}
				const prompts = body.action === "list" ? await store.read() : await store.update((prompts) => {
					const index = prompts.findIndex((prompt) => prompt.id === body.id);
					if (body.action === "save") {
						const value = validatePrompt(body);
						if (body.id && index < 0) throw new Error("提示词已删除，请刷新。");
						if (index >= 0) prompts[index] = {
							id: body.id,
							...value
						};
						else {
							if (prompts.length >= 100) throw new Error("最多保存 100 条提示词。");
							prompts.push({
								id: randomUUID(),
								...value
							});
						}
					} else if (body.action === "delete") {
						if (index < 0) throw new Error("提示词不存在。");
						prompts.splice(index, 1);
					} else throw new Error("未知操作。");
				});
				send(res, 200, { prompts });
			} catch (error) {
				send(res, 400, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}));
}
//#endregion
export { apply, inject, name, validatePrompt };
