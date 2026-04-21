#!/usr/bin/env node
/**
 * mcp-server-gemini-lkbaba
 * Main server file — v2.0 SDK-based implementation
 *
 * Specialized MCP server for Gemini 3.x Pro focused on UI generation and
 * frontend development. Protocol layer is now fully managed by the official
 * @modelcontextprotocol/sdk instead of hand-written JSON-RPC routing.
 *
 * Based on: aliargun/mcp-server-gemini (historical inspiration)
 * Author: LKbaba
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode, } from '@modelcontextprotocol/sdk/types.js';
import { SERVER_INFO, TOOL_NAMES } from './config/constants.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { handleSearch } from './tools/search.js';
import { handleMultimodalQuery } from './tools/multimodal-query.js';
import { handleAnalyzeContent } from './tools/analyze-content.js';
import { handleAnalyzeCodebase } from './tools/analyze-codebase.js';
import { handleBrainstorm } from './tools/brainstorm.js';
import { createGeminiClient } from './utils/gemini-client.js';
import { createGeminiAI, detectAuthConfig } from './utils/gemini-factory.js';
import { ValidationError, SecurityError } from './utils/errors.js';
// Proxy setup — must run before any HTTP client is instantiated.
// Many users sit behind corporate proxies / VPNs (HTTPS_PROXY env var);
// without installing a dispatcher the Google GenAI SDK fetch calls silently
// fail with network-level errors that surface as "Connection closed" to the
// MCP client.
async function setupProxy() {
    const proxyUrl = process.env.HTTP_PROXY ||
        process.env.HTTPS_PROXY ||
        process.env.http_proxy ||
        process.env.https_proxy;
    if (proxyUrl) {
        try {
            const { ProxyAgent, setGlobalDispatcher } = await import('undici');
            const dispatcher = new ProxyAgent(proxyUrl);
            setGlobalDispatcher(dispatcher);
            console.error(`🌐 Proxy configured: ${proxyUrl}`);
        }
        catch {
            console.error('⚠️  Failed to configure proxy. If you need proxy support, run: npm install undici');
        }
    }
}
// Lazy Gemini clients — constructed on the first tools/call so that server
// startup never blocks on auth detection. Auth errors only surface when a
// tool is actually invoked, matching v1 behavior. Two flavours are exposed
// because search uses the raw GoogleGenAI SDK (needs googleSearch tool config)
// while the other four tools share a higher-level GeminiClient wrapper.
let cachedAuthConfig = null;
let geminiAI = null;
let geminiClient = null;
function getAuthConfig() {
    if (!cachedAuthConfig) {
        cachedAuthConfig = detectAuthConfig();
        console.error(`[INFO] Auth mode: ${cachedAuthConfig.mode}`);
    }
    return cachedAuthConfig;
}
function getGeminiAI() {
    if (!geminiAI) {
        geminiAI = createGeminiAI(getAuthConfig());
    }
    return geminiAI;
}
function getGeminiClient() {
    if (!geminiClient) {
        geminiClient = createGeminiClient(getAuthConfig());
    }
    return geminiClient;
}
// Prevent silent crashes from unhandled promise rejections. Without this,
// any unhandled rejection terminates the process and the MCP client only
// sees "Connection closed" with no error details.
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled rejection — server will exit:', reason);
});
// Graceful shutdown on OS signals. The stdio transport also handles stdin
// close via the SDK, but we keep these for parity with v1 and to surface
// a clear log line when the user Ctrl-C's a manual test run.
process.on('SIGINT', () => {
    console.error('\nShutting down (SIGINT)...');
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.error('\nShutting down (SIGTERM)...');
    process.exit(0);
});
async function main() {
    // Startup banner — goes to stderr so it never pollutes the stdio JSON-RPC
    // channel. Matches v1 output roughly so log scrapers keep working.
    console.error(`🚀 ${SERVER_INFO.name} v${SERVER_INFO.version}`);
    console.error(`📋 Based on: ${SERVER_INFO.basedOn}`);
    console.error(`🎨 Specialized for UI generation and frontend development`);
    console.error(`⚡ Powered by Gemini 3.x Pro`);
    console.error('');
    await setupProxy();
    const server = new Server({
        name: SERVER_INFO.name,
        version: SERVER_INFO.version,
    }, {
        capabilities: {
            tools: {},
        },
    });
    // tools/list — all five tools are migrated.
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOL_DEFINITIONS,
    }));
    // tools/call — route to the per-tool handler. Errors are mapped to the
    // SDK's McpError taxonomy so the client receives structured JSON-RPC
    // errors instead of a dropped connection.
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            switch (name) {
                case TOOL_NAMES.SEARCH: {
                    const result = await handleSearch(args, getGeminiAI());
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                case TOOL_NAMES.MULTIMODAL_QUERY: {
                    const result = await handleMultimodalQuery(args, getGeminiClient());
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                case TOOL_NAMES.ANALYZE_CONTENT: {
                    const result = await handleAnalyzeContent(args, getGeminiClient());
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                case TOOL_NAMES.ANALYZE_CODEBASE: {
                    const result = await handleAnalyzeCodebase(args, getGeminiClient());
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                case TOOL_NAMES.BRAINSTORM: {
                    const result = await handleBrainstorm(args, getGeminiClient());
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                    };
                }
                default:
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
            }
        }
        catch (error) {
            // Re-raise SDK errors as-is — they already carry the right code.
            if (error instanceof McpError) {
                throw error;
            }
            // Validation / security failures → InvalidParams so the client can
            // correct the input rather than treating it as a server fault.
            if (error instanceof ValidationError || error instanceof SecurityError) {
                throw new McpError(ErrorCode.InvalidParams, error.message);
            }
            // Everything else is a backend / transport failure.
            const message = error?.message || String(error);
            console.error(`[ERROR] Tool "${name}" failed:`, message);
            throw new McpError(ErrorCode.InternalError, message);
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ MCP server connected (stdio transport), waiting for requests...');
    console.error('');
}
main().catch((err) => {
    console.error('[FATAL] Server failed to start:', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map