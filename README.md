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
| `prompt` | string | No | What to ask the model (defaults to detailed description) |
| `model` | string | No | Override model per call |
| `max_tokens` | integer | No | Default 4096 |
| `temperature` | number | No | Default 0.2 |
| `detail` | string | No | `low` / `high` / `auto` |
| `system` | string | No | Optional system message |

## Tips: avoid `[image]` tag conversion (Windows)

When you paste a local image path into Claude Code, the CLI may auto-convert it into an `[image]` tag and inline the bytes, which fails on models or not stable that do not accept image input. To keep the raw path intact, use [ImageClipboardModify](https://github.com/winton979/ImageClipboardModify) — it appends a fixed prefix to clipboard image paths so they are no longer recognized as images, letting `analyze_image` receive the path verbatim. for use mcp vision always

> 中文说明:Claude Code 会把粘贴的本地图片路径自动识别为 `[image]` 标签,导致不支持图片的模型偶尔不稳定或者报错。可使用 [ImageClipboardModify](https://github.com/winton979/ImageClipboardModify) 给剪切板图片附加一段固定文字,绕过识别,让路径以纯文本形式传入 `analyze_image`，使用使用mcp vision解析

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
