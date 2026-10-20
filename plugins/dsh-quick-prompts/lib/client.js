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
		const ongoingRuns = (runs) => runs.filter((run) => active(run.status)).sort((a, b) => b.startedAt - a.startedAt);
		function createTasks(request = taskRequest) {
			let current = {
				runs: [],
				open: true,
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
						if (revision === mutation) {
							const failed = runs.find((run) => run.status === "failed" && current.runs.some((previous) => previous.id === run.id && active(previous.status)));
							publish({
								runs,
								syncError: "",
								...failed ? { error: `${failed.name}：${failed.error ?? "任务未能完成，请从原生子智能体列表查看记录。"}` } : {}
							});
						}
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
						publish({
							runs: [run, ...current.runs.filter((item) => item.id !== run.id)],
							...run.status === "failed" ? { error: `${run.name}：${run.error ?? "任务未能启动。"}` } : {}
						});
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
/* One grid owns the host's message scroller (including its sticky composer)
   and our task seat. No fixed layer or reserved body padding is involved. */
.dqp-dock-seat{display:none}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock){
  display:grid;grid-template-columns:minmax(0,1fr) clamp(250px,26%,320px);grid-template-rows:minmax(0,1fr);
  --dsh-chat-content-width:min(var(--dsh-chat-user-width,920px),calc(100% - 48px));
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock)>[data-conversation-scroll]{grid-column:1;grid-row:1;min-width:0;overflow-x:hidden}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock)>[data-width-handle]{display:none}
.dqp-dock-seat:has(> .dqp-dock){
  grid-column:2;grid-row:1;display:flex;min-width:0;min-height:0;overflow:hidden;
  background:transparent;
}
.dqp-dock{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary,#dce7ef);font:12px/1.6 var(--moss-text,system-ui)}
[data-conversation-content][data-dqp-layout=stacked]:has(> .dqp-dock-seat > .dqp-dock){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,min(220px,35%))}
[data-dqp-layout=stacked]>.dqp-dock-seat:has(> .dqp-dock){grid-column:1;grid-row:2}
.dqp-dock-body{flex:1;overflow:auto;padding:12px 10px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-run-card{padding:13px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-live-output{margin:0;min-height:24px;max-height:min(340px,45vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;font:12px/1.85 var(--moss-text,system-ui);color:var(--dsw-alias-label-secondary,#c1d3e1);white-space:pre-wrap;overflow-wrap:anywhere}
.dqp-live-pending{display:flex;flex-direction:column;gap:8px;padding:3px 0;opacity:.5;animation:dqp-pending 1.8s ease-in-out infinite}
.dqp-live-pending i{display:block;height:5px;width:88%;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#dce7ef) 16%,transparent)}
.dqp-live-pending i:nth-child(2){width:66%}.dqp-live-pending i:nth-child(3){width:40%}
.dqp-dialog :is(button,input,textarea):focus-visible,.dqp-bar button:focus-visible,.dqp-dock-body:focus-visible,.dqp-live-output:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-pending{50%{opacity:.22}}@media(prefers-reduced-motion:reduce){.dqp-live-pending{animation:none!important}}body[data-moss-motion=off] .dqp-live-pending{animation:none}
@media(max-width:600px){.dqp-panel-trigger{font-size:10px!important}}
`;
		//#endregion
		//#region src/client/task-dock.ts
		/** Add only our portal seat. The host keeps ownership of its chat/composer tree. */
		function installTaskDock(root, onSeat) {
			const seat = root.ownerDocument.createElement("div");
			seat.className = "dqp-dock-seat";
			let content;
			let previousLayout = null;
			let publishedLayout;
			let frame;
			let stopped = false;
			const measure = () => {
				if (!content) return;
				const next = content.clientWidth >= 820 ? "columns" : "stacked";
				if (content.getAttribute("data-dqp-layout") !== next) content.setAttribute("data-dqp-layout", next);
				publishedLayout = next;
			};
			const resize = new ResizeObserver(measure);
			const release = () => {
				resize.disconnect();
				if (content && content.getAttribute("data-dqp-layout") === publishedLayout) {
					if (previousLayout === null) content.removeAttribute("data-dqp-layout");
					else content.setAttribute("data-dqp-layout", previousLayout);
				}
				seat.remove();
				content = void 0;
				publishedLayout = void 0;
			};
			const sync = () => {
				frame = void 0;
				if (stopped) return;
				const candidates = Array.from(root.querySelectorAll("[data-conversation-content]")).filter((node) => !node.closest("[data-sidebar-right-panel],[data-sidebar-chat],[hidden],[aria-hidden=\"true\"]") && node.getClientRects().length > 0);
				const next = candidates.find((node) => node.closest("[data-slot=\"main.conversation\"]")) ?? candidates[0];
				if (next === content && seat.parentElement === content) {
					measure();
					return;
				}
				release();
				if (!next) {
					onSeat(null);
					return;
				}
				content = next;
				previousLayout = content.getAttribute("data-dqp-layout");
				content.appendChild(seat);
				resize.observe(content);
				measure();
				onSeat(seat);
			};
			const schedule = () => {
				if (!stopped && frame === void 0) frame = requestAnimationFrame(sync);
			};
			const mutations = new MutationObserver(schedule);
			mutations.observe(root, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: [
					"hidden",
					"aria-hidden",
					"data-conversation-session",
					"class"
				]
			});
			sync();
			return () => {
				stopped = true;
				mutations.disconnect();
				if (frame !== void 0) cancelAnimationFrame(frame);
				release();
			};
		}
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
			}, () => h(TaskPanel, { tasks }))));
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
				const timer = setInterval(poll, 400);
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
			})), h("small", null, "沿用主 Agent 的模型、工作目录与权限。结果和执行进度显示在对话右侧任务栏，主对话可继续使用。"), error && h("p", { role: "alert" }, error), h("footer", null, draft.id && h("button", {
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
			const running = ongoingRuns(state.runs).length;
			const notice = error || state.error || state.syncError;
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
			}, h("path", { d: "M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" })))))), running > 0 && h("button", {
				type: "button",
				className: "dqp-panel-trigger",
				"aria-expanded": state.open,
				title: state.open ? "收起进行中的任务" : "显示进行中的任务",
				onClick: () => tasks.show(!state.open)
			}, `后台任务 ${running}`)), notice && !draft && h("div", {
				className: "dqp-notice",
				role: "alert",
				title: notice
			}, notice), modal);
		}
		function TaskPanel({ tasks }) {
			const state = react.default.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot);
			const [seat, setSeat] = react.default.useState(null);
			react.default.useLayoutEffect(() => installTaskDock(document.body, setSeat), []);
			const runs = ongoingRuns(state.runs);
			if (!state.open || !seat || !runs.length) return null;
			return (0, react_dom.createPortal)(h("aside", {
				className: "dqp-dock",
				"aria-label": "进行中的快捷任务"
			}, h("div", {
				className: "dqp-dock-body",
				role: "region",
				"aria-label": "进行中的任务卡片",
				tabIndex: 0
			}, ...runs.map((run) => h(RunCard, {
				key: run.id,
				run
			})))), seat);
		}
		function RunCard({ run }) {
			const output = run.liveOutput ?? run.output;
			const viewport = react.default.useRef(null);
			const follow = react.default.useRef(true);
			react.default.useLayoutEffect(() => {
				const node = viewport.current;
				if (node && follow.current) node.scrollTop = node.scrollHeight;
			}, [output]);
			return h("section", {
				className: "dqp-run-card",
				"data-run-id": run.id,
				"aria-label": run.name,
				title: run.name
			}, output ? h("pre", {
				ref: viewport,
				className: "dqp-live-output",
				role: "log",
				tabIndex: 0,
				"aria-label": `${run.name} 的实时输出`,
				"aria-live": "off",
				onScroll: (event) => {
					const node = event.currentTarget;
					follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
				}
			}, output) : h("div", {
				className: "dqp-live-pending",
				role: "status",
				"aria-label": `${run.name} 等待输出`
			}, h("i"), h("i"), h("i")));
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