window.__ModuleLoader__.load({
	id: "dsh-version-update",
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
		//#region src/client/blank-session-nav.ts
		function hideBlankNavigation(list) {
			return list.current !== void 0 && list.byId[list.current]?.blank === true;
		}
		/** Keep official session ownership intact; suppress only its provisional row. */
		function installBlankSessionNavigation(ctx) {
			const sessions = ctx.get("sessions");
			if (!sessions) throw new Error("Blank session navigation requires the sessions service");
			const attribute = "data-dsh-hide-blank-navigation";
			const style = document.createElement("style");
			style.textContent = `html[${attribute}] [role="tree"] [role="treeitem"][aria-selected="true"][class*="_sessionRow"] { display:none !important; }`;
			document.head.appendChild(style);
			const sync = () => {
				const hide = hideBlankNavigation(sessions.list.getSnapshot());
				if (document.documentElement.hasAttribute(attribute) !== hide) document.documentElement.toggleAttribute(attribute, hide);
				document.dispatchEvent(new CustomEvent("dsh-performance", { detail: {
					kind: "blank-navigation",
					duration: hide ? 1 : 0
				} }));
			};
			sync();
			const unsubscribe = sessions.list.subscribe(sync);
			return () => {
				unsubscribe();
				style.remove();
				document.documentElement.removeAttribute(attribute);
			};
		}
		//#endregion
		//#region src/client/performance.ts
		/** Temporary opt-out recorder. No payloads, URLs with tokens, or DOM text. */
		function installPerformanceRecorder() {
			const originalFetch = window.fetch;
			const run = crypto.randomUUID();
			let enabled = true, disposed = false, started = performance.now(), last = started, switchId = 0;
			let events = [];
			let flushing = false, failed = false;
			const counts = /* @__PURE__ */ new Map();
			const add = (kind, data = {}) => {
				if (enabled && events.length < 200) events.push({
					kind,
					run,
					t: Math.round(performance.now()),
					switchId,
					...data
				});
			};
			const button = document.createElement("button");
			Object.assign(button.style, {
				position: "fixed",
				bottom: "8px",
				left: "8px",
				zIndex: "10010",
				fontSize: "11px",
				padding: "4px 8px",
				borderRadius: "6px",
				border: "1px solid #8885",
				background: "var(--dsw-alias-bg-layer-2)",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer"
			});
			button.title = "记录性能耗时，不记录内容；10 分钟自动停止。点击停止或重新开始。";
			const label = () => {
				button.textContent = failed ? "性能日志写入失败" : enabled ? "性能记录中 · 停止" : "性能记录已停止 · 开始";
			};
			document.body.appendChild(button);
			label();
			const flush = async () => {
				if (flushing || !events.length) return;
				flushing = true;
				const batch = events.splice(0, 200);
				try {
					failed = !(await originalFetch.call(window, "/dsh-ui-performance", {
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ events: batch }),
						keepalive: true
					})).ok;
				} catch {
					failed = true;
				} finally {
					flushing = false;
					if (!disposed) label();
				}
			};
			const stop = () => {
				add("stop");
				enabled = false;
				label();
				flush();
			};
			button.onclick = () => {
				if (enabled) stop();
				else {
					enabled = true;
					started = performance.now();
					last = started;
					add("start", { longtaskSupported: PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? false });
					label();
				}
			};
			const request = async (input, init) => {
				if (!enabled) return originalFetch.call(window, input, init);
				let endpoint = "other";
				try {
					const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
					if (url.origin === location.origin) {
						const root = url.pathname.split("/")[1];
						endpoint = [
							"dsh-project-run",
							"dsh-quick-prompts",
							"dsh-git-plus",
							"dsh-version-update"
						].includes(root) ? root : "official";
					}
				} catch {}
				const start = performance.now();
				let status = 0;
				try {
					const res = await originalFetch.call(window, input, init);
					status = res.status;
					return res;
				} finally {
					const duration = Math.round(performance.now() - start);
					const key = endpoint;
					const previous = counts.get(key) ?? {
						count: 0,
						duration: 0
					};
					previous.count++;
					previous.duration += duration;
					counts.set(key, previous);
					if (duration > 150) add("request", {
						endpoint,
						duration,
						status,
						phase: "slow-headers"
					});
				}
			};
			window.fetch = request;
			const click = (event) => {
				const tab = event.target?.closest?.("header [role=\"tablist\"] > [role=\"tab\"]");
				if (!tab || !enabled) return;
				switchId++;
				const id = switchId, start = performance.now();
				const kind = tab.getAttribute("data-dsh-nav") ?? "other";
				add("tab", {
					tab: kind,
					phase: "click"
				});
				requestAnimationFrame(() => requestAnimationFrame(() => {
					if (id === switchId) add("tab", {
						tab: kind,
						phase: "two-frames",
						duration: Math.round(performance.now() - start)
					});
				}));
			};
			document.addEventListener("click", click, true);
			const mark = (event) => {
				const detail = event.detail;
				if (detail && [
					"files-sync",
					"files-mount",
					"terminal-mount",
					"terminal-ready",
					"quick-save",
					"session-change",
					"files-ready",
					"blank-navigation"
				].includes(detail.kind)) add(detail.kind, { duration: Math.round(Number(detail.duration) || 0) });
			};
			document.addEventListener("dsh-performance", mark);
			const supported = PerformanceObserver.supportedEntryTypes?.includes("longtask") ?? false;
			let observer;
			if (supported) {
				observer = new PerformanceObserver((list) => {
					for (const e of list.getEntries()) add("longtask", { duration: Math.round(e.duration) });
				});
				observer.observe({ entryTypes: ["longtask"] });
			}
			let raf = 0;
			const frame = (now) => {
				if (enabled && document.visibilityState === "visible" && now - last > 80) add("frame-gap", {
					duration: Math.round(now - last),
					visible: true
				});
				last = now;
				if (!disposed) raf = requestAnimationFrame(frame);
			};
			raf = requestAnimationFrame(frame);
			const visible = () => {
				last = performance.now();
			};
			document.addEventListener("visibilitychange", visible);
			const timer = setInterval(() => {
				if (enabled) {
					for (const [endpoint, value] of counts) add("request", {
						endpoint,
						...value,
						phase: "headers-summary"
					});
					counts.clear();
					if (performance.now() - started > 6e5) stop();
				}
				flush();
			}, 3e3);
			const pagehide = () => {
				add("stop");
				flush();
			};
			window.addEventListener("pagehide", pagehide);
			add("start", {
				longtaskSupported: supported,
				width: innerWidth,
				height: innerHeight
			});
			return () => {
				pagehide();
				disposed = true;
				enabled = false;
				clearInterval(timer);
				cancelAnimationFrame(raf);
				observer?.disconnect();
				button.remove();
				document.removeEventListener("click", click, true);
				document.removeEventListener("dsh-performance", mark);
				document.removeEventListener("visibilitychange", visible);
				window.removeEventListener("pagehide", pagehide);
				if (window.fetch === request) window.fetch = originalFetch;
			};
		}
		//#endregion
		//#region src/client/window-chrome.ts
		const TOP_HIT_PX = 40;
		const TRAFFIC_LIGHTS_PX = 80;
		const INTERACTIVE = "button, a, input, textarea, select, [role=\"tab\"], [role=\"menuitem\"], [contenteditable=\"true\"]";
		function currentWindow() {
			return window.__TAURI__?.window?.getCurrentWindow?.() ?? null;
		}
		function zoomToFill(appWindow) {
			if (appWindow.toggleMaximize) {
				appWindow.toggleMaximize();
				return;
			}
			appWindow.isMaximized?.().then((maximized) => {
				if (maximized) appWindow.unmaximize?.();
				else appWindow.maximize?.();
			});
		}
		function retargetTopDom(appWindow) {
			const el = document.getElementById("pake-top-dom");
			if (!el || el.dataset.dshZoom === "1") return;
			const next = el.cloneNode(true);
			next.dataset.dshZoom = "1";
			next.style.left = `${TRAFFIC_LIGHTS_PX}px`;
			next.style.width = `calc(100% - ${TRAFFIC_LIGHTS_PX}px)`;
			next.style.height = `${TOP_HIT_PX}px`;
			next.style.zIndex = "20";
			next.style.cursor = "default";
			el.replaceWith(next);
			next.addEventListener("mousedown", (event) => {
				if (event.button !== 0 || event.detail === 2) return;
				appWindow.startDragging?.();
			});
		}
		function enableTitlebarZoom() {
			const appWindow = currentWindow();
			if (!appWindow) return () => {};
			const onPageDblClick = (event) => {
				if (event.clientY > TOP_HIT_PX || event.clientX < TRAFFIC_LIGHTS_PX) return;
				if (event.target?.closest?.(INTERACTIVE)) return;
				event.preventDefault();
				event.stopPropagation();
				zoomToFill(appWindow);
			};
			retargetTopDom(appWindow);
			const observer = new MutationObserver(() => {
				retargetTopDom(appWindow);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			document.addEventListener("dblclick", onPageDblClick, true);
			return () => {
				observer.disconnect();
				document.removeEventListener("dblclick", onPageDblClick, true);
			};
		}
		function WindowChrome() {
			react.default.useEffect(() => enableTitlebarZoom(), []);
			return react.default.createElement("span", {
				className: "dvu-chrome",
				"aria-hidden": true
			});
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "sessions"];
		function apply(ctx) {
			ctx.effect(installPerformanceRecorder);
			ctx.effect(() => {
				const sessions = ctx.get("sessions");
				let current = sessions?.list.getSnapshot().current;
				return sessions?.list.subscribe(() => {
					const next = sessions.list.getSnapshot().current;
					if (next !== current) {
						current = next;
						globalThis.document.dispatchEvent(new CustomEvent("dsh-performance", { detail: {
							kind: "session-change",
							duration: 0
						} }));
					}
				});
			});
			ctx.effect(() => installBlankSessionNavigation(ctx));
			injectStyles();
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-window-chrome",
				order: 0,
				label: "Window"
			}, () => react.default.createElement(WindowChrome)));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-version-update",
				order: 10,
				label: "Update"
			}, () => react.default.createElement(UpdateBadge)));
		}
		function UpdateBadge() {
			const [info, setInfo] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const [error, setError] = react.default.useState("");
			const load = react.default.useCallback(async (force = false) => {
				const res = await fetch(`/dsh-version-update/check${force ? "?force=1" : ""}`, { credentials: "include" });
				setInfo(await res.json());
			}, []);
			react.default.useEffect(() => {
				load();
				const timer = setInterval(() => {
					load();
				}, 3e5);
				return () => clearInterval(timer);
			}, [load]);
			const update = async () => {
				if (busy) return;
				setBusy(true);
				setError("");
				try {
					const res = await fetch("/dsh-version-update/update", {
						method: "POST",
						credentials: "include"
					});
					const body = await res.json();
					if (!res.ok) throw new Error(body.error || res.statusText);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
					setBusy(false);
				}
			};
			if (!(info?.state === "update-available" || busy || Boolean(error))) return null;
			const title = error || (busy ? "正在下载并重启…" : `有新版本 ${info?.latest ?? ""}，点击下载、更新并重启`);
			return react.default.createElement("button", {
				type: "button",
				className: error ? "dvu-badge dvu-badge-err" : "dvu-badge",
				title,
				disabled: busy,
				onClick: () => {
					update();
				}
			}, react.default.createElement("span", { className: "dvu-dot" }, "●"), busy ? "更新中" : error ? "更新失败" : "有更新");
		}
		let stylesInjected = false;
		function injectStyles() {
			if (stylesInjected || typeof document === "undefined") return;
			stylesInjected = true;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-version-update";
			tag.textContent = `
.dvu-chrome { display:none; }
.dvu-badge { position:absolute; top:10px; left:30px; z-index:30; appearance:none; border:0; display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px; border-radius:999px; background:var(--dsw-alias-state-error-primary, #e24); color:#fff; font:inherit; font-size:11px; line-height:20px; cursor:pointer; pointer-events:auto; box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill, #fff); }
.dvu-badge:disabled { opacity:.85; cursor:progress; }
.dvu-badge-err { background:var(--dsw-alias-label-tertiary, #888); }
.dvu-dot { font-size:8px; }
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