#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
if (!FIGMA_TOKEN) {
    console.error('Error: FIGMA_TOKEN environment variable is required');
    process.exit(1);
}
const server = new Server({ name: 'figma-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
// Schemas
const GetNodeSchema = z.object({
    fileKey: z.string().describe('Figma file key (from URL)'),
    nodeId: z.string().describe('Node ID (e.g., "9389-158685")'),
    depth: z.number().min(0).max(10).default(1).describe('Depth of children to include'),
});
const GetImageSchema = z.object({
    fileKey: z.string().describe('Figma file key'),
    nodeId: z.string().describe('Node ID to render'),
    scale: z.number().min(0.5).max(4).default(2).describe('Image scale (0.5-4)'),
    format: z.enum(['png', 'jpg', 'svg', 'pdf']).default('png').describe('Image format'),
});
const ListFramesSchema = z.object({
    fileKey: z.string().describe('Figma file key'),
});
const SearchNodesSchema = z.object({
    fileKey: z.string().describe('Figma file key'),
    query: z.string().describe('Search query for node names'),
});
// Helper function
async function figmaFetch(endpoint) {
    const response = await fetch(`https://api.figma.com/v1${endpoint}`, {
        headers: { 'X-Figma-Token': FIGMA_TOKEN },
    });
    if (!response.ok) {
        throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'figma_get_node',
            description: 'Get a Figma node with its properties and children. Returns JSON with layout, styles, and structure.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileKey: { type: 'string', description: 'Figma file key (from URL after /design/)' },
                    nodeId: { type: 'string', description: 'Node ID (e.g., "9389-158685" or "9389:158685")' },
                    depth: { type: 'number', default: 1, description: 'Depth of children (0-10)' },
                },
                required: ['fileKey', 'nodeId'],
            },
        },
        {
            name: 'figma_get_image',
            description: 'Render a Figma node as an image. Returns the image URL.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileKey: { type: 'string', description: 'Figma file key' },
                    nodeId: { type: 'string', description: 'Node ID to render' },
                    scale: { type: 'number', default: 2, description: 'Scale (0.5-4)' },
                    format: { type: 'string', enum: ['png', 'jpg', 'svg', 'pdf'], default: 'png' },
                },
                required: ['fileKey', 'nodeId'],
            },
        },
        {
            name: 'figma_list_frames',
            description: 'List all top-level frames in a Figma file. Useful for discovering available screens/components.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileKey: { type: 'string', description: 'Figma file key' },
                },
                required: ['fileKey'],
            },
        },
        {
            name: 'figma_search',
            description: 'Search for nodes by name in a Figma file.',
            inputSchema: {
                type: 'object',
                properties: {
                    fileKey: { type: 'string', description: 'Figma file key' },
                    query: { type: 'string', description: 'Search query for node names' },
                },
                required: ['fileKey', 'query'],
            },
        },
    ],
}));
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'figma_get_node': {
                const { fileKey, nodeId, depth } = GetNodeSchema.parse(args);
                const normalizedNodeId = nodeId.replace('-', ':');
                const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${normalizedNodeId}&depth=${depth}`);
                const node = data.nodes[normalizedNodeId];
                if (!node) {
                    return {
                        content: [{ type: 'text', text: `Node ${nodeId} not found in file ${fileKey}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                id: node.document.id,
                                name: node.document.name,
                                type: node.document.type,
                                size: {
                                    width: node.document.absoluteBoundingBox?.width,
                                    height: node.document.absoluteBoundingBox?.height,
                                },
                                children: node.document.children?.length || 0,
                                full: node.document,
                            }, null, 2),
                        }],
                };
            }
            case 'figma_get_image': {
                const { fileKey, nodeId, scale, format } = GetImageSchema.parse(args);
                const normalizedNodeId = nodeId.replace('-', ':');
                const data = await figmaFetch(`/images/${fileKey}?ids=${normalizedNodeId}&scale=${scale}&format=${format}`);
                const imageUrl = data.images[normalizedNodeId];
                if (!imageUrl) {
                    return {
                        content: [{ type: 'text', text: `Failed to render node ${nodeId}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                nodeId,
                                imageUrl,
                                format,
                                scale,
                            }, null, 2),
                        }],
                };
            }
            case 'figma_list_frames': {
                const { fileKey } = ListFramesSchema.parse(args);
                const data = await figmaFetch(`/files/${fileKey}?depth=1`);
                const frames = [];
                function collectFrames(node) {
                    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
                        frames.push({
                            id: node.id,
                            name: node.name,
                            type: node.type,
                        });
                    }
                    if (node.children) {
                        for (const child of node.children) {
                            collectFrames(child);
                        }
                    }
                }
                collectFrames(data.document);
                return {
                    content: [{
                            type: 'text',
                            text: `Found ${frames.length} frames:\n\n${frames.map(f => `- **${f.name}** (${f.type}) — id: \`${f.id}\``).join('\n')}`,
                        }],
                };
            }
            case 'figma_search': {
                const { fileKey, query } = SearchNodesSchema.parse(args);
                const data = await figmaFetch(`/files/${fileKey}`);
                const matches = [];
                function searchNodes(node, path = []) {
                    const currentPath = [...path, node.name];
                    if (node.name.toLowerCase().includes(query.toLowerCase())) {
                        matches.push({
                            id: node.id,
                            name: node.name,
                            type: node.type,
                            path: currentPath,
                        });
                    }
                    if (node.children) {
                        for (const child of node.children) {
                            searchNodes(child, currentPath);
                        }
                    }
                }
                searchNodes(data.document);
                return {
                    content: [{
                            type: 'text',
                            text: matches.length > 0
                                ? `Found ${matches.length} matches for "${query}":\n\n${matches.slice(0, 20).map(m => `- **${m.name}** (${m.type})\n  id: \`${m.id}\`\n  path: ${m.path.join(' → ')}`).join('\n\n')}`
                                : `No nodes found matching "${query}"`,
                        }],
                };
            }
            default:
                return {
                    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
                    isError: true,
                };
        }
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                }],
            isError: true,
        };
    }
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Figma MCP server running on stdio');
}
main().catch(console.error);
