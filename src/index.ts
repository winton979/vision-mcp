#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";

const BASE_URL = (process.env.VISION_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const API_KEY = process.env.VISION_API_KEY ?? "";
const DEFAULT_MODEL = process.env.VISION_MODEL ?? "gpt-4o";

type AnalyzeArgs = {
  path?: string;
  url?: string;
  base64?: string;
  mime_type?: string;
  prompt?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  detail?: "low" | "high" | "auto";
  system?: string;
};

function sniffMime(bytes: Uint8Array): string {
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "image/bmp";
  return "application/octet-stream";
}

function mimeFromExt(p: string): string | null {
  const ext = p.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "bmp": return "image/bmp";
    default: return null;
  }
}

async function resolveImageUrl(args: AnalyzeArgs): Promise<string> {
  const provided = [args.path, args.url, args.base64].filter((v) => typeof v === "string" && v.length > 0);
  if (provided.length === 0) throw new Error("must provide one of: path | url | base64");
  if (provided.length > 1) throw new Error("provide exactly one of: path | url | base64");

  if (args.url) {
    if (!/^https?:\/\//i.test(args.url)) throw new Error("url must start with http:// or https://");
    return args.url;
  }

  if (args.path) {
    const abs = resolvePath(args.path);
    const buf = await readFile(abs);
    const mime = args.mime_type ?? mimeFromExt(abs) ?? sniffMime(buf);
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  // base64
  const raw = args.base64!.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length === 0) throw new Error("base64 decoded to empty bytes");
  const mime = args.mime_type ?? sniffMime(bytes);
  return `data:${mime};base64,${raw}`;
}

async function callVision(args: AnalyzeArgs): Promise<{ text: string; usage: unknown; model: string }> {
  if (!API_KEY) throw new Error("VISION_API_KEY is not set");

  const imageUrl = await resolveImageUrl(args);
  const model = args.model ?? DEFAULT_MODEL;
  const prompt = args.prompt ?? "请详细描述这张图片中的所有可见信息。";

  const userContent: Array<Record<string, unknown>> = [
    { type: "image_url", image_url: args.detail ? { url: imageUrl, detail: args.detail } : { url: imageUrl } },
    { type: "text", text: prompt },
  ];

  const messages: Array<Record<string, unknown>> = [];
  if (args.system) messages.push({ role: "system", content: args.system });
  messages.push({ role: "user", content: userContent });

  const body = {
    model,
    messages,
    temperature: args.temperature ?? 0.2,
    max_tokens: args.max_tokens ?? 4096,
  };

  const resp = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(`vision API HTTP ${resp.status}: ${errText.slice(0, 500)}`);
  }

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, usage: data.usage ?? null, model };
}

const server = new Server(
  { name: "vision-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const ANALYZE_IMAGE_TOOL = {
  name: "analyze_image",
  description:
    "Analyze an image with a vision LLM (OpenAI-compatible chat/completions). " +
    "Provide exactly one of `path` (local file), `url` (http/https), or `base64`. " +
    "Optionally pass a custom `prompt` to steer the analysis (OCR, table extraction, captioning, Q&A, etc).",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative local file path to the image." },
      url: { type: "string", description: "Public http(s) URL of the image." },
      base64: { type: "string", description: "Raw base64 string (with or without data: prefix)." },
      mime_type: {
        type: "string",
        description: "Override MIME type for base64 input. Auto-detected if omitted.",
      },
      prompt: {
        type: "string",
        description: "What you want the model to do with the image. Defaults to a detailed description.",
      },
      model: {
        type: "string",
        description: `Override the vision model. Defaults to env VISION_MODEL (${DEFAULT_MODEL}).`,
      },
      max_tokens: { type: "integer", minimum: 1, maximum: 32768, default: 4096 },
      temperature: { type: "number", minimum: 0, maximum: 2, default: 0.2 },
      detail: {
        type: "string",
        enum: ["low", "high", "auto"],
        description: "Optional image detail hint passed to the gateway.",
      },
      system: { type: "string", description: "Optional system message." },
    },
    additionalProperties: false,
  },
} as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [ANALYZE_IMAGE_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "analyze_image") {
    throw new Error(`unknown tool: ${request.params.name}`);
  }
  const args = (request.params.arguments ?? {}) as AnalyzeArgs;

  try {
    const { text, usage, model } = await callVision(args);
    const meta = { model, usage };
    return {
      content: [
        { type: "text", text },
        { type: "text", text: `\n---\n${JSON.stringify(meta)}` },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `analyze_image failed: ${message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // 日志写 stderr，不污染 stdio 协议流
  process.stderr.write(
    `[vision-mcp] ready. base=${BASE_URL} model=${DEFAULT_MODEL} key=${API_KEY ? "set" : "MISSING"}\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`[vision-mcp] fatal: ${err?.stack ?? err}\n`);
  process.exit(1);
});
