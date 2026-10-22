import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
//#region src/native.ts
const exec = promisify(execFile);
var NativeNotices = class {
	child;
	preparing;
	stopped = false;
	lifetime = new AbortController();
	status = process.platform === "darwin" ? "idle" : "unavailable";
	error = process.platform === "darwin" ? "" : "自定义桌面位置目前支持 macOS。";
	onOpen;
	onStatus;
	constructor(onOpen, onStatus = () => {}) {
		this.onOpen = onOpen;
		this.onStatus = onStatus;
	}
	prepare() {
		if (this.stopped) return Promise.reject(/* @__PURE__ */ new Error("提醒插件已停止。"));
		if (this.child && this.status === "ready") return Promise.resolve();
		if (this.preparing) return this.preparing;
		this.preparing = this.start().finally(() => {
			this.preparing = void 0;
		});
		return this.preparing;
	}
	async start() {
		if (process.platform !== "darwin") throw new Error(this.error);
		this.status = "preparing";
		this.error = "";
		this.onStatus();
		try {
			const source = await readFile(fileURLToPath(new URL("../native/DSHNotices.swift", import.meta.url)));
			const hash = createHash("sha256").update(source).update(process.arch).digest("hex").slice(0, 20);
			const app = join(homedir(), ".dsh", "cache", "desktop-notify", hash, "DSH Notices.app");
			const bin = join(app, "Contents", "MacOS", "DSHNotices");
			try {
				await access(bin);
			} catch {
				await mkdir(join(app, "Contents", "MacOS"), {
					recursive: true,
					mode: 448
				});
				const temporary = `${bin}.${process.pid}`;
				await exec("/usr/bin/xcrun", [
					"swiftc",
					"-O",
					"-swift-version",
					"5",
					"-framework",
					"AppKit",
					"-framework",
					"SwiftUI",
					"-framework",
					"SceneKit",
					fileURLToPath(new URL("../native/DSHNotices.swift", import.meta.url)),
					"-o",
					temporary
				], {
					timeout: 12e4,
					maxBuffer: 1048576,
					signal: this.lifetime.signal
				});
				await writeFile(join(app, "Contents", "Info.plist"), "<?xml version=\"1.0\" encoding=\"UTF-8\"?><plist version=\"1.0\"><dict><key>CFBundleIdentifier</key><string>dev.dsh.desktop-notify</string><key>CFBundleName</key><string>DSH Notices</string><key>CFBundleExecutable</key><string>DSHNotices</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>");
				await rename(temporary, bin);
			}
			if (this.stopped) return;
			const child = spawn(bin, [], { stdio: [
				"pipe",
				"pipe",
				"pipe"
			] });
			this.child = child;
			const lines = createInterface({ input: child.stdout });
			let stderr = "";
			child.stderr.on("data", (chunk) => {
				stderr = (stderr + String(chunk)).slice(-1500);
			});
			child.stdin.on("error", () => {});
			await new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					child.kill();
					reject(/* @__PURE__ */ new Error("桌面提醒窗口启动超时。"));
				}, 12e3);
				const fail = (error) => {
					clearTimeout(timer);
					reject(error);
				};
				child.once("error", fail);
				child.once("exit", (code) => {
					clearTimeout(timer);
					lines.close();
					if (this.child === child) this.child = void 0;
					if (!this.stopped) {
						this.status = "unavailable";
						this.error = `桌面提醒已退出 (${code ?? "signal"})。${stderr}`;
						this.onStatus();
					}
					reject(new Error(this.error || "桌面提醒已停止。"));
				});
				lines.on("line", (line) => {
					try {
						const value = JSON.parse(line);
						if (value.type === "ready") {
							clearTimeout(timer);
							this.status = "ready";
							this.onStatus();
							resolve();
						}
						if (value.type === "open" && typeof value.id === "string") this.onOpen(value.id);
					} catch {}
				});
			});
		} catch (error) {
			this.status = "unavailable";
			this.error = `桌面提醒不可用：${error instanceof Error ? error.message : String(error)}。首次使用需要 Xcode Command Line Tools。`;
			this.onStatus();
			throw new Error(this.error);
		}
	}
	async show(notice, preferences) {
		await this.prepare();
		this.send({
			action: "show",
			notice,
			preferences
		});
	}
	dismiss(id) {
		this.send({
			action: "dismiss",
			id
		});
	}
	configure(preferences) {
		this.send({
			action: "configure",
			preferences
		});
	}
	send(value) {
		if (this.child?.stdin.writable) this.child.stdin.write(`${JSON.stringify(value)}\n`);
	}
	dispose() {
		this.stopped = true;
		this.lifetime.abort();
		this.child?.stdin.end();
		this.child?.kill();
		this.child = void 0;
	}
};
//#endregion
//#region src/monitor.ts
const text = (value, fallback, limit = 160) => typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : fallback;
function pending(content) {
	if (!Array.isArray(content)) return false;
	try {
		return JSON.parse(content.find((block) => block.type === "text")?.text ?? "{}").pending === true;
	} catch {
		return false;
	}
}
/** Observe committed live events only. No history replay, selected-session dependency, or focus gate. */
var TaskMonitor = class {
	states = /* @__PURE__ */ new Map();
	sink;
	constructor(sink) {
		this.sink = sink;
	}
	remove(sessionId) {
		const state = this.states.get(sessionId);
		for (const key of state?.pending ?? []) this.sink.dismiss(key);
		this.sink.dismiss(`${sessionId}:end`);
		this.states.delete(sessionId);
	}
	observe(session, event) {
		if (session.header?.origin === "subagent") return;
		let state = this.states.get(session.id);
		if (!state) {
			state = {
				seq: -1,
				pending: /* @__PURE__ */ new Set(),
				stepped: false
			};
			this.states.set(session.id, state);
		}
		if (event.seq <= state.seq) return;
		state.seq = event.seq;
		const data = event.data;
		const title = () => {
			if (!state.title) {
				const recorded = session.snapshotEvents?.().findLast((item) => item.type === "session/title");
				state.title = text(recorded?.data.title, session.header?.cwd?.split(/[\\/]/).filter(Boolean).at(-1) ?? "DSH 任务", 80);
			}
			return state.title;
		};
		const showDecision = (key, body) => {
			if (state.pending.has(key)) return;
			state.pending.add(key);
			this.sink.dismiss(`${session.id}:end`);
			this.sink.show({
				id: key,
				sessionId: session.id,
				kind: "decision",
				title: title(),
				body
			});
		};
		const settle = (key) => {
			state.pending.delete(key);
			this.sink.dismiss(key);
		};
		switch (event.type) {
			case "session/title":
				state.title = text(data.title, title(), 80);
				break;
			case "turn/start":
				state.stepped = false;
				this.sink.dismiss(`${session.id}:end`);
				break;
			case "step/start":
				state.stepped = true;
				break;
			case "approval/asked":
				showDecision(`${session.id}:approval:${data.id}`, text(data.reason, `需要确认 ${text(data.toolName, "工具操作", 60)}`));
				break;
			case "approval/decided":
				settle(`${session.id}:approval:${data.id}`);
				break;
			case "tool/call":
			case "tool/ptc-dispatch": {
				if (data.name !== "ask_user_question") break;
				if (event.type === "tool/ptc-dispatch" && (data.isError || !pending(data.content))) break;
				let args = data.arguments;
				if (typeof args === "string") try {
					args = JSON.parse(args);
				} catch {
					break;
				}
				if (!Array.isArray(args?.questions) || !args.questions.length) break;
				showDecision(`${session.id}:question:${event.type === "tool/ptc-dispatch" ? data.subCallId : data.callId}`, text(args.questions[0].question, "任务需要你的选择，请返回会话处理。"));
				break;
			}
			case "tool/result":
				if (!pending(data.message?.content) && !["TOOL_OUTCOME_UNKNOWN", "tool/outcome-unknown"].includes(data.error?.code)) settle(`${session.id}:question:${data.message?.toolCallId}`);
				break;
			case "user/message":
				if (data.source?.kind === "user-question-reply") settle(`${session.id}:question:${data.source.callId}`);
				break;
			case "turn/end": {
				const reason = data.reason?.kind;
				if (reason !== "completed") {
					for (const key of [...state.pending]) settle(key);
					if (reason === "error") this.sink.show({
						id: `${session.id}:end`,
						sessionId: session.id,
						kind: "error",
						title: title(),
						body: "任务出现异常，请返回会话查看。"
					});
				} else if ((state.stepped || data.turn != null && session.snapshotEvents?.().some((item) => item.type === "step/start" && item.data.turn === data.turn)) && !state.pending.size) this.sink.show({
					id: `${session.id}:end`,
					sessionId: session.id,
					kind: "complete",
					title: title(),
					body: "本轮任务已完成，点击查看结果。"
				});
				state.stepped = false;
				break;
			}
		}
	}
};
//#endregion
//#region src/preferences.ts
const positions = [
	"top-left",
	"top",
	"top-right",
	"right",
	"bottom-right",
	"bottom",
	"bottom-left",
	"left"
];
const defaults = {
	enabled: true,
	completion: true,
	decisions: true,
	sound: false,
	position: "right",
	display: "main",
	duration: 4
};
/** Earlier releases offered left/right/top/island; map them onto the closest border anchor. */
const legacy = { island: "top" };
function parsePreferences(value) {
	const data = value && typeof value === "object" ? value : {};
	const stored = typeof data.position === "string" ? data.position : "";
	const position = positions.includes(stored) ? stored : legacy[stored] ?? defaults.position;
	return {
		enabled: typeof data.enabled === "boolean" ? data.enabled : defaults.enabled,
		completion: typeof data.completion === "boolean" ? data.completion : defaults.completion,
		decisions: typeof data.decisions === "boolean" ? data.decisions : defaults.decisions,
		sound: typeof data.sound === "boolean" ? data.sound : defaults.sound,
		position,
		display: data.display === "pointer" ? "pointer" : "main",
		duration: typeof data.duration === "number" && Number.isFinite(data.duration) ? Math.min(30, Math.max(3, Math.round(data.duration))) : defaults.duration
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-desktop-notify";
const inject = [
	"webServer",
	"connection",
	"sessions"
];
async function apply(ctx, _config = {}, internals = {}) {
	const directory = internals.directory ?? join(homedir(), ".dsh");
	const file = join(directory, "desktop-notify.json");
	let preferences = { ...defaults };
	try {
		preferences = parsePreferences(JSON.parse(await readFile(file, "utf8")));
	} catch (error) {
		if (error.code !== "ENOENT") console.warn("dsh-desktop-notify: invalid preferences; using defaults");
	}
	let disposed = false;
	let writeQueue = Promise.resolve();
	let navigation;
	const active = /* @__PURE__ */ new Map();
	const recent = [];
	const native = (internals.native ?? ((onOpen) => new NativeNotices(onOpen)))((id) => {
		const notice = recent.find((item) => item.id === id);
		if (notice) navigation = {
			id: randomUUID(),
			sessionId: notice.sessionId,
			at: Date.now()
		};
	});
	const allowed = (kind) => preferences.enabled && (kind === "complete" ? preferences.completion : preferences.decisions);
	const dismiss = (id) => {
		const entry = active.get(id);
		clearTimeout(entry?.timer);
		active.delete(id);
		native.dismiss(id);
	};
	const show = (notice) => {
		if (!allowed(notice.kind) || disposed) return;
		dismiss(notice.id);
		if (active.size >= 100) dismiss(active.keys().next().value);
		recent.unshift({
			...notice,
			at: Date.now()
		});
		recent.splice(100);
		const entry = {
			notice,
			timer: void 0
		};
		active.set(notice.id, entry);
		entry.timer = setTimeout(() => {
			native.prepare().then(async () => {
				if (disposed || active.get(notice.id) !== entry || !allowed(notice.kind)) return;
				await native.show(notice, preferences);
				entry.timer = setTimeout(() => active.delete(notice.id), (preferences.duration + 2) * 1e3);
			}).catch((error) => console.warn("dsh-desktop-notify:", error instanceof Error ? error.message : String(error)));
		}, notice.kind === "decision" ? 200 : 400);
	};
	const monitor = new TaskMonitor({
		show,
		dismiss
	});
	const host = ctx;
	host.on("session/event", (session, event) => {
		try {
			monitor.observe(session, event);
		} catch (error) {
			console.warn("dsh-desktop-notify: event observer failed", error);
		}
	}, { global: true });
	host.on("session/disposed", (session) => monitor.remove(session.id), { global: true });
	ctx.effect(() => {
		const stop = () => native.dispose();
		process.once("exit", stop);
		return () => {
			disposed = true;
			process.off("exit", stop);
			for (const id of active.keys()) dismiss(id);
			native.dispose();
		};
	});
	const server = ctx.get("webServer");
	const send = (res, status, body) => {
		res.statusCode = status;
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(JSON.stringify(body));
	};
	ctx.effect(() => server.register({
		kind: "exact",
		path: "/dsh-desktop-notify",
		handler: async (req, res) => {
			const fence = ctx.get("connection");
			const denied = fence?.requestRejection({ headers: req.headers });
			if (!fence || denied !== void 0) {
				send(res, denied ?? 403, { error: "访问被拒绝。" });
				return;
			}
			if (req.method !== "POST" || String(req.headers["content-type"]).split(";")[0].trim() !== "application/json") {
				send(res, 400, { error: "需要 JSON POST 请求。" });
				return;
			}
			try {
				let size = 0;
				const chunks = [];
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 16e3) {
						send(res, 413, { error: "请求过长。" });
						return;
					}
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (body.action === "update") {
					const next = parsePreferences({
						...preferences,
						...body.preferences
					});
					const save = writeQueue.then(async () => {
						await mkdir(directory, {
							recursive: true,
							mode: 448
						});
						const temporary = `${file}.${process.pid}.tmp`;
						await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 384 });
						await rename(temporary, file);
						preferences = next;
						for (const [id, entry] of active) if (!allowed(entry.notice.kind)) dismiss(id);
						native.configure(preferences);
					});
					writeQueue = save.catch(() => {});
					await save;
				} else if (body.action === "test") {
					if (!preferences.enabled) throw new Error("请先开启桌面提醒。");
					await native.prepare();
					const notice = {
						id: `preview:${randomUUID()}`,
						sessionId: "",
						kind: body.kind === "decision" ? "decision" : "complete",
						title: "提醒测试",
						body: body.kind === "decision" ? "任务需要你的选择。真实请求处理后，此提醒会自动收起。" : "任务已完成。DSH 在后台运行时，也会在这里提醒。"
					};
					await native.show(notice, preferences);
				} else if (body.action === "prepare") await native.prepare();
				else if (body.action === "poll") {
					const open = body.desktop === true && body.focused === true && navigation && Date.now() - navigation.at < 6e4 ? navigation : void 0;
					send(res, 200, { open });
					return;
				} else if (body.action === "ack") {
					if (body.id === navigation?.id) navigation = void 0;
				} else if (body.action !== "get") throw new Error("未知操作。");
				send(res, 200, {
					preferences,
					native: {
						status: native.status,
						error: native.error,
						platform: process.platform
					},
					recent: recent.slice(0, 12)
				});
			} catch (error) {
				send(res, 400, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}));
}
//#endregion
export { apply, inject, name };
