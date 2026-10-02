import { isAbsolute, relative, resolve, sep } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
//#region src/git.ts
const execFileAsync = promisify(execFile);
function createGitRunner(config = {}) {
	const executable = config.gitExecutable?.trim() || "git";
	const helperPath = config.gitExecPath?.trim();
	return async (cwd, args) => {
		try {
			const result = await execFileAsync(executable, args, {
				cwd,
				env: helperPath ? {
					...process.env,
					GIT_EXEC_PATH: helperPath
				} : process.env,
				timeout: 2e4,
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
	for (const file of parsed.files.filter((f) => !hasHead || f.status === "??")) {
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
function isSafeRef(name) {
	return name.length > 0 && name.length < 200 && !name.startsWith("-") && !name.includes("..") && !name.includes("\\") && /^[A-Za-z0-9][A-Za-z0-9._/\-]*$/.test(name);
}
function parseLocalBranches(stdout) {
	const branches = [];
	for (const line of stdout.split("\n")) {
		if (!line) continue;
		const [name, head] = line.split("	");
		if (!name || !isSafeRef(name)) continue;
		branches.push({
			name,
			current: head === "*"
		});
	}
	return branches;
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
		const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
		if (inside.code !== 0 || inside.stdout.trim() !== "true") {
			sendJson(res, 200, {
				ok: false,
				error: inside.stderr.trim() || "not a git repository"
			});
			return;
		}
		sendJson(res, 200, {
			ok: true,
			...await readStatus(git, cwd)
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
	register("/dsh-git-plus/branches", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		const listed = await git(loc.cwd, [
			"for-each-ref",
			"--sort=-committerdate",
			"--format=%(refname:short)%09%(HEAD)",
			"refs/heads"
		]);
		if (listed.code !== 0) {
			sendJson(res, 200, {
				ok: false,
				error: listed.stderr.trim() || "unable to list branches"
			});
			return;
		}
		sendJson(res, 200, {
			ok: true,
			branches: parseLocalBranches(listed.stdout)
		});
	});
	register("/dsh-git-plus/switch", async (req, res) => {
		const loc = await readWorkspace(ctx, req, res);
		if (!loc) return;
		const branch = String(loc.body.branch ?? "");
		if (!isSafeRef(branch)) {
			sendJson(res, 400, { error: "invalid branch name" });
			return;
		}
		const switched = await git(loc.cwd, [
			"switch",
			"--",
			branch
		]);
		if (switched.code !== 0) {
			sendJson(res, 200, {
				ok: false,
				error: (switched.stderr || switched.stdout).trim() || `unable to switch to ${branch}`
			});
			return;
		}
		sendJson(res, 200, {
			ok: true,
			branch
		});
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
