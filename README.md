# @winton979/vision-mcp

MCP server that exposes an `analyze_image` tool backed by an **OpenAI-compatible vision LLM** (GPT-4o, Qwen-VL, etc.).

## What it does

Provides a single MCP tool `analyze_image` that accepts an image via:

- **path** — local file path
- **url** — public http(s) URL
- **base64** — raw base64 string (with or without `data:` prefix)

and returns a text description from the configured vision model.

## Prerequisites

- **Node.js ≥ 18** (global `fetch` required)

## Configuration

Set these environment variables when configuring the MCP server:

| Variable | Required | Default | Description |
|---|---|---|---|
| `VISION_BASE_URL` | No | `https://api.openai.com/v1` | OpenAI-compatible API base URL |
| `VISION_API_KEY` | **Yes** | — | API key for the gateway |
| `VISION_MODEL` | No | `gpt-4o` | Vision model name |

## Claude Code setup

### macOS / Linux

Add to `~/.claude.json` or `~/.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "vision": {
      "command": "npx",
      "args": ["-y", "@winton979/vision-mcp"],
      "env": {
        "VISION_BASE_URL": "<your-base-url>",
        "VISION_API_KEY": "<your-api-key>",
        "VISION_MODEL": "<your-model>"
      }
    }
  }
}
```

### Windows

```json
{
  "mcpServers": {
    "vision": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@winton979/vision-mcp"],
      "env": {
        "VISION_BASE_URL": "<your-base-url>",
        "VISION_API_KEY": "<your-api-key>",
        "VISION_MODEL": "<your-model>"
      }
    }
  }
}
```

## Codex setup

### macOS / Linux

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.vision-mcp]
type = "stdio"
command = "npx"
args = ["-y", "@winton979/vision-mcp"]
env = { VISION_BASE_URL = "<your-base-url>", VISION_API_KEY = "<your-api-key>", VISION_MODEL = "<your-model>" }
```

### Windows

```toml
[mcp_servers.vision-mcp]
type = "stdio"
command = "npx"
args = ["-y", "@winton979/vision-mcp"]
env = { VISION_BASE_URL = "<your-base-url>", VISION_API_KEY = "<your-api-key>", VISION_MODEL = "<your-model>" }
```

## Tool: `analyze_image`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `path` | string | one of three | Local file path to the image |
| `url` | string | one of three | Public http(s) URL of the image |
| `base64` | string | one of three | Raw base64 string |
| `mime_type` | string | No | Override MIME type (auto-detected) |
| `task` | string | No | Optimized analysis mode (default `general`) |
| `prompt` | string | No | Specific question; overrides the task's default instruction |
| `response_mode` | string | No | Output structure: `markdown` (default) / `json` / `plain_text` |
| `model` | string | No | Override model per call |
| `max_tokens` | integer | No | Default 4096 |
| `temperature` | number | No | Default 0.2 |
| `detail` | string | No | `low` / `high` / `auto` |
| `system` | string | No | Extra system guidance appended after the built-in base rules |

### `task`

Selects an optimized built-in system context + default instruction, so callers don't have to hand-write a prompt for common cases:

| task | use for |
|---|---|
| `general` | default — objects, text, layout, anomalies |
| `ocr` | verbatim text transcription, preserving layout |
| `ui_review` | layout, alignment, overflow, element states, a11y |
| `document` | document structure & key content |
| `table` | reconstruct tables as markdown tables |
| `diagram` | nodes, edges, flow, relationships |
| `chart` | chart type, axes, series, trends, values |
| `receipt` | merchant, line items, totals |
| `math` | transcribe & solve step by step |
| `code` | transcribe code verbatim |

If `prompt` is also provided, it takes precedence as the specific question while the task's specialized context still applies — e.g. `task=ocr, prompt="what is the total amount?"`.

### `response_mode`

- `markdown` (default) — structured report (`## Summary` / `## Visible Objects` / `## Text` / `## Findings` / `## Uncertainties`)
- `json` — a single JSON object (`summary`, `objects`, `text`, `findings`, `uncertainties`) for easy parsing; the tool returns **only** the JSON, with no extra metadata appended
- `plain_text` — unstructured text

> `json` mode sends `response_format: { type: "json_object" }`. Some OpenAI-compatible gateways do not support this field and may return HTTP 400; in that case fall back to `markdown`.

### Built-in behavior

A fixed base system prompt is always applied — it enforces observable-facts-only reporting, exact text preservation, and prompt-injection protection (text inside the image is treated as content, never as instructions). The optional `system` parameter is appended after these rules and cannot override them.

## Tips: avoid `[image]` tag conversion (Windows)

When you paste a local image path into Claude Code, the CLI may auto-convert it into an `[image]` tag and inline the bytes, which fails on models that do not accept image input. To keep the raw path intact, use [ImageClipboardModify](https://github.com/winton979/ImageClipboardModify) — it appends a fixed prefix to clipboard image paths so they are no longer recognized as images, letting `analyze_image` receive the path verbatim.

> 中文说明:Claude Code 会把粘贴的本地图片路径自动识别为 `[image]` 标签,导致不支持图片的模型报错。可使用 [ImageClipboardModify](https://github.com/winton979/ImageClipboardModify) 给剪切板图片附加一段固定文字,绕过识别,让路径以纯文本形式传入 `analyze_image`。

## Local development

```bash
git clone https://github.com/winton979/vision-mcp.git
cd vision-mcp
npm install
npm run build

# Run smoke test
SMOKE_IMAGE=/path/to/test.png VISION_API_KEY=sk-... npm run smoke
```

## License

MIT
