import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
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
//#region src/types.ts
const active = (status) => [
	"starting",
	"running",
	"waiting",
	"stopping"
].includes(status);
//#endregion
//#region src/task-manager.ts
const textOf = (blocks) => Array.isArray(blocks) ? blocks.filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n").slice(-24e3) : "";
const messageOf = (error) => error instanceof Error ? error.message : String(error);
const CONTEXT = "你正在执行用户从快捷指令栏启动的后台子任务。仅处理下面的任务内容，完成后给出清晰结果。主对话继续独立运行，不要调用 send_message 给主 Agent 发送进度或触发它继续执行。若内容是命令，请由你使用当前获准的工具执行并反馈结果；遵守继承的权限和审批规则，遇到限制明确说明。";
var TaskManager = class {
	entries = /* @__PURE__ */ new Map();
	runtime;
	closed = false;
	constructor(runtime) {
		this.runtime = runtime;
	}
	list() {
		return [...this.entries.values()].map((entry) => structuredClone(entry.run)).reverse();
	}
	start(parent, prompt, requestId) {
		if (this.closed) throw new Error("快捷任务服务正在关闭。");
		const previous = [...this.entries.values()].find((entry) => entry.run.parentId === parent.id && entry.run.requestId === requestId);
		if (previous) {
			if (previous.run.promptId !== prompt.id) throw new Error("请求编号已用于其他任务。");
			return structuredClone(previous.run);
		}
		const running = [...this.entries.values()].find((entry) => entry.run.parentId === parent.id && entry.run.promptId === prompt.id && active(entry.run.status));
		if (running) return structuredClone(running.run);
		if (!this.runtime.getProvider("spawn")) throw new Error("DSH 尚未加载原生 spawn 子 Agent，请检查子 Agent 插件。");
		const maxDepth = this.runtime.resolveMaxDepth();
		const finished = [...this.entries.values()].filter((entry) => !active(entry.run.status));
		while (this.entries.size >= 100 && finished.length) {
			const old = finished.shift();
			this.entries.delete(old.run.id);
			old.receipt?.dispose().catch(() => {});
		}
		if (this.entries.size >= 100) throw new Error("后台任务过多，请先等待部分任务结束。");
		const now = Date.now();
		const parentTitle = parent.session.snapshotEvents?.().findLast((event) => event.type === "session/title")?.data.title;
		const entry = {
			run: {
				id: randomUUID(),
				requestId,
				promptId: prompt.id,
				name: prompt.name,
				parentId: parent.id,
				parentTitle: typeof parentTitle === "string" ? parentTitle.slice(0, 100) : parent.session.header.cwd?.split(/[\\/]/).at(-1) ?? "主会话",
				childId: randomUUID(),
				status: "starting",
				startedAt: now,
				updatedAt: now,
				output: "",
				progress: "正在创建原生子 Agent…",
				steps: 0,
				tools: []
			},
			controller: new AbortController(),
			pending: /* @__PURE__ */ new Set(),
			parent
		};
		this.entries.set(entry.run.id, entry);
		entry.admission = this.launch(entry, prompt, maxDepth);
		return structuredClone(entry.run);
	}
	async launch(entry, prompt, maxDepth) {
		try {
			const receipt = await this.runtime.startActivation({
				provider: "spawn",
				childId: entry.run.childId,
				label: prompt.name,
				request: {
					parent: entry.parent,
					prompt: [{
						type: "text",
						text: CONTEXT
					}, {
						type: "text",
						text: prompt.text
					}],
					...maxDepth === void 0 ? {} : { maxDepth }
				},
				signal: entry.controller.signal,
				delivery: "caller"
			});
			entry.receipt = receipt;
			entry.run.childId = receipt.childId;
			this.settle(entry, receipt);
			if (entry.run.status === "stopping" || this.closed) this.runtime.interrupt(receipt.childId, {
				kind: "user",
				parentSessionId: entry.run.parentId
			});
			else {
				entry.run.status = entry.pending.size ? "waiting" : "running";
				if (!entry.run.steps) entry.run.progress = "AI 正在执行后台任务…";
			}
			entry.run.updatedAt = Date.now();
		} catch (error) {
			this.fail(entry, error);
		}
	}
	async settle(entry, receipt) {
		try {
			const result = await receipt.result;
			entry.settled = true;
			entry.run.output = textOf(result.output) || entry.run.output;
			this.finish(entry, result.stopReason);
		} catch (error) {
			this.fail(entry, error);
		} finally {
			for (const tool of entry.run.tools) if (tool.state === "running") tool.state = "ended";
			entry.run.updatedAt = Date.now();
		}
	}
	finish(entry, reason) {
		const run = entry.run;
		if (reason === "completed" && entry.pending.size && !entry.controller.signal.aborted) {
			run.status = "waiting";
			run.progress = "任务需要你的处理，请打开完整记录。";
			return;
		}
		if (reason === "completed") {
			run.status = "completed";
			run.progress = "后台任务已完成";
		} else if (["aborted", "interrupted"].includes(reason)) {
			run.status = "stopped";
			run.progress = "后台任务已停止";
		} else {
			run.status = "failed";
			run.progress = "任务未能完成";
			run.error = reason === "blocked" ? "子 Agent 被权限或执行规则阻止，请查看结果中的说明。" : reason === "max-tokens" ? "已达到输出上限，任务未完整完成。" : "子 Agent 执行失败，请查看结果或完整记录。";
		}
		for (const tool of run.tools) if (tool.state === "running") tool.state = "ended";
		run.endedAt = Date.now();
		run.updatedAt = Date.now();
	}
	fail(entry, error) {
		entry.run.status = entry.controller.signal.aborted ? "stopped" : "failed";
		entry.run.error = entry.controller.signal.aborted ? void 0 : messageOf(error);
		entry.run.progress = entry.controller.signal.aborted ? "后台任务已停止" : "启动或执行失败";
		for (const tool of entry.run.tools) if (tool.state === "running") tool.state = "ended";
		entry.run.endedAt = Date.now();
		entry.run.updatedAt = Date.now();
	}
	stop(id) {
		const entry = this.entries.get(id);
		if (!entry) throw new Error("后台任务不存在。");
		if (!active(entry.run.status) || entry.run.status === "stopping") return;
		if (entry.settled && entry.run.status === "waiting" && !entry.turnActive) {
			entry.controller.abort();
			this.finish(entry, "aborted");
			return;
		}
		if (entry.receipt) this.runtime.interrupt(entry.run.childId, {
			kind: "user",
			parentSessionId: entry.run.parentId
		});
		else entry.controller.abort();
		entry.run.status = "stopping";
		entry.run.progress = "正在停止子 Agent…";
		entry.run.updatedAt = Date.now();
	}
	observe(sessionId, event) {
		const entry = [...this.entries.values()].find((entry) => entry.run.childId === sessionId && active(entry.run.status));
		if (!entry) return;
		const { run, pending } = entry;
		const data = event.data;
		switch (event.type) {
			case "turn/start":
				entry.turnActive = true;
				run.progress = "AI 正在执行后台任务…";
				break;
			case "step/start":
				entry.turnActive = true;
				run.steps++;
				run.progress = `正在执行第 ${run.steps} 步`;
				break;
			case "tool/call":
				run.tools.push({
					callId: data.callId,
					name: String(data.name).slice(0, 100),
					state: "running"
				});
				run.tools = run.tools.slice(-6);
				run.progress = `正在调用 ${String(data.name).slice(0, 100)}`;
				if (data.name === "ask_user_question") pending.add(`question:${data.callId}`);
				break;
			case "tool/result": {
				const tool = run.tools.find((tool) => tool.callId === data.message?.toolCallId);
				if (tool) tool.state = data.message?.isError || data.error ? "failed" : "done";
				let continued = false;
				try {
					continued = JSON.parse(textOf(data.message?.content)).pending === true;
				} catch {}
				if (!continued && !["TOOL_OUTCOME_UNKNOWN", "tool/outcome-unknown"].includes(data.error?.code)) pending.delete(`question:${data.message?.toolCallId}`);
				break;
			}
			case "tool/ptc-dispatch":
				if (data.name === "ask_user_question" && !data.isError) try {
					if (JSON.parse(textOf(data.content)).pending === true) pending.add(`question:${data.subCallId}`);
				} catch {}
				break;
			case "approval/asked":
				pending.add(`approval:${data.id}`);
				run.progress = "需要处理权限或审批请求";
				break;
			case "approval/decided":
				pending.delete(`approval:${data.id}`);
				break;
			case "user/message":
				if (data.source?.kind === "user-question-reply") {
					pending.delete(`question:${data.source.callId}`);
					run.progress = "已收到回复，继续执行…";
				}
				break;
			case "assistant/message": {
				const text = textOf(data.message?.content);
				if (text) run.output = text;
				break;
			}
			case "turn/end":
				entry.turnActive = false;
				if (entry.settled) this.finish(entry, data.reason?.kind ?? "error");
				else if (data.reason?.kind !== "completed") run.progress = "正在整理执行结果…";
				break;
			default: return;
		}
		if (active(run.status) && run.status !== "stopping") run.status = pending.size ? "waiting" : run.status === "starting" ? "starting" : "running";
		if (run.status === "waiting") run.progress = "任务需要你的处理，请打开完整记录。";
		run.updatedAt = Date.now();
	}
	async dispose() {
		this.closed = true;
		const entries = [...this.entries.values()];
		for (const entry of entries) entry.controller.abort();
		await Promise.allSettled(entries.map((entry) => entry.admission));
		await Promise.allSettled(entries.map((entry) => entry.receipt?.dispose()));
	}
};
//#endregion
//#region src/index.ts
const name = "dsh-quick-prompts";
const inject = [
	"webServer",
	"connection",
	"sessions",
	"agents",
	"subagents"
];
function validatePrompt(value) {
	if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 100) throw new Error("名称不能为空，且不能超过 100 字。");
	if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 32e3 || value.text.includes("\0")) throw new Error("任务内容不能为空，且不能超过 32,000 字。");
	return {
		name: value.name.trim(),
		text: value.text
	};
}
function apply(ctx, _config = {}, internals = {}) {
	const manager = new TaskManager(ctx.get("subagents"));
	const agents = ctx.get("agents");
	ctx.on("session/event", (session, event) => {
		try {
			manager.observe(session.id, event);
		} catch (error) {
			console.warn("dsh-quick-prompts: task observation failed", error);
		}
	}, { global: true });
	ctx.effect(() => () => manager.dispose());
	const store = new PromptStore(join(internals.directory ?? join(homedir(), ".dsh"), "quick-prompts.json"));
	const prompts = async () => (await store.read()).map((item) => ({
		id: item.id,
		...validatePrompt(item)
	}));
	const server = ctx.get("webServer");
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
						send(res, 413, { error: "任务内容过长。" });
						return;
					}
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (body.action === "runs") {
					send(res, 200, { runs: manager.list() });
					return;
				}
				if (body.action === "start") {
					if (typeof body.sessionId !== "string" || !body.sessionId || typeof body.requestId !== "string" || !body.requestId || body.requestId.length > 100) throw new Error("请先打开主会话，再启动快捷任务。");
					const prompt = (await prompts()).find((item) => item.id === body.id);
					if (!prompt) throw new Error("快捷任务已删除，请刷新。");
					const parent = agents.get(body.sessionId);
					if (!parent) throw new Error("主会话尚未就绪，请先打开会话，连接就绪后重试。");
					send(res, 202, { run: manager.start(parent, prompt, body.requestId) });
					return;
				}
				if (body.action === "stop") {
					manager.stop(body.runId);
					send(res, 200, { runs: manager.list() });
					return;
				}
				if (body.action === "list") {
					send(res, 200, { prompts: await prompts() });
					return;
				}
				const items = await store.update((items) => {
					const index = items.findIndex((item) => item.id === body.id);
					if (body.action === "save") {
						const value = validatePrompt(body);
						if (body.id && index < 0) throw new Error("快捷任务已删除，请刷新。");
						if (index >= 0) items[index] = {
							id: body.id,
							...value
						};
						else {
							if (items.length >= 100) throw new Error("最多保存 100 条快捷任务。");
							items.push({
								id: randomUUID(),
								...value
							});
						}
					} else if (body.action === "delete") {
						if (index < 0) throw new Error("快捷任务不存在。");
						items.splice(index, 1);
					} else throw new Error("未知操作。");
				});
				send(res, 200, { prompts: items.map((item) => ({
					id: item.id,
					...validatePrompt(item)
				})) });
			} catch (error) {
				send(res, 400, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}));
}
//#endregion
export { apply, inject, name, validatePrompt };
