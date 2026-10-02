import { execFile } from "node:child_process";
import { isAbsolute, resolve, sep } from "node:path";
import { promisify } from "node:util";
import Schema from "@deepseek-ai/schemastery";
//#region src/index.ts
const execFileAsync = promisify(execFile);
const name = "dsh-git-plus";
const inject = ["webServer"];
const Config = Schema.object({
	provider: Schema.string().default(""),
	model: Schema.string().default(""),
	prompt: Schema.string().default("Write a concise Conventional Commits message for the git diff below. Reply with the message only.")
});
const MAX_BODY_BYTES = 262144;
const GIT_TIMEOUT_MS = 2e4;
const DIFF_MAX_CHARS = 8e4;
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
	const code = ctx.get("connection")?.requestRejection({ headers: req.headers });
	if (code === void 0) return false;
	res.statusCode = code;
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
function sessionOwnsCwd(ctx, sessionId, cwd) {
	const list = ctx.get("sessions")?.list?.() ?? [];
	for (const raw of list) {
		const session = raw;
		if ((session.id ?? session.header?.id) !== sessionId) continue;
		const root = session.header?.cwd ?? session.cwd;
		if (!root) return true;
		const resolved = resolve(cwd);
		const owned = resolve(root);
		return resolved === owned || resolved.startsWith(owned + sep);
	}
	return list.length === 0;
}
async function git(cwd, args) {
	try {
		const result = await execFileAsync("git", args, {
			cwd,
			timeout: GIT_TIMEOUT_MS,
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
			stderr: err.stderr ?? (error instanceof Error ? error.message : String(error)),
			code: typeof err.code === "number" ? err.code : 1
		};
	}
}
function parsePorcelain(stdout) {
	const lines = stdout.split("\n").filter(Boolean);
	let branch = "";
	let upstream = "";
	const files = [];
	for (const line of lines) {
		if (line.startsWith("## ")) {
			const [names] = line.slice(3).split(" ", 1);
			const [head, remote] = (names ?? "").split("...");
			branch = head ?? "";
			upstream = remote ?? "";
			continue;
		}
		const status = line.slice(0, 2).trim() || line.slice(0, 2);
		const raw = line.slice(3);
		const path = raw.includes(" -> ") ? raw.split(" -> ").pop() ?? raw : raw;
		if (path) files.push({
			path,
			status
		});
	}
	return {
		branch,
		upstream,
		files
	};
}
function parseNumstat(stdout) {
	let insertions = 0;
	let deletions = 0;
	const byPath = {};
	for (const line of stdout.split("\n")) {
		if (!line) continue;
		const [added, removed, path] = line.split("	");
		const plus = added && added !== "-" ? Number(added) || 0 : 0;
		const minus = removed && removed !== "-" ? Number(removed) || 0 : 0;
		insertions += plus;
		deletions += minus;
		if (path) byPath[path] = {
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
	if (!sessionOwnsCwd(ctx, sessionId, cwd)) {
		sendJson(res, 403, { error: "cwd is not owned by the live session" });
		return null;
	}
	return {
		sessionId,
		cwd,
		body
	};
}
async function drainSummary(ctx, config, diff) {
	const llm = ctx.get("llm");
	if (!llm) throw new Error("llm service is not mounted");
	const providers = llm.listProviders?.() ?? [];
	const providerName = config.provider || (typeof providers[0] === "string" ? providers[0] : providers[0]?.name);
	if (!providerName) throw new Error("no LLM provider is configured");
	let model = config.model;
	if (!model && llm.listModels) {
		const first = (await llm.listModels(providerName))[0];
		model = typeof first === "string" ? first : first?.id ?? "";
	}
	if (!model) throw new Error("no LLM model is configured");
	const clipped = diff.length > DIFF_MAX_CHARS ? `${diff.slice(0, DIFF_MAX_CHARS)}\n…(truncated)` : diff;
	let text = "";
	for await (const chunk of llm.stream({
		provider: providerName,
		model,
		system: config.prompt,
		messages: [{
			id: crypto.randomUUID(),
			role: "user",
			content: [{
				type: "text",
				text: clipped || "(no diff)"
			}]
		}]
	})) {
		if (chunk.type === "text-delta" && chunk.text) text += chunk.text;
		if (chunk.type === "finish" && chunk.reason && chunk.reason !== "stop" && chunk.reason !== "end") throw new Error(`model finished with ${chunk.reason}`);
	}
	return text.trim();
}
function apply(ctx, config) {
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
		if (!sessionOwnsCwd(ctx, sessionId, cwd)) {
			sendJson(res, 403, { error: "cwd is not owned by the live session" });
			return;
		}
		const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
		if (inside.code !== 0 || inside.stdout.trim() !== "true") {
			sendJson(res, 200, {
				ok: false,
				error: "not a git repository"
			});
			return;
		}
		const parsed = parsePorcelain((await git(cwd, [
			"status",
			"--porcelain=v1",
			"-b"
		])).stdout);
		const counts = parseNumstat((await git(cwd, [
			"diff",
			"--numstat",
			"HEAD"
		])).stdout);
		const stat = await git(cwd, [
			"diff",
			"--stat",
			"HEAD"
		]);
		sendJson(res, 200, {
			ok: true,
			branch: parsed.branch,
			upstream: parsed.upstream,
			files: parsed.files.map((file) => ({
				...file,
				insertions: counts.byPath[file.path]?.insertions,
				deletions: counts.byPath[file.path]?.deletions
			})),
			insertions: counts.insertions,
			deletions: counts.deletions,
			stat: stat.stdout.trim()
		});
	});
	register("/dsh-git-plus/diff", async (req, res) => {
		const body = await parseJsonBody(req, res);
		if (!body) return;
		const sessionId = String(body.sessionId ?? "");
		const cwd = String(body.cwd ?? "");
		const filePath = String(body.path ?? "");
		if (!sessionId || !cwd || !isAbsolute(cwd) || !filePath || filePath.includes("..")) {
			sendJson(res, 400, { error: "sessionId, absolute cwd, and a relative path are required" });
			return;
		}
		if (!sessionOwnsCwd(ctx, sessionId, cwd)) {
			sendJson(res, 403, { error: "cwd is not owned by the live session" });
			return;
		}
		const tracked = await git(cwd, [
			"diff",
			"HEAD",
			"--",
			filePath
		]);
		const untracked = tracked.stdout.trim() ? tracked : await git(cwd, [
			"diff",
			"--no-index",
			"--",
			"/dev/null",
			filePath
		]);
		sendJson(res, 200, {
			ok: true,
			diff: untracked.stdout || untracked.stderr
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
		if (!sessionOwnsCwd(ctx, sessionId, cwd)) {
			sendJson(res, 403, { error: "cwd is not owned by the live session" });
			return;
		}
		const staged = await git(cwd, ["diff", "--cached"]);
		const unstaged = await git(cwd, ["diff"]);
		sendJson(res, 200, {
			ok: true,
			message: await drainSummary(ctx, config, [staged.stdout, unstaged.stdout].filter(Boolean).join("\n"))
		});
	});
}
//#endregion
export { Config, apply, inject, name };
