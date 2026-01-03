#!/usr/bin/env node
/**
 * mcp-server-gemini-lkbaba
 * Main server file
 *
 * Specialized MCP server for Gemini 3.0 Pro focused on UI generation and frontend development
 * Based on: aliargun/mcp-server-gemini v4.2.2
 * Author: LKbaba
 */
import { createInterface } from 'readline';
import { SERVER_INFO, MCP_VERSION, ERROR_CODES, TOOL_NAMES } from './config/constants.js';
import { createGeminiClient } from './utils/gemini-client.js';
import { handleAPIError, handleValidationError, handleInternalError, logError } from './utils/error-handler.js';
import { TOOL_DEFINITIONS } from './tools/definitions.js';
import { handleGenerateUI, handleMultimodalQuery, handleFixUI, handleCreateAnimation, handleAnalyzeContent, handleAnalyzeCodebase, handleBrainstorm, handleSearch, handleListModels } from './tools/index.js';
// Setup proxy for Node.js fetch (required for users behind proxy/VPN)
async function setupProxy() {
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
    if (proxyUrl) {
        try {
            const { ProxyAgent, setGlobalDispatcher } = await import('undici');
            const dispatcher = new ProxyAgent(proxyUrl);
            setGlobalDispatcher(dispatcher);
            console.error(`🌐 Proxy configured: ${proxyUrl}`);
        }
        catch (error) {
            console.error('⚠️  Failed to configure proxy. If you need proxy support, run: npm install undici');
        }
    }
}
// Initialize proxy before anything else
await setupProxy();
// Increase stdin buffer size (for large images)
if (process.stdin.setEncoding) {
    process.stdin.setEncoding('utf8');
}
// Global state
let geminiClient = null;
let isInitialized = false;
/**
 * Send response to stdout
 */
function sendResponse(response) {
    console.log(JSON.stringify(response));
}
/**
 * Send error response
 */
function sendError(id, code, message, data) {
    sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code, message, data }
    });
}
/**
 * Handle initialize request
 */
function handleInitialize(request) {
    const result = {
        protocolVersion: MCP_VERSION,
        serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version
        },
        capabilities: {
            tools: {
                listChanged: false
            }
        }
    };
    sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result
    });
    isInitialized = true;
}
/**
 * Handle tools/list request
 */
function handleToolsList(request) {
    sendResponse({
        jsonrpc: '2.0',
        id: request.id,
        result: {
            tools: TOOL_DEFINITIONS
        }
    });
}
/**
 * Handle tools/call request
 */
async function handleToolsCall(request) {
    if (!isInitialized) {
        sendError(request.id, ERROR_CODES.INTERNAL_ERROR, 'Server not initialized');
        return;
    }
    const { name, arguments: args } = request.params;
    // Initialize Gemini client (if not already)
    if (!geminiClient) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            sendError(request.id, ERROR_CODES.API_ERROR, 'GEMINI_API_KEY environment variable is not set');
            return;
        }
        geminiClient = createGeminiClient(apiKey);
    }
    try {
        let result;
        // Route to corresponding tool handler
        switch (name) {
            case TOOL_NAMES.LIST_MODELS:
                result = await handleListModels();
                break;
            case TOOL_NAMES.GENERATE_UI:
                result = await handleGenerateUI(args, geminiClient);
                break;
            case TOOL_NAMES.MULTIMODAL_QUERY:
                result = await handleMultimodalQuery(args, geminiClient);
                break;
            case TOOL_NAMES.FIX_UI:
                result = await handleFixUI(args, geminiClient);
                break;
            case TOOL_NAMES.CREATE_ANIMATION:
                result = await handleCreateAnimation(args, geminiClient);
                break;
            case TOOL_NAMES.ANALYZE_CONTENT:
                result = await handleAnalyzeContent(args, geminiClient);
                break;
            case TOOL_NAMES.ANALYZE_CODEBASE:
                result = await handleAnalyzeCodebase(args, geminiClient);
                break;
            case TOOL_NAMES.BRAINSTORM:
                result = await handleBrainstorm(args, geminiClient);
                break;
            case TOOL_NAMES.SEARCH:
                result = await handleSearch(args, process.env.GEMINI_API_KEY);
                break;
            default:
                sendError(request.id, ERROR_CODES.METHOD_NOT_FOUND, `Unknown tool: ${name}`);
                return;
        }
        // Send success response
        sendResponse({
            jsonrpc: '2.0',
            id: request.id,
            result: {
                content: [
                    {
                        type: 'text',
                        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                    }
                ]
            }
        });
    }
    catch (error) {
        logError(`Tool: ${name}`, error);
        // Return appropriate error based on error type
        if (error.message?.includes('not yet implemented')) {
            sendError(request.id, ERROR_CODES.INTERNAL_ERROR, error.message);
        }
        else if (error.message?.includes('required') || error.message?.includes('must be')) {
            const validationError = handleValidationError(error.message);
            sendError(request.id, validationError.code, validationError.message, validationError.data);
        }
        else {
            const apiError = handleAPIError(error);
            sendError(request.id, apiError.code, apiError.message, apiError.data);
        }
    }
}
/**
 * Handle request
 */
async function handleRequest(request) {
    try {
        switch (request.method) {
            case 'initialize':
                handleInitialize(request);
                break;
            case 'tools/list':
                handleToolsList(request);
                break;
            case 'tools/call':
                await handleToolsCall(request);
                break;
            case 'ping':
                sendResponse({
                    jsonrpc: '2.0',
                    id: request.id,
                    result: { status: 'ok' }
                });
                break;
            default:
                sendError(request.id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${request.method}`);
        }
    }
    catch (error) {
        logError('Request handler', error);
        const internalError = handleInternalError(error);
        sendError(request.id, internalError.code, internalError.message, internalError.data);
    }
}
/**
 * Main function
 */
function main() {
    console.error(`🚀 ${SERVER_INFO.name} v${SERVER_INFO.version}`);
    console.error(`📋 Based on: ${SERVER_INFO.basedOn}`);
    console.error(`🎨 Specialized for UI generation and frontend development`);
    console.error(`⚡ Powered by Gemini 3.0 Pro`);
    console.error('');
    console.error('Waiting for requests...');
    console.error('');
    // Read stdin line by line
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    rl.on('line', async (line) => {
        if (!line.trim())
            return;
        try {
            const request = JSON.parse(line);
            await handleRequest(request);
        }
        catch (error) {
            console.error('Failed to parse request:', error);
            sendError('unknown', ERROR_CODES.PARSE_ERROR, 'Invalid JSON-RPC request');
        }
    });
    rl.on('close', () => {
        console.error('Connection closed');
        process.exit(0);
    });
    // Handle process signals
    process.on('SIGINT', () => {
        console.error('\nShutting down...');
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        console.error('\nShutting down...');
        process.exit(0);
    });
}
// Start server
main();
//# sourceMappingURL=server.js.map