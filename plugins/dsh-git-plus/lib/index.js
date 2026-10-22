import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, opendir, realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
//#region src/git.ts
const execFileAsync = promisify(execFile);
function createGitRunner(config = {}) {
	const executable = config.gitExecutable?.trim() || "git";
	const helperPath = config.gitExecPath?.trim();
	return async (cwd, args, options = {}) => {
		try {
			const result = await execFileAsync(executable, args, {
				cwd,
				env: helperPath ? {
					...process.env,
					GIT_EXEC_PATH: helperPath
				} : process.env,
				timeout: options.timeoutMs ?? 2e4,
				maxBuffer: 4194304,
				windowsHide: true
			});
			return {
				stdout: result.stdout,
				stderr: result.stderr,
				code: 0
			};
		} catch (error) {
			const err = error;
			return {
				stdout: err.stdout ?? "",
				stderr: err.stderr || (error instanceof Error ? error.message : String(error)),
				code: typeof err.code === "number" ? err.code : 1
			};
		}
	};
}
//#endregion
//#region src/repository.ts
/** Partial counts are acceptable: the badge is a hint, not an audit. */
const COUNT_BUDGET_MS = 2500;
function parseStatus(output) {
	const records = output.split("\0");
	let branch = "", upstream = "";
	const files = [];
	for (let i = 0; i < records.length; i++) {
		const row = records[i];
		if (row.startsWith("## ")) {
			const names = row.slice(3).replace(/^(No commits yet on |Initial commit on )/, "").split(" [")[0];
			[branch, upstream = ""] = names.split("...");
		} else if (row) {
			const status = row.slice(0, 2);
			const file = {
				path: row.slice(3),
				status: status.trim()
			};
			if (/[RC]/.test(status)) file.oldPath = records[++i];
			files.push(file);
		}
	}
	return {
		branch,
		upstream,
		files
	};
}
function parseCounts(output) {
	let insertions = 0, deletions = 0;
	const byPath = Object.create(null);
	const records = output.split("\0");
	for (let i = 0; i < records.length; i++) {
		const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(records[i]);
		if (!match) continue;
		let path = match[3];
		if (!path) {
			i++;
			path = records[++i];
		}
		const plus = Number(match[1]) || 0, minus = Number(match[2]) || 0;
		insertions += plus;
		deletions += minus;
		byPath[path] = {
			insertions: plus,
			deletions: minus
		};
	}
	return {
		insertions,
		deletions,
		byPath
	};
}
async function sessionOwnsCwd(ctx, sessionId, cwd) {
	const live = ctx.get("sessions")?.list().find((s) => (s.id ?? s.header?.id) === sessionId);
	const persistence = ctx.get("sessionPersistence");
	const stored = live ? void 0 : await persistence?.stat(sessionId);
	if (stored && stored.header.id !== sessionId) return false;
	const root = live?.header?.cwd ?? live?.cwd ?? stored?.header.cwd;
	if (!root || !isAbsolute(cwd)) return false;
	try {
		const [owned, candidate] = await Promise.all([realpath(root), realpath(cwd)]);
		return candidate === owned || candidate.startsWith(owned + sep);
	} catch {
		return false;
	}
}
async function readStatus(git, cwd) {
	const status = await git(cwd, [
		"status",
		"--porcelain=v1",
		"-z",
		"-b",
		"--untracked-files=all"
	]);
	if (status.code !== 0) throw new Error(status.stderr.trim() || "无法读取 Git 状态");
	const parsed = parseStatus(status.stdout);
	const hasHead = (await git(cwd, [
		"rev-parse",
		"--verify",
		"HEAD"
	])).code === 0;
	let stats = "";
	if (hasHead) {
		const result = await git(cwd, [
			"diff",
			"--numstat",
			"-z",
			"HEAD"
		]);
		if (result.code !== 0) throw new Error(result.stderr);
		stats = result.stdout;
	}
	const untracked = parsed.files.filter((f) => !hasHead || f.status === "??");
	const countDeadline = Date.now() + COUNT_BUDGET_MS;
	for (const file of untracked.slice(0, 200)) {
		if (Date.now() >= countDeadline) break;
		const result = await git(cwd, [
			"diff",
			"--no-index",
			"--numstat",
			"-z",
			"--",
			"/dev/null",
			file.path
		]);
		if (result.code <= 1) stats += result.stdout;
	}
	const counts = parseCounts(stats);
	return {
		...parsed,
		files: parsed.files.map((file) => ({
			...file,
			...counts.byPath[file.path]
		})),
		insertions: counts.insertions,
		deletions: counts.deletions
	};
}
async function readDiff(git, cwd, path) {
	if (!path || isAbsolute(path) || path.includes("\0")) throw new Error("需要工作区内的相对路径");
	const rel = relative(resolve(cwd), resolve(cwd, path));
	if (rel === ".." || rel.startsWith(".." + sep)) throw new Error("路径超出工作区");
	const status = await git(cwd, [
		"status",
		"--porcelain=v1",
		"-z",
		"-b",
		"--untracked-files=all"
	]);
	if (status.code !== 0) throw new Error(status.stderr);
	const file = parseStatus(status.stdout).files.find((f) => f.path === path);
	if (!file) return "";
	const hasHead = (await git(cwd, [
		"rev-parse",
		"--verify",
		"HEAD"
	])).code === 0;
	let result;
	if (!hasHead || file.status === "??") {
		const canonical = await realpath(resolve(cwd, path));
		const root = await realpath(cwd);
		if (!canonical.startsWith(root + sep)) throw new Error("文件指向工作区外部");
		result = await git(cwd, [
			"diff",
			"--no-index",
			"--",
			"/dev/null",
			path
		]);
		if (result.code > 1) throw new Error(result.stderr);
	} else {
		result = await git(cwd, [
			"--literal-pathspecs",
			"diff",
			"HEAD",
			"--",
			...file.oldPath ? [file.oldPath] : [],
			path
		]);
		if (result.code !== 0) throw new Error(result.stderr);
	}
	return result.stdout;
}
//#endregion
//#region src/branches.ts
async function listBranches(git, cwd) {
	const result = await git(cwd, [
		"for-each-ref",
		"--sort=-committerdate",
		"--format=%(refname)%09%(HEAD)%09%(symref)",
		"refs/heads/",
		"refs/remotes/"
	]);
	if (result.code !== 0) return {
		ok: false,
		error: result.stderr.trim() || "无法列出分支"
	};
	return {
		ok: true,
		branches: result.stdout.split("\n").filter(Boolean).flatMap((line) => {
			const [ref, head, symbolic] = line.split("	");
			const remote = ref.startsWith("refs/remotes/");
			if (remote && symbolic) return [];
			return [{
				name: ref.slice(remote ? 13 : 11),
				current: !remote && head === "*",
				kind: remote ? "remote" : "local"
			}];
		})
	};
}
async function switchBranch(git, cwd, branch, kind = "local") {
	const ref = `${kind === "remote" ? "refs/remotes/" : "refs/heads/"}${branch}`;
	if (!branch || branch.startsWith("-") || (await git(cwd, ["check-ref-format", ref])).code !== 0) return {
		ok: false,
		error: "无效的分支名称"
	};
	if ((await git(cwd, [
		"show-ref",
		"--verify",
		"--quiet",
		ref
	])).code !== 0) return {
		ok: false,
		error: `分支不存在：${branch}。请重新打开分支菜单。`
	};
	let localBranch = branch;
	let trackingRemote;
	let args = [
		"switch",
		"--no-guess",
		"--",
		branch
	];
	if (kind === "remote") {
		if ((await git(cwd, [
			"symbolic-ref",
			"--quiet",
			ref
		])).code === 0) return {
			ok: false,
			error: "不能切换到远程符号引用，请选择具体分支。"
		};
		const remotes = await git(cwd, ["remote"]);
		if (remotes.code !== 0) return {
			ok: false,
			error: remotes.stderr.trim() || "无法读取远程仓库"
		};
		const remote = remotes.stdout.split("\n").filter((name) => name && branch.startsWith(`${name}/`)).sort((a, b) => b.length - a.length)[0];
		if (!remote) return {
			ok: false,
			error: `找不到远程分支对应的远程仓库：${branch}`
		};
		localBranch = branch.slice(remote.length + 1);
		if (localBranch.startsWith("-") || (await git(cwd, ["check-ref-format", `refs/heads/${localBranch}`])).code !== 0) return {
			ok: false,
			error: "远程分支无法转换为有效的本地分支名称"
		};
		if ((await git(cwd, [
			"show-ref",
			"--verify",
			"--quiet",
			`refs/heads/${localBranch}`
		])).code === 0) return {
			ok: false,
			error: `本地分支已存在：${localBranch}。请选择本地分支，或使用 Git 检查其上游。`
		};
		trackingRemote = remote;
		args = [
			"switch",
			"--no-guess",
			"--create",
			localBranch,
			"--no-track",
			"--",
			ref
		];
	}
	const result = await git(cwd, args);
	if (result.code !== 0) return {
		ok: false,
		error: (result.stderr || result.stdout).trim() || `无法切换到 ${branch}`
	};
	if (trackingRemote) for (const [key, value] of [["remote", trackingRemote], ["merge", `refs/heads/${localBranch}`]]) {
		const configured = await git(cwd, [
			"config",
			"--local",
			"--replace-all",
			`branch.${localBranch}.${key}`,
			value
		]);
		if (configured.code !== 0) return {
			ok: false,
			error: `已切换到 ${localBranch}，但设置上游失败：${configured.stderr.trim()}`
		};
	}
	return {
		ok: true,
		branch: localBranch
	};
}
//#endregion
//#region src/repositories.ts
const SCAN_LIMITS = {
	maxDepth: 8,
	maxDirectories: 2e3,
	maxRepositories: 100,
	maxDurationMs: 3e3
};
const SKIP = /* @__PURE__ */ new Set([
	".git",
	"node_modules",
	".cache",
	".npm",
	".pnpm-store",
	".yarn",
	"dist",
	"build",
	"out",
	"target",
	"coverage",
	".next",
	".nuxt",
	".turbo",
	".venv",
	"venv",
	"__pycache__",
	".gradle"
]);
const contained = (root, path) => path === root || !isAbsolute(relative(root, path)) && relative(root, path) !== ".." && !relative(root, path).startsWith(".." + sep);
/** A fresh check for every action; discovery results never authorize a target. */
async function resolveRepository(git, cwd, repositoryPath = ".") {
	if (typeof repositoryPath !== "string" || !repositoryPath || isAbsolute(repositoryPath) || /^[A-Za-z]:/.test(repositoryPath) || repositoryPath.includes("\\") || repositoryPath.includes("\0") || repositoryPath.split("/").includes("..")) throw new Error("repositoryPath must be a relative path without ..");
	const root = await realpath(cwd);
	const target = await realpath(resolve(root, repositoryPath));
	if (!contained(root, target)) throw new Error("repositoryPath is outside the authorized cwd");
	let cursor = root;
	for (const part of repositoryPath.split("/").filter((p) => p && p !== ".")) {
		cursor = join(cursor, part);
		if ((await lstat(cursor)).isSymbolicLink()) throw new Error("repositoryPath must not traverse symlink directories");
	}
	const result = await git(target, ["rev-parse", "--show-toplevel"]);
	if (result.code !== 0) throw new Error("repositoryPath is not a Git worktree");
	const top = await realpath(result.stdout.trim());
	if (target !== root && top !== target) throw new Error("repositoryPath must identify an exact Git worktree root");
	return target;
}
async function scanRepositories(git, cwd, overrides = {}) {
	const limits = {
		...SCAN_LIMITS,
		...overrides
	};
	const root = await realpath(cwd);
	const deadline = Date.now() + limits.maxDurationMs;
	const repositories = [];
	const reasons = /* @__PURE__ */ new Set();
	const errors = [];
	const expired = () => {
		if (Date.now() >= deadline) {
			reasons.add("time");
			return true;
		}
		return false;
	};
	const run = async (path, args) => {
		if (expired()) return {
			code: 1,
			stdout: "",
			stderr: "Repository scan time limit reached"
		};
		const result = await git(path, args, { timeoutMs: Math.max(1, deadline - Date.now()) });
		expired();
		return result;
	};
	const inspect = async (path, rel) => {
		const info = await run(path, [
			"rev-parse",
			"--show-toplevel",
			"--absolute-git-dir",
			"--git-common-dir",
			"--show-superproject-working-tree"
		]);
		if (info.code !== 0) return;
		const [top, gitDir, commonDir, superproject] = info.stdout.trimEnd().split("\n");
		if (!top || !gitDir || !commonDir) return;
		if (rel !== "." && await realpath(top) !== path) return;
		const branch = await run(path, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD"
		]);
		if (expired()) return;
		const kind = superproject ? "submodule" : await realpath(resolve(path, gitDir)) !== await realpath(resolve(path, commonDir)) ? "worktree" : "repository";
		repositories.push({
			path: rel,
			name: basename(path),
			branch: branch.code === 0 ? branch.stdout.trim() : "HEAD (detached)",
			kind
		});
	};
	const queue = [{
		path: root,
		rel: ".",
		depth: 0
	}];
	const queued = /* @__PURE__ */ new Set([root]);
	let scheduled = 1;
	let scanIndex = -1;
	const enqueue = (path, rel, depth) => {
		if (queued.has(path)) return;
		if (depth > limits.maxDepth) {
			reasons.add("depth");
			return;
		}
		if (scheduled >= limits.maxDirectories) {
			reasons.add("directories");
			return;
		}
		if (repositories.length >= limits.maxRepositories) {
			reasons.add("repositories");
			return;
		}
		queued.add(path);
		scheduled++;
		const insertion = queue.findIndex((item, index) => index > scanIndex && item.depth > depth);
		const item = {
			path,
			rel,
			depth
		};
		if (insertion < 0) queue.push(item);
		else queue.splice(insertion, 0, item);
	};
	for (scanIndex = 0; scanIndex < queue.length; scanIndex++) {
		if (expired()) break;
		if (repositories.length >= limits.maxRepositories) {
			reasons.add("repositories");
			break;
		}
		const item = queue[scanIndex];
		try {
			if (await realpath(item.path) !== item.path || !(await lstat(item.path)).isDirectory()) continue;
			let candidate = item.depth === 0;
			if (!candidate) try {
				const marker = await lstat(join(item.path, ".git"));
				candidate = marker.isFile() || marker.isDirectory();
			} catch {}
			const before = repositories.length;
			if (candidate) await inspect(item.path, item.rel);
			if (expired()) break;
			if (repositories.length > before) {
				let hasModules = false;
				try {
					hasModules = (await lstat(join(item.path, ".gitmodules"))).isFile();
				} catch {}
				if (hasModules) {
					const modules = await run(item.path, [
						"config",
						"--null",
						"--file",
						".gitmodules",
						"--get-regexp",
						"^submodule\\..*\\.path$"
					]);
					for (const record of modules.stdout.split("\0")) {
						if (expired()) break;
						const split = record.indexOf("\n");
						if (split < 0) continue;
						const subpath = record.slice(split + 1);
						const parts = subpath.split("/");
						if (!subpath || isAbsolute(subpath) || subpath.includes("\\") || /^[A-Za-z]:/.test(subpath) || parts.some((p) => !p || p === "." || p === ".." || p === ".git")) continue;
						const depth = item.depth + parts.length;
						if (depth > limits.maxDepth) {
							reasons.add("depth");
							continue;
						}
						let path = item.path, safe = true;
						for (const part of parts) {
							path = join(path, part);
							try {
								if (!(await lstat(path)).isDirectory()) {
									safe = false;
									break;
								}
							} catch {
								safe = false;
								break;
							}
						}
						if (!safe || !contained(root, path)) continue;
						try {
							const marker = await lstat(join(path, ".git"));
							if (!marker.isFile() && !marker.isDirectory()) continue;
						} catch {
							continue;
						}
						enqueue(path, item.rel === "." ? subpath : `${item.rel}/${subpath}`, depth);
					}
				}
			}
			if (expired()) break;
			const directory = await opendir(item.path);
			for await (const entry of directory) {
				if (expired()) break;
				if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
				if (item.depth >= limits.maxDepth) {
					reasons.add("depth");
					continue;
				}
				if (scheduled >= limits.maxDirectories) {
					reasons.add("directories");
					break;
				}
				if (repositories.length >= limits.maxRepositories) {
					reasons.add("repositories");
					break;
				}
				enqueue(join(item.path, entry.name), item.rel === "." ? entry.name : `${item.rel}/${entry.name}`, item.depth + 1);
			}
		} catch (error) {
			if (errors.length < 20) errors.push({
				path: item.rel,
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}
	repositories.sort((a, b) => a.path === "." ? -1 : b.path === "." ? 1 : a.path.localeCompare(b.path));
	return {
		ok: true,
		repositories,
		truncated: reasons.size > 0,
		limits,
		limitReasons: [...reasons],
		...errors.length ? { errors } : {}
	};
}
/** Per-plugin bounded cache, keyed by canonical authorized cwd, with explicit refresh. */
function createRepositoryDiscovery(git) {
	const cache = /* @__PURE__ */ new Map();
	const pending = /* @__PURE__ */ new Map();
	return async (cwd, refresh = false) => {
		const root = await realpath(cwd);
		const previous = cache.get(root);
		if (!refresh && previous && previous.expires > Date.now()) return previous.result;
		const active = pending.get(root);
		if (active) return active;
		while (pending.size >= 32) await Promise.race(pending.values()).catch(() => {});
		const waiting = pending.get(root);
		if (waiting) return waiting;
		const scan = scanRepositories(git, root).then((result) => {
			if (cache.size >= 32) cache.delete(cache.keys().next().value);
			cache.set(root, {
				expires: Date.now() + 15e3,
				result
			});
			return result;
		}).finally(() => {
			pending.delete(root);
		});
		pending.set(root, scan);
		return scan;
	};
}
//#endregion
//#region src/summary.ts
async function drainSummary(ctx, config, diff, sessionId) {
	if (!diff.trim()) throw new Error("没有可用于生成提交说明的变更");
	const llm = ctx.get("llm");
	if (!llm) throw new Error("LLM 服务未加载");
	const defaults = ctx.get("agentDefaultModel")?.currentSelection();
	const provider = config.provider || defaults?.provider || llm.listProviders()[0]?.id;
	if (!provider) throw new Error("请先配置模型提供方");
	const model = config.model || (provider === defaults?.provider ? defaults.model : "") || (await llm.listModels(provider))[0]?.id;
	if (!model) throw new Error("请先配置模型");
	const signal = AbortSignal.timeout(9e4);
	const clipped = diff.length > 8e4 ? diff.slice(0, 8e4) + "\n…(truncated)" : diff;
	let text = "", finished = false;
	for await (const chunk of llm.stream({
		provider,
		model,
		system: config.prompt,
		messages: [{
			id: randomUUID(),
			role: "user",
			source: { kind: "dsh-git-plus" },
			content: [{
				type: "text",
				text: clipped
			}]
		}],
		sessionId,
		purpose: "git-commit-message",
		signal
	})) {
		signal.throwIfAborted();
		if (chunk.type === "text-delta") text += chunk.text ?? "";
		if (chunk.type === "finish") {
			if (chunk.reason?.kind !== "stop") throw new Error(chunk.reason?.failure?.message ?? `生成未完成：${chunk.reason?.kind}`);
			finished = true;
		}
	}
	if (!finished || !text.trim()) throw new Error("模型没有返回完整的提交说明");
	return text.trim();
}
//#endregion
//#region src/index.ts
const name = "dsh-git-plus";
const inject = [
	"webServer",
	"connection",
	"sessions"
];
const Config = Schema.object({
	gitExecutable: Schema.string().default("").description("Git executable path. Empty uses git from the host PATH."),
	gitExecPath: Schema.string().default("").description("Optional Git helper directory (GIT_EXEC_PATH), for portable Git distributions."),
	provider: Schema.string().default(""),
	model: Schema.string().default(""),
	prompt: Schema.string().default("Write a concise Conventional Commits message for the git diff below. Reply with the message only.")
});
const MAX_BODY_BYTES = 262144;
function sendJson(res, status, payload) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(payload));
}
async function readBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.byteLength;
		if (size > MAX_BODY_BYTES) {
			req.resume();
			return null;
		}
		chunks.push(chunk);
	}
	return Buffer.concat(chunks, size).toString("utf8");
}
function rejected(ctx, req, res) {
	const connection = ctx.get("connection");
	const code = connection?.requestRejection({ headers: req.headers });
	if (connection && code === void 0) return false;
	res.statusCode = code ?? 403;
	res.end();
	return true;
}
async function parseJsonBody(req, res) {
	if (req.method !== "POST") {
		res.statusCode = 405;
		res.setHeader("allow", "POST");
		res.end();
		return null;
	}
	if (String(req.headers["content-type"]).split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
		sendJson(res, 415, { error: "content-type must be application/json" });
		return null;
	}
	const text = await readBody(req);
	if (text === null) {
		sendJson(res, 413, { error: "payload too large" });
		return null;
	}
	try {
		const value = JSON.parse(text);
		if (value === null || typeof value !== "object" || Array.isArray(value)) {
			sendJson(res, 400, { error: "body must be a JSON object" });
			return null;
		}
		return value;
	} catch {
		sendJson(res, 400, { error: "invalid JSON" });
		return null;
	}
}
async function readWorkspace(ctx, req, res) {
	const body = await parseJsonBody(req, res);
	if (!body) return null;
	const sessionId = String(body.sessionId ?? "");
	const cwd = String(body.cwd ?? "");
	if (!sessionId || !cwd || !isAbsolute(cwd)) {
		sendJson(res, 400, { error: "sessionId and absolute cwd are required" });
		return null;
	}
	if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
		sendJson(res, 403, { error: "cwd is not owned by the live session" });
		return null;
	}
	return {
		sessionId,
		cwd,
		body
	};
}
function apply(ctx, config) {
	const git = createGitRunner(config);
	const discoverRepositories = createRepositoryDiscovery(git);
	const selectedRepository = async (loc, res) => {
		if (loc.body.repositoryPath === void 0) return loc.cwd;
		try {
			return await resolveRepository(git, loc.cwd, loc.body.repositoryPath);
		} catch (error) {
			sendJson(res, 400, {
				ok: false,
				error: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	};
	const webServer = Reflect.get(ctx, "webServer");
	const register = (path, handler) => {
		ctx.effect(() => webServer.register({
			kind: "exact",
			path,
			handler: async (req, res) => {
				if (rejected(ctx, req, res)) return;
				try {
					await handler(req, res);
				} catch (error) {
					sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				}
			}
		}));
	};
	register("/dsh-git-plus/status", async (req, res) => {
		const body = await parseJsonBody(req, res);
		if (!body) return;
		const sessionId = String(body.sessionId ?? "");
		const cwd = String(body.cwd ?? "");
		if (!sessionId || !cwd || !isAbsolute(cwd)) {
			sendJson(res, 400, { error: "sessionId and absolute cwd are required" });
			return;
		}
		if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
			sendJson(res, 403, { error: "cwd is not owned by the live session" });
			return;
		}
		const summary = await git(cwd, [
			"status",
			"--porcelain=v1",
			"-z",
			"-b",
			"--untracked-files=all"
		]);
		if (summary.code !== 0) {
			sendJson(res, 200, {
				ok: false,
				error: summary.stderr.trim() || "not a git repository"
			});
			return;
		}
		sendJson(res, 200, {
			ok: true,
			...parseStatus(summary.stdout),
			countsPending: true
		});
	});
	register("/dsh-git-plus/counts", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		if (!loc.body || typeof loc.body !== "object" || typeof loc.body.cwd !== "string") {
			sendJson(res, 400, { error: "需要工作目录" });
			return;
		}
		sendJson(res, 200, {
			ok: true,
			...await readStatus(git, loc.body.cwd)
		});
	});
	register("/dsh-git-plus/diff", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		if (typeof loc.body.path !== "string") {
			sendJson(res, 400, { error: "需要文件路径" });
			return;
		}
		sendJson(res, 200, {
			ok: true,
			diff: await readDiff(git, loc.cwd, loc.body.path)
		});
	});
	register("/dsh-git-plus/repositories", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		if (loc.body.refresh !== void 0 && typeof loc.body.refresh !== "boolean") {
			sendJson(res, 400, {
				ok: false,
				error: "refresh must be a boolean"
			});
			return;
		}
		sendJson(res, 200, await discoverRepositories(loc.cwd, loc.body.refresh === true));
	});
	register("/dsh-git-plus/branches", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		const cwd = await selectedRepository(loc, res);
		if (!cwd) return;
		sendJson(res, 200, await listBranches(git, cwd));
	});
	register("/dsh-git-plus/switch", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		if (typeof loc.body.branch !== "string") {
			sendJson(res, 400, { error: "branch must be a string" });
			return;
		}
		if (loc.body.kind !== void 0 && loc.body.kind !== "local" && loc.body.kind !== "remote") {
			sendJson(res, 400, { error: "kind must be local or remote" });
			return;
		}
		const cwd = await selectedRepository(loc, res);
		if (!cwd) return;
		sendJson(res, 200, await switchBranch(git, cwd, loc.body.branch, loc.body.kind));
	});
	register("/dsh-git-plus/summarize", async (req, res) => {
		const body = await parseJsonBody(req, res);
		if (!body) return;
		const sessionId = String(body.sessionId ?? "");
		const cwd = String(body.cwd ?? "");
		if (!sessionId || !cwd || !isAbsolute(cwd)) {
			sendJson(res, 400, { error: "sessionId and absolute cwd are required" });
			return;
		}
		if (!await sessionOwnsCwd(ctx, sessionId, cwd)) {
			sendJson(res, 403, { error: "cwd is not owned by the live session" });
			return;
		}
		const status = await readStatus(git, cwd);
		const parts = [];
		let size = 0;
		for (const file of status.files) {
			const diff = await readDiff(git, cwd, file.path);
			parts.push(diff);
			size += diff.length;
			if (size >= 8e4) break;
		}
		sendJson(res, 200, {
			ok: true,
			message: await drainSummary(ctx, config, parts.join("\n"), sessionId)
		});
	});
}
//#endregion
export { Config, apply, inject, name };
