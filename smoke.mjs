// Smoke test: spawns the MCP server over stdio, performs handshake,
// lists tools, then calls analyze_image on a test image.
// Usage: SMOKE_IMAGE=/path/to/image.png VISION_API_KEY=sk-... npm run smoke
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SERVER = resolve(__dirname, "src/index.ts");
const IMAGE = process.env.SMOKE_IMAGE;

if (!IMAGE) {
  console.error("ERROR: SMOKE_IMAGE env is required. Example: SMOKE_IMAGE=/path/to/image.png");
  process.exit(1);
}
if (!process.env.VISION_API_KEY) {
  console.error("ERROR: VISION_API_KEY env is required.");
  process.exit(1);
}

const child = spawn("npx", ["tsx", SERVER], {
  stdio: ["pipe", "pipe", "pipe"],
  env: process.env,
  shell: process.platform === "win32",
});

child.stderr.on("data", (b) => process.stderr.write(`[server] ${b}`));

let buf = "";
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r } = pending.get(msg.id);
        pending.delete(msg.id);
        r(msg);
      }
    } catch {
      // ignore non-json lines
    }
  }
});

function rpc(method, params) {
  const id = Math.floor(Math.random() * 1e9);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 180000);
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

(async () => {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke", version: "0.0.1" },
  });
  console.log("INIT:", JSON.stringify(init.result?.serverInfo));

  notify("notifications/initialized", {});

  const tools = await rpc("tools/list", {});
  console.log("TOOLS:", JSON.stringify(tools.result?.tools?.map((t) => t.name)));

  const call = await rpc("tools/call", {
    name: "analyze_image",
    arguments: {
      path: IMAGE,
      prompt: "用一句话概括这张截图的内容。",
      max_tokens: 200,
    },
  });
  console.log("CALL RESULT:");
  for (const part of call.result?.content ?? []) {
    if (part.type === "text") console.log(part.text);
  }
  if (call.result?.isError) console.log("(reported error)");

  child.kill();
  process.exit(0);
})().catch((e) => {
  console.error("smoke failed:", e);
  child.kill();
  process.exit(1);
});
