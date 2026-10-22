import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region src/index.ts
const name = "dsh-file-preview";
const inject = [
	"webServer",
	"connection",
	"sessions"
];
const exec = promisify(execFile);
/** Probe the resolved project directory only; inherited Git overrides must not redirect it. */
async function gitWorktree(cwd) {
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	try {
		return (await exec("git", ["rev-parse", "--is-inside-work-tree"], {
			cwd,
			env,
			timeout: 5e3,
			maxBuffer: 16384,
			windowsHide: true
		})).stdout.trim() === "true";
	} catch {
		return false;
	}
}
function apply(ctx) {
	const server = ctx.get("webServer");
	const send = (res, status, body) => {
		res.statusCode = status;
		res.setHeader("content-type", "application/json; charset=utf-8");
		res.setHeader("cache-control", "no-store");
		res.end(JSON.stringify(body));
	};
	ctx.effect(() => server.register({
		kind: "exact",
		path: "/dsh-file-preview",
		handler: async (req, res) => {
			const fence = ctx.get("connection");
			const denied = fence?.requestRejection({ headers: req.headers });
			if (!fence || denied !== void 0) {
				send(res, denied ?? 403, { error: "访问被拒绝。" });
				return;
			}
			if (req.method !== "POST" || String(req.headers["content-type"]).split(";")[0]?.trim() !== "application/json") {
				send(res, 400, { error: "需要 JSON POST 请求。" });
				return;
			}
			try {
				let size = 0;
				const chunks = [];
				for await (const chunk of req) {
					size += chunk.length;
					if (size > 4096) {
						send(res, 413, { error: "请求内容过长。" });
						return;
					}
					chunks.push(chunk);
				}
				const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				if (typeof body.sessionId !== "string" || !body.sessionId) throw new Error("缺少会话标识。");
				const session = ctx.get("sessions").list().find((item) => (item.id ?? item.header?.id) === body.sessionId);
				const cwd = session && ("header" in session ? session.header?.cwd : session.cwd);
				if (!cwd) throw new Error("请先打开有项目目录的会话。");
				send(res, 200, { git: await gitWorktree(cwd) });
			} catch (error) {
				send(res, 400, { error: error instanceof Error ? error.message : String(error) });
			}
		}
	}));
}
//#endregion
export { apply, inject, name };
