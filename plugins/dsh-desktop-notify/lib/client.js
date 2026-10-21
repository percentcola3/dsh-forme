window.__ModuleLoader__.load({
	id: "dsh-desktop-notify",
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
		//#region src/preferences.ts
		const positions = [
			"left",
			"right",
			"top",
			"island"
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
		//#endregion
		//#region src/client/styles.ts
		const styles = `
.dn-account-entry{width:100%;text-align:left}.dn-account-entry svg{width:16px;height:16px;flex:none}.dn-account-entry:is(:hover,:focus-visible){outline:0;background:var(--dsw-alias-interactive-bg-hover,#ffffff12)}
.dn-entry{display:flex;align-items:center;gap:9px;border:0;background:transparent;color:inherit;font:inherit;padding:8px 10px;border-radius:8px;cursor:pointer}.dn-entry:hover{background:#8ca6bd18}.dn-entry svg{width:17px;height:17px;flex:none}.dn-setting-row{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;font:13px/1.6 var(--moss-text,system-ui)}.dn-setting-row small{display:block;opacity:.55}.dn-setting-row button{border:1px solid #71809655;background:transparent;border-radius:7px;color:inherit;padding:6px 12px;cursor:pointer}
.dn-shade{position:fixed;inset:0;z-index:11000;display:grid;place-items:center;padding:24px;background:#030911a6;backdrop-filter:blur(8px)}.dn-panel{display:flex;flex-direction:column;color:#e3eaf1;background:linear-gradient(145deg,#152232,#0b131e);border:1px solid #9aafc42a;border-radius:20px;width:min(640px,100%);max-height:calc(100vh - 48px);overflow:hidden;box-shadow:0 28px 100px #0008;font:13px/1.6 var(--moss-text,system-ui,sans-serif);outline:none}.dn-panel *{box-sizing:border-box}.dn-panel button,.dn-panel select,.dn-panel input{font:inherit}.dn-panel button{cursor:pointer}.dn-head{flex:none;display:flex;gap:12px;align-items:center;padding:24px 28px 18px;border-bottom:1px solid #aab9cb17}.dn-head>svg{width:24px;height:24px;color:#c9ddec}.dn-head h2{font-size:18px;line-height:1.5;margin:0;font-weight:600}.dn-head p{margin:3px 0 0;color:#93a4b6;font-size:11px}.dn-head>button{margin-left:auto;border:0;background:transparent;color:#98a9bb;font-size:22px;align-self:flex-start;padding:0 5px}.dn-body{padding:18px 28px;overflow-y:auto;min-height:0}.dn-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:10px 0}.dn-row small{display:block;color:#899bab;font-size:11px;margin-top:2px}.dn-row input[type=checkbox]{width:17px;height:17px;accent-color:#87b9d5;cursor:pointer}.dn-label{margin:22px 0 12px;color:#90a5b8;font-size:10px;letter-spacing:.14em}.dn-positions{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.dn-positions button{display:flex;flex-direction:column;align-items:center;gap:10px;background:#0a1520;color:#90a4b7;border:1px solid #8ea7bd24;border-radius:10px;padding:14px 8px 10px;font-size:11px}.dn-positions button[aria-pressed=true]{border-color:#9fcbe48c;background:#253e53;color:#eef5fb;box-shadow:inset 0 0 0 1px #93c8e212}.dn-monitor{position:relative;width:68px;height:43px;border:1px solid #8ca2b64d;border-radius:5px;background:linear-gradient(135deg,#1a2b3c,#0d1722)}.dn-monitor:after{content:'';position:absolute;width:20px;height:2px;background:#9fcbe4;box-shadow:0 0 6px #9fcbe450;border-radius:3px;right:5px;top:7px}.dn-monitor[data-position=left]:after{left:5px;right:auto}.dn-monitor[data-position=top]:after{left:23px;right:auto;top:5px}.dn-monitor[data-position=island]:after{left:19px;right:auto;top:0;width:28px;height:8px;border-radius:0 0 5px 5px;background:#cdd7df}.dn-options{display:flex;gap:20px;margin:16px 0}.dn-options label{flex:1;color:#9aafc0;font-size:11px}.dn-panel select{display:block;margin-top:7px;width:100%;padding:8px 10px;border-radius:7px;border:1px solid #8ca6bd32;background:#101d2b;color:#d9e4ed;color-scheme:dark}.dn-note{font-size:11px;color:#8298ac;margin:12px 0}.dn-status{padding:10px 13px;background:#9ac4e00a;border:1px solid #91b5d51e;border-radius:8px;color:#98b0c3;font-size:11px}.dn-error{margin-top:12px;color:#ff9ba0;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.dn-actions{flex:none;display:flex;align-items:center;gap:9px;padding:16px 28px;border-top:1px solid #aab9cb17;background:#101a28}.dn-actions button{border:1px solid #8fa6bc3d;border-radius:8px;background:#1b2b3d;color:#d5e4ef;padding:8px 13px;font-size:11px}.dn-actions button:last-child{margin-left:auto;color:#14232f;background:#c7deed;border-color:#c7deed}.dn-actions button:disabled{opacity:.45;cursor:default}.dn-panel button:focus-visible,.dn-panel select:focus-visible,.dn-entry:focus-visible{outline:2px solid #9ccfe8;outline-offset:3px}.dn-recent{margin-top:22px;border-top:1px solid #8da5bb20;padding-top:14px}.dn-recent summary{cursor:pointer;font-size:11px;color:#92a9bc}.dn-recent li{padding:8px 0;font-size:11px;display:flex;gap:10px;border-bottom:1px solid #8da5bb12}.dn-recent ol{list-style:none;padding:0;margin:8px 0}.dn-recent time{margin-left:auto;color:#728a9f}.dn-pill{color:#b2d7e7}.dn-pill[data-kind=decision],.dn-pill[data-kind=error]{color:#ed969a}@media(max-width:520px){.dn-shade{padding:10px}.dn-body{padding:16px}.dn-head{padding:18px 16px}.dn-positions{gap:6px}.dn-monitor{width:54px}.dn-monitor[data-position=top]:after{left:16px}.dn-monitor[data-position=island]:after{left:12px}.dn-actions{flex-wrap:wrap}.dn-options{gap:10px}}
`;
		//#endregion
		//#region src/client/account-menu.ts
		/** The host's account menu has no item slot yet. Extend only the menu owned by
		* its account trigger, keeping the native account and sign-out actions intact. */
		function installAccountMenu(doc, open) {
			let entry;
			let menu;
			let trigger = null;
			const sync = () => {
				trigger = doc.querySelector("button[data-signed-out][aria-haspopup=\"menu\"][aria-expanded=\"true\"]");
				const controlled = trigger?.getAttribute("aria-controls");
				const next = trigger ? controlled ? doc.getElementById(controlled) : doc.querySelector("[role=\"menu\"]") : null;
				if (entry?.isConnected && menu === next) return;
				entry?.remove();
				entry = void 0;
				menu = void 0;
				const template = next?.querySelector("[role=\"menuitem\"]");
				if (!next || !template) return;
				menu = next;
				entry = doc.createElement("button");
				entry.type = "button";
				entry.className = `${template.className} dn-account-entry`;
				entry.setAttribute("role", "menuitem");
				entry.setAttribute("tabindex", "-1");
				entry.setAttribute("data-desktop-notify-entry", "");
				entry.innerHTML = "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" aria-hidden=\"true\"><path d=\"M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3zM9 21h6M12 1v2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg><span>桌面提醒</span>";
				entry.addEventListener("click", (event) => {
					event.stopPropagation();
					const account = trigger;
					account?.click();
					account?.focus();
					open();
				});
				(template.parentElement === next ? template : template.parentElement).after(entry);
			};
			const keydown = (event) => {
				if (!menu || !entry || !menu.contains(event.target)) return;
				const items = [...menu.querySelectorAll("[role=\"menuitem\"]")].filter((item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true");
				const index = items.indexOf(doc.activeElement);
				let next;
				if (event.key === "ArrowDown") next = (index + 1) % items.length;
				else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
				else if (event.key === "Home") next = 0;
				else if (event.key === "End") next = items.length - 1;
				else if (event.target === entry && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault();
					event.stopPropagation();
					entry.click();
					return;
				} else return;
				event.preventDefault();
				event.stopPropagation();
				items[next]?.focus();
			};
			const observer = new MutationObserver(sync);
			observer.observe(doc.body, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["aria-expanded"]
			});
			doc.addEventListener("keydown", keydown, true);
			sync();
			return () => {
				observer.disconnect();
				doc.removeEventListener("keydown", keydown, true);
				entry?.remove();
			};
		}
		//#endregion
		//#region src/client/index.ts
		const inject = ["slots", "uiWorkspace"];
		const labels = {
			left: "屏幕左侧",
			right: "屏幕右侧",
			top: "屏幕顶部",
			island: "灵动岛"
		};
		async function request(action, body = {}) {
			const res = await fetch("/dsh-desktop-notify", {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action,
					...body
				})
			});
			const value = await res.json();
			if (!res.ok) throw new Error(value.error ?? "桌面提醒操作失败。");
			return value;
		}
		const h = react.default.createElement;
		function Bell() {
			return h("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.5,
				"aria-hidden": true
			}, h("path", {
				d: "M5 10a7 7 0 0 1 14 0v5l2 3H3l2-3zM9 21h6M12 1v2",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}));
		}
		function apply(ctx) {
			const slots = ctx.get("slots");
			ctx.effect(() => {
				const style = document.createElement("style");
				style.textContent = styles;
				document.head.appendChild(style);
				return () => style.remove();
			});
			ctx.effect(() => slots.inject("shell.overlay", () => slots.register({
				name: "shell.overlay",
				id: "dsh-desktop-notify-menu",
				order: 70
			}, () => h(AccountNotifyEntry))));
			ctx.effect(() => slots.inject("settings.general.item", () => slots.register({
				name: "settings.general.item",
				id: "dsh-desktop-notify",
				order: 70
			}, () => h(NotifyEntry, { settings: true }))));
			ctx.effect(() => {
				let live = true;
				let polling = false;
				const workspace = ctx.get("uiWorkspace");
				const poll = async () => {
					if (polling || document.hidden || !document.hasFocus()) return;
					polling = true;
					try {
						const { open } = await request("poll", {
							desktop: !!window.dshDesktop,
							focused: true
						});
						if (live && open?.sessionId) {
							workspace.openSession(open.sessionId);
							await request("ack", { id: open.id });
						}
					} catch {} finally {
						polling = false;
					}
				};
				const timer = setInterval(() => {
					poll();
				}, 1e3);
				window.addEventListener("focus", poll);
				document.addEventListener("visibilitychange", poll);
				return () => {
					live = false;
					clearInterval(timer);
					window.removeEventListener("focus", poll);
					document.removeEventListener("visibilitychange", poll);
				};
			});
		}
		function AccountNotifyEntry() {
			const [open, setOpen] = react.default.useState(false);
			react.default.useEffect(() => installAccountMenu(document, () => setOpen(true)), []);
			return open ? h(NotifySettings, { close: () => setOpen(false) }) : null;
		}
		function NotifyEntry({ compact = false, settings = false }) {
			const [open, setOpen] = react.default.useState(false);
			return h(react.default.Fragment, null, settings ? h("div", { className: "dn-setting-row" }, h("div", null, "桌面提醒", h("small", null, "后台任务完成与审批、选择提醒")), h("button", {
				type: "button",
				onClick: () => setOpen(true)
			}, "配置")) : h("button", {
				type: "button",
				className: "dn-entry",
				title: "桌面提醒",
				"aria-label": "配置桌面提醒",
				onClick: () => setOpen(true)
			}, h(Bell), !compact && "桌面提醒"), open && h(NotifySettings, { close: () => setOpen(false) }));
		}
		function NotifySettings({ close }) {
			const [value, setValue] = react.default.useState({ ...defaults });
			const [state, setState] = react.default.useState();
			const [error, setError] = react.default.useState("");
			const [busy, setBusy] = react.default.useState(true);
			const [saved, setSaved] = react.default.useState(false);
			const panel = react.default.useRef(null);
			const titleId = react.default.useId();
			react.default.useEffect(() => {
				let live = true;
				request("get").then((data) => {
					if (live) {
						setState(data);
						setValue(data.preferences);
					}
				}).catch((err) => {
					if (live) setError(String(err.message));
				}).finally(() => {
					if (live) setBusy(false);
				});
				const previous = document.activeElement;
				panel.current?.focus();
				const key = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						close();
					}
					if (event.key === "Tab") {
						const nodes = panel.current?.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),summary");
						if (!nodes?.length) return;
						const first = nodes[0];
						const last = nodes[nodes.length - 1];
						if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
							event.preventDefault();
							last.focus();
						} else if (!event.shiftKey && document.activeElement === last) {
							event.preventDefault();
							first.focus();
						}
					}
				};
				document.addEventListener("keydown", key, true);
				return () => {
					live = false;
					document.removeEventListener("keydown", key, true);
					previous?.focus();
				};
			}, []);
			const patch = (next) => {
				setValue((old) => ({
					...old,
					...next
				}));
				setSaved(false);
			};
			const save = async (kind) => {
				setBusy(true);
				setError("");
				setSaved(false);
				try {
					let data = await request("update", { preferences: value });
					setState(data);
					setValue(data.preferences);
					if (kind) {
						data = await request("test", { kind });
						setState(data);
					} else if (value.enabled && data.native.status === "idle") {
						data = await request("prepare");
						setState(data);
					}
					setSaved(true);
				} catch (err) {
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					setBusy(false);
				}
			};
			const toggle = (key, label, detail) => h("label", {
				className: "dn-row",
				key
			}, h("span", null, label, h("small", null, detail)), h("input", {
				type: "checkbox",
				checked: value[key],
				disabled: busy || !state,
				onChange: (event) => patch({ [key]: event.target.checked })
			}));
			return (0, react_dom.createPortal)(h("div", {
				className: "dn-shade",
				onMouseDown: (event) => {
					if (event.target === event.currentTarget) close();
				}
			}, h("div", {
				className: "dn-panel",
				role: "dialog",
				"aria-modal": true,
				"aria-labelledby": titleId,
				ref: panel,
				tabIndex: -1
			}, h("div", { className: "dn-head" }, h(Bell), h("div", null, h("h2", { id: titleId }, "桌面提醒"), h("p", null, "任务有结果，随时知晓。")), h("button", {
				type: "button",
				"aria-label": "关闭桌面提醒设置",
				onClick: close
			}, "×")), h("div", { className: "dn-body" }, toggle("enabled", "开启桌面提醒", "DSH 在前台或后台运行时均提醒，不抢占焦点。"), h("div", { className: "dn-label" }, "提醒位置 / PLACEMENT"), h("div", {
				className: "dn-positions",
				role: "group",
				"aria-label": "提醒位置"
			}, ...positions.map((position) => h("button", {
				type: "button",
				key: position,
				disabled: busy || !state,
				"aria-pressed": value.position === position,
				onClick: () => patch({ position })
			}, h("span", {
				className: "dn-monitor",
				"data-position": position,
				"aria-hidden": true
			}), labels[position]))), h("div", { className: "dn-options" }, h("label", null, "显示器", h("select", {
				"aria-label": "显示器",
				value: value.display,
				disabled: busy || !state,
				onChange: (event) => patch({ display: event.target.value })
			}, h("option", { value: "main" }, "主显示器"), h("option", { value: "pointer" }, "鼠标所在显示器"))), h("label", null, "自动收起时长", h("select", {
				"aria-label": "自动收起时长",
				value: value.duration,
				disabled: busy || !state,
				onChange: (event) => patch({ duration: Number(event.target.value) })
			}, ...[.../* @__PURE__ */ new Set([
				3,
				4,
				5,
				8,
				12,
				20,
				30,
				value.duration
			])].sort((a, b) => a - b).map((seconds) => h("option", {
				value: seconds,
				key: seconds
			}, `${seconds} 秒`))))), toggle("completion", "任务完成", "仅正常结束时提醒，取消和中断不会显示为完成。"), toggle("decisions", "需要选择或审批", "轻动画提示后自动收起，问题和审批仍在任务内等你处理。异常也会提醒。"), toggle("sound", "提示音", "每条新提醒播放一次轻提示音。"), h("p", { className: "dn-note" }, "完成时显示淡蓝色自转地球，需要审批或选择时切换为黑红月球。仅显示星球，到时自动消失；点击返回任务。"), h("div", {
				className: "dn-status",
				role: "status"
			}, busy ? "正在保存或准备原生提醒，首次编译可能需要片刻…" : state?.native.status === "ready" ? "原生提醒已就绪 · 覆盖所有会话 · 前后台均有效" : state?.native.status === "unavailable" ? state.native.error : "首次保存或测试会准备原生提醒，无需系统通知权限。"), error && h("div", {
				className: "dn-error",
				role: "alert"
			}, error), !!state?.recent.length && h("details", { className: "dn-recent" }, h("summary", null, "最近提醒"), h("ol", null, ...state.recent.map((notice, i) => h("li", { key: `${notice.id}:${i}` }, h("span", {
				className: "dn-pill",
				"data-kind": notice.kind
			}, notice.kind === "complete" ? "完成" : notice.kind === "error" ? "异常" : "待选择"), h("span", null, notice.title), h("time", null, new Date(notice.at).toLocaleTimeString("zh-CN", {
				hour: "2-digit",
				minute: "2-digit"
			}))))))), h("div", { className: "dn-actions" }, h("button", {
				type: "button",
				disabled: busy || !state || !value.enabled,
				onClick: () => {
					save("complete");
				}
			}, "测试完成提醒"), h("button", {
				type: "button",
				disabled: busy || !state || !value.enabled,
				onClick: () => {
					save("decision");
				}
			}, "测试选择提醒"), h("button", {
				type: "button",
				disabled: busy || !state,
				onClick: () => {
					save();
				}
			}, busy ? "处理中…" : saved ? "已保存" : "保存设置")))), document.body);
		}
		//#endregion
		exports.AccountNotifyEntry = AccountNotifyEntry;
		exports.Bell = Bell;
		exports.NotifyEntry = NotifyEntry;
		exports.NotifySettings = NotifySettings;
		exports.apply = apply;
		exports.inject = inject;
		exports.request = request;
		return module.exports;
	}
});
