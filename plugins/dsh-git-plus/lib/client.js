window.__ModuleLoader__.load({
	id: "dsh-git-plus",
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
		//#region src/client/repository-styles.ts
		const repositoryStyles = `
.dgp-repository-menu { min-width:0; max-height:min(70vh,620px); overflow:auto; }
.dgp-repository-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 4px 6px; font-size:12px; }
.dgp-repository-heading button { border:0; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:11px; cursor:pointer; }
.dgp-repository-menu .dgp-hint,.dgp-repository-menu .dgp-error { margin:3px 0; padding:3px 5px; font-size:11px; line-height:1.4; }
.dgp-repository-tree,.dgp-repository-tree ul { list-style:none; padding:0; margin:0; }
.dgp-repository-tree ul { margin-left:6px; padding-left:6px; border-left:1px solid var(--dsw-alias-border-l2); }
.dgp-repository-row { display:flex; align-items:center; gap:4px; min-width:0; height:25px; padding:0 3px; }
.dgp-repository-row:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-repository-toggle { appearance:none; flex:1; min-width:0; height:25px; display:flex; align-items:center; gap:4px; padding:0; border:0; background:transparent; color:var(--dsw-alias-label-secondary); text-align:left; font:inherit; font-size:12px; cursor:pointer; }
.dgp-repository-chevron { width:10px; flex:none; font-size:10px; }
.dgp-repository-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-kind { flex:none; font-size:10px; color:var(--dsw-alias-label-tertiary); }
.dgp-repository-current { appearance:none; display:flex; align-items:center; gap:4px; height:23px; max-width:46%; padding:0 4px; border:0; border-radius:3px; background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:11px; cursor:pointer; }
.dgp-repository-current span:first-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-current:hover:not(:disabled) { background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); }
.dgp-repository-current:disabled { opacity:.6; cursor:default; }
.dgp-repository-branches { margin:2px 0 4px 13px; padding:4px; border:1px solid var(--dsw-alias-border-l2); border-radius:4px; }
.dgp-repository-branches .dgp-branch-results { max-height:220px; overflow:auto; margin:0; padding:0; border:0; }
.dgp-repository-branches .dgp-branch { width:100%; min-width:0; min-height:24px; padding:3px 5px; border-radius:3px; font-size:11px; line-height:18px; font-weight:400; box-shadow:none; background:transparent; color:var(--dsw-alias-label-secondary); }
.dgp-repository-branches .dgp-branch:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-repository-branches .dgp-branch span:first-child { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-repository-branches .dgp-branch span:last-child { flex:none; color:var(--dsw-alias-label-tertiary); }
.dgp-repository-branches .dgp-branch:disabled { opacity:1; }
.dgp-branch-search { box-sizing:border-box; width:100%; height:26px; margin:0 0 3px; padding:3px 6px; border:1px solid var(--dsw-alias-border-l2); border-radius:3px; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); font:inherit; font-size:11px; }
.dgp-repository-toggle:focus-visible,.dgp-repository-current:focus-visible,.dgp-branch-search:focus-visible { outline:1px solid var(--dsw-alias-label-secondary); outline-offset:-1px; }
`;
		//#endregion
		//#region src/client/requests.ts
		async function post(path, body) {
			const res = await fetch(path, {
				method: "POST",
				credentials: "include",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body)
			});
			const text = await res.text();
			let data;
			try {
				data = JSON.parse(text);
			} catch {
				throw new Error(`Git request failed (${res.status} ${res.statusText || "invalid response"}). Try refreshing the session.`);
			}
			if (!res.ok) throw new Error(data?.error || `Git request failed (${res.status} ${res.statusText})`);
			return data;
		}
		//#endregion
		//#region src/client/repository-tree.ts
		/** Keep directory boundaries, even when a repository contains other repositories. */
		function repositoryTree(repositories, rootName) {
			const root = {
				path: ".",
				name: rootName,
				children: []
			};
			for (const repository of repositories) {
				if (repository.path === ".") {
					root.repository = repository;
					continue;
				}
				const parts = repository.path.split("/");
				if (parts.some((part) => !part || part === "." || part === "..")) continue;
				let parent = root;
				for (let index = 0; index < parts.length; index++) {
					const path = parts.slice(0, index + 1).join("/");
					let child = parent.children.find((item) => item.path === path);
					if (!child) {
						child = {
							path,
							name: parts[index],
							children: []
						};
						parent.children.push(child);
					}
					parent = child;
				}
				parent.repository = repository;
			}
			const sort = (node) => {
				node.children.sort((a, b) => a.name.localeCompare(b.name));
				node.children.forEach(sort);
			};
			sort(root);
			return root;
		}
		//#endregion
		//#region src/client/repository-menu.ts
		const h = react.default.createElement;
		function RepositoryMenu({ loc, inventory, loading, error, refresh }) {
			const tree = repositoryTree(inventory?.repositories ?? [], loc.cwd.split("/").filter(Boolean).at(-1) || loc.cwd);
			const [pickerPath, setPickerPath] = react.default.useState(null);
			const [busy, setBusy] = react.default.useState(false);
			const lock = react.default.useRef(false);
			const active = react.default.useRef(true);
			react.default.useEffect(() => {
				active.current = true;
				return () => {
					active.current = false;
				};
			}, []);
			const acquire = () => {
				if (lock.current) return false;
				lock.current = true;
				setBusy(true);
				return true;
			};
			const release = () => {
				lock.current = false;
				if (active.current) setBusy(false);
			};
			return h("div", { className: "dgp-repository-menu" }, h("div", { className: "dgp-repository-heading" }, h("strong", null, `仓库与分支 · ${inventory?.repositories.length ?? 0}`), h("button", {
				type: "button",
				disabled: busy || loading,
				onClick: () => {
					refresh();
				}
			}, loading ? "检测中…" : "重新检测")), error && h("p", {
				className: "dgp-error",
				role: "alert"
			}, error), inventory?.truncated && h("p", {
				className: "dgp-hint",
				role: "status"
			}, "检测达到范围或时间限制，仅显示已发现的仓库；可进入子目录继续查看。"), !!inventory?.errors?.length && h("p", {
				className: "dgp-hint",
				title: inventory.errors.map((item) => `${item.path}: ${item.error}`).join("\n")
			}, "部分目录无法读取，检测结果可能不完整。"), inventory?.repositories.length ? h("ul", {
				className: "dgp-repository-tree",
				"aria-label": "目录、仓库与分支"
			}, h(TreeNode, {
				node: tree,
				loc,
				root: true,
				busy,
				acquire,
				release,
				refresh,
				pickerPath,
				setPickerPath
			})) : h("p", { className: "dgp-hint" }, loading ? "正在检测仓库…" : "当前目录范围内没有发现可管理的 Git 仓库。"), h("p", { className: "dgp-hint" }, "点击右侧分支名切换分支，仅作用于该仓库。"));
		}
		function TreeNode(props) {
			const { node, loc, root, busy, acquire, release, refresh, pickerPath, setPickerPath } = props;
			const [expanded, setExpanded] = react.default.useState(Boolean(root) || !node.repository);
			const trigger = react.default.useRef(null);
			const repo = node.repository;
			const hasChildren = node.children.length > 0;
			const open = !!repo && pickerPath === repo.path;
			const wasOpen = react.default.useRef(open);
			react.default.useEffect(() => {
				if (busy) return;
				if (wasOpen.current && !open) trigger.current?.focus();
				wasOpen.current = open;
			}, [open, busy]);
			const close = () => setPickerPath(null);
			return h("li", { className: "dgp-repository-node" }, h("div", { className: "dgp-repository-row" }, h("button", {
				type: "button",
				className: "dgp-repository-toggle",
				disabled: busy,
				"aria-expanded": hasChildren ? expanded : void 0,
				title: node.path,
				onClick: () => hasChildren ? setExpanded((value) => !value) : repo && setPickerPath(open ? null : repo.path)
			}, h("span", {
				className: "dgp-repository-chevron",
				"aria-hidden": true
			}, hasChildren ? expanded ? "▾" : "▸" : "·"), h("span", { className: "dgp-repository-name" }, node.name), repo && h("span", { className: "dgp-repository-kind" }, repo.kind === "submodule" ? "子模块" : repo.kind === "worktree" ? "工作树" : "Git")), repo && h("button", {
				ref: trigger,
				type: "button",
				className: "dgp-repository-current",
				disabled: busy,
				"aria-label": `切换 ${node.name} 的分支，当前 ${repo.branch}`,
				"aria-expanded": open,
				title: `${node.path} · ${repo.branch} · 点击切换分支`,
				onClick: () => setPickerPath(open ? null : repo.path)
			}, h("span", null, repo.branch), h("span", { "aria-hidden": true }, "⌄"))), open && repo && h(RepositoryBranches, {
				key: repo.path,
				repositoryPath: repo.path,
				branch: repo.branch,
				loc,
				busy,
				acquire,
				release,
				refresh,
				close
			}), expanded && hasChildren && h("ul", null, ...node.children.map((child) => h(TreeNode, {
				...props,
				key: child.path,
				node: child,
				root: false
			}))));
		}
		function RepositoryBranches({ repositoryPath, branch, loc, busy, acquire, release, refresh, close }) {
			const [query, setQuery] = react.default.useState("");
			const [branches, setBranches] = react.default.useState([]);
			const [error, setError] = react.default.useState("");
			const [ready, setReady] = react.default.useState(false);
			const [switching, setSwitching] = react.default.useState("");
			const active = react.default.useRef(true);
			const sequence = react.default.useRef(0);
			react.default.useEffect(() => {
				active.current = true;
				return () => {
					active.current = false;
					sequence.current++;
				};
			}, []);
			const reload = react.default.useCallback(async () => {
				const ticket = ++sequence.current;
				setReady(false);
				try {
					const value = await post("/dsh-git-plus/branches", {
						...loc,
						repositoryPath
					});
					if (!active.current || ticket !== sequence.current) return;
					if (!value.ok) throw new Error(value.error || "无法读取分支");
					setBranches(value.branches ?? []);
					setError("");
				} catch (reason) {
					if (active.current && ticket === sequence.current) setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					if (active.current && ticket === sequence.current) setReady(true);
				}
			}, [
				loc.sessionId,
				loc.cwd,
				repositoryPath
			]);
			react.default.useEffect(() => {
				reload();
			}, [reload, branch]);
			const switchTo = async (target) => {
				if (!acquire()) return;
				setSwitching(`${target.kind ?? "local"}:${target.name}`);
				setError("");
				try {
					const result = await post("/dsh-git-plus/switch", {
						...loc,
						repositoryPath,
						branch: target.name,
						kind: target.kind ?? "local"
					});
					if (!result.ok) throw new Error(result.error || "分支切换失败");
					if (active.current) await reload();
					await refresh();
					if (active.current) close();
				} catch (reason) {
					if (active.current) setError(reason instanceof Error ? reason.message : String(reason));
				} finally {
					release();
					if (active.current) setSwitching("");
				}
			};
			const filtered = branches.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
			return h("div", {
				className: "dgp-repository-branches",
				onKeyDown: (event) => {
					if (event.key === "Escape" && !busy) {
						event.preventDefault();
						event.stopPropagation();
						close();
					}
				}
			}, h("input", {
				className: "dgp-branch-search",
				type: "search",
				value: query,
				disabled: busy,
				placeholder: "搜索本地 / 远程分支…",
				"aria-label": `搜索 ${repositoryPath} 的分支`,
				onChange: (event) => setQuery(event.target.value)
			}), error && h("p", {
				className: "dgp-error",
				role: "alert"
			}, error), !ready ? h("p", { className: "dgp-hint" }, "加载分支…") : branches.length === 0 ? h("p", { className: "dgp-hint" }, "暂无分支（可能尚未创建首次提交）") : !filtered.length ? h("p", { className: "dgp-hint" }, "没有匹配的分支") : h("ul", { className: "dgp-branch-results" }, ...filtered.map((item) => h("li", { key: `${item.kind ?? "local"}:${item.name}` }, h("button", {
				type: "button",
				className: "dgp-branch",
				"aria-current": item.current ? "true" : void 0,
				title: `${repositoryPath} → ${item.name}${item.kind === "remote" ? "（创建本地跟踪分支并切换）" : ""}`,
				disabled: busy || item.current,
				onClick: () => {
					switchTo(item);
				}
			}, h("span", null, item.name), h("span", null, switching === `${item.kind ?? "local"}:${item.name}` ? "切换中…" : item.current ? "当前" : item.kind === "remote" ? "远程 · 检出" : "切换"))))), ready && branches.some((item) => item.kind === "remote") && h("p", { className: "dgp-hint" }, "远程分支检出时创建本地跟踪分支。"), error && h("button", {
				type: "button",
				disabled: busy,
				onClick: () => {
					reload();
				}
			}, "重试读取分支"));
		}
		//#endregion
		//#region src/client/diff-rows.ts
		function splitUnifiedDiff(diff) {
			const rows = [];
			let leftNo = 0;
			let rightNo = 0;
			let inHunk = false;
			const pendingDel = [];
			const flushDel = () => {
				while (pendingDel.length > 0) {
					const text = pendingDel.shift() ?? "";
					leftNo += 1;
					rows.push({
						leftNo,
						rightNo: null,
						left: text,
						right: "",
						kind: "del"
					});
				}
			};
			for (const line of diff.split("\n")) {
				if (line.startsWith("diff ")) {
					flushDel();
					inHunk = false;
					continue;
				}
				if (line.startsWith("@@")) {
					flushDel();
					const mark = /@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
					if (mark) {
						inHunk = true;
						leftNo = Number(mark[1]) - 1;
						rightNo = Number(mark[2]) - 1;
					}
					continue;
				}
				if (!inHunk) continue;
				if (line.startsWith("\\")) continue;
				if (line.startsWith("-")) {
					pendingDel.push(line.slice(1));
					continue;
				}
				if (line.startsWith("+")) {
					const text = line.slice(1);
					if (pendingDel.length > 0) {
						const old = pendingDel.shift() ?? "";
						leftNo += 1;
						rightNo += 1;
						rows.push({
							leftNo,
							rightNo,
							left: old,
							right: text,
							kind: "replace"
						});
					} else {
						rightNo += 1;
						rows.push({
							leftNo: null,
							rightNo,
							left: "",
							right: text,
							kind: "add"
						});
					}
					continue;
				}
				if (!line.startsWith(" ")) continue;
				flushDel();
				const text = line.slice(1);
				leftNo += 1;
				rightNo += 1;
				rows.push({
					leftNo,
					rightNo,
					left: text,
					right: text,
					kind: "ctx"
				});
			}
			flushDel();
			return rows;
		}
		//#endregion
		//#region src/client/tab-host.ts
		function useWorkspaceToolHost() {
			const nodeRef = react.default.useRef(null);
			const [host, setHost] = react.default.useState(null);
			const [changesHost, setChangesHost] = react.default.useState(null);
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
					setChangesHost(tabs.querySelector("[data-dsh-nav=\"changes\"]"));
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
				host,
				changesHost
			};
		}
		function renderOnTabRow(host, node, fallback) {
			if (!host) return fallback;
			return (0, react_dom.createPortal)(node, host);
		}
		function FloatingPanel(props) {
			const panelRef = react.default.useRef(null);
			const [style, setStyle] = react.default.useState({});
			react.default.useLayoutEffect(() => {
				if (!props.open || !props.anchor?.getBoundingClientRect) return;
				const place = () => {
					const rect = props.anchor?.getBoundingClientRect?.();
					if (!rect) return;
					const width = Math.min(props.width, Math.max(0, window.innerWidth - 16));
					const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
					const top = Math.min(rect.bottom + 6, window.innerHeight - 16);
					setStyle({
						position: "fixed",
						top,
						left,
						width,
						zIndex: 1e4
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				props.open,
				props.anchor,
				props.width
			]);
			react.default.useEffect(() => {
				if (!props.open) return;
				const onPointer = (event) => {
					const target = event.target;
					if (props.anchor?.contains?.(target) || panelRef.current?.contains?.(target)) return;
					props.onClose();
				};
				document.addEventListener("mousedown", onPointer);
				return () => document.removeEventListener("mousedown", onPointer);
			}, [
				props.open,
				props.anchor,
				props.onClose
			]);
			if (!props.open) return null;
			return (0, react_dom.createPortal)(react.default.createElement("div", {
				className: "dgp-menu",
				role: "dialog",
				ref: panelRef,
				style
			}, props.children), document.body);
		}
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"sessions",
			"uiWorkspace"
		];
		function useWorkspace(ctx, sessionId) {
			const sessions = ctx.get("sessions");
			const navigation = ctx.get("uiWorkspace");
			const snap = react.default.useSyncExternalStore(sessions.list.subscribe.bind(sessions.list), sessions.list.getSnapshot.bind(sessions.list));
			const selection = react.default.useSyncExternalStore(navigation.selection.subscribe.bind(navigation.selection), navigation.selection.getSnapshot.bind(navigation.selection));
			const id = sessionId || selection.sessionId;
			const cwd = id ? snap.byId[id]?.cwd : void 0;
			return id && cwd ? {
				sessionId: id,
				cwd
			} : null;
		}
		function fileName(path) {
			const parts = path.replace(/\\/g, "/").split("/");
			return {
				base: parts.pop() || path,
				dir: parts.join("/")
			};
		}
		function statusTone(status) {
			if (status.includes("D")) return "dgp-st-del";
			if (status.includes("A") || status.includes("?")) return "dgp-st-add";
			if (status.includes("U")) return "dgp-st-del";
			return "dgp-st-mod";
		}
		function icon(path) {
			return react.default.createElement("svg", {
				width: 12,
				height: 12,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "1.5",
				"stroke-linecap": "round",
				"stroke-linejoin": "round",
				"aria-hidden": true
			}, react.default.createElement("path", { d: path }));
		}
		function apply(ctx) {
			const slots = ctx.get("slots");
			injectStyles();
			slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "git-changes",
				order: 20,
				label: "Changes"
			}, (props) => react.default.createElement(GitChangesView, {
				ctx,
				sessionId: props.sessionId
			})));
			slots.inject("conversation.session.header.actions", () => slots.register({
				name: "conversation.session.header.actions",
				id: "dsh-git-plus",
				order: 1,
				label: "Git"
			}, (props) => react.default.createElement(GitToolbar, {
				ctx,
				sessionId: props.sessionId
			})));
		}
		function GitToolbar(props) {
			const loc = useWorkspace(props.ctx, props.sessionId);
			return react.default.createElement(GitToolbarWorkspace, {
				key: JSON.stringify(loc),
				loc
			});
		}
		function GitToolbarWorkspace({ loc }) {
			const { anchorRef, host, changesHost } = useWorkspaceToolHost();
			const [status, setStatus] = react.default.useState(null);
			const [menu, setMenu] = react.default.useState(null);
			const [inventory, setInventory] = react.default.useState(null);
			const [scanError, setScanError] = react.default.useState("");
			const [loading, setLoading] = react.default.useState(false);
			const active = react.default.useRef(true);
			const branchRef = react.default.useRef(null);
			const request = react.default.useRef(0);
			react.default.useEffect(() => {
				active.current = true;
				return () => {
					active.current = false;
					request.current++;
				};
			}, []);
			const reload = react.default.useCallback(async (refresh = false, background = false) => {
				if (!loc || !active.current) return;
				if (!background || request.current === 0) request.current++;
				const ticket = request.current;
				if (!background) setLoading(true);
				const [statusResult, scanResult] = await Promise.allSettled([post("/dsh-git-plus/status", loc), post("/dsh-git-plus/repositories", {
					...loc,
					refresh
				})]);
				if (!active.current || ticket !== request.current) return;
				const nextStatus = statusResult.status === "fulfilled" ? statusResult.value : null;
				if (nextStatus?.ok === true && nextStatus.countsPending && ticket === request.current) post("/dsh-git-plus/counts", loc).then((counts) => {
					if (!active.current || ticket !== request.current) return;
					setStatus((previous) => previous && JSON.stringify(previous) === JSON.stringify(counts) ? previous : counts);
				}).catch(() => {});
				setStatus((previous) => JSON.stringify(previous) === JSON.stringify(nextStatus) ? previous : nextStatus);
				if (scanResult.status === "fulfilled" && scanResult.value.ok) {
					const nextInventory = scanResult.value;
					setInventory((previous) => JSON.stringify(previous) === JSON.stringify(nextInventory) ? previous : nextInventory);
					setScanError("");
				} else setScanError(scanResult.status === "rejected" ? String(scanResult.reason?.message ?? scanResult.reason) : scanResult.value.error || "仓库检测失败");
				if (!background) setLoading(false);
			}, [loc?.sessionId, loc?.cwd]);
			react.default.useEffect(() => {
				reload();
			}, [reload]);
			react.default.useEffect(() => {
				const page = globalThis;
				const tick = () => {
					if (!page.document.hidden) reload(false, true);
				};
				const timer = setInterval(tick, 15e3);
				page.document.addEventListener("visibilitychange", tick);
				return () => {
					clearInterval(timer);
					page.document.removeEventListener("visibilitychange", tick);
				};
			}, [reload]);
			const repositories = inventory ?? {
				ok: true,
				truncated: false,
				repositories: status?.ok === true ? [{
					path: ".",
					name: loc?.cwd.split("/").at(-1) || ".",
					branch: status.branch || "HEAD",
					kind: "repository"
				}] : []
			};
			const count = repositories.repositories.length;
			const nonGit = status !== null && status?.ok === false;
			const label = count > 1 || count === 1 && repositories.repositories[0].path !== "." ? `Git · ${count}` : count === 1 ? repositories.repositories[0].branch : !nonGit && (inventory?.truncated || status === null) ? "Git · 检测未完" : status?.branch || "Git";
			const bar = !nonGit && (count > 0 || status?.ok === true || inventory?.truncated || status === null) ? react.default.createElement("div", { className: "dgp-toolbar" }, react.default.createElement("button", {
				type: "button",
				className: "dgp-chip",
				ref: branchRef,
				"aria-expanded": menu === "branch",
				"aria-haspopup": "dialog",
				title: "管理当前目录及子目录中的 Git 仓库与分支",
				onClick: () => setMenu(menu === "branch" ? null : "branch")
			}, icon("M6 3v8M6 11a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 6a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 6h4.5A2.5 2.5 0 0 1 13 8.5V11"), react.default.createElement("span", { className: "dgp-chip-label" }, label), icon("M4 6l4 4 4-4")), react.default.createElement(FloatingPanel, {
				open: menu === "branch",
				width: 460,
				anchor: branchRef.current,
				onClose: () => setMenu(null),
				children: loc ? react.default.createElement(RepositoryMenu, {
					loc,
					inventory: repositories,
					loading,
					error: scanError,
					refresh: () => reload(true)
				}) : react.default.createElement(react.default.Fragment)
			})) : react.default.createElement(react.default.Fragment);
			return react.default.createElement(react.default.Fragment, null, react.default.createElement("span", {
				ref: anchorRef,
				className: "dgp-anchor"
			}), renderOnTabRow(host, bar, bar), status?.ok === true && changesHost ? renderOnTabRow(changesHost, react.default.createElement("span", {
				className: "dgp-tab-counts",
				"aria-hidden": true
			}, react.default.createElement("span", { className: "dgp-ins" }, `+${status?.insertions ?? 0}`), react.default.createElement("span", { className: "dgp-del" }, `-${status?.deletions ?? 0}`)), react.default.createElement(react.default.Fragment)) : null);
		}
		const changesSnapshots = /* @__PURE__ */ new Map();
		function rememberChanges(key, snapshot) {
			changesSnapshots.delete(key);
			changesSnapshots.set(key, snapshot);
			if (changesSnapshots.size > 8) changesSnapshots.delete(changesSnapshots.keys().next().value);
		}
		function GitChangesView(props) {
			const loc = useWorkspace(props.ctx, props.sessionId);
			return react.default.createElement(GitChangesWorkspace, {
				key: JSON.stringify(loc),
				loc
			});
		}
		function GitChangesWorkspace({ loc }) {
			const cacheKey = JSON.stringify(loc);
			const cached = changesSnapshots.get(cacheKey);
			const [status, setStatus] = react.default.useState(() => cached?.status ?? null);
			const latestStatus = react.default.useRef(status);
			latestStatus.current = status;
			const [error, setError] = react.default.useState("");
			const [selected, setSelected] = react.default.useState(() => cached?.selected ?? "");
			const [rows, setRows] = react.default.useState(() => cached?.rows ?? []);
			const [busy, setBusy] = react.default.useState(false);
			const request = react.default.useRef(0);
			react.default.useEffect(() => () => {
				request.current++;
			}, []);
			const reload = react.default.useCallback(async () => {
				if (!loc) return;
				setError("");
				const ticket = ++request.current;
				try {
					const next = await post("/dsh-git-plus/status", loc);
					if (ticket !== request.current) return;
					setStatus(next);
					latestStatus.current = next;
					if (next.ok === true && next.countsPending) post("/dsh-git-plus/counts", loc).then((counts) => {
						if (ticket !== request.current) return;
						setStatus(counts);
						latestStatus.current = counts;
						const cached = changesSnapshots.get(cacheKey);
						if (cached) rememberChanges(cacheKey, {
							...cached,
							status: counts
						});
					}).catch(() => {});
					const previous = changesSnapshots.get(cacheKey);
					if (previous) rememberChanges(cacheKey, {
						...previous,
						status: next
					});
					setSelected((current) => {
						if (current && next.files?.some((file) => file.path === current)) return current;
						return next.files?.[0]?.path ?? "";
					});
				} catch (err) {
					if (ticket === request.current) setError(err instanceof Error ? err.message : String(err));
				}
			}, [loc?.sessionId, loc?.cwd]);
			react.default.useEffect(() => {
				reload();
			}, [reload]);
			react.default.useEffect(() => {
				if (!loc || !selected) {
					setRows([]);
					return;
				}
				let cancelled = false;
				const previous = changesSnapshots.get(cacheKey);
				const hasPreview = previous?.selected === selected;
				setRows(hasPreview ? previous.rows : []);
				setBusy(!hasPreview);
				post("/dsh-git-plus/diff", {
					...loc,
					path: selected
				}).then((next) => {
					if (!cancelled) {
						const parsed = splitUnifiedDiff(next.diff || "");
						setRows(parsed);
						rememberChanges(cacheKey, {
							status: latestStatus.current,
							selected,
							rows: parsed
						});
					}
				}).catch((err) => {
					if (!cancelled) setError(err instanceof Error ? err.message : String(err));
				}).finally(() => {
					if (!cancelled) setBusy(false);
				});
				return () => {
					cancelled = true;
				};
			}, [
				loc?.sessionId,
				loc?.cwd,
				selected
			]);
			const files = status?.files ?? [];
			const current = files.find((file) => file.path === selected);
			const name = selected ? fileName(selected) : null;
			return react.default.createElement("div", {
				className: "dgp-page",
				"data-conversation-composer-overlay": ""
			}, react.default.createElement("aside", { className: "dgp-page-files" }, react.default.createElement("div", { className: "dgp-page-head" }, react.default.createElement("span", null, "CHANGES"), react.default.createElement("span", { className: "dgp-count" }, String(files.length))), error ? react.default.createElement("p", {
				className: "dgp-error",
				role: "alert"
			}, error) : null, !loc ? react.default.createElement("p", { className: "dgp-hint" }, "打开一个带工作目录的会话后再试。") : null, status && !status.ok ? react.default.createElement("p", { className: "dgp-hint" }, status.error) : null, loc && status?.ok && files.length === 0 ? react.default.createElement("p", { className: "dgp-hint" }, "没有未提交的变更") : files.map((file) => {
				const parts = fileName(file.path);
				return react.default.createElement("button", {
					key: file.path,
					type: "button",
					className: selected === file.path ? "dgp-file dgp-file-on" : "dgp-file",
					"aria-current": selected === file.path ? "true" : void 0,
					onClick: () => setSelected(file.path),
					title: file.path
				}, react.default.createElement("span", { className: "dgp-file-main" }, react.default.createElement("span", { className: "dgp-file-base" }, parts.base), parts.dir ? react.default.createElement("span", { className: "dgp-file-dir" }, parts.dir) : null), react.default.createElement("span", { className: "dgp-file-meta" }, file.insertions ? react.default.createElement("span", { className: "dgp-ins" }, `+${file.insertions}`) : null, file.deletions ? react.default.createElement("span", { className: "dgp-del" }, `-${file.deletions}`) : null, react.default.createElement("code", { className: statusTone(file.status) }, file.status.trim() || file.status)));
			})), react.default.createElement("section", { className: "dgp-page-diff" }, react.default.createElement("div", { className: "dgp-page-head dgp-diff-head" }, name ? react.default.createElement("span", { className: "dgp-diff-title" }, react.default.createElement("span", null, name.base), name.dir ? react.default.createElement("span", { className: "dgp-file-dir" }, name.dir) : null, current ? react.default.createElement("code", { className: statusTone(current.status) }, current.status.trim() || current.status) : null) : react.default.createElement("span", null, "选择一个文件")), react.default.createElement(DiffCompare, {
				rows,
				busy
			})));
		}
		function DiffCompare(props) {
			return react.default.createElement("div", { className: "dgp-split" }, react.default.createElement("div", { className: "dgp-split-head" }, react.default.createElement("div", null, "改动前"), react.default.createElement("div", null, "改动后")), react.default.createElement("div", { className: "dgp-split-body" }, props.busy ? react.default.createElement("p", { className: "dgp-hint" }, "加载 diff…") : props.rows.length === 0 ? react.default.createElement("p", { className: "dgp-hint" }, "没有可对比的内容") : props.rows.map((row, index) => react.default.createElement("div", {
				key: index,
				className: "dgp-pair"
			}, react.default.createElement(DiffCell, {
				side: "before",
				row
			}), react.default.createElement(DiffCell, {
				side: "after",
				row
			})))));
		}
		function DiffCell(props) {
			const before = props.side === "before";
			const text = before ? props.row.left : props.row.right;
			const no = before ? props.row.leftNo : props.row.rightNo;
			const tone = before ? props.row.kind === "del" || props.row.kind === "replace" ? "dgp-line-del" : text ? "" : "dgp-line-empty" : props.row.kind === "add" || props.row.kind === "replace" ? "dgp-line-add" : text ? "" : "dgp-line-empty";
			return react.default.createElement("div", { className: `dgp-line ${tone}` }, react.default.createElement("span", { className: "dgp-no" }, no ?? ""), react.default.createElement("pre", null, text || " "));
		}
		let stylesInjected = false;
		function injectStyles() {
			if (stylesInjected || typeof document === "undefined") return;
			stylesInjected = true;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-git-plus";
			tag.textContent = `
.dgp-anchor { display:none; }

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
.dfp-path-chip { order:0; max-width:240px !important; }
.dgp-toolbar { order:1; }
.dgp-toolbar { display:inline-flex; align-items:center; gap:6px; min-width:0; flex-wrap:nowrap; }
.dgp-chip, .dgp-pill { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-secondary); font:inherit; display:inline-flex; align-items:center; gap:5px; height:28px; box-sizing:border-box; max-width:168px; min-width:0; padding:0 8px; border-radius:8px; font-size:12px; line-height:1; white-space:nowrap; cursor:pointer; }
.dgp-pill { max-width:none; flex:none; }
.dgp-chip svg, .dgp-pill svg { flex:none; }
.dgp-chip-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dgp-chip:hover, .dgp-pill:hover { color:var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }
.dgp-chip[aria-expanded="true"], .dgp-pill[aria-expanded="true"], .dgp-pill[aria-pressed="true"] { color:var(--dsw-alias-state-business-primary); border-color:var(--dsw-alias-state-business-primary); background:var(--dsw-specific-sidebar-nav-item-active-accent); }
.dgp-chip:focus-visible, .dgp-pill:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.dgp-menu-content { display:flex; flex-direction:column; gap:8px; min-width:0; }
.dgp-ins { color:#3c9; font-variant-numeric:tabular-nums; }
.dgp-del { color:var(--dsw-alias-state-error-primary); font-variant-numeric:tabular-nums; }
.dgp-menu { box-sizing:border-box; padding:12px; border-radius:12px; background:var(--dsw-alias-bg-layer-3); border:1px solid var(--dsw-alias-border-l2); box-shadow:var(--dsw-elevation-prominent); display:flex; flex-direction:column; gap:8px; max-height:min(420px, calc(100vh - 24px)); overflow:auto; }
.dgp-menu-title { font-size:12px; font-weight:600; color:var(--dsw-alias-label-tertiary); }
.dgp-menu textarea { font:inherit; min-height:72px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary); padding:8px; }
.dgp-menu-foot { display:flex; justify-content:flex-end; gap:8px; }
.dgp-menu-foot button, .dgp-primary { appearance:none; border:1px solid var(--dsw-alias-border-l2); background:none; border-radius:8px; padding:6px 12px; font:inherit; font-size:12px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-primary { background:var(--dsw-alias-label-primary) !important; color:var(--dsw-alias-bg-layer-3) !important; }
.dgp-branch-list { overflow:auto; display:flex; flex-direction:column; min-height:0; }
.dgp-branch { appearance:none; border:0; background:none; width:100%; display:flex; justify-content:space-between; gap:8px; text-align:left; padding:8px 10px; border-radius:8px; font:inherit; font-size:13px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-branch:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.dgp-branch-on, .dgp-branch-on:hover:not(:disabled) { background:var(--dsw-specific-sidebar-nav-item-active-accent); color:var(--dsw-alias-state-business-primary); box-shadow:inset 3px 0 var(--dsw-alias-state-business-primary); font-weight:600; }
.dgp-branch:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dgp-branch:disabled { cursor:default; }
.dgp-branch:disabled:not(.dgp-branch-on) { opacity:.7; }
.dgp-page { display:flex; height:100%; width:100%; min-height:0; overflow:hidden; background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary); box-sizing:border-box; }
.dgp-page-files { width:280px; flex:none; overflow:auto; border-right:1px solid var(--dsw-alias-border-l2); background:var(--dsw-alias-bg-layer-2); padding-bottom:calc(var(--dsh-composer-height, 152px) + 16px); }
.dgp-page-diff { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; }
.dgp-page-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px; font-size:11px; font-weight:600; letter-spacing:.06em; color:var(--dsw-alias-label-tertiary); border-bottom:1px solid var(--dsw-alias-border-l2); }
.dgp-count { font-variant-numeric:tabular-nums; }
.dgp-diff-head { letter-spacing:0; }
.dgp-diff-title { display:flex; align-items:center; gap:8px; min-width:0; font-size:13px; font-weight:500; color:var(--dsw-alias-label-primary); letter-spacing:0; }
.dgp-file { appearance:none; box-sizing:border-box; border:0; border-radius:6px; background:none; width:calc(100% - 12px); margin:2px 6px; display:flex; align-items:center; gap:8px; text-align:left; padding:8px 10px; font:inherit; font-size:12px; cursor:pointer; color:var(--dsw-alias-label-secondary); }
.dgp-file-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.dgp-file-base { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--dsw-alias-label-primary); }
.dgp-file-dir { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--dsw-alias-label-tertiary); }
.dgp-file-meta { flex:none; display:inline-flex; align-items:center; gap:6px; font-size:11px; }
.dgp-file-meta code, .dgp-diff-title code { font:inherit; font-size:11px; font-weight:600; }
.dgp-st-mod { color:#c90; }
.dgp-st-add { color:#3c9; }
.dgp-st-del { color:var(--dsw-alias-state-error-primary); }
.dgp-file:hover { background:var(--dsw-alias-interactive-bg-hover); }
.dgp-file-on, .dgp-file-on:hover { background:var(--dsw-specific-sidebar-nav-item-active-accent); box-shadow:inset 3px 0 0 var(--dsw-alias-state-business-primary); }
.dgp-file-on .dgp-file-base { font-weight:600; }
.dgp-file-on .dgp-file-dir { color:var(--dsw-alias-label-secondary); }
.dgp-file:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:-2px; }
.dgp-split { display:flex; flex-direction:column; min-height:0; flex:1; }
.dgp-split-head { display:grid; grid-template-columns:1fr 1fr; position:sticky; top:0; z-index:1; background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-tertiary); font-size:12px; }
.dgp-split-head > div { padding:8px 12px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.dgp-split-head > div:first-child { border-right:1px solid var(--dsw-alias-border-l2); }
.dgp-split-body { flex:1; min-height:0; overflow:auto; padding-bottom:calc(var(--dsh-composer-height, 152px) + 16px); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
.dgp-pair { display:grid; grid-template-columns:1fr 1fr; }
.dgp-line { display:grid; grid-template-columns:48px minmax(0,1fr); min-height:18px; border-right:1px solid var(--dsw-alias-border-l2); }
.dgp-pair > .dgp-line:last-child { border-right:0; }
.dgp-no { padding:0 8px; text-align:right; color:var(--dsw-alias-label-tertiary); user-select:none; }
.dgp-line pre { margin:0; padding:0 8px; white-space:pre; overflow:hidden; text-overflow:ellipsis; }
.dgp-line-del { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 16%, transparent); }
.dgp-line-add { background:color-mix(in srgb, #3c9 18%, transparent); }
.dgp-line-empty { background:color-mix(in srgb, var(--dsw-alias-label-tertiary) 8%, transparent); }
.dgp-error { white-space:pre-wrap; overflow-wrap:anywhere; color:var(--dsw-alias-state-error-primary); padding:8px 12px; font-size:12px; }
.dgp-hint { padding:8px 12px; font-size:12px; color:var(--dsw-alias-label-tertiary); }
`;
			tag.textContent += repositoryStyles;
			document.head.appendChild(tag);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map