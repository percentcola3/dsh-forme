window.__ModuleLoader__.load({
	id: "dsh-quick-prompts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_dom = require("react-dom");
		//#region src/client/tasks.ts
		const sessionsFor = (ctx) => ctx.get("sessions");
		const modelsFor = (ctx) => ctx.get("modelDirectories");
		async function taskRequest(action, value = {}) {
			const res = await fetch("/dsh-quick-prompts", {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...value
				})
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? "快捷任务操作失败。");
			return body;
		}
		async function startAgent(ctx, cwd, item, created) {
			const sessions = sessionsFor(ctx);
			const id = await sessions.create({ cwd });
			created(id);
			const binding = sessions.binding(id);
			if (!binding) throw new Error("独立会话尚未就绪。");
			const renamed = await binding.session.rename(`快捷任务 · ${item.name}`);
			if (!renamed.ok) throw new Error(renamed.error?.message ?? "会话命名失败");
			if (item.selection) {
				const models = modelsFor(ctx);
				if (!models) throw new Error("模型选择服务不可用。");
				await models.directoryFor(id).select(item.selection);
			}
			const conversation = sessions.scope(id)?.get("conversation");
			if (!conversation) throw new Error("独立会话暂不可用。");
			await conversation.send(item.text);
			return id;
		}
		//#endregion
		//#region src/client/logic.ts
		function shortName(name) {
			return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(name), (item) => item.segment).slice(0, 5).join("");
		}
		async function sendPrompt(ctx, sessionId, text) {
			const sessions = ctx.get("sessions");
			if (!sessionId || sessions.list.getSnapshot().current !== sessionId) throw new Error("请先选择要发送的对话。");
			const conversation = sessions.scope(sessionId)?.get("conversation");
			if (!conversation) throw new Error("当前对话暂不可用。");
			await conversation.send(text);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots"];
		async function request(action, value = {}) {
			const res = await fetch("/dsh-quick-prompts", {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...value
				})
			});
			const body = await res.json();
			if (!res.ok) throw new Error(body.error ?? "快捷提示词操作失败。");
			return body.prompts;
		}
		function apply(ctx) {
			const slots = ctx.get("slots");
			ctx.effect(() => slots.inject("conversation.input.overlay", () => slots.register({
				name: "conversation.input.overlay",
				id: "dsh-quick-prompts",
				order: 5
			}, (props) => react.default.createElement(QuickPrompts, {
				ctx,
				sessionId: props.sessionId,
				key: props.sessionId
			}))));
			ctx.effect(() => {
				const style = document.createElement("style");
				style.textContent = `
/* Reserve the shortcut row inside the card. The official composer observer
   includes this height, so chat content and file previews clear it naturally. */
[data-composer-card]:has(.dqp-bar) { --dqp-status-height:0px; --dqp-header-height:44px; padding-top:calc(var(--dqp-header-height) + 8px); }
[data-composer-card]:has(.dqp-task-status) { --dqp-status-height:32px; --dqp-header-height:76px; }
[data-composer-card]:has(.dqp-notice) { --dqp-header-height:calc(72px + var(--dqp-status-height)); }
.dqp-task-chip { display:inline-flex; align-items:center; flex:none; border-radius:999px; background:var(--dsw-alias-interactive-bg-hover); }
.dqp-bar .dqp-task-chip > button { background:transparent; }
.dqp-bar .dqp-task-chip > button:first-child { padding-right:7px; }
.dqp-bar .dqp-task-edit { width:25px; padding:0; border-radius:0 999px 999px 0; display:grid; place-items:center; }
.dqp-bar .dqp-task-edit:hover { color:var(--dsw-alias-state-business-primary); background:var(--dsw-alias-bg-layer-3); }
.dqp-task-status { position:absolute; top:44px; left:12px; right:12px; height:28px; display:flex; align-items:center; gap:8px; overflow:auto; white-space:nowrap; font-size:11px; }
.dqp-task-status button { border:0; border-radius:6px; background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font:inherit; cursor:pointer; padding:3px 7px; }
.dqp-bar { position:absolute; top:0; left:0; right:0; height:44px; box-sizing:border-box; display:flex; align-items:center; gap:6px; padding:7px 12px; border:0; border-radius:22px 22px 0 0; background:color-mix(in srgb, var(--dsw-specific-input-major) 94%, var(--dsw-alias-label-primary) 6%); pointer-events:auto; }
.dqp-bar::after { content:''; position:absolute; bottom:0; left:12px; right:12px; height:1px; background:var(--dsw-alias-border-l3); pointer-events:none; }
.dqp-items { display:flex; flex:1; align-items:center; gap:6px; overflow-x:auto; overflow-y:hidden; min-width:0; max-height:30px; scrollbar-width:thin; }
.dqp-bar button { appearance:none; flex:none; height:28px; padding:0 11px; border:0; border-radius:999px; background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px; cursor:pointer; white-space:nowrap; }
.dqp-bar button:hover { background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); }
.dqp-bar .dqp-add { width:28px; padding:0; font-size:20px; line-height:28px; background:transparent; color:var(--dsw-alias-label-secondary); }
.dqp-bar .dqp-add:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-state-business-primary); }
.dqp-bar button:disabled { opacity:.45; cursor:default; }
.dqp-bar button:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dqp-dialog :is(button,input,textarea,select):focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dqp-notice { position:absolute; top:calc(44px + var(--dqp-status-height)); left:12px; right:12px; height:28px; line-height:28px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-state-error-primary); font-size:12px; }
.dqp-backdrop { position:fixed; inset:0; z-index:10020; display:grid; place-items:center; padding:20px; background:rgb(0 0 0 / .2); }
.dqp-dialog { width:440px; max-width:100%; max-height:calc(100vh - 40px); overflow:auto; box-sizing:border-box; padding:20px; border:1px solid var(--dsw-alias-border-l2); border-radius:16px; background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); box-shadow:0 12px 40px rgb(0 0 0 / .2); display:flex; flex-direction:column; gap:14px; font-size:13px; }
.dqp-dialog h3 { margin:0; font-size:16px; }
.dqp-dialog label { display:flex; flex-direction:column; gap:7px; }
.dqp-dialog :is(input,textarea,select) { width:100%; box-sizing:border-box; padding:9px 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:inherit; font:inherit; }
.dqp-dialog textarea { min-height:150px; resize:vertical; line-height:1.6; }
.dqp-dialog small { color:var(--dsw-alias-label-tertiary); }
.dqp-dialog footer { display:flex; gap:8px; justify-content:flex-end; }
.dqp-dialog button { padding:7px 14px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-layer-2); color:inherit; cursor:pointer; font:inherit; }
.dqp-dialog .dqp-save { background:var(--dsw-alias-state-business-primary); color:white; border-color:transparent; }
.dqp-dialog .dqp-delete { margin-right:auto; color:var(--dsw-alias-state-error-primary); }
.dqp-dialog button:disabled { opacity:.5; cursor:default; }
.dqp-dialog [role="alert"] { color:var(--dsw-alias-state-error-primary); margin:0; }
`;
				document.head.appendChild(style);
				return () => style.remove();
			});
		}
		function QuickPrompts({ ctx, sessionId }) {
			const [items, setItems] = react.default.useState([]);
			const [draft, setDraft] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(false);
			const [modelError, setModelError] = react.default.useState("");
			const [catalog, setCatalog] = react.default.useState({ groups: [] });
			const [runs, setRuns] = react.default.useState(() => {
				try {
					return JSON.parse(localStorage.getItem(`dqp-runs:${sessionId}`) ?? "{}");
				} catch {
					return {};
				}
			});
			react.default.useEffect(() => {
				try {
					localStorage.setItem(`dqp-runs:${sessionId}`, JSON.stringify(runs));
				} catch {}
			}, [runs, sessionId]);
			const [panel, setPanel] = react.default.useState(false);
			const [output, setOutput] = react.default.useState({
				status: "idle",
				output: "",
				cwd: "",
				exitCode: null
			});
			const [, tick] = react.default.useState(0);
			react.default.useEffect(() => {
				if (!sessionId || draft?.mode !== "agent") return;
				let live = true;
				try {
					modelsFor(ctx)?.directoryFor(sessionId).load().then((value) => {
						if (live) setCatalog(value);
					}).catch((err) => {
						if (live) setModelError(String(err));
					});
				} catch (err) {
					setModelError(String(err));
				}
				return () => {
					live = false;
				};
			}, [
				ctx,
				sessionId,
				draft?.mode
			]);
			react.default.useEffect(() => {
				const stops = Object.values(runs).map((id) => sessionsFor(ctx).binding(id)?.session.subscribe(() => tick((n) => n + 1)));
				return () => {
					for (const stop of stops) stop?.();
				};
			}, [ctx, runs]);
			const commandRunning = ["running", "stopping"].includes(output.status);
			react.default.useEffect(() => {
				if (!sessionId) return;
				let live = true;
				let timer;
				const poll = async () => {
					try {
						const value = await taskRequest("status", {
							sessionId,
							includeOutput: panel
						});
						if (live) setOutput((previous) => {
							const next = {
								...value,
								output: panel ? value.output : previous.output
							};
							return previous.status === next.status && previous.output === next.output && previous.cwd === next.cwd && previous.exitCode === next.exitCode ? previous : next;
						});
					} catch (err) {
						if (live && panel) setError(String(err));
					}
					if (live && (panel || commandRunning)) timer = setTimeout(poll, panel ? 1e3 : 3e3);
				};
				poll();
				return () => {
					live = false;
					clearTimeout(timer);
				};
			}, [
				sessionId,
				panel,
				commandRunning
			]);
			const sending = react.default.useRef(false);
			const nameInput = react.default.useRef(null);
			const trigger = react.default.useRef(null);
			react.default.useEffect(() => {
				let live = true;
				request("list").then((items) => {
					if (live) setItems(items);
				}).catch((err) => {
					if (live) setError(String(err.message));
				});
				return () => {
					live = false;
				};
			}, []);
			const close = () => {
				if (busy) return;
				setDraft(null);
				setError("");
				trigger.current?.focus();
			};
			react.default.useEffect(() => {
				if (!draft) return;
				nameInput.current?.focus();
				const onKey = (e) => {
					if (e.key === "Escape" && !sending.current) {
						setDraft(null);
						setError("");
						trigger.current?.focus();
					}
				};
				document.addEventListener("keydown", onKey);
				return () => document.removeEventListener("keydown", onKey);
			}, [!!draft]);
			const open = (event, item) => {
				trigger.current = event.currentTarget;
				setError("");
				setDraft(item ? { ...item } : {
					name: "",
					text: "",
					mode: "chat"
				});
			};
			const save = async (action) => {
				if (!draft || sending.current) return;
				sending.current = true;
				setBusy(true);
				setError("");
				const started = performance.now();
				try {
					const items = await request(action, draft);
					setDraft(null);
					trigger.current?.focus();
					react.default.startTransition(() => setItems(items));
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					sending.current = false;
					setBusy(false);
					document.dispatchEvent(new CustomEvent("dsh-performance", { detail: {
						kind: "quick-save",
						duration: performance.now() - started
					} }));
				}
			};
			const send = async (item) => {
				if (sending.current) return;
				sending.current = true;
				setBusy(true);
				setError("");
				try {
					if (!sessionId || sessionsFor(ctx).list.getSnapshot().current !== sessionId) throw new Error("请先选择会话。");
					if (item.mode === "shell") {
						setOutput(await taskRequest("run", {
							id: item.id,
							sessionId
						}));
						setPanel(true);
					} else if (item.mode === "agent") {
						const { cwd } = await taskRequest("workspace", { sessionId });
						await startAgent(ctx, cwd, item, (id) => setRuns((previous) => Object.fromEntries(Object.entries({
							...previous,
							[item.id]: id
						}).slice(-20))));
					} else await sendPrompt(ctx, sessionId, item.text);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					sending.current = false;
					setBusy(false);
				}
			};
			const modal = draft ? (0, react_dom.createPortal)(react.default.createElement("div", {
				className: "dqp-backdrop",
				onClick: (event) => {
					if (event.target === event.currentTarget) close();
				}
			}, react.default.createElement("form", {
				className: "dqp-dialog",
				role: "dialog",
				"aria-modal": true,
				"aria-label": draft.id ? "编辑快捷任务" : "新增快捷任务",
				onSubmit: (event) => {
					event.preventDefault();
					save("save");
				},
				onKeyDown: (event) => {
					if (event.key !== "Tab") return;
					const controls = Array.from(event.currentTarget.querySelectorAll("input,textarea,select,button:not(:disabled)"));
					const first = controls[0], last = controls[controls.length - 1];
					if (event.shiftKey && document.activeElement === first) {
						event.preventDefault();
						last?.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first?.focus();
					}
				}
			}, react.default.createElement("h3", null, draft.id ? "编辑快捷任务" : "新增快捷任务"), react.default.createElement("label", null, "名称", react.default.createElement("input", {
				ref: nameInput,
				value: draft.name,
				maxLength: 100,
				disabled: busy,
				placeholder: "例如：检查代码",
				onChange: (e) => setDraft({
					...draft,
					name: e.target.value
				})
			}), react.default.createElement("small", null, "按钮最多显示 5 个字，悬停查看全名。")), react.default.createElement("label", null, "执行方式", react.default.createElement("select", {
				value: draft.mode ?? "chat",
				disabled: busy,
				onChange: (e) => setDraft({
					...draft,
					mode: e.target.value,
					selection: void 0
				})
			}, react.default.createElement("option", { value: "chat" }, "当前对话"), react.default.createElement("option", { value: "agent" }, "独立 Agent"), react.default.createElement("option", { value: "shell" }, "终端命令"))), draft.mode === "agent" && modelError ? react.default.createElement("small", null, `模型列表暂不可用：${modelError}`) : null, draft.mode === "agent" ? react.default.createElement("label", null, "模型", react.default.createElement("select", {
				value: draft.selection ? JSON.stringify([draft.selection.provider, draft.selection.model]) : "",
				disabled: busy,
				onChange: (e) => {
					const route = e.target.value ? JSON.parse(e.target.value) : null;
					setDraft({
						...draft,
						selection: route ? {
							provider: route[0],
							model: route[1]
						} : void 0
					});
				}
			}, react.default.createElement("option", { value: "" }, "系统默认"), ...catalog.groups.flatMap((group) => group.models.map((model) => react.default.createElement("option", {
				key: JSON.stringify([group.id, model.id]),
				value: JSON.stringify([group.id, model.id])
			}, `${group.name} · ${model.name}`))))) : null, draft.mode === "agent" && draft.selection ? react.default.createElement("label", null, "思考强度", react.default.createElement("select", {
				value: draft.selection.reasoningEffort ?? "",
				disabled: busy,
				onChange: (e) => setDraft({
					...draft,
					selection: {
						...draft.selection,
						reasoningEffort: e.target.value || void 0
					}
				})
			}, react.default.createElement("option", { value: "" }, "模型默认"), ...(catalog.groups.find((g) => g.id === draft.selection?.provider)?.models.find((m) => m.id === draft.selection?.model)?.reasoning?.efforts ?? []).map((e) => react.default.createElement("option", {
				key: e.id,
				value: e.id
			}, e.name)))) : null, react.default.createElement("label", null, draft.mode === "shell" ? "Shell 命令" : "提示词", react.default.createElement("textarea", {
				value: draft.text,
				maxLength: 32e3,
				disabled: busy,
				placeholder: "输入要发送的完整提示词…",
				onChange: (e) => setDraft({
					...draft,
					text: e.target.value
				})
			})), react.default.createElement("small", null, draft.mode === "agent" ? "新建独立会话，仅使用当前目录和项目规则，不携带聊天历史；审批与结果在独立会话查看。" : draft.mode === "shell" ? "在当前工作目录执行，不经过 AI。每个目录同时运行一个快捷命令；输出面板可停止。" : "发送到当前对话，沿用当前模型及上下文。"), error ? react.default.createElement("p", { role: "alert" }, error) : null, react.default.createElement("footer", null, draft.id ? react.default.createElement("button", {
				type: "button",
				className: "dqp-delete",
				disabled: busy,
				onClick: () => {
					save("delete");
				}
			}, "删除") : null, react.default.createElement("button", {
				type: "button",
				disabled: busy,
				onClick: close
			}, "取消"), react.default.createElement("button", {
				type: "submit",
				className: "dqp-save",
				disabled: busy || !draft.name.trim() || !draft.text.trim()
			}, busy ? "保存中…" : "保存")))), document.body) : null;
			return react.default.createElement(react.default.Fragment, null, react.default.createElement("div", {
				className: "dqp-bar",
				role: "group",
				"aria-label": "快捷任务"
			}, react.default.createElement("button", {
				type: "button",
				className: "dqp-add",
				"aria-label": "新增快捷任务",
				title: "新增快捷任务",
				disabled: busy,
				onClick: (e) => open(e)
			}, "+"), react.default.createElement("div", { className: "dqp-items" }, ...items.map((item) => react.default.createElement("span", {
				key: item.id,
				className: "dqp-task-chip"
			}, react.default.createElement("button", {
				type: "button",
				disabled: busy || !sessionId || item.mode === "agent" && !!runs[item.id] && (!!sessionsFor(ctx).binding(runs[item.id])?.session.getSnapshot().running || !!sessionsFor(ctx).binding(runs[item.id])?.session.getSnapshot().awaitingFirstTurn) || item.mode === "shell" && ["running", "stopping"].includes(output.status),
				title: `${item.name} · ${{
					chat: "当前对话",
					agent: "独立 Agent",
					shell: "终端命令"
				}[item.mode ?? "chat"]}\n点击执行 · 右键编辑`,
				onClick: () => {
					send(item);
				},
				onContextMenu: (e) => {
					e.preventDefault();
					open(e, item);
				}
			}, shortName(item.name)), react.default.createElement("button", {
				type: "button",
				className: "dqp-task-edit",
				disabled: busy,
				title: `编辑 ${item.name}`,
				"aria-label": `编辑快捷任务 ${item.name}`,
				onClick: (e) => open(e, item)
			}, react.default.createElement("svg", {
				width: 12,
				height: 12,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.8,
				"aria-hidden": true
			}, react.default.createElement("path", { d: "M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" }))))))), Object.keys(runs).length > 0 || output.status !== "idle" ? react.default.createElement("div", { className: "dqp-task-status" }, ...Object.entries(runs).map(([key, id]) => react.default.createElement("span", { key }, react.default.createElement("button", {
				type: "button",
				onClick: () => sessionsFor(ctx).open(id)
			}, `${shortName(items.find((i) => i.id === key)?.name ?? "任务")} · ${sessionsFor(ctx).binding(id)?.session.getSnapshot().running ? "运行中" : "查看结果/审批"}`), react.default.createElement("button", {
				type: "button",
				onClick: () => {
					sessionsFor(ctx).binding(id)?.session.cancel().then((r) => {
						if (!r.ok) setError(r.error?.message ?? "停止失败");
					}).catch((e) => setError(String(e)));
				}
			}, "停止"))), output.status !== "idle" ? react.default.createElement("button", {
				type: "button",
				onClick: () => setPanel(true)
			}, "终端任务日志") : null) : null, panel ? (0, react_dom.createPortal)(react.default.createElement("div", {
				className: "dqp-backdrop",
				onClick: (e) => {
					if (e.target === e.currentTarget) setPanel(false);
				}
			}, react.default.createElement("section", {
				className: "dqp-dialog",
				role: "dialog",
				"aria-modal": true,
				"aria-label": "命令输出"
			}, react.default.createElement("h3", null, `命令输出 · ${output.status}${output.exitCode == null ? "" : ` · 退出码 ${output.exitCode}`}`), react.default.createElement("small", null, output.cwd), error ? react.default.createElement("p", { role: "alert" }, error) : null, react.default.createElement("pre", { style: {
				whiteSpace: "pre-wrap",
				overflow: "auto",
				maxHeight: "50vh",
				minHeight: 100
			} }, output.output || "暂无输出"), react.default.createElement("footer", null, react.default.createElement("button", {
				disabled: !["running", "stopping"].includes(output.status),
				onClick: () => {
					taskRequest("stop", { sessionId }).then(setOutput).catch((e) => setError(String(e)));
				}
			}, "停止命令"), react.default.createElement("button", { onClick: () => setPanel(false) }, "关闭")))), document.body) : null, error && !draft ? react.default.createElement("div", {
				className: "dqp-notice",
				role: "alert",
				title: error
			}, error) : null, modal);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map