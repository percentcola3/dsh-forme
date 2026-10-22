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
			const workspace = ctx.get("uiWorkspace");
			if (run.sessionKind === "conversation") {
				workspace.openSession(run.childId);
				return;
			}
			workspace.openSession({
				kind: "subagent",
				parentSessionId: run.parentId,
				childSessionId: run.childId,
				mode: "continuable"
			});
		}
		const ongoingRuns = (runs) => runs.filter((run) => !run.dismissed).sort((a, b) => b.startedAt - a.startedAt);
		const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
		const messageOf = (error) => error instanceof Error ? error.message : String(error);
		function createTasks(request = taskRequest, now = Date.now) {
			let current = {
				sessionId: void 0,
				projectId: "",
				cwd: "",
				prompts: [],
				legacyAvailable: false,
				ready: false,
				runs: [],
				open: true,
				terminalOpen: false,
				terminalCards: [],
				recovery: null,
				error: "",
				syncError: ""
			};
			const listeners = /* @__PURE__ */ new Set();
			const starting = /* @__PURE__ */ new Map();
			const drafts = /* @__PURE__ */ new Map();
			const replyKeys = /* @__PURE__ */ new Map();
			const projectCards = /* @__PURE__ */ new Map();
			let epoch = 0, mutation = 0, catalogRevision = 0;
			let lastCatalogAt = -Infinity;
			let polling;
			const publish = (patch) => {
				current = {
					...current,
					...patch
				};
				if (current.ready && current.projectId) {
					projectCards.delete(current.projectId);
					projectCards.set(current.projectId, {
						open: current.open,
						terminalOpen: current.terminalOpen,
						runs: current.runs
					});
				}
				for (const listener of listeners) listener();
			};
			const scope = () => ({
				sessionId: current.sessionId,
				projectId: current.projectId
			});
			const load = async (generation) => {
				if (!current.sessionId) return;
				const revision = catalogRevision;
				lastCatalogAt = now();
				try {
					const value = await request("list", { sessionId: current.sessionId });
					if (generation !== epoch || revision !== catalogRevision) return;
					if (current.ready && value.projectId === current.projectId && Object.entries(value).every(([key, item]) => same(item, current[key]))) return;
					if (value.projectId !== current.projectId) {
						if (current.ready) {
							epoch++;
							mutation++;
							catalogRevision++;
						}
						const cards = projectCards.get(value.projectId);
						publish({
							...value,
							runs: cards?.runs ?? [],
							open: cards?.open ?? true,
							terminalOpen: current.terminalCards.some((card) => card.projectId === value.projectId),
							recovery: null,
							ready: true,
							error: "",
							syncError: ""
						});
					} else publish({
						...value,
						ready: true,
						...current.ready ? {} : { error: "" }
					});
				} catch (error) {
					if (generation === epoch && revision === catalogRevision) publish({ error: messageOf(error) });
				}
			};
			const store = {
				getSnapshot: () => current,
				getDraft: (runId) => drafts.get(runId) ?? "",
				setDraft(runId, text) {
					if (text) {
						drafts.delete(runId);
						drafts.set(runId, text);
					} else drafts.delete(runId);
					while (drafts.size > 100) drafts.delete(drafts.keys().next().value);
				},
				replyRequestId(runId, text) {
					const previous = replyKeys.get(runId);
					if (previous?.text === text) return previous.id;
					const id = crypto.randomUUID();
					replyKeys.set(runId, {
						text,
						id
					});
					return id;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				async select(sessionId) {
					if (sessionId === current.sessionId) return;
					const generation = ++epoch;
					mutation++;
					catalogRevision++;
					publish({
						sessionId,
						projectId: "",
						cwd: "",
						prompts: [],
						runs: [],
						legacyAvailable: false,
						ready: false,
						error: "",
						syncError: "",
						recovery: null,
						open: true,
						terminalOpen: false
					});
					await load(generation);
				},
				show(open = true) {
					publish({ open });
				},
				showTerminal(open = true, projectId = current.projectId) {
					if (!projectId || open && (!current.ready || projectId !== current.projectId || !current.sessionId)) return;
					const terminalCards = current.terminalCards.filter((card) => card.projectId !== projectId);
					const previous = current.terminalCards.find((card) => card.projectId === projectId);
					if (open) terminalCards.push(previous ?? {
						projectId,
						sessionId: current.sessionId
					});
					const cached = projectCards.get(projectId);
					if (cached) projectCards.set(projectId, {
						...cached,
						terminalOpen: open
					});
					publish({
						terminalCards,
						...current.projectId === projectId ? {
							terminalOpen: open,
							open: true
						} : {}
					});
				},
				async refresh() {
					const generation = epoch;
					if (!current.sessionId || polling === generation) return;
					polling = generation;
					const revision = mutation;
					try {
						if (!current.ready) {
							await load(generation);
							return;
						}
						if (now() - lastCatalogAt >= 15e3) await load(generation);
						if (generation !== epoch) return;
						const { runs, projectId, recovery = null } = await request("runs", scope());
						if (generation === epoch && revision === mutation && projectId === current.projectId) {
							const failed = runs.find((run) => run.status === "failed" && current.runs.some((previous) => previous.id === run.id && active(previous.status)));
							if (!(!failed && current.syncError === "" && same(runs, current.runs) && same(recovery, current.recovery))) publish({
								runs: same(runs, current.runs) ? current.runs : runs.map((run) => {
									const previous = current.runs.find((item) => item.id === run.id);
									return previous && same(previous, run) ? previous : run;
								}),
								recovery: same(recovery, current.recovery) ? current.recovery : recovery,
								syncError: "",
								...failed ? { error: `${failed.name}：${failed.error ?? "任务未能完成，请从原生子智能体列表查看记录。"}` } : {}
							});
						}
					} catch {
						const syncError = "任务状态同步失败，正在重连；当前显示可能已过期。";
						if (generation === epoch && current.syncError !== syncError) publish({ syncError });
					} finally {
						if (polling === generation) polling = void 0;
					}
				},
				async models() {
					if (!current.ready || !current.sessionId) throw new Error("项目尚未就绪，请稍后重试。");
					const generation = epoch, projectId = current.projectId;
					const value = await request("models", scope());
					if (generation !== epoch || projectId !== current.projectId || value.projectId !== projectId) throw new Error("项目已切换，请重新打开快捷任务。");
					if (!Array.isArray(value.models)) throw new Error("模型列表暂不可用，请重新加载插件后重试。");
					return value.models;
				},
				async save(action, draft = {}) {
					if (!current.ready) throw new Error("项目尚未就绪，请稍后重试。");
					const generation = epoch, projectId = current.projectId;
					const revision = ++catalogRevision;
					const value = await request(action, {
						...draft,
						...scope()
					});
					if (generation === epoch && projectId === current.projectId && revision === catalogRevision) {
						catalogRevision++;
						lastCatalogAt = now();
						publish(value);
					}
				},
				start(sessionId, promptId) {
					if (sessionId !== current.sessionId || !current.ready) return Promise.resolve();
					const key = `${epoch}:${promptId}`;
					if (starting.has(key)) return starting.get(key);
					const generation = epoch;
					mutation++;
					const operation = request("start", {
						...scope(),
						id: promptId,
						requestId: crypto.randomUUID()
					}).then(({ run }) => {
						if (generation !== epoch) return;
						mutation++;
						publish({
							runs: [run, ...current.runs.filter((item) => item.id !== run.id)],
							...run.status === "failed" ? { error: `${run.name}：${run.error ?? "任务未能启动。"}` } : {}
						});
					}).catch((error) => {
						if (generation === epoch) publish({ error: messageOf(error) });
					}).finally(() => {
						starting.delete(key);
						if (generation === epoch) publish({});
					});
					starting.set(key, operation);
					publish({
						open: true,
						error: ""
					});
					return operation;
				},
				async reply(runId, text, requestId) {
					if (!current.ready || !current.sessionId) throw new Error("项目尚未就绪，请稍后重试。");
					const generation = epoch;
					mutation++;
					const { run, projectId } = await request("reply", {
						...scope(),
						runId,
						text,
						requestId
					});
					if (replyKeys.get(runId)?.id === requestId) replyKeys.delete(runId);
					if (generation === epoch && projectId === current.projectId) {
						mutation++;
						publish({
							runs: current.runs.map((previous) => previous.id === run.id ? run : previous),
							error: ""
						});
					}
				},
				async control(action, runId) {
					const generation = epoch;
					mutation++;
					try {
						const { runs } = await request(action, {
							...scope(),
							runId
						});
						if (action === "close") {
							drafts.delete(runId);
							replyKeys.delete(runId);
						}
						if (generation === epoch) {
							mutation++;
							const updated = runs.find((run) => run.id === runId);
							publish({
								runs: updated ? current.runs.map((run) => run.id === runId ? updated : run) : current.runs.filter((run) => run.id !== runId),
								error: ""
							});
						}
					} catch (error) {
						if (generation === epoch) publish({ error: messageOf(error) });
					}
				},
				stop(runId) {
					return store.control("stop", runId);
				},
				close(runId) {
					return store.control("close", runId);
				},
				busy(sessionId, promptId) {
					return sessionId === current.sessionId && starting.has(`${epoch}:${promptId}`);
				}
			};
			return store;
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
.dqp-bar .dqp-add{width:28px;padding:0;display:grid;place-items:center}
.dqp-bar .dqp-task-edit{width:25px;padding:0;display:grid;place-items:center}
.dqp-bar button:disabled{opacity:.45;cursor:default}
.dqp-panel-trigger{margin-left:auto;display:flex;gap:6px;align-items:center}
.dqp-notice{position:absolute;top:46px;left:12px;right:12px;line-height:28px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ef9398;font-size:12px}
.dqp-backdrop{position:fixed;inset:0;z-index:11020;display:grid;place-items:center;padding:20px;background:#040a12a8;backdrop-filter:blur(6px)}
.dqp-dialog{width:440px;max-width:100%;max-height:calc(100vh - 40px);overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:16px;background:var(--dsw-alias-bg-layer-3,#152333);color:var(--dsw-alias-label-primary,#e1eaf3);box-shadow:0 20px 70px #0007;display:flex;flex-direction:column;gap:18px;font:13px/1.6 var(--moss-text,system-ui)}
.dqp-dialog h3{margin:0;font-size:17px}.dqp-dialog label{display:flex;flex-direction:column;gap:7px}.dqp-dialog :is(input,textarea,select){width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;font:inherit}.dqp-dialog textarea{min-height:170px;resize:vertical;line-height:1.7}.dqp-dialog small{color:var(--dsw-alias-label-tertiary,#8ea4b8)}.dqp-dialog footer{display:flex;gap:8px;justify-content:flex-end}.dqp-dialog button{padding:8px 15px;border:1px solid var(--dsw-alias-border-l2,#899bb433);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#101b29);color:inherit;cursor:pointer;font:inherit}.dqp-dialog .dqp-save{background:#c7dce9;color:#14202c;border-color:transparent}.dqp-dialog .dqp-delete{margin-right:auto;color:#ef9398}.dqp-dialog button:disabled{opacity:.5;cursor:default}.dqp-dialog [role=alert]{color:#ef9398;margin:0}
.dqp-model-field{display:flex;flex-direction:column;gap:7px}.dqp-model-field select{min-height:42px}.dqp-model-message{display:flex;align-items:center;gap:8px;font-size:12px}.dqp-model-message button{flex:none;padding:3px 8px}.dqp-model-warning{color:#efb26e!important}
/* One grid owns the host's message scroller (including its sticky composer)
   and our task seat. No fixed layer or reserved body padding is involved. */
.dqp-dock-seat{display:none}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden])){
  display:grid;grid-template-columns:minmax(0,1fr) clamp(280px,28%,360px);grid-template-rows:minmax(0,1fr);
  --dsh-chat-content-width:min(var(--dsh-chat-user-width,920px),calc(100% - 48px));
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden]))>[data-conversation-scroll]{grid-column:1;grid-row:1;min-width:0;overflow-x:hidden}
[data-conversation-content]:has(> .dqp-dock-seat > .dqp-dock:not([hidden]))>[data-width-handle]{display:none}
.dqp-dock-seat:has(> .dqp-dock:not([hidden])){
  grid-column:2;grid-row:1;display:flex;min-width:0;min-height:0;overflow:hidden;
  background:transparent;
}
.dqp-dock[hidden]{display:none}
.dqp-dock{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary,#dce7ef);font:12px/1.6 var(--moss-text,system-ui)}
[data-conversation-content][data-dqp-layout=stacked]:has(> .dqp-dock-seat > .dqp-dock:not([hidden])){grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,min(220px,35%))}
[data-dqp-layout=stacked]>.dqp-dock-seat:has(> .dqp-dock:not([hidden])){grid-column:1;grid-row:2}
.dqp-dock-body{flex:1;overflow:auto;padding:12px 10px;min-height:0;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#839eb644 transparent;scrollbar-gutter:stable}
.dqp-run-card{padding:13px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
.dqp-run-actions{display:flex;align-items:center;gap:5px;margin:-5px -5px 8px 0;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-run-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
.dqp-run-actions button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;padding:3px 6px;border-radius:5px;cursor:pointer}
.dqp-run-actions button:hover{background:#ffffff0d;color:#ed969c}.dqp-run-actions button:disabled{opacity:.45;cursor:default}.dqp-run-actions button:focus-visible{outline:1px solid #a3c8e1;outline-offset:1px}
.dqp-run-card:last-child{margin-bottom:0}
.dqp-live-output{margin:0;min-height:24px;max-height:min(340px,45vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;font:12px/1.85 var(--moss-text,system-ui);color:var(--dsw-alias-label-secondary,#c1d3e1);white-space:pre-wrap;overflow-wrap:anywhere}
.dqp-live-pending{display:flex;flex-direction:column;gap:8px;padding:3px 0;opacity:.5;animation:dqp-pending 1.8s ease-in-out infinite}
.dqp-live-pending i{display:block;height:5px;width:88%;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#dce7ef) 16%,transparent)}
.dqp-live-pending i:nth-child(2){width:66%}.dqp-live-pending i:nth-child(3){width:40%}
.dqp-dialog :is(button,input,textarea,select):focus-visible,.dqp-bar button:focus-visible,.dqp-dock-body:focus-visible,.dqp-live-output:focus-visible{outline:2px solid #a3c8e1;outline-offset:2px}
@keyframes dqp-pending{50%{opacity:.22}}@media(prefers-reduced-motion:reduce){.dqp-live-pending{animation:none!important}}body[data-moss-motion=off] .dqp-live-pending{animation:none}
@media(max-width:600px){.dqp-panel-trigger{font-size:10px!important}}
.dqp-bar button.dqp-terminal{width:28px;padding:0;display:grid;place-items:center;background:transparent!important;border:0!important;box-shadow:none!important;border-radius:0}
.dqp-bar button.dqp-terminal:hover{background:transparent!important;color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-bar .dqp-terminal[aria-pressed=true]{color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-run-state{margin-left:6px;font-style:normal;font-size:10px;color:#ef9398}
.dqp-run-card[data-run-status=failed]{border-color:#ef939855}
.dqp-run-error{margin:0 0 8px;color:#ef9398;font-size:11px;line-height:1.6;overflow-wrap:anywhere}
.dqp-terminal-card{position:relative;display:flex;flex-direction:column;min-height:220px;margin-bottom:10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-base,#101c29)}
.dqp-terminal-card:last-child{margin-bottom:0}
/* A single hairline frames the borrowed terminal; the official header stays. */
.dqp-terminal-overlay{position:absolute;top:0;right:0;z-index:12;display:flex;gap:2px;padding:3px}
.dqp-terminal-overlay button{appearance:none;height:22px;padding:0 7px;border:0;border-radius:5px;background:#0b1723cc;color:var(--dsw-alias-label-secondary,#b7c6d5);font:11px/1 var(--moss-text,system-ui);cursor:pointer;opacity:.45}
.dqp-terminal-overlay:hover{opacity:1}
.dqp-terminal-overlay button:hover{background:#152435e6;color:var(--dsw-alias-label-primary,#edf4fa)}
.dqp-terminal-overlay button:focus-visible{outline:2px solid #a3c8e1;outline-offset:1px}
.dqp-terminal-overlay button:disabled{cursor:default;opacity:.3}
.dqp-terminal-body{height:230px;min-height:160px;overflow:hidden;color:var(--dsw-alias-label-tertiary);font-size:11px}
.dqp-terminal-overlay{border-radius:8px 8px 0 0}
.dqp-terminal-body:has(.dqp-terminal-return){border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);background:color-mix(in srgb,var(--dsw-alias-bg-base,#101c29) 93%,#9ab9d1 7%)}
[data-dqp-official-terminal]{position:fixed!important;left:var(--dqp-terminal-left)!important;top:var(--dqp-terminal-top)!important;width:var(--dqp-terminal-width)!important;height:var(--dqp-terminal-height)!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;transform:none!important;clip-path:var(--dqp-terminal-clip);visibility:var(--dqp-terminal-visibility)!important;z-index:70!important}
.dqp-terminal-error{margin:6px 0 0;color:#ef9398;font-size:11px;display:flex;align-items:center;gap:8px}
.dqp-terminal-error button{appearance:none;border:1px solid #ef939855;border-radius:5px;background:transparent;color:inherit;font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
/* Lightweight conversations: plain text, scoped scrolling, small local composer. */
.dqp-conversation{display:flex;flex-direction:column;min-height:210px;contain:layout style}
.dqp-conversation .dqp-run-actions{margin-bottom:10px}
.dqp-conversation-state{font-size:10px;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-conversation[data-run-status=running] .dqp-conversation-state{color:#a3c8e1}
.dqp-conversation-messages{min-height:70px;max-height:min(400px,48vh);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;overflow-wrap:anywhere;padding-right:3px}
.dqp-message{margin:0 0 13px;font-size:12px;line-height:1.8}
.dqp-message small{display:block;margin-bottom:3px;font-size:10px;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-message>div{white-space:pre-wrap}
.dqp-message-user{margin-left:16px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover,#ffffff09)}
.dqp-message-assistant{color:var(--dsw-alias-label-primary,#dce7ef)}
.dqp-conversation-progress{padding:2px 0 9px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8ea4b8)}
.dqp-conversation-input{display:flex;align-items:flex-end;gap:6px;margin-top:10px;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l3,#a1b7cc22)}
.dqp-conversation-input textarea{display:block;flex:1;min-width:0;min-height:44px;max-height:140px;resize:vertical;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:7px;padding:7px 8px;background:var(--dsw-alias-bg-base,#101c29);color:inherit;font:12px/1.6 var(--moss-text,system-ui)}
.dqp-conversation-input button{flex:none;padding:7px 9px;border:0;border-radius:6px;background:#c7dce9;color:#14202c;font:11px/1.5 var(--moss-text,system-ui);cursor:pointer}
.dqp-conversation-input button:disabled{opacity:.4;cursor:default}
.dqp-conversation-input :is(textarea,button):focus-visible,.dqp-conversation-messages:focus-visible{outline:2px solid #a3c8e1;outline-offset:1px}
.dqp-terminal-return{display:grid;align-content:center;justify-items:start;gap:8px;height:100%;padding:12px}.dqp-terminal-return p{margin:0}.dqp-terminal-return button{padding:6px 10px;border:1px solid var(--dsw-alias-border-l3,#a1b7cc22);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary,#dce7ef);font:inherit;cursor:pointer}
`;
		//#endregion
		//#region src/client/model-picker.ts
		const h$2 = react.default.createElement;
		const modelKey = (value) => value ? JSON.stringify([value.provider, value.model]) : "";
		function TaskModelPicker({ tasks, value, disabled, onChange }) {
			const [models, setModels] = react.default.useState([]);
			const [loading, setLoading] = react.default.useState(true);
			const [error, setError] = react.default.useState("");
			const [revision, retry] = react.default.useReducer((value) => value + 1, 0);
			react.default.useEffect(() => {
				let active = true;
				setLoading(true);
				setError("");
				tasks.models().then((items) => {
					if (active) setModels(items);
				}).catch((error) => {
					if (active) setError(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					if (active) setLoading(false);
				});
				return () => {
					active = false;
				};
			}, [tasks, revision]);
			const selected = modelKey(value);
			const missing = !!value && !models.some((item) => modelKey(item) === selected);
			const groups = /* @__PURE__ */ new Map();
			for (const model of models) groups.set(model.provider, [...groups.get(model.provider) ?? [], model]);
			return h$2("div", { className: "dqp-model-field" }, h$2("label", null, "执行模型", h$2("select", {
				value: selected,
				disabled,
				"aria-busy": loading,
				onChange: (event) => {
					if (!event.target.value) {
						onChange(void 0);
						return;
					}
					const choice = models.find((item) => modelKey(item) === event.target.value);
					if (choice) onChange({
						provider: choice.provider,
						model: choice.model
					});
				}
			}, h$2("option", { value: "" }, "跟随当前会话模型"), missing && h$2("option", {
				value: selected,
				disabled: true
			}, `${value.provider} / ${value.model}（${loading ? "正在核对" : error ? "暂无法核对" : "当前不可用"}）`), ...[...groups].map(([provider, entries]) => h$2("optgroup", {
				key: provider,
				label: entries[0].providerLabel || provider
			}, ...entries.map((item) => h$2("option", {
				key: modelKey(item),
				value: modelKey(item)
			}, item.label === item.model ? item.label : `${item.label} · ${item.model}`)))))), h$2("small", null, value ? "此快捷任务固定使用所选模型，主对话的模型不变。" : "执行时使用当前会话的模型；以后切换会话模型时自动跟随。"), loading && h$2("small", { role: "status" }, "正在加载可用模型…"), error && h$2("div", {
				className: "dqp-model-message",
				role: "alert"
			}, `模型列表加载失败：${error}`, h$2("button", {
				type: "button",
				disabled,
				onClick: () => retry()
			}, "重试")), !loading && !error && !models.length && h$2("small", null, "没有可选模型，请先在 DSH 中配置模型提供方。"), !loading && !error && missing && h$2("small", { className: "dqp-model-warning" }, "已保存的模型当前不可用，请重新选择或改为跟随当前会话。"));
		}
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
			const mutations = new MutationObserver((records) => {
				if (!content || !content.isConnected || seat.parentElement !== content) return schedule();
				for (const record of records) {
					const target = record.target;
					if (target === seat || seat.contains(target)) continue;
					if (content.contains(target) && record.type === "childList") continue;
					return schedule();
				}
			});
			mutations.observe(root, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: [
					"hidden",
					"aria-hidden",
					"data-conversation-session"
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
		//#region ../dsh-terminal/src/client/official-terminal.ts
		/** A card owns one real official floating tab, never a second terminal renderer. */
		function createOfficialTerminalCard(sidebar, terminals, sessionId, rect) {
			const expanded = sidebar.isExpanded();
			sidebar.openTab("terminal");
			const tab = sidebar.active();
			if (!tab || tab.kind !== "terminal") throw new Error("官方终端尚未就绪，请稍后重试。");
			try {
				sidebar.float(tab.id, rect);
				if (!expanded && sidebar.isExpanded()) sidebar.toggleExpanded();
			} catch (error) {
				sidebar.closeIn(sessionId, tab.id);
				throw error;
			}
			let closed = false;
			return {
				tabId: tab.id,
				exists: () => sidebar.openTabs.getSnapshot().some((item) => item.sessionId === sessionId && item.tabId === tab.id),
				interrupt() {
					if (closed) return;
					const navigation = sidebar.tabDomain.occurrence(sessionId, { id: tab.id }).navigation.getSnapshot();
					const view = terminals.view(sessionId, tab.id, navigation.address, navigation.params?.terminalId, navigation.params?.shellPath);
					if (!view.state.getSnapshot().writable) throw new Error("终端尚未连接或当前不可输入。");
					view.write("");
				},
				expand(paneId) {
					if (closed) return;
					sidebar.dock(paneId);
					closed = true;
					if (!sidebar.isExpanded()) sidebar.toggleExpanded();
					sidebar.focus(tab.id);
				},
				release() {
					closed = true;
				},
				close() {
					if (!closed) {
						closed = true;
						sidebar.closeIn(sessionId, tab.id);
					}
				}
			};
		}
		//#endregion
		//#region src/client/terminal-card.ts
		/** Only a seat: DSH keeps ownership of the floating pane, renderer and PTY. */
		function TerminalCard({ ctx, sessionId, active = true, sourceSelected = true, onClose }) {
			const host = react.default.useRef(null);
			const lease = react.default.useRef(null);
			const expandRef = react.default.useRef(null);
			const activeRef = react.default.useRef(active && sourceSelected);
			activeRef.current = active && sourceSelected;
			const scheduleRef = react.default.useRef(null);
			react.default.useLayoutEffect(() => {
				scheduleRef.current?.();
			}, [active, sourceSelected]);
			const closeRef = react.default.useRef(onClose);
			closeRef.current = onClose;
			const [error, setError] = react.default.useState("");
			const [connected, setConnected] = react.default.useState(false);
			react.default.useEffect(() => {
				const seat = host.current;
				if (!seat) return;
				const sidebar = ctx.get("sidebarRight");
				let owner;
				let stopped = false;
				let frame;
				let pane;
				const releasePane = () => {
					pane?.removeAttribute("data-dqp-official-terminal");
					for (const key of [
						"left",
						"top",
						"width",
						"height",
						"clip",
						"visibility"
					]) pane?.style.removeProperty(`--dqp-terminal-${key}`);
				};
				expandRef.current = () => {
					const paneId = pane?.dataset.dockkitFloat;
					if (!owner || !paneId) throw new Error("终端小窗尚未就绪，请稍后重试。");
					owner.expand(paneId);
					releasePane();
					closeRef.current();
				};
				const sync = () => {
					frame = void 0;
					if (stopped) return;
					if (!activeRef.current) {
						pane?.style.setProperty("--dqp-terminal-visibility", "hidden");
						return;
					}
					if (ctx.get("uiWorkspace").selection.getSnapshot().sessionId !== sessionId) return;
					if (!owner) try {
						const rect = seat.getBoundingClientRect();
						owner = createOfficialTerminalCard(sidebar, ctx.get("webTerminals"), sessionId, {
							x: rect.left,
							y: rect.top,
							width: Math.max(1, rect.width),
							height: Math.max(1, rect.height)
						});
						lease.current = owner;
					} catch (error) {
						setError(error instanceof Error ? error.message : String(error));
						return;
					}
					if (!owner.exists()) {
						closeRef.current();
						return;
					}
					const body = Array.from(document.querySelectorAll("div[data-sidebar-right-tab]")).find((node) => node.dataset.sidebarRightTab === owner.tabId && node.closest("[data-sidebar-right-session]")?.getAttribute("data-sidebar-right-session") === sessionId);
					const next = body?.closest("[data-dockkit-float]") ?? void 0;
					if (!next) {
						if (pane && body?.closest("[data-dockkit-pane]")) {
							owner.release();
							closeRef.current();
						}
						return;
					}
					if (pane !== next) {
						releasePane();
						pane = next;
					}
					pane.setAttribute("data-dqp-official-terminal", "");
					const rect = seat.getBoundingClientRect();
					const viewport = seat.closest(".dqp-dock-body")?.getBoundingClientRect();
					const top = Math.max(0, (viewport?.top ?? 0) - rect.top, -rect.top);
					const bottom = Math.max(0, rect.bottom - (viewport?.bottom ?? innerHeight), rect.bottom - innerHeight);
					const left = Math.max(0, (viewport?.left ?? 0) - rect.left, -rect.left);
					const right = Math.max(0, rect.right - (viewport?.right ?? innerWidth), rect.right - innerWidth);
					const values = {
						left: `${rect.left}px`,
						top: `${rect.top}px`,
						width: `${rect.width}px`,
						height: `${rect.height}px`,
						clip: `inset(${top}px ${right}px ${bottom}px ${left}px)`,
						visibility: rect.width > 0 && rect.height > 0 && top + bottom < rect.height ? "visible" : "hidden"
					};
					for (const [key, value] of Object.entries(values)) if (pane.style.getPropertyValue(`--dqp-terminal-${key}`) !== value) pane.style.setProperty(`--dqp-terminal-${key}`, value);
					setConnected(true);
				};
				const schedule = () => {
					if (!stopped && frame === void 0) frame = requestAnimationFrame(sync);
				};
				scheduleRef.current = schedule;
				const mutations = new MutationObserver((records) => {
					if (!activeRef.current) return;
					if (!pane?.isConnected) return schedule();
					if (records.some((record) => !pane.contains(record.target) && !seat.contains(record.target) && !record.target.closest?.("[data-composer-seat]"))) schedule();
				});
				mutations.observe(document.body, {
					childList: true,
					subtree: true
				});
				const resize = new ResizeObserver(schedule);
				resize.observe(seat);
				const unsubscribe = sidebar.openTabs.subscribe(schedule);
				window.addEventListener("scroll", schedule, true);
				window.addEventListener("resize", schedule);
				sync();
				return () => {
					stopped = true;
					scheduleRef.current = null;
					if (frame !== void 0) cancelAnimationFrame(frame);
					mutations.disconnect();
					resize.disconnect();
					unsubscribe();
					window.removeEventListener("scroll", schedule, true);
					window.removeEventListener("resize", schedule);
					releasePane();
					owner?.close();
					lease.current = null;
					expandRef.current = null;
				};
			}, [ctx, sessionId]);
			const interrupt = () => {
				try {
					lease.current?.interrupt();
					setError("");
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			};
			const expand = () => {
				try {
					expandRef.current?.();
					setError("");
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			};
			const returnToSource = () => {
				try {
					ctx.get("uiWorkspace").openSession(sessionId);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			};
			const body = sourceSelected ? connected ? null : "正在打开官方终端…" : react.default.createElement("div", { className: "dqp-terminal-return" }, react.default.createElement("p", null, "终端保留在本项目的原会话中。"), react.default.createElement("button", {
				type: "button",
				onClick: returnToSource
			}, "返回原终端"));
			return react.default.createElement("section", {
				className: "dqp-terminal-card",
				"aria-label": "官方项目终端"
			}, react.default.createElement("div", { className: "dqp-terminal-overlay" }, react.default.createElement("button", {
				type: "button",
				disabled: !connected || !sourceSelected,
				title: "在官方侧边栏展开此终端",
				"aria-label": "放大终端到侧边栏",
				onClick: expand
			}, "放大"), react.default.createElement("button", {
				type: "button",
				disabled: !connected,
				title: "发送 Ctrl+C",
				onClick: interrupt
			}, "中断"), react.default.createElement("button", {
				type: "button",
				title: "结束终端并关闭卡片",
				"aria-label": "关闭终端",
				onClick: onClose
			}, "×")), react.default.createElement("div", {
				className: "dqp-terminal-body",
				ref: host
			}, body), error ? react.default.createElement("p", {
				className: "dqp-terminal-error",
				role: "alert"
			}, error) : null);
		}
		//#endregion
		//#region src/client/draft-memory.ts
		const LAST = "dsh-forme.draft-session.v1.";
		/** Reopen the original blank Session: never copy text over another composer. */
		function installDraftNavigation(navigation, sessions, workspaces, storage) {
			const read = (key) => {
				try {
					return storage.getItem(key);
				} catch {
					return null;
				}
			};
			const remember = () => {
				const id = navigation.selection.getSnapshot().sessionId;
				if (!id || !sessions.list.getSnapshot().byId[id]?.blank) return;
				const workspace = workspaces.list.getSnapshot().items.find((item) => item.sessionIds.includes(id));
				if (workspace) try {
					storage.setItem(LAST + workspace.workspaceId, id);
				} catch {}
			};
			const candidate = (workspaceId) => {
				const catalog = sessions.list.getSnapshot();
				const groups = workspaces.list.getSnapshot();
				if (catalog.phase !== "ready" || groups.phase !== "ready") return;
				const current = navigation.selection.getSnapshot().sessionId;
				const recent = [...groups.items].sort((a, b) => {
					const time = (w) => Math.max(Date.parse(w.createdAt ?? "") || 0, ...w.sessionIds.map((id) => catalog.byId[id]?.updatedAt ?? 0));
					return time(b) - time(a);
				})[0];
				const target = workspaceId ?? groups.items.find((item) => current && item.sessionIds.includes(current))?.workspaceId ?? recent?.workspaceId;
				const workspace = groups.items.find((item) => item.workspaceId === target);
				if (!workspace) return;
				const preferred = read(LAST + workspace.workspaceId);
				return [.../* @__PURE__ */ new Set([
					current,
					preferred,
					...catalog.ids
				])].find((id) => {
					if (!id || !workspace.sessionIds.includes(id) || groups.archivedSessionIds.includes(id)) return false;
					const summary = catalog.byId[id];
					if (!summary?.blank || summary.cwd !== workspace.path) return false;
					try {
						const saved = JSON.parse(read("dsh.conversation." + id) ?? "null");
						const text = typeof saved?.draft === "string" ? saved.draft : saved?.draft?.text;
						return typeof text === "string" && text.trim().length > 0;
					} catch {
						return false;
					}
				});
			};
			const ownStart = Object.getOwnPropertyDescriptor(navigation, "startSession");
			const ownOpen = Object.getOwnPropertyDescriptor(navigation, "openWorkspace");
			const method = (name) => {
				let object = navigation;
				while (object) {
					const value = Object.getOwnPropertyDescriptor(object, name)?.value;
					if (typeof value === "function") return value;
					object = Object.getPrototypeOf(object);
				}
				throw new Error(`Workspace navigation method unavailable: ${name}`);
			};
			const originalStart = method("startSession");
			const originalOpen = method("openWorkspace");
			const mayRestore = (options) => options?.prompt === void 0 && options?.clearPreviousDraft !== true && options?.agentPreset === void 0;
			const start = function(workspaceId, options) {
				const id = mayRestore(options) ? candidate(workspaceId) : void 0;
				if (id) {
					navigation.openSession(id);
					return;
				}
				return originalStart.call(this, workspaceId, options);
			};
			const open = function(workspaceId, beforeOpen, options) {
				const id = beforeOpen === void 0 && mayRestore(options) ? candidate(workspaceId) : void 0;
				if (id) {
					navigation.openSession(id);
					return Promise.resolve();
				}
				return originalOpen.call(this, workspaceId, beforeOpen, options);
			};
			Object.defineProperty(navigation, "startSession", {
				configurable: true,
				writable: true,
				value: start
			});
			Object.defineProperty(navigation, "openWorkspace", {
				configurable: true,
				writable: true,
				value: open
			});
			remember();
			const stop = navigation.selection.subscribe(remember);
			return () => {
				stop();
				const restore = (name, wrapper, descriptor) => {
					if (Object.getOwnPropertyDescriptor(navigation, name)?.value !== wrapper) return;
					if (descriptor) Object.defineProperty(navigation, name, descriptor);
					else Reflect.deleteProperty(navigation, name);
				};
				restore("startSession", start, ownStart);
				restore("openWorkspace", open, ownOpen);
			};
		}
		//#endregion
		//#region src/client/conversation-card.ts
		const h$1 = react.default.createElement;
		/** Small conversation surface; the durable child owns context, tools and approvals. */
		const ConversationCard = react.default.memo(function ConversationCard({ ctx, run, tasks }) {
			const [text, setText] = react.default.useState(() => tasks.getDraft(run.id));
			const [error, setError] = react.default.useState("");
			const [acting, setActing] = react.default.useState(false);
			const [sending, setSending] = react.default.useState(false);
			const inFlight = react.default.useRef(false);
			const viewport = react.default.useRef(null);
			const follow = react.default.useRef(true);
			const messages = run.messages ?? [];
			react.default.useLayoutEffect(() => {
				if (viewport.current && follow.current) viewport.current.scrollTop = viewport.current.scrollHeight;
			}, [messages, run.status]);
			const control = async (action) => {
				setActing(true);
				setError("");
				try {
					await tasks.control(action, run.id);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setActing(false);
				}
			};
			const send = async () => {
				const value = text.trim();
				if (!value || inFlight.current || active(run.status)) return;
				inFlight.current = true;
				setSending(true);
				setError("");
				follow.current = true;
				try {
					await tasks.reply(run.id, value, tasks.replyRequestId(run.id, value));
					if (tasks.getDraft(run.id).trim() === value) tasks.setDraft(run.id, "");
					setText((current) => current.trim() === value ? "" : current);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					inFlight.current = false;
					setSending(false);
				}
			};
			return h$1("section", {
				className: "dqp-run-card dqp-conversation",
				"data-run-id": run.id,
				"data-run-status": run.status,
				"aria-label": `${run.name} 对话`
			}, h$1("div", { className: "dqp-run-actions" }, h$1("span", {
				className: "dqp-run-name",
				title: run.name
			}, run.name), h$1("span", {
				className: "dqp-conversation-state",
				role: "status"
			}, statusLabels[run.status]), h$1("button", {
				type: "button",
				title: "在完整对话中查看工具、审批与全部记录",
				"aria-label": `打开 ${run.name} 的完整对话`,
				onClick: () => openRun(ctx, run)
			}, "↗"), active(run.status) && h$1("button", {
				type: "button",
				disabled: acting || run.status === "stopping",
				onClick: () => {
					control("stop");
				}
			}, run.status === "stopping" ? "停止中" : "停止"), h$1("button", {
				type: "button",
				disabled: acting || sending,
				title: active(run.status) ? "停止并关闭对话" : "关闭对话卡片",
				"aria-label": `关闭对话 ${run.name}`,
				onClick: () => {
					control("close");
				}
			}, "×")), h$1("div", {
				ref: viewport,
				className: "dqp-conversation-messages",
				role: "log",
				"aria-label": `${run.name} 的对话`,
				"aria-live": "off",
				tabIndex: 0,
				onScroll: (event) => {
					const node = event.currentTarget;
					follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
				}
			}, ...messages.map((message) => h$1("div", {
				key: message.id,
				className: `dqp-message dqp-message-${message.role}`
			}, h$1("small", null, message.role === "user" ? "你" : "AI"), h$1("div", null, message.text))), !messages.some((message) => message.role === "assistant") && !active(run.status) && run.output && h$1("div", { className: "dqp-message dqp-message-assistant" }, h$1("small", null, "AI"), h$1("div", null, run.output)), active(run.status) && h$1("div", { className: "dqp-conversation-progress" }, run.status === "waiting" ? "需要审批或选择，请打开完整对话处理。" : run.status === "stopping" ? "正在停止…" : "AI 正在回复…")), (error || run.error) && h$1("p", {
				className: "dqp-run-error",
				role: "alert"
			}, error || run.error), h$1("form", {
				className: "dqp-conversation-input",
				onSubmit: (event) => {
					event.preventDefault();
					send();
				}
			}, h$1("textarea", {
				value: text,
				rows: 2,
				maxLength: 32e3,
				"aria-label": `给 ${run.name} 发送消息`,
				placeholder: active(run.status) ? "可以先写下下一条消息…" : "继续对话…",
				onChange: (event) => {
					setText(event.target.value);
					tasks.setDraft(run.id, event.target.value);
				},
				onKeyDown: (event) => {
					if (event.key === "Enter") event.stopPropagation();
					if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
						event.preventDefault();
						send();
					}
				}
			}), h$1("button", {
				type: "submit",
				disabled: !text.trim() || sending || active(run.status),
				"aria-label": `发送消息给 ${run.name}`
			}, sending ? "发送中" : "发送")));
		});
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"uiWorkspace",
			"sidebarRight",
			"webTerminals",
			"sessions",
			"workspaces"
		];
		const h = react.default.createElement;
		function apply(ctx) {
			const tasks = createTasks();
			ctx.effect(() => installDraftNavigation(ctx.get("uiWorkspace"), ctx.get("sessions"), ctx.get("workspaces"), localStorage));
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
				let timer;
				let stopped = false;
				const poll = () => {
					tasks.select(currentSessionId(ctx)).then(() => tasks.refresh()).catch(() => {});
				};
				const tick = () => {
					timer = void 0;
					if (stopped) return;
					if (!document.hidden) poll();
					const live = tasks.getSnapshot().runs.some((run) => active(run.status));
					timer = setTimeout(tick, document.hidden ? 5e3 : live ? 600 : 3e3);
				};
				const wake = () => {
					if (timer !== void 0) clearTimeout(timer);
					tick();
				};
				tick();
				window.addEventListener("focus", wake);
				document.addEventListener("visibilitychange", wake);
				const unsubscribe = tasks.subscribe(() => {
					if (timer !== void 0 && tasks.getSnapshot().runs.some((run) => active(run.status))) {
						clearTimeout(timer);
						timer = setTimeout(tick, 600);
					}
				});
				const unselect = ctx.get("uiWorkspace").selection.subscribe(poll);
				return () => {
					stopped = true;
					unselect();
					unsubscribe();
					if (timer !== void 0) clearTimeout(timer);
					window.removeEventListener("focus", wake);
					document.removeEventListener("visibilitychange", wake);
				};
			});
		}
		function QuickPrompts({ ctx, tasks, sessionId }) {
			const state = react.default.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot);
			const selected = state.sessionId === sessionId;
			const items = selected ? state.prompts : [];
			const [draft, setDraft] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const [saving, setSaving] = react.default.useState(false);
			const submitting = react.default.useRef(false);
			const nameInput = react.default.useRef(null);
			const trigger = react.default.useRef(null);
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
					await tasks.save(action, draft);
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
					const nodes = Array.from(event.currentTarget.querySelectorAll("input:not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(:disabled)"));
					const first = nodes[0], last = nodes[nodes.length - 1];
					if (event.shiftKey && document.activeElement === first) {
						event.preventDefault();
						last?.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first?.focus();
					}
				}
			}, h("h3", null, draft.id ? "编辑快捷任务" : "新增快捷任务"), h("small", null, "独立快捷对话 · 主对话继续运行"), h("label", null, "名称", h("input", {
				ref: nameInput,
				value: draft.name,
				maxLength: 100,
				disabled: saving,
				placeholder: "例如：检查代码",
				onChange: (event) => setDraft({
					...draft,
					name: event.target.value
				})
			}), h("small", null, "按钮最多显示 5 个字，悬停查看全名。")), h(TaskModelPicker, {
				key: `${sessionId}:${state.projectId}`,
				tasks,
				value: draft.model,
				disabled: saving,
				onChange: (model) => setDraft({
					...draft,
					model
				})
			}), h("label", null, "任务内容", h("textarea", {
				value: draft.text,
				maxLength: 32e3,
				disabled: saving,
				placeholder: "描述要在独立对话中执行的任务，也可以填写需要 AI 执行的命令…",
				onChange: (event) => setDraft({
					...draft,
					text: event.target.value
				})
			})), h("small", null, `使用当前项目目录：${state.cwd}。各任务独立运行，主对话可继续使用。`), error && h("p", { role: "alert" }, error), h("footer", null, draft.id && h("button", {
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
			const running = selected ? ongoingRuns(state.runs).filter((run) => active(run.status)).length : 0;
			const recoveryNotice = state.recovery?.state === "reserved" || state.recovery?.state === "failed" ? "上次任务的自动续接未能确认。请检查本对话记录后发送「继续」；系统不会自动重复提交。" : "";
			const notice = error || (selected ? state.error || state.syncError || recoveryNotice : "");
			return h(react.default.Fragment, null, h("div", {
				className: "dqp-bar",
				role: "group",
				"aria-label": "快捷任务"
			}, h("button", {
				type: "button",
				className: "dqp-terminal",
				"aria-label": "打开项目终端",
				"aria-pressed": state.terminalOpen,
				disabled: !selected || !sessionId,
				title: `${state.cwd || "当前项目"} 下打开终端小窗口`,
				onClick: () => tasks.showTerminal(!state.terminalOpen, state.projectId)
			}, h("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.8,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true
			}, h("path", { d: "M5 6l6 6-6 6M13 18h6" }))), h("button", {
				type: "button",
				className: "dqp-add",
				"aria-label": "新增快捷任务",
				disabled: saving || !selected || !state.ready,
				onClick: (event) => open(event)
			}, h("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.8,
				strokeLinecap: "round",
				"aria-hidden": true
			}, h("path", { d: "M12 4v16M4 12h16" }))), h("div", { className: "dqp-items" }, ...items.map((item) => h("span", {
				className: "dqp-task-chip",
				key: item.id
			}, h("button", {
				type: "button",
				disabled: !selected || !state.ready || !sessionId || tasks.busy(sessionId, item.id),
				title: `${item.name} · 独立快捷对话\n${item.model ? `${item.model.provider} / ${item.model.model}` : "跟随当前会话模型"}\n点击执行 · 右键编辑`,
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
			}, h("path", { d: "M15 5l4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" })))))), selected && state.legacyAvailable && h("button", {
				type: "button",
				title: "将旧版全局指令归入当前项目，仅可导入一次",
				onClick: () => {
					tasks.save("import").catch((error) => setError(String(error.message)));
				}
			}, "导入旧指令"), selected && ongoingRuns(state.runs).length > 0 && h("button", {
				type: "button",
				className: "dqp-panel-trigger",
				"aria-expanded": state.open,
				title: state.open ? "收起快捷对话" : "显示快捷对话",
				onClick: () => tasks.show(!state.open)
			}, `快捷对话 ${ongoingRuns(state.runs).length}${running ? ` · ${running} 运行中` : ""}`)), notice && !draft && h("div", {
				className: "dqp-notice",
				role: "alert",
				title: notice
			}, notice), modal);
		}
		function TaskPanel({ ctx, tasks }) {
			const state = react.default.useSyncExternalStore(tasks.subscribe, tasks.getSnapshot);
			const [seat, setSeat] = react.default.useState(null);
			react.default.useLayoutEffect(() => installTaskDock(document.body, setSeat), []);
			const projects = [.../* @__PURE__ */ new Set([state.projectId, ...state.terminalCards.map((card) => card.projectId)])].filter(Boolean);
			if (!seat) return null;
			return (0, react_dom.createPortal)(h(react.default.Fragment, null, ...projects.map((projectId) => {
				const selected = state.ready && state.projectId === projectId;
				const runs = selected ? ongoingRuns(state.runs).filter((run) => run.projectId === projectId) : [];
				const terminal = state.terminalCards.find((card) => card.projectId === projectId);
				const visible = selected && state.open && (!!runs.length || !!terminal);
				return h("aside", {
					key: projectId,
					className: "dqp-dock",
					hidden: !visible,
					"data-dqp-project": projectId,
					"aria-label": "快捷对话"
				}, h("div", {
					className: "dqp-dock-body",
					role: "region",
					"aria-label": "快捷对话卡片",
					tabIndex: 0
				}, terminal && h(TerminalCard, {
					ctx,
					key: `terminal:${projectId}`,
					sessionId: terminal.sessionId,
					active: visible,
					sourceSelected: state.sessionId === terminal.sessionId,
					onClose: () => tasks.showTerminal(false, projectId)
				}), ...runs.map((run) => h(ConversationCard, {
					key: run.id,
					ctx,
					run,
					tasks
				}))));
			})), seat);
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