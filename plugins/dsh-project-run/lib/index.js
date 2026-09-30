import { mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import * as pty from "node-pty";
import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
//#region src/terminal.ts
var ProjectTerminals = class {
	entries = /* @__PURE__ */ new Map();
	disposed = false;
	open(key, cwd, cols, rows) {
		const current = this.entries.get(key);
		if (current) return this.read(key, current.id, 0);
		if (this.disposed) throw new Error("终端已关闭。");
		if (this.entries.size >= 16) throw new Error("最多打开 16 个终端，请先关闭不用的终端。");
		const process = pty.spawn("/bin/zsh", ["-i"], {
			cwd,
			cols,
			rows,
			name: "xterm-256color",
			env: {
				...globalThis.process.env,
				TERM: "xterm-256color"
			}
		});
		const entry = {
			id: randomUUID(),
			cwd,
			process,
			output: "",
			offset: 0,
			exited: false
		};
		this.entries.set(key, entry);
		process.onData((data) => {
			entry.output += data;
			if (entry.output.length > 2e5) {
				const drop = entry.output.length - 2e5;
				entry.output = entry.output.slice(drop);
				entry.offset += drop;
			}
		});
		process.onExit(() => {
			entry.exited = true;
		});
		return this.read(key, entry.id, 0);
	}
	entry(key, id) {
		const entry = this.entries.get(key);
		if (!entry || entry.id !== id) throw new Error("终端已关闭，请重新打开。");
		return entry;
	}
	read(key, id, cursor) {
		const entry = this.entry(key, id);
		const reset = cursor < entry.offset || cursor > entry.offset + entry.output.length;
		return {
			id,
			cwd: entry.cwd,
			exited: entry.exited,
			reset,
			output: entry.output.slice(reset ? 0 : cursor - entry.offset),
			cursor: entry.offset + entry.output.length
		};
	}
	write(key, id, data) {
		const entry = this.entry(key, id);
		if (entry.exited) throw new Error("终端进程已结束。");
		entry.process.write(data);
	}
	resize(key, id, cols, rows) {
		const entry = this.entry(key, id);
		if (!entry.exited) entry.process.resize(cols, rows);
	}
	close(key, id) {
		const entry = this.entry(key, id);
		this.entries.delete(key);
		try {
			entry.process.kill("SIGHUP");
		} catch {}
		setTimeout(() => {
			if (!entry.exited) {
				try {
					globalThis.process.kill(-entry.process.pid, "SIGKILL");
				} catch {}
				try {
					entry.process.kill("SIGKILL");
				} catch {}
			}
		}, 1e3).unref();
	}
	dispose() {
		this.disposed = true;
		for (const [key, entry] of this.entries) this.close(key, entry.id);
	}
};
//#endregion
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
//#region src/index.ts
const name = "dsh-project-run";
const inject = [
	"webServer",
	"sessions",
	"connection"
];
const json = (res, code, value) => {
	res.statusCode = code;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(value));
};
async function projectCwd(ctx, sessionId) {
	if (typeof sessionId !== "string" || !sessionId) throw new Error("请先打开项目会话。");
	const session = ctx.get("sessions").list().find((item) => (item.id ?? item.header?.id) === sessionId);
	const persistence = ctx.get("sessionPersistence");
	const stored = session ? void 0 : await persistence?.stat(sessionId);
	if (stored && stored.header.id !== sessionId) throw new Error("会话信息不匹配。");
	const cwd = session?.header?.cwd ?? session?.cwd ?? stored?.header.cwd;
	if (!cwd) throw new Error("会话没有有效的工作目录。");
	return realpathSync(cwd);
}
function apply(ctx) {
	const runner = new ProjectRunner();
	const terminals = new ProjectTerminals();
	const server = ctx.get("webServer");
	const configDir = join(homedir(), ".dsh", "project-run");
	const configFile = (cwd) => join(configDir, createHash("sha256").update(cwd).digest("hex") + ".json");
	const readCommand = (cwd) => {
		try {
			return String(JSON.parse(readFileSync(configFile(cwd), "utf8")).command ?? "");
		} catch (err) {
			if (err.code === "ENOENT") return "";
			throw err;
		}
	};
	const snapshot = (cwd) => ({
		cwd,
		savedCommand: readCommand(cwd),
		...runner.snapshot(cwd) ?? {
			status: "idle",
			command: "",
			output: "",
			exitCode: null,
			truncated: false
		}
	});
	ctx.effect(() => server.register({
		kind: "exact",
		path: "/dsh-project-run",
		handler: async (req, res) => {
			const connection = ctx.get("connection");
			const denied = connection?.requestRejection({ headers: req.headers });
			if (!connection || denied !== void 0) {
				json(res, denied ?? 403, { error: "访问被拒绝。" });
				return;
			}
			if (req.method !== "POST") {
				json(res, 405, { error: "POST required" });
				return;
			}
			if (String(req.headers["content-type"]).split(";")[0]?.trim() !== "application/json") {
				json(res, 415, { error: "JSON required" });
				return;
			}
			try {
				let size = 0;
				const chunks = [];
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 32768) {
						json(res, 413, { error: "请求过大。" });
						return;
					}
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				const cwd = await projectCwd(ctx, body.sessionId);
				if (typeof body.action === "string" && body.action.startsWith("terminal/")) {
					const key = JSON.stringify([body.sessionId, cwd]);
					const dimension = (value, max) => {
						if (!Number.isInteger(value) || value < 2 || value > max) throw new Error("终端尺寸无效。");
						return value;
					};
					if (body.action === "terminal/open") {
						json(res, 200, terminals.open(key, cwd, dimension(body.cols, 500), dimension(body.rows, 300)));
						return;
					}
					if (typeof body.id !== "string") throw new Error("终端标识无效。");
					switch (body.action) {
						case "terminal/read":
							if (!Number.isSafeInteger(body.cursor) || body.cursor < 0) throw new Error("终端位置无效。");
							json(res, 200, terminals.read(key, body.id, body.cursor));
							return;
						case "terminal/write":
							if (typeof body.data !== "string" || body.data.length > 8192) throw new Error("终端输入过长。");
							terminals.write(key, body.id, body.data);
							break;
						case "terminal/resize":
							terminals.resize(key, body.id, dimension(body.cols, 500), dimension(body.rows, 300));
							break;
						case "terminal/close":
							terminals.close(key, body.id);
							break;
						default: throw new Error("未知终端操作。");
					}
					json(res, 200, {});
					return;
				}
				switch (body.action) {
					case "status": break;
					case "save": {
						if (typeof body.command !== "string" || body.command.length > 16e3 || body.command.includes("\0")) throw new Error("启动命令无效。");
						mkdirSync(configDir, {
							recursive: true,
							mode: 448
						});
						const file = configFile(cwd);
						writeFileSync(file + ".tmp", JSON.stringify({ command: body.command }), { mode: 384 });
						renameSync(file + ".tmp", file);
						break;
					}
					case "start":
						runner.start(cwd, readCommand(cwd));
						break;
					case "stop":
						await runner.stop(cwd);
						break;
					case "restart":
						await runner.restart(cwd, readCommand(cwd));
						break;
					default: throw new Error("未知操作。");
				}
				const result = snapshot(cwd);
				json(res, 200, body.includeOutput === false ? {
					...result,
					output: ""
				} : result);
			} catch (error) {
				json(res, 400, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}));
	ctx.effect(() => {
		const onExit = () => {
			terminals.dispose();
			runner.killAll();
		};
		const onTerm = () => {
			terminals.dispose();
			runner.killAll();
			if (process.listenerCount("SIGTERM") === 1) process.exit(143);
		};
		const onInt = () => {
			terminals.dispose();
			runner.killAll();
			if (process.listenerCount("SIGINT") === 1) process.exit(130);
		};
		process.on("exit", onExit);
		process.on("SIGTERM", onTerm);
		process.on("SIGINT", onInt);
		return async () => {
			terminals.dispose();
			await runner.dispose();
			process.off("exit", onExit);
			process.off("SIGTERM", onTerm);
			process.off("SIGINT", onInt);
		};
	});
}
//#endregion
export { apply, inject, name, projectCwd };
