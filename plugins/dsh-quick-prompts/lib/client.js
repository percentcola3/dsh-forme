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
		//#region src/types.ts
		const active = (status) => [
			"starting",
			"running",
			"waiting",
			"stopping"
		].includes(status);
		const statusLabels = {
			starting: "启动中",
			running: "运行中",
			waiting: "需要处理",
			stopping: "停止中",
			completed: "已完成",
			stopped: "已停止",
			failed: "失败"
		};
		//#endregion
		//#region src/client/tasks.ts
		async function taskRequest(action, body = {}) {
			const res = await fetch("/dsh-quick-prompts", {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...body
				})
			});
			const value = await res.json();
			if (!res.ok) throw new Error(value.error ?? "快捷任务操作失败。");
			return value;
		}
		function openRun(ctx, run) {
			ctx.get("uiWorkspace").openSession({
				kind: "subagent",
				parentSessionId: run.parentId,
				childSessionId: run.childId,
				mode: "continuable"
			});
		}
		function createTasks(request = taskRequest) {
			let current = {
				runs: [],
				open: false,
				error: "",
				syncError: ""
			};
			const listeners = /* @__PURE__ */ new Set();
			const starting = /* @__PURE__ */ new Map();
			let polling = false;
			let mutation = 0;
			const publish = (patch) => {
				current = {
					...current,
					...patch
				};
				for (const listener of listeners) listener();
			};
			return {
				getSnapshot: () => current,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				show(open = true) {
					publish({ open });
				},
				async refresh() {
					if (polling) return;
					polling = true;
					const revision = mutation;
					try {
						const { runs } = await request("runs");
						if (revision === mutation) publish({
							runs,
							syncError: ""
						});
					} catch {
						publish({ syncError: "任务状态同步失败，正在重连；当前显示可能已过期。" });
					} finally {
						polling = false;
					}
				},
				start(sessionId, promptId) {
					const key = `${sessionId}:${promptId}`;
					if (starting.has(key)) return starting.get(key);
					const operation = request("start", {
						sessionId,
						id: promptId,
						requestId: crypto.randomUUID()
					}).then(({ run }) => {
						mutation++;
						publish({ runs: [run, ...current.runs.filter((item) => item.id !== run.id)] });
					}).catch((error) => {
						publish({ error: error instanceof Error ? error.message : String(error) });
					}).finally(() => {
						starting.delete(key);
						publish({});
					});
					starting.set(key, operation);
					publish({
						open: true,
						error: ""
					});
					return operation;
				},
				async stop(runId) {
					try {
						const { runs } = await request("stop", { runId });
						mutation++;
						publish({
							runs,
							error: ""
						});
					} catch (error) {
						publish({ error: error instanceof Error ? error.message : String(error) });
					}
				},
				busy(sessionId, promptId) {
					return !!sessionId && (starting.has(`${sessionId}:${promptId}`) || current.runs.some((run) => run.parentId === sessionId && run.promptId === promptId && active(run.status)));
				}
			};
		}
		//#endregion
		//#region src/client/logic.ts
		function shortName(name) {
			return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(name), (item) => item.segment).slice(0, 5).join("");
		}
		function currentSessionId(ctx) {
			return ctx.get("uiWorkspace").selection.getSnapshot().sessionId;
		}
		//#endregion
		//#region src/client/styles.ts
		const styles = `
[data-composer-card]:has(.dqp-bar){padding-top:52px}
[data-composer-card]:has(.dqp-notice){padding-top:82px}
.dqp-bar{position:absolute;top:0;left:0;right:0;height:44px;box-sizing:border-box;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:22px 22px 0 0;background:color-mix(in srgb,var(--dsw-specific-input-major,#152435) 94%,var(--dsw-alias-label-primary,#ddd) 6%);pointer-events:auto}
.dqp-bar:after{content:'';position:absolute;bottom:0;left:12px;right:12px;height:1px;background:var(--dsw-alias-border-l3,#ffffff20);pointer-events:none}
.dqp-items{display:flex;flex:1;gap:6px;align-items:center;overflow-x:auto;overflow-y:hidden;min-width:0;max-height:30px;scrollbar-width:thin}
.dqp-task-chip{display:inline-flex;align-items:center;flex:none;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,#ffffff12)}
.dqp-bar button{appearance:none;flex:none;height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b7c6d5);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.dqp-bar button:hover{background:var(--dsw-alias-bg-layer-3,#ffffff15);color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-bar .dqp-add{width:28px;padding:0;font-size:20px}
.dqp-bar .dqp-task-edit{width:25px;padding:0;display:grid;place-items:center}
.dqp-bar button:disabled{opacity:.45;cursor:default}
.dqp-panel-trigger{margin-left:auto;display:flex;gap:6px;align-items:center}
.dqp-notice{position:absolute;top:46px;left:12px;right:12px;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ef9398;font-size:12px}
.dqp-backdrop{position:fixed;inset:0;z-index:11020;display:grid;place-items:center;padding:20px;background:#040a12a8;backdrop-filter:blur(6px)}
.dqp-dialog{width:440px;max-width:100%;max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:16px;background:var(--dsw-alias-bg-layer-3,#152333);color:var(--dsw-alias-label-primary,#e1eaf3);box-shadow:0 20px 70px #0007;display:flex;flex-direction:column;gap:18px;font:13px/1.6 var(--moss-text,system-ui)}
.dqp-dialog h3{margin:0;font-size:17px}.dqp-dialog label{display:flex;flex-direction:column;gap:7px}.dqp-dialog :is(input,textarea){width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;font:inherit}.dqp-dialog textarea{min-height:170px;resize:vertical;line-height:1.7}.dqp-dialog small{color:var(--dsw-alias-label-tertiary,#8ea4b8)}.dqp-dialog footer{display:flex;gap:8px;justify-content:flex-end}.dqp-dialog button{padding:8px 15px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;cursor:pointer;font:inherit}.dqp-dialog .dqp-save{background:#c7dce9;color:#14202c;border-color:transparent}.dqp-dialog .dqp-delete{margin-right:auto;color:#ef9398}.dqp-dialog button:disabled{opacity:.5;cursor:default}.dqp-dialog [role=alert]{color:#ef9398;margin:0}
.dqp-float{
  position:fixed;z-index:10015;right:18px;top:calc(var(--moss-chrome-height,36px) + 66px);
  width:min(320px,calc(100vw - 28px));max-height:min(380px,48vh,calc(100vh - var(--moss-chrome-height,36px) - 210px));
  display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;
  border:1px solid #93adc333;border-radius:12px;background:linear-gradient(145deg,#172838f5,#101d2bf7);
  backdrop-filter:blur(20px);color:#dce7ef;box-shadow:0 12px 36px #0005;
  font:12px/1.6 var(--moss-text,system-ui);pointer-events:auto;
}
.dqp-float-head{display:flex;align-items:center;gap:9px;min-height:42px;box-sizing:border-box;padding:8px 12px;border-bottom:1px solid #b9d3e416;flex:none}
.dqp-float-head strong{font-size:12px;font-weight:600}
.dqp-float-count{font-size:10px;color:#8ca7ba}
.dqp-float button{cursor:pointer;font:inherit;color:inherit}
.dqp-float-head button{display:grid;place-items:center;margin-left:auto;width:24px;height:24px;padding:0;border:0;border-radius:5px;background:transparent;color:#9eb6c9}
.dqp-float-head button:hover{background:#adc9db12;color:#e2eff7}
.dqp-float-body{overflow:auto;padding:8px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-float-empty{padding:18px 8px;text-align:center;color:#8faabd;font-size:11px}
.dqp-run-card{padding:10px;margin-bottom:7px;border:1px solid #a1b7cc1b;border-radius:8px;background:#8faec207}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-run-heading{display:flex;gap:7px;align-items:center}
.dqp-run-heading strong{flex:1;min-width:0;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqp-run-status{font-size:10px;white-space:nowrap;color:#a9bfce}
.dqp-run-status[data-status=completed]{color:#8ecdbd}
.dqp-run-status[data-status=failed],.dqp-run-status[data-status=waiting]{color:#ef9298}
.dqp-run-meta{display:flex;gap:10px;color:#7694ab;font-size:10px;margin-top:3px}
.dqp-run-meta span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dqp-run-meta time{font-variant-numeric:tabular-nums}
.dqp-run-progress{margin-top:7px;font-size:11px;color:#9eb8cb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dqp-run-preview{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0 0;color:#b4c9d8;font-size:11px;line-height:1.65}
.dqp-run-error{white-space:pre-wrap;overflow-wrap:anywhere;color:#f1a3a5;margin-top:7px;font-size:11px}
.dqp-run-details{margin-top:8px;padding-top:8px;border-top:1px solid #a8c2d415}
.dqp-run-output{font:11px/1.75 var(--moss-text,system-ui);white-space:pre-wrap;overflow-wrap:anywhere;max-height:150px;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;margin:6px 0 0;color:#c1d3e1}
.dqp-run-tools{list-style:none;margin:0;padding:0;color:#8faec2;font:10px/1.8 var(--moss-code,monospace)}
.dqp-run-tools li{display:flex;gap:8px}.dqp-run-tools span{flex:1;min-width:0;overflow-wrap:anywhere}.dqp-run-tools b{font-weight:400;color:#7b9aac;white-space:nowrap}
.dqp-run-actions{display:flex;gap:10px;align-items:center;margin-top:8px}
.dqp-run-actions button{display:inline-flex;align-items:center;gap:4px;border:0;border-radius:4px;padding:2px 0;background:transparent;font-size:10px;color:#89a9c0}
.dqp-run-actions button:hover{color:#dcecf7}.dqp-run-actions button:disabled{opacity:.35;cursor:default}
.dqp-run-actions .dqp-run-record{margin-left:auto}
.dqp-run-actions .dqp-run-stop{padding:2px 6px;background:#e9778010;color:#f1a3a5}
.dqp-dot{width:5px;height:5px;border-radius:50%;background:#7b98ac;flex:none}
.dqp-dot[data-status=running],.dqp-dot[data-status=starting]{background:#b2d8ef;box-shadow:0 0 8px #98c7e188;animation:dqp-breathe 1.7s ease-in-out infinite}
.dqp-dot[data-status=completed]{background:#84c9b4}
.dqp-dot[data-status=failed],.dqp-dot[data-status=waiting]{background:#e97780}
.dqp-float-collapsed{position:fixed;right:18px;top:calc(var(--moss-chrome-height,36px) + 66px);z-index:10015;display:flex;align-items:center;gap:7px;border:1px solid #9db8ca33;border-radius:8px;padding:7px 10px;background:#142334ed;color:#c0d6e7;box-shadow:0 6px 24px #0004;font:11px var(--moss-text,system-ui);cursor:pointer}
.dqp-float-error{margin:0 0 8px;padding:8px;border:1px solid #ed8c9626;border-radius:6px;color:#f2a2a5;font-size:11px;overflow-wrap:anywhere}
.dqp-dialog :is(button,input,textarea):focus-visible,.dqp-bar button:focus-visible,.dqp-float button:focus-visible,.dqp-float-body:focus-visible,.dqp-run-output:focus-visible,.dqp-float-collapsed:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-breathe{50%{opacity:.35;box-shadow:0 0 3px #98c7e144}}@media(prefers-reduced-motion:reduce){.dqp-dot{animation:none!important}}body[data-moss-motion=off] .dqp-dot{animation:none}
@media(max-width:600px){.dqp-float{right:10px;top:80px;max-height:min(360px,48vh)}.dqp-panel-trigger{font-size:10px!important}.dqp-float-collapsed{right:10px;top:85px}}
`;
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "uiWorkspace"];
		const h = react.default.createElement;
		function apply(ctx) {
			const tasks = createTasks();
			const slots = ctx.get("slots");
			ctx.effect(() => slots.inject("conversation.input.overlay", () => slots.register({
				name: "conversation.input.overlay",
				id: "dsh-quick-prompts",
				order: 5
			}, (props) => h(QuickPrompts, {
				ctx,
				tasks,
				sessionId: props.sessionId,
				key: props.sessionId
			}))));
			ctx.effect(() => slots.inject("shell.overlay", () => slots.register({
				name: "shell.overlay",
				id: "dsh-quick-prompts-panel",
				order: 95
			}, () => h(TaskPanel, {
				ctx,
				tasks
			}))));
			ctx.effect(() => {
				const style = document.createElement("style");
				style.textContent = styles;
				document.head.appendChild(style);
				return () => style.remove();
			});
			ctx.effect(() => {
				const poll = () => {
					tasks.refresh().catch(() => {});
				};
				poll();
				const timer = setInterval(poll, 1200);
				window.addEventListener("focus", poll);
				return () => {
					clearInterval(timer);
					window.removeEventListener("focus", poll);
				};
			});
		}
		function QuickPrompts({ ctx, tasks, sessionId }) {
			const state = react.default.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot);
			const [items, setItems] = react.default.useState([]);
			const [draft, setDraft] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const [saving, setSaving] = react.default.useState(false);
			const submitting = react.default.useRef(false);
			const nameInput = react.default.useRef(null);
			const trigger = react.default.useRef(null);
			react.default.useEffect(() => {
				let live = true;
				taskRequest("list").then(({ prompts }) => {
					if (live) setItems(prompts);
				}).catch((error) => {
					if (live) setError(String(error.message));
				});
				return () => {
					live = false;
				};
			}, []);
			const close = () => {
				if (submitting.current) return;
				setDraft(null);
				setError("");
				trigger.current?.focus();
			};
			react.default.useEffect(() => {
				if (!draft) return;
				nameInput.current?.focus();
				const onKey = (event) => {
					if (event.key === "Escape" && !submitting.current) {
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
					text: ""
				});
			};
			const save = async (action) => {
				if (!draft || submitting.current) return;
				submitting.current = true;
				setSaving(true);
				setError("");
				try {
					const { prompts } = await taskRequest(action, draft);
					setItems(prompts);
					setDraft(null);
					trigger.current?.focus();
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				} finally {
					submitting.current = false;
					setSaving(false);
				}
			};
			const start = (item) => {
				if (!sessionId || currentSessionId(ctx) !== sessionId) {
					setError("请先选择主会话。");
					return;
				}
				setError("");
				tasks.start(sessionId, item.id);
			};
			const modal = draft ? (0, react_dom.createPortal)(h("div", {
				className: "dqp-backdrop",
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) close();
				}
			}, h("form", {
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
					const nodes = Array.from(event.currentTarget.querySelectorAll("input,textarea,button:not(:disabled)"));
					const first = nodes[0], last = nodes[nodes.length - 1];
					if (event.shiftKey && document.activeElement === first) {
						event.preventDefault();
						last?.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first?.focus();
					}
				}
			}, h("h3", null, draft.id ? "编辑快捷任务" : "新增快捷任务"), h("small", null, "后台子 Agent · 主对话继续运行"), h("label", null, "名称", h("input", {
				ref: nameInput,
				value: draft.name,
				maxLength: 100,
				disabled: saving,
				placeholder: "例如：检查代码",
				onChange: (event) => setDraft({
					...draft,
					name: event.target.value
				})
			}), h("small", null, "按钮最多显示 5 个字，悬停查看全名。")), h("label", null, "任务内容", h("textarea", {
				value: draft.text,
				maxLength: 32e3,
				disabled: saving,
				placeholder: "描述要交给子 Agent 的任务，也可以填写需要 AI 执行的命令…",
				onChange: (event) => setDraft({
					...draft,
					text: event.target.value
				})
			})), h("small", null, "沿用主 Agent 的模型、工作目录与权限。结果和执行进度显示在右侧悬浮面板，不占用主对话输入框。"), error && h("p", { role: "alert" }, error), h("footer", null, draft.id && h("button", {
				type: "button",
				className: "dqp-delete",
				disabled: saving,
				onClick: () => {
					save("delete");
				}
			}, "删除"), h("button", {
				type: "button",
				disabled: saving,
				onClick: close
			}, "取消"), h("button", {
				type: "submit",
				className: "dqp-save",
				disabled: saving || !draft.name.trim() || !draft.text.trim()
			}, saving ? "保存中…" : "保存")))), document.body) : null;
			const running = state.runs.filter((run) => active(run.status)).length;
			return h(react.default.Fragment, null, h("div", {
				className: "dqp-bar",
				role: "group",
				"aria-label": "快捷任务"
			}, h("button", {
				type: "button",
				className: "dqp-add",
				"aria-label": "新增快捷任务",
				disabled: saving,
				onClick: (event) => open(event)
			}, "+"), h("div", { className: "dqp-items" }, ...items.map((item) => h("span", {
				className: "dqp-task-chip",
				key: item.id
			}, h("button", {
				type: "button",
				disabled: !sessionId || tasks.busy(sessionId, item.id),
				title: `${item.name} · 后台子 Agent\n点击执行 · 右键编辑`,
				onClick: () => start(item),
				onContextMenu: (event) => {
					event.preventDefault();
					open(event, item);
				}
			}, shortName(item.name)), h("button", {
				type: "button",
				className: "dqp-task-edit",
				"aria-label": `编辑快捷任务 ${item.name}`,
				onClick: (event) => open(event, item)
			}, h("svg", {
				width: 12,
				height: 12,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.8,
				"aria-hidden": true
			}, h("path", { d: "M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" })))))), h("button", {
				type: "button",
				className: "dqp-panel-trigger",
				onClick: () => tasks.show()
			}, "后台任务", running ? ` ${running}` : "")), error && !draft && h("div", {
				className: "dqp-notice",
				role: "alert",
				title: error
			}, error), modal);
		}
		function elapsed(run, now) {
			const seconds = Math.max(0, Math.floor(((run.endedAt ?? now) - run.startedAt) / 1e3));
			return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
		}
		function TaskPanel({ ctx, tasks }) {
			const state = react.default.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot);
			const [now, setNow] = react.default.useState(Date.now);
			const count = state.runs.filter((run) => active(run.status)).length;
			react.default.useEffect(() => {
				if (!state.open || !count) return;
				setNow(Date.now());
				const timer = setInterval(() => setNow(Date.now()), 1e3);
				return () => clearInterval(timer);
			}, [state.open, count]);
			if (!state.open) return state.runs.length ? (0, react_dom.createPortal)(h("button", {
				type: "button",
				className: "dqp-float-collapsed",
				"aria-label": "展开后台快捷任务",
				onClick: () => tasks.show()
			}, h("i", {
				className: "dqp-dot",
				"data-status": count ? "running" : "stopped"
			}), "后台任务", count ? ` · ${count}` : ""), document.body) : null;
			const runs = [...state.runs].sort((a, b) => Number(active(b.status)) - Number(active(a.status)) || b.startedAt - a.startedAt).slice(0, 20);
			return (0, react_dom.createPortal)(h("aside", {
				className: "dqp-float",
				"aria-label": "后台快捷任务"
			}, h("header", { className: "dqp-float-head" }, h("strong", null, "快捷任务"), h("span", {
				className: "dqp-float-count",
				role: "status"
			}, count ? `${count} 个执行中` : `${runs.length} 条记录`), h("button", {
				type: "button",
				"aria-label": "收起后台任务面板",
				onClick: () => tasks.show(false)
			}, h("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				"aria-hidden": true
			}, h("path", { d: "M5 12h14" })))), h("div", {
				className: "dqp-float-body",
				role: "region",
				"aria-label": "快捷任务列表",
				tabIndex: 0
			}, (state.error || state.syncError) && h("p", {
				role: "alert",
				className: "dqp-float-error"
			}, state.error || state.syncError), !runs.length && h("div", { className: "dqp-float-empty" }, "点击快捷指令，在后台执行任务。"), ...runs.map((run) => h(RunCard, {
				key: run.id,
				ctx,
				tasks,
				run,
				now
			})))), document.body);
		}
		function RunCard({ ctx, tasks, run, now }) {
			const [expanded, setExpanded] = react.default.useState(false);
			const hasDetails = !!(run.output || run.error || run.tools.length);
			const detailId = `dqp-details-${run.id}`;
			return h("section", {
				className: "dqp-run-card",
				"data-run-id": run.id,
				"aria-label": run.name
			}, h("div", { className: "dqp-run-heading" }, h("i", {
				className: "dqp-dot",
				"data-status": run.status
			}), h("strong", { title: run.name }, run.name), h("span", {
				className: "dqp-run-status",
				"data-status": run.status,
				role: "status"
			}, statusLabels[run.status])), h("div", { className: "dqp-run-meta" }, h("span", { title: run.parentTitle }, run.parentTitle), h("time", null, elapsed(run, now))), active(run.status) && h("div", {
				className: "dqp-run-progress",
				title: run.progress
			}, run.progress), !expanded && run.error && h("div", {
				className: "dqp-run-error dqp-run-preview",
				title: run.error
			}, run.error), !expanded && !run.error && run.output && h("p", { className: "dqp-run-preview" }, run.output.replace(/\s+/g, " ").trim()), expanded && h("div", {
				className: "dqp-run-details",
				id: detailId
			}, run.error && h("div", { className: "dqp-run-error" }, run.error), !!run.tools.length && h("ul", { className: "dqp-run-tools" }, ...run.tools.map((tool) => h("li", { key: tool.callId }, h("span", null, tool.name), h("b", null, {
				running: "执行中",
				done: "已返回",
				failed: "失败",
				ended: "已结束"
			}[tool.state])))), !!run.output && h("pre", {
				className: "dqp-run-output",
				tabIndex: 0,
				"aria-label": `${run.name} 的执行结果`
			}, run.output)), h("div", { className: "dqp-run-actions" }, hasDetails && h("button", {
				type: "button",
				className: "dqp-run-expand",
				"aria-expanded": expanded,
				"aria-controls": expanded ? detailId : void 0,
				onClick: () => setExpanded(!expanded)
			}, expanded ? "收起详情" : "展开详情", h("svg", {
				width: 10,
				height: 10,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.8,
				"aria-hidden": true,
				style: { transform: expanded ? "rotate(180deg)" : void 0 }
			}, h("path", { d: "m6 9 6 6 6-6" }))), h("button", {
				type: "button",
				className: "dqp-run-record",
				disabled: !run.steps && !run.output,
				onClick: () => openRun(ctx, run)
			}, "完整记录", h("span", { "aria-hidden": true }, "↗")), active(run.status) && h("button", {
				type: "button",
				className: "dqp-run-stop",
				disabled: run.status === "stopping",
				"aria-label": `停止 ${run.name}`,
				onClick: () => {
					tasks.stop(run.id);
				}
			}, run.status === "stopping" ? "停止中…" : "停止")));
		}
		//#endregion
		exports.QuickPrompts = QuickPrompts;
		exports.TaskPanel = TaskPanel;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map