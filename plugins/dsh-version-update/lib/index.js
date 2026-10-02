import { createRequire } from "node:module";
import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import Schema from "@deepseek-ai/schemastery";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
//#region src/performance-log.ts
function sanitizeEvent(value) {
	const v = value;
	if (!v || typeof v !== "object" || ![
		"start",
		"tab",
		"frame-gap",
		"longtask",
		"request",
		"files-sync",
		"files-mount",
		"terminal-mount",
		"terminal-ready",
		"quick-save",
		"session-change",
		"files-ready",
		"blank-navigation",
		"stop"
	].includes(String(v.kind))) throw new Error("Invalid event");
	const out = { kind: String(v.kind) };
	for (const key of [
		"t",
		"duration",
		"count",
		"status",
		"width",
		"height",
		"switchId"
	]) if (typeof v[key] === "number" && Number.isFinite(v[key])) out[key] = v[key];
	for (const key of [
		"tab",
		"phase",
		"endpoint",
		"run"
	]) if (typeof v[key] === "string" && /^[a-zA-Z0-9_./-]{0,90}$/.test(v[key])) out[key] = v[key];
	for (const key of ["longtaskSupported", "visible"]) if (typeof v[key] === "boolean") out[key] = v[key];
	return out;
}
function installPerformanceLog(ctx) {
	const server = ctx.get("webServer");
	const directory = join(homedir(), ".dsh", "logs");
	const file = join(directory, "ui-performance.jsonl");
	let pending = 0;
	let queue = Promise.resolve();
	ctx.effect(() => server.register({
		kind: "exact",
		path: "/dsh-ui-performance",
		handler: async (req, res) => {
			const fence = ctx.get("connection");
			const denied = fence?.requestRejection({ headers: req.headers });
			if (!fence || denied !== void 0) {
				res.statusCode = denied ?? 403;
				res.end();
				return;
			}
			if (req.method !== "POST" || !String(req.headers["content-type"]).startsWith("application/json")) {
				res.statusCode = 400;
				res.end();
				return;
			}
			if (pending >= 4) {
				res.statusCode = 429;
				res.end();
				return;
			}
			try {
				const chunks = [];
				let size = 0;
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 65536) throw new Error("Too large");
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (!Array.isArray(body.events) || body.events.length > 200) throw new Error("Invalid batch");
				const data = body.events.map((event) => JSON.stringify({
					receivedAt: Date.now(),
					...sanitizeEvent(event)
				})).join("\n") + "\n";
				pending++;
				const write = queue.then(async () => {
					await mkdir(directory, {
						recursive: true,
						mode: 448
					});
					if (await stat(file).then((s) => s.size > 5e6).catch(() => false)) await rename(file, file + ".1");
					await appendFile(file, data, { mode: 384 });
				});
				queue = write.catch(() => {});
				try {
					await write;
				} finally {
					pending--;
				}
				res.statusCode = 204;
				res.end();
			} catch {
				res.statusCode = 400;
				res.end();
			}
		}
	}));
}
//#endregion
//#region src/probe.ts
function readJson(path) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return null;
	}
}
function walkParents(start) {
	const out = [];
	let dir = start;
	for (let i = 0; i < 16; i += 1) {
		out.push(dir);
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return out;
}
function dirOfArgv(path) {
	try {
		return dirname(path.startsWith("file:") ? fileURLToPath(path) : path);
	} catch {
		return process.cwd();
	}
}
function isNpxInstall(dir) {
	return dir.includes("_npx") || dir.includes("npm-cache") || dir.includes(`${sep}dlx${sep}`) || dir.includes("/dlx/");
}
function classify(pkg, dir) {
	if (pkg.name === "@deepseek-ai/dsh-root") return {
		current: typeof pkg.version === "string" ? pkg.version : null,
		mode: "source",
		hint: "当前是源码检出，版本插件不会执行 npm 更新。开发请自行 git pull。"
	};
	if (pkg.name === "@deepseek-ai/dsh" && typeof pkg.version === "string") {
		const npx = isNpxInstall(dir);
		return {
			current: pkg.version,
			mode: npx ? "npx" : "global",
			hint: npx ? "npx --yes @deepseek-ai/dsh@latest web" : "npm install -g @deepseek-ai/dsh@latest"
		};
	}
	return null;
}
function probeFromStart(start) {
	let npm = null;
	for (const dir of walkParents(start)) {
		const pkgPath = join(dir, "package.json");
		if (!existsSync(pkgPath)) continue;
		const pkg = readJson(pkgPath);
		if (!pkg) continue;
		const found = classify(pkg, dir);
		if (!found) continue;
		if (found.mode === "source") return found;
		if (!npm) npm = found;
	}
	return npm;
}
function resolveNearby(id, from) {
	try {
		return createRequire(from).resolve(`${id}/package.json`);
	} catch {
		return null;
	}
}
function collectStarts(input) {
	const starts = [];
	const seen = /* @__PURE__ */ new Set();
	const push = (dir) => {
		if (!dir || seen.has(dir)) return;
		seen.add(dir);
		starts.push(dir);
	};
	if (input.argv1) {
		try {
			push(dirname(realpathSync(input.argv1)));
		} catch {}
		push(dirOfArgv(input.argv1));
		const from = input.argv1.startsWith("file:") ? fileURLToPath(input.argv1) : input.argv1;
		const dsh = resolveNearby("@deepseek-ai/dsh", from);
		if (dsh) push(dirname(dsh));
		const root = resolveNearby("@deepseek-ai/dsh-root", from);
		if (root) push(dirname(root));
	}
	push(input.cwd);
	return starts;
}
function probeInstall(input = {
	argv1: process.argv[1],
	cwd: process.cwd()
}) {
	let npm = null;
	for (const start of collectStarts(input)) {
		const found = probeFromStart(start);
		if (found?.mode === "source") return found;
		if (found && !npm) npm = found;
	}
	return npm ?? {
		current: null,
		mode: "unknown",
		hint: "无法识别本地 dsh 安装"
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-version-update";
const inject = ["webServer"];
const Config = Schema.object({
	checkIntervalMs: Schema.number().default(216e5),
	timeoutMs: Schema.number().default(5e3),
	registry: Schema.string().default("https://registry.npmjs.org")
});
function sendJson(res, status, payload) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(payload));
}
function rejected(ctx, req, res) {
	const code = ctx.get("connection")?.requestRejection({ headers: req.headers });
	if (code === void 0) return false;
	res.statusCode = code;
	res.end();
	return true;
}
function webArgs() {
	const rest = process.argv.slice(2);
	return rest[0] === "web" ? rest : ["web", ...rest];
}
function relaunchLatest() {
	spawn("npx", [
		"--yes",
		"@deepseek-ai/dsh@latest",
		...webArgs()
	], {
		detached: true,
		stdio: "ignore",
		windowsHide: true,
		env: process.env
	}).unref();
}
async function fetchLatest(registry, timeoutMs) {
	const url = `${registry.replace(/\/$/, "")}/@deepseek-ai/dsh/latest`;
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: ac.signal,
			headers: { accept: "application/json" }
		});
		if (!res.ok) throw new Error(`registry ${res.status}`);
		const body = await res.json();
		if (!body.version) throw new Error("registry payload missing version");
		return body.version;
	} finally {
		clearTimeout(timer);
	}
}
function apply(ctx, config) {
	installPerformanceLog(ctx);
	const webServer = Reflect.get(ctx, "webServer");
	let cached = {
		state: "checking",
		current: null,
		latest: null,
		mode: "unknown",
		hint: "",
		error: null,
		fetchedAt: null
	};
	let updating = false;
	const refresh = async () => {
		const probe = probeInstall();
		if (probe.mode === "source") {
			cached = {
				state: "source",
				current: probe.current,
				latest: null,
				mode: "source",
				hint: probe.hint,
				error: null,
				fetchedAt: Date.now()
			};
			return cached;
		}
		if (!probe.current) {
			cached = {
				state: "unknown",
				current: null,
				latest: null,
				mode: probe.mode,
				hint: probe.hint,
				error: null,
				fetchedAt: Date.now()
			};
			return cached;
		}
		try {
			const latest = await fetchLatest(config.registry, config.timeoutMs);
			cached = {
				state: latest === probe.current ? "up-to-date" : "update-available",
				current: probe.current,
				latest,
				mode: probe.mode,
				hint: probe.hint,
				error: null,
				fetchedAt: Date.now()
			};
		} catch (error) {
			cached = {
				state: "error",
				current: probe.current,
				latest: cached.latest,
				mode: probe.mode,
				hint: probe.hint,
				error: error instanceof Error ? error.message : String(error),
				fetchedAt: Date.now()
			};
		}
		return cached;
	};
	ctx.effect(() => {
		refresh();
		const timer = setInterval(() => {
			refresh();
		}, config.checkIntervalMs);
		return () => clearInterval(timer);
	});
	ctx.effect(() => webServer.register({
		kind: "exact",
		path: "/dsh-version-update/check",
		handler: async (req, res) => {
			if (rejected(ctx, req, res)) return;
			if (req.method !== "GET") {
				res.statusCode = 405;
				res.setHeader("allow", "GET");
				res.end();
				return;
			}
			if (new URL(String(req.url), "http://localhost").searchParams.get("force") === "1") await refresh();
			sendJson(res, 200, cached);
		}
	}));
	ctx.effect(() => webServer.register({
		kind: "exact",
		path: "/dsh-version-update/update",
		handler: async (req, res) => {
			if (rejected(ctx, req, res)) return;
			if (req.method !== "POST") {
				res.statusCode = 405;
				res.setHeader("allow", "POST");
				res.end();
				return;
			}
			if (updating) {
				sendJson(res, 409, { error: "update already running" });
				return;
			}
			const snapshot = cached.state === "update-available" ? cached : await refresh();
			if (snapshot.mode === "source") {
				sendJson(res, 400, { error: snapshot.hint });
				return;
			}
			if (snapshot.state !== "update-available") {
				sendJson(res, 400, { error: "no npm update is available" });
				return;
			}
			updating = true;
			try {
				if (snapshot.mode === "global") await new Promise((resolvePromise, reject) => {
					const child = spawn("npm", [
						"install",
						"-g",
						"@deepseek-ai/dsh@latest"
					], {
						stdio: [
							"ignore",
							"pipe",
							"pipe"
						],
						windowsHide: true
					});
					let stderr = "";
					child.stderr?.on("data", (chunk) => {
						stderr += chunk.toString();
					});
					child.on("error", reject);
					child.on("exit", (code) => {
						if (code === 0) resolvePromise();
						else reject(new Error(stderr.trim() || `npm exited ${String(code)}`));
					});
				});
				relaunchLatest();
				sendJson(res, 200, {
					ok: true,
					restart: true,
					hint: "正在下载最新版本并重启。"
				});
				setTimeout(() => process.exit(0), 500);
			} catch (error) {
				sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
				updating = false;
			}
		}
	}));
}
//#endregion
export { Config, apply, inject, name };
