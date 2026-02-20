# Figma MCP

MCP server for the Figma API. Lets AI agents fetch designs, nodes, and rendered images from Figma.

## Features

- 🎨 **Get Node** — Fetch node JSON with layout, styles, children
- 🖼️ **Get Image** — Render any node as PNG/JPG/SVG/PDF
- 📋 **List Frames** — Discover all frames in a file
- 🔍 **Search** — Find nodes by name

## Quick Start

```bash
npm install
npm run build
```

## Configuration

Requires `FIGMA_TOKEN` environment variable. Get one from:
https://www.figma.com/developers/api#access-tokens

### Claude Desktop

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["/path/to/figma-mcp/dist/server.js"],
      "env": {
        "FIGMA_TOKEN": "figd_xxxxx"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["/path/to/figma-mcp/dist/server.js"],
      "env": {
        "FIGMA_TOKEN": "figd_xxxxx"
      }
    }
  }
}
```

## Tools

### `figma_get_node`

Get a node's JSON data including layout, styles, and children.

```typescript
figma_get_node({
  fileKey: "jWm9EQEE08EY743SGyj6ru",  // From Figma URL
  nodeId: "9389-158685",               // Node ID
  depth: 2                             // Children depth (0-10)
})
```

**Returns:**
```json
{
  "id": "9389:158685",
  "name": "DR_Home__ConnectOrg_0004_",
  "type": "FRAME",
  "size": { "width": 1440, "height": 1024 },
  "children": 3,
  "full": { ... }
}
```

### `figma_get_image`

Render a node as an image.

```typescript
figma_get_image({
  fileKey: "jWm9EQEE08EY743SGyj6ru",
  nodeId: "9389-158685",
  scale: 2,        // 0.5 - 4
  format: "png"    // png, jpg, svg, pdf
})
```

**Returns:**
```json
{
  "nodeId": "9389-158685",
  "imageUrl": "https://figma-alpha-api.s3.us-west-2.amazonaws.com/images/...",
  "format": "png",
  "scale": 2
}
```

### `figma_list_frames`

List all top-level frames in a file.

```typescript
figma_list_frames({
  fileKey: "jWm9EQEE08EY743SGyj6ru"
})
```

**Returns:**
```
Found 45 frames:

- **Home Page** (FRAME) — id: `123:456`
- **Settings Modal** (FRAME) — id: `789:012`
...
```

### `figma_search`

Search for nodes by name.

```typescript
figma_search({
  fileKey: "jWm9EQEE08EY743SGyj6ru",
  query: "Button"
})
```

**Returns:**
```
Found 12 matches for "Button":

- **Primary Button** (COMPONENT)
  id: `1:234`
  path: Document → Components → Buttons → Primary Button
...
```

## Getting File Key and Node ID

From a Figma URL:
```
https://www.figma.com/design/jWm9EQEE08EY743SGyj6ru/File-Name?node-id=9389-158685
                              ^^^^^^^^^^^^^^^^^^^^^^^^                ^^^^^^^^^^^
                              fileKey                                 nodeId
```

## License

MIT
