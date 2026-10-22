window.__ModuleLoader__.load({
	id: "dsh-file-preview",
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
		//#region src/client/selection-menu.ts
		function fileReference(path, lines) {
			if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) throw new Error("文件路径包含不支持的字符。");
			const mention = /\s/u.test(path) ? `@"${path}"` : `@${path}`;
			const location = lines ? `:${lines.start}${lines.end === lines.start ? "" : `-${lines.end}`}` : "";
			return {
				source: "reference",
				ref: mention,
				clipboardText: mention,
				appearance: "file",
				label: `${path.split("/").pop()}${location} · ${path}`
			};
		}
		/** Only use line offsets from the official code element, never rendered Markdown. */
		function selectedCode(preview) {
			const selection = window.getSelection();
			const body = preview.querySelector("[data-textpreview-body]");
			if (!body || !selection || selection.isCollapsed || !selection.rangeCount || !selection.toString().trim()) return { code: false };
			const range = selection.getRangeAt(0);
			if (!body.contains(range.startContainer) || !body.contains(range.endContainer)) return { code: false };
			const code = body.querySelector("pre code");
			if (!code?.contains(range.startContainer) || !code.contains(range.endContainer)) return { code: true };
			const prefix = document.createRange();
			prefix.selectNodeContents(code);
			prefix.setEnd(range.startContainer, range.startOffset);
			const start = prefix.toString().split("\n").length;
			prefix.setEnd(range.endContainer, range.endOffset);
			const beforeEnd = prefix.toString();
			return {
				code: true,
				lines: {
					start,
					end: Math.max(start, beforeEnd.split("\n").length - (beforeEnd.endsWith("\n") ? 1 : 0))
				}
			};
		}
		function SelectionMenu({ ctx, sessionId }) {
			const [selection, setSelection] = react.default.useState(null);
			const [error, setError] = react.default.useState("");
			const menuRef = react.default.useRef(null);
			react.default.useEffect(() => {
				const close = () => setSelection(null);
				const onPointer = (event) => {
					if (!menuRef.current?.contains(event.target)) close();
				};
				const onKey = (event) => {
					if (event.key === "Escape") close();
				};
				const onContext = (event) => {
					const preview = (event.target instanceof Element ? event.target : null)?.closest("[data-dfp-preview] [data-textpreview-state]");
					const path = preview?.querySelector("[data-textpreview-path]")?.getAttribute("title");
					if (!path || !preview) {
						close();
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					setError("");
					setSelection({
						path,
						...selectedCode(preview),
						x: event.clientX,
						y: event.clientY
					});
				};
				document.addEventListener("contextmenu", onContext, true);
				document.addEventListener("pointerdown", onPointer, true);
				document.addEventListener("keydown", onKey);
				window.addEventListener("resize", close);
				window.addEventListener("scroll", close, true);
				return () => {
					document.removeEventListener("contextmenu", onContext, true);
					document.removeEventListener("pointerdown", onPointer, true);
					document.removeEventListener("keydown", onKey);
					window.removeEventListener("resize", close);
					window.removeEventListener("scroll", close, true);
				};
			}, []);
			react.default.useLayoutEffect(() => {
				const menu = menuRef.current;
				if (!selection || !menu) return;
				const rect = menu.getBoundingClientRect();
				menu.style.left = `${Math.max(8, Math.min(selection.x, window.innerWidth - rect.width - 8))}px`;
				menu.style.top = `${Math.max(8, Math.min(selection.y, window.innerHeight - rect.height - 8))}px`;
				menu.querySelector("button")?.focus({ preventScroll: true });
			}, [selection, error]);
			const add = () => {
				if (!selection) return;
				try {
					const sessions = ctx.get("sessions");
					const navigation = ctx.get("uiWorkspace");
					if (!sessionId || navigation.selection.getSnapshot().sessionId !== sessionId) throw new Error("会话已切换，请重新打开文件菜单。");
					const scope = sessions.scope(sessionId);
					if (!scope) throw new Error("当前会话输入框不可用。");
					const input = scope.get("conversation").input.for(scope);
					const state = input.state.getSnapshot();
					if (state.phase !== "plain") throw new Error("输入框正在处理操作，请稍后再加入。");
					const end = state.draft.length - state.occurrences.reduce((total, ref) => total + ref.length - 1, 0);
					const events = scope;
					if (events.bail(scope, "slash/input-insert-reference", {
						reference: fileReference(selection.path, selection.lines),
						span: {
							start: end,
							end,
							draftRev: state.draftRev
						}
					}) !== true) throw new Error("输入内容已变化，请重试。");
					if (selection.lines) {
						const next = input.state.getSnapshot();
						const tail = next.draft.length - next.occurrences.reduce((total, ref) => total + ref.length - 1, 0);
						const { start, end } = selection.lines;
						if (events.bail(scope, "slash/input-insert-text", {
							text: ` （第 ${start}${end === start ? "" : `–${end}`} 行） `,
							span: {
								start: tail,
								end: tail,
								draftRev: next.draftRev
							}
						}) !== true) throw new Error("文件已加入，但行号插入失败，请补充选区行号。");
					}
					setSelection(null);
					document.querySelector("[data-input-scroll] [contenteditable=\"true\"], [data-composer-seat] textarea")?.focus();
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				}
			};
			if (!selection) return null;
			return (0, react_dom.createPortal)(react.default.createElement("div", {
				ref: menuRef,
				className: "dfp-selection-menu",
				role: "menu",
				"aria-label": "文件操作",
				style: {
					left: selection.x,
					top: selection.y
				}
			}, react.default.createElement("button", {
				type: "button",
				role: "menuitem",
				onClick: add
			}, react.default.createElement("span", {
				className: "dfp-menu-icon",
				"aria-hidden": true
			}, react.default.createElement("svg", {
				width: 18,
				height: 18,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.6,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}, react.default.createElement("path", { d: selection.code ? "m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16" : "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zm0 0v5h5M8 13h8M8 17h5" }))), react.default.createElement("span", { className: "dfp-menu-copy" }, react.default.createElement("span", { className: "dfp-menu-label" }, selection.code ? "将代码插入 Chat" : "将文件插入 Chat"), react.default.createElement("span", {
				className: "dfp-menu-description",
				title: selection.path
			}, `${selection.path.split("/").pop()}${selection.lines ? ` · 第 ${selection.lines.start}${selection.lines.end === selection.lines.start ? "" : `–${selection.lines.end}`} 行` : ""}`))), error ? react.default.createElement("p", { role: "alert" }, error) : null), document.body);
		}
		//#endregion
		//#region src/client/tab-host.ts
		function useWorkspaceToolHost() {
			const nodeRef = react.default.useRef(null);
			const [host, setHost] = react.default.useState(null);
			const anchorRef = react.default.useCallback((el) => {
				nodeRef.current = el;
			}, []);
			react.default.useLayoutEffect(() => {
				const header = nodeRef.current?.closest("header");
				if (!header) return;
				const read = () => {
					const tabs = header.querySelector("[role=\"tablist\"]");
					if (!tabs) {
						setHost(null);
						return;
					}
					const items = tabs.querySelectorAll("[role=\"tab\"]");
					for (let i = 0; i < items.length; i++) {
						const tab = items[i];
						const label = tab?.textContent?.trim() ?? "";
						const kind = /^(对话|Chat)$/.test(label) ? "chat" : /^(文件|Files)$/.test(label) ? "files" : /^(Changes|变更)/.test(label) ? "changes" : /^(轨迹|Trace|Trajectory)$/.test(label) ? "trace" : /^(终端|Terminal|运行|Run)$/.test(label) ? "run" : "other";
						if (tab?.getAttribute("data-dsh-nav") !== kind) tab?.setAttribute("data-dsh-nav", kind);
					}
					let bar = tabs.querySelector("[data-dsh-workspace-tools]");
					if (!bar) {
						bar = document.createElement("span");
						bar.setAttribute("data-dsh-workspace-tools", "");
						bar.setAttribute("class", "dsh-ws-tools");
						tabs.appendChild(bar);
					}
					setHost(bar);
				};
				read();
				let frame = 0;
				const observer = new MutationObserver((records) => {
					if (frame) return;
					const bar = header.querySelector("[data-dsh-workspace-tools]");
					if (bar && records.every((record) => bar.contains(record.target))) return;
					frame = requestAnimationFrame(() => {
						frame = 0;
						read();
					});
				});
				observer.observe(header, {
					childList: true,
					subtree: true
				});
				return () => {
					observer.disconnect();
					if (frame) cancelAnimationFrame(frame);
				};
			}, []);
			return {
				anchorRef,
				host
			};
		}
		function renderOnTabRow(host, node, fallback) {
			if (!host) return fallback;
			return (0, react_dom.createPortal)(node, host);
		}
		//#endregion
		//#region ../dsh-terminal/src/client/official-terminal.ts
		/** Use the same target resolution and launch path as DSH's terminal shortcut. */
		function openOfficialTerminal(sidebar, element) {
			const target = sidebar.commandTarget(element);
			if (target) sidebar.openTabFromTarget("terminal", target);
			else sidebar.openTab("terminal");
			const tab = sidebar.active();
			if (!tab || tab.kind !== "terminal") throw new Error("官方终端尚未就绪，请稍后重试。");
			return tab;
		}
		//#endregion
		//#region src/client/files-workspace.ts
		/** File tree share of the Files tab; DockKit refuses panes under 20%. */
		const TREE_FRACTION = .22;
		/** Official components stay in their React-owned dock; only their viewport changes. */
		function installFilesWorkspace(sidebar, layout, currentSession) {
			const originalOpen = sidebar.openResource;
			const originalOpenIn = sidebar.openResourceIn;
			const originalPresentation = layout.openRightbar;
			let leave;
			let active;
			const wrappedOpen = (address, options) => {
				if (active && currentSession() === active.session && address.startsWith("dsh-resource://file/")) active.route(address, options);
				else originalOpen.call(sidebar, address, options);
			};
			const wrappedOpenIn = (session, address, options) => {
				if (active?.session === session && currentSession() === session && address.startsWith("dsh-resource://file/")) active.route(address, options);
				else originalOpenIn.call(sidebar, session, address, options);
			};
			sidebar.openResource = wrappedOpen;
			sidebar.openResourceIn = wrappedOpenIn;
			return {
				mount(host, session = currentSession()) {
					leave?.();
					if (!session) return () => {};
					const wasExpanded = sidebar.isExpanded();
					const previousTab = sidebar.active()?.id;
					let presentation = [true, false];
					let stopped = false;
					let pending;
					let splitPending = false;
					let openedTabId;
					let timer;
					let frame;
					let ready = false;
					let selectedPath;
					const composer = host.closest("[data-conversation-scroll]")?.querySelector("[data-composer-seat]");
					const marked = /* @__PURE__ */ new Set();
					const panel = () => document.querySelector("[data-sidebar-right-panel]");
					const mark = (el, name, value = "") => {
						if (el.getAttribute(name) !== value) el.setAttribute(name, value);
						marked.add(el);
					};
					const presentationOverride = (track, fullscreen) => {
						presentation = [track, fullscreen];
						layout.closeRightbar();
					};
					layout.openRightbar = presentationOverride;
					layout.closeRightbar();
					const sync = () => {
						if (stopped || currentSession() !== session) return;
						const dock = panel();
						if (!dock) return;
						const rect = host.getBoundingClientRect();
						mark(dock, "data-dfp-embedded");
						const composerRect = (composer?.querySelector("[data-composer-card]") ?? composer)?.getBoundingClientRect();
						const bottom = composerRect && composerRect.height > 0 ? Math.min(rect.top + rect.height, composerRect.top - 8) : rect.top + rect.height;
						const values = {
							left: rect.left,
							top: rect.top,
							width: rect.width,
							height: Math.max(0, bottom - rect.top)
						};
						for (const [key, value] of Object.entries(values)) {
							const property = `--dfp-${key}`;
							if (dock.style.getPropertyValue(property) !== `${value}px`) dock.style.setProperty(property, `${value}px`);
						}
						const panes = Array.from(dock.querySelectorAll("[data-dockkit-pane]"));
						const tree = panes[0];
						if (!tree) return;
						mark(tree, "data-dfp-tree");
						if (openedFilesTab && !openedTabId) {
							const tab = tree.querySelector("[data-dockkit-tab][aria-selected=\"true\"]")?.dataset.dockkitTab;
							if (tab) openedTabId = tab;
						}
						const preview = panes[1];
						if (!preview) {
							if (!splitPending) splitPending = !!sidebar.split(tree.dataset.dockkitPane);
							return;
						}
						splitPending = false;
						narrowTree(tree);
						ready = true;
						clearTimeout(timer);
						mark(preview, "data-dfp-preview");
						const seed = !!preview.querySelector("[data-files-state], [data-sidebar-right-guide-entry]");
						mark(preview, "data-dfp-empty", String(seed));
						if (pending) {
							const request = pending;
							pending = void 0;
							const tab = preview.querySelector("[data-dockkit-tab][aria-selected=\"true\"]")?.dataset.dockkitTab;
							originalOpenIn.call(sidebar, session, request.address, {
								...request.options,
								paneId: preview.dataset.dockkitPane,
								replaceTab: tab,
								revealIfOpened: false
							});
						}
						for (const row of tree.querySelectorAll("[data-files-entry=\"file\"]")) {
							const button = row.querySelector("button");
							if (button) {
								const selected = String(row.dataset.filesPath === selectedPath);
								if (button.getAttribute("aria-current") !== selected) button.setAttribute("aria-current", selected);
							}
						}
					};
					let narrowed = false;
					const narrowTree = (tree) => {
						if (narrowed) return;
						const layoutState = sidebar.mountedSurface?.()?.layout;
						const root = layoutState?.nodes[layoutState.rootId];
						if (!root || root.kind !== "split" || root.children?.length !== 2 || !root.sizes) return;
						const target = root.children[0] === tree.dataset.dockkitPane ? [TREE_FRACTION, .78] : [.78, TREE_FRACTION];
						narrowed = true;
						if (root.sizes.every((size, index) => Math.abs(size - target[index]) < .005)) return;
						try {
							sidebar.actionsFor?.(session)?.resizeSplit?.(session, layoutState.rootId, target);
						} catch (error) {
							console.warn("dsh-file-preview: could not narrow the file tree", error);
						}
					};
					active = {
						session,
						route(address, options) {
							pending = {
								address,
								options
							};
							const prefix = `dsh-resource://file/session/${encodeURIComponent(session)}`;
							try {
								const path = decodeURIComponent(new URL(address).pathname.slice(new URL(prefix).pathname.length + 1));
								const root = panel()?.querySelector("[data-files-root]")?.dataset.filesRoot;
								selectedPath = path.startsWith("/") ? path : root ? `${root.replace(/\/$/, "")}/${path}` : void 0;
							} catch {
								selectedPath = void 0;
							}
							sync();
						}
					};
					let openedFilesTab = false;
					const firstPane = panel()?.querySelector("[data-dockkit-pane]");
					if (firstPane?.querySelector("[data-files-state]")) {
						if (!sidebar.isExpanded()) sidebar.toggleExpanded();
					} else {
						openedFilesTab = true;
						sidebar.openTabIn(session, "files", {
							paneId: firstPane?.dataset.dockkitPane,
							revealIfOpened: false
						});
					}
					const schedule = () => {
						if (stopped || frame !== void 0) return;
						frame = requestAnimationFrame(() => {
							frame = void 0;
							sync();
						});
					};
					const onScroll = (event) => {
						const target = event.target;
						if (target === document || target instanceof Element && target.contains(host)) schedule();
					};
					const resize = new ResizeObserver(schedule);
					resize.observe(host);
					if (composer) resize.observe(composer);
					const observer = new MutationObserver(schedule);
					const dock = panel();
					if (dock) observer.observe(dock, {
						childList: true,
						subtree: true
					});
					window.addEventListener("resize", schedule);
					window.addEventListener("scroll", onScroll, true);
					let attempts = 0;
					const retry = () => {
						sync();
						if (!stopped && !ready && ++attempts < 20) timer = setTimeout(retry, 80);
					};
					retry();
					const cleanup = (restorePrevious = false) => {
						if (stopped) return;
						stopped = true;
						active = void 0;
						clearTimeout(timer);
						resize.disconnect();
						observer.disconnect();
						if (frame !== void 0) cancelAnimationFrame(frame);
						window.removeEventListener("resize", schedule);
						window.removeEventListener("scroll", onScroll, true);
						for (const el of marked) {
							for (const attr of [
								"data-dfp-embedded",
								"data-dfp-tree",
								"data-dfp-preview",
								"data-dfp-empty"
							]) el.removeAttribute(attr);
							for (const key of [
								"left",
								"top",
								"width",
								"height"
							]) el.style.removeProperty(`--dfp-${key}`);
						}
						if (layout.openRightbar === presentationOverride) layout.openRightbar = originalPresentation;
						if (openedFilesTab && openedTabId) try {
							sidebar.closeIn(session, openedTabId);
						} catch {}
						if (currentSession() === session) {
							if (restorePrevious) {
								if (previousTab) sidebar.focus(previousTab);
								if (sidebar.isExpanded() !== wasExpanded) sidebar.toggleExpanded();
								if (wasExpanded) originalPresentation.call(layout, ...presentation);
								else layout.closeRightbar();
							} else {
								if (sidebar.isExpanded()) sidebar.toggleExpanded();
								layout.closeRightbar();
							}
						}
						if (leave === cleanup) leave = void 0;
					};
					leave = cleanup;
					return cleanup;
				},
				dispose() {
					leave?.(true);
					if (sidebar.openResource === wrappedOpen) sidebar.openResource = originalOpen;
					if (sidebar.openResourceIn === wrappedOpenIn) sidebar.openResourceIn = originalOpenIn;
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"sidebarRight",
			"layout",
			"sessions",
			"uiWorkspace"
		];
		/** One lightweight probe per distinct project path; results cache across tab switches. */
		const gitPaths = /* @__PURE__ */ new Map();
		async function probeGit(sessionId, cwd) {
			if (!cwd) return false;
			if (gitPaths.has(cwd)) return gitPaths.get(cwd);
			gitPaths.set(cwd, false);
			try {
				const res = await fetch("/dsh-file-preview", {
					method: "POST",
					credentials: "include",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						sessionId,
						cwd
					})
				});
				const value = await res.json();
				if (res.ok && typeof value.git === "boolean") {
					gitPaths.set(cwd, value.git);
					return value.git;
				}
			} catch {}
			return false;
		}
		function useWorkspacePath(ctx, sessionId) {
			const sessions = ctx.get("sessions");
			const navigation = ctx.get("uiWorkspace");
			const snapshot = react.default.useSyncExternalStore(sessions.list.subscribe, sessions.list.getSnapshot);
			const selection = react.default.useSyncExternalStore(navigation.selection.subscribe, navigation.selection.getSnapshot);
			const id = sessionId || selection.sessionId;
			return (id ? snapshot.byId[id]?.cwd : void 0) ?? "";
		}
		function useIsGit(ctx, sessionId, name) {
			const [git, setGit] = react.default.useState(() => gitPaths.get(name) ?? false);
			react.default.useEffect(() => {
				let live = true;
				probeGit(sessionId, name).then((value) => {
					if (live) setGit(value);
				});
				return () => {
					live = false;
				};
			}, [sessionId, name]);
			return git;
		}
		function apply(ctx) {
			const slots = ctx.get("slots");
			injectStyles();
			const workspace = installFilesWorkspace(ctx.get("sidebarRight"), ctx.get("layout"), () => {
				return ctx.get("uiWorkspace").selection.getSnapshot().sessionId;
			});
			ctx.effect(() => () => workspace.dispose());
			slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "dsh-files",
				order: 21,
				label: "文件"
			}, (props) => react.default.createElement(FilesView, {
				ctx,
				sessionId: props.sessionId,
				workspace
			})));
			slots.inject("conversation.session.header.actions", () => slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-file-preview",
				order: 0,
				label: "文件"
			}, (props) => react.default.createElement(FilesAction, {
				ctx,
				sessionId: props.sessionId
			})));
		}
		function FilesAction(props) {
			const { anchorRef, host } = useWorkspaceToolHost();
			const name = useWorkspacePath(props.ctx, props.sessionId);
			const [copyState, setCopyState] = react.default.useState("idle");
			const copyEpoch = react.default.useRef(0);
			react.default.useEffect(() => {
				copyEpoch.current++;
				setCopyState("idle");
				return () => {
					copyEpoch.current++;
				};
			}, [name]);
			react.default.useEffect(() => {
				if (copyState === "idle") return;
				const timer = setTimeout(() => setCopyState("idle"), 2500);
				return () => clearTimeout(timer);
			}, [copyState]);
			const copy = async () => {
				const epoch = ++copyEpoch.current;
				try {
					await navigator.clipboard.writeText(name);
					if (copyEpoch.current === epoch) setCopyState("copied");
				} catch {
					if (copyEpoch.current === epoch) setCopyState("failed");
				}
			};
			const copyByKey = (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					copy();
				}
			};
			const isGit = useIsGit(props.ctx, props.sessionId, name);
			const openTerminal = (event) => {
				try {
					openOfficialTerminal(props.ctx.get("sidebarRight"), event.currentTarget);
				} catch (error) {
					console.warn("dsh-file-preview: could not open the official terminal", error);
				}
			};
			const chip = !name ? react.default.createElement(react.default.Fragment) : react.default.createElement("span", {
				className: "dfp-chip dfp-path-chip",
				"data-dfp-git": isGit || void 0,
				title: name
			}, isGit ? react.default.createElement("svg", {
				width: 12,
				height: 12,
				viewBox: "0 0 16 16",
				fill: "currentColor",
				"aria-hidden": true
			}, react.default.createElement("path", { d: "M5 3a2 2 0 1 1-2.6 1.9L1.6 5.8a1.2 1.2 0 1 0 .3 2.2l1.8-.6a2 2 0 1 0 2.2-3.2A2 2 0 0 1 5 3zm6 6.5a2 2 0 1 1-2.6 1.9c-.6.3-1.6.9-2.3 1.3a1.2 1.2 0 1 0 1.1 2.1l3.8-2.1v-3.2zm0-6.4a2 2 0 1 0 0 3.8v1.9L7.3 11a1.2 1.2 0 0 0 1.2 2.1l3.5-2v-4.9a2 2 0 0 0 0-3.2zM11 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM4 4a1 1 0 1 0 0 0zm0 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" })) : null, react.default.createElement("span", { className: "dfp-chip-label dfp-path-label" }, name), react.default.createElement("button", {
				type: "button",
				className: "dfp-copy-path",
				onClick: () => {
					copy();
				},
				onKeyDown: copyByKey,
				"aria-label": copyState === "copied" ? "路径已复制" : "复制项目路径",
				title: copyState === "failed" ? "复制失败，请选中路径文字手动复制" : copyState === "copied" ? "已复制" : "复制完整项目路径"
			}, react.default.createElement("svg", {
				width: 13,
				height: 13,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": true
			}, react.default.createElement("path", { d: copyState === "copied" ? "M3 8l3 3 7-7" : "M5 5h8v9H5zM3 11H2V2h8v1" }))), react.default.createElement("span", {
				className: "dfp-copy-feedback",
				role: "status",
				"aria-live": "polite"
			}, copyState === "copied" ? "已复制完整路径" : copyState === "failed" ? "复制失败，请选中路径手动复制" : ""));
			const terminal = react.default.createElement("button", {
				type: "button",
				className: "dfp-chip dfp-open-terminal",
				onClick: openTerminal,
				"aria-label": "打开终端",
				title: "在右侧栏打开内置终端"
			}, react.default.createElement("svg", {
				width: 12,
				height: 12,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": 1.6,
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
				"aria-hidden": true
			}, react.default.createElement("path", { d: "M3 4l3.5 4L3 12M8 12h5" })));
			return react.default.createElement(react.default.Fragment, null, react.default.createElement("span", {
				ref: anchorRef,
				className: "dfp-anchor"
			}), renderOnTabRow(host, react.default.createElement(react.default.Fragment, null, chip, terminal), chip));
		}
		function FilesView({ ctx, sessionId, workspace }) {
			const ref = react.default.useRef(null);
			react.default.useEffect(() => {
				let cleanup;
				let timer;
				const frame = requestAnimationFrame(() => {
					timer = setTimeout(() => {
						if (ref.current) cleanup = workspace.mount(ref.current, sessionId);
					}, 0);
				});
				return () => {
					cancelAnimationFrame(frame);
					clearTimeout(timer);
					cleanup?.();
				};
			}, [workspace, sessionId]);
			return react.default.createElement("div", {
				className: "dfp-view",
				"data-conversation-composer-overlay": ""
			}, react.default.createElement("div", {
				className: "dfp-viewport",
				ref
			}, "正在打开文件…"), react.default.createElement(SelectionMenu, {
				ctx,
				sessionId
			}));
		}
		let stylesInjected = false;
		function injectStyles() {
			if (stylesInjected || typeof document === "undefined") return;
			stylesInjected = true;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-file-preview";
			tag.textContent = `
.dfp-view { height:100%; flex:1; min-height:0; box-sizing:border-box; }
.dfp-viewport { height:100%; min-height:0; color:var(--dsw-alias-label-tertiary); }
[data-dfp-embedded] { position:fixed !important; inset:auto !important; left:var(--dfp-left) !important; top:var(--dfp-top) !important; width:var(--dfp-width) !important; height:var(--dfp-height) !important; z-index:10 !important; transform:none !important; transition:none !important; border:0 !important; overflow:hidden; }
[data-dfp-embedded] [data-sidebar-right-mode], [data-dfp-embedded] [data-sidebar-right-toggle] { display:none !important; }
/* Current DockKit positions panes directly; the older cell-only flex rule
   does not constrain these panes and leaves a 50/50 split. */
[data-dfp-embedded] { --dfp-tree-width:22%; }
[data-dfp-embedded] [data-dfp-tree] { left:0 !important; width:var(--dfp-tree-width) !important; min-width:0 !important; box-sizing:border-box; }
[data-dfp-embedded] [data-dfp-preview] { left:var(--dfp-tree-width) !important; width:calc(100% - var(--dfp-tree-width)) !important; min-width:0 !important; box-sizing:border-box; }
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-tree]) { flex:0 0 var(--dfp-tree-width) !important; }
[data-dfp-embedded] [data-dockkit-cell]:has(> [data-dfp-preview]) { flex:1 1 0 !important; }
[data-dfp-embedded] [data-dockkit-cell] > :is([data-dfp-tree],[data-dfp-preview]) { left:0 !important; width:100% !important; }
[data-dfp-embedded] [data-dockkit-divider] { display:none !important; }
[data-dfp-tree] { background:color-mix(in srgb, var(--dsw-alias-bg-base) 94%, var(--dsw-alias-label-primary) 6%); }
[data-dfp-tree] [data-files-state] { background:inherit; }
[data-dfp-preview] { background:var(--dsw-alias-bg-base); }
[data-dfp-tree] [data-dockkit-strip] { display:none; }
[data-dfp-preview][data-dfp-empty="true"] { position:relative; }
[data-dfp-preview][data-dfp-empty="true"] > * { visibility:hidden; }
[data-dfp-preview][data-dfp-empty="true"]::after { content:'选择左侧文件以预览'; position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; color:var(--dsw-alias-label-tertiary); font-size:13px; }
[data-dfp-tree] [data-files-entry] > button { border-radius:6px; transition:background-color 120ms; }
[data-dfp-tree] [data-files-entry] > button:hover { background:var(--dsw-alias-interactive-bg-hover); }
[data-dfp-tree] [data-files-entry] > button[aria-current="true"] { background:var(--dsw-specific-sidebar-nav-item-active-accent); box-shadow:inset 3px 0 var(--dsw-alias-state-business-primary); font-weight:600; }
[data-dfp-tree] [data-files-entry] > button:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dfp-selection-menu { position:fixed; z-index:10000; width:248px; max-width:calc(100vw - 16px); box-sizing:border-box; padding:5px; border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-layer-3); box-shadow:0 6px 24px rgb(0 0 0 / .12); }
.dfp-selection-menu button { display:flex; align-items:center; gap:10px; width:100%; box-sizing:border-box; padding:10px; border:0; border-radius:8px; background:none; color:var(--dsw-alias-label-primary); text-align:left; font:inherit; font-size:13px; cursor:pointer; }
.dfp-selection-menu button:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dfp-selection-menu button:focus-visible { background:var(--dsw-alias-interactive-bg-hover); outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dfp-menu-icon { display:grid; place-items:center; width:32px; height:32px; flex:none; border-radius:8px; color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dfp-menu-copy { display:flex; flex-direction:column; gap:4px; min-width:0; }
.dfp-menu-label { font-weight:500; }
.dfp-menu-description { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dfp-selection-menu p { padding:6px 10px; margin:0; font-size:12px; color:var(--dsw-alias-state-error-primary); }
.dfp-anchor { display:none; }

header [role="tablist"] { flex-wrap:nowrap !important; align-items:center; gap:0; padding:0 8px 8px; }
header [role="tablist"] > [role="tab"] { isolation:isolate; position:relative; display:inline-flex; align-items:center; justify-content:center; gap:5px; flex:none; box-sizing:border-box; height:34px; padding:0 14px; border:0; border-radius:0; white-space:nowrap; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-interactive-bg-hover); font-size:13px; font-weight:500; line-height:26px; }
header [role="tablist"] > [role="tab"]::after { display:none; }
header [role="tablist"] > [role="tab"]::before { content:''; position:absolute; inset:4px; border-radius:999px; z-index:-1; }
header [role="tablist"] > [role="tab"]:hover { color:var(--dsw-alias-label-primary); }
header [role="tablist"] > [role="tab"]:hover::before { background:var(--dsw-alias-bg-layer-2); }
header [role="tablist"] > [role="tab"][aria-selected="true"] { color:var(--dsw-alias-label-primary); font-weight:600; }
header [role="tablist"] > [role="tab"][aria-selected="true"]::before { background:var(--dsw-alias-bg-base); box-shadow:0 1px 4px rgb(0 0 0 / .14); }
header [role="tablist"] > [role="tab"]:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
header [role="tablist"] > [role="tab"][data-dsh-nav="chat"] { order:0; border-radius:999px 0 0 999px; }
header [role="tablist"] > [role="tab"][data-dsh-nav="files"] { order:1; }
header [role="tablist"] > [role="tab"][data-dsh-nav="changes"] { order:2; }
header [role="tablist"] > [role="tab"][data-dsh-nav="trace"] { order:3; border-radius:0 999px 999px 0; }
header [role="tablist"] > [role="tab"][data-dsh-nav="other"] { order:4; }
.dsh-ws-tools { display:inline-flex; align-items:center; order:100; gap:6px; min-width:0; max-width:calc(100% - 350px); margin:0 0 0 auto; padding-left:16px; flex:0 1 auto; flex-wrap:nowrap; }
.dgp-tab-counts { display:inline-flex; gap:3px; font-size:10px; font-weight:400; }
.dfp-path-chip { order:0; max-width:320px !important; }
.dfp-open-terminal { order:0; width:28px; padding:0; justify-content:center; }
.dfp-open-terminal:hover { color:var(--dsw-alias-label-primary); border-color:var(--dsw-alias-border-l2); }
.dgp-toolbar { order:1; }
.dfp-chip { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; display:inline-flex; align-items:center; gap:5px; height:28px; box-sizing:border-box; max-width:160px; min-width:0; padding:0 8px; border-radius:8px; font-size:12px; line-height:1; white-space:nowrap; cursor:pointer; }
.dfp-chip svg { flex:none; }
.dfp-chip.dfp-path-chip { border:0; background:transparent; padding:2px 4px; cursor:copy; position:relative; }
.dfp-chip.dfp-path-chip:hover { background:var(--dsw-alias-interactive-bg-hover); border-radius:6px; }
.dfp-chip.dfp-path-chip:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
.dfp-path-label { user-select:text; cursor:text; }
.dfp-path-chip[data-dfp-git] { color:var(--dsw-alias-label-secondary); }
.dfp-path-chip[data-dfp-git] svg { color:#e8a97a; }
.dfp-copy-path { position:relative; display:inline-flex; align-items:center; justify-content:center; flex:none; width:24px; height:24px; margin:2px 0 2px 2px; border:0; border-radius:4px; background:transparent; color:inherit; cursor:pointer; }
.dfp-copy-path::before { content:''; position:absolute; inset:-6px; }
.dfp-copy-path:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); }
.dfp-copy-path:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
.dfp-copy-feedback { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; }
.dfp-chip-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.dfp-chip[aria-pressed="true"] { color:var(--dsw-alias-state-business-primary); border-color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dfp-chip:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
`;
			document.head.appendChild(tag);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map