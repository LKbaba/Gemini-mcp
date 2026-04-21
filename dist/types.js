/**
 * Legacy error type retained for error-handler.ts backward compatibility.
 *
 * All JSON-RPC protocol types (MCPRequest/MCPResponse/NotificationMessage
 * etc.) were removed in v2.0 — the @modelcontextprotocol/sdk package now
 * owns the wire protocol. This class remains because handleAPIError in
 * utils/error-handler.ts returns an MCPError instance, which the SDK
 * CallToolRequestSchema handler then re-wraps as McpError (InternalError).
 */
export class MCPError extends Error {
    code;
    data;
    constructor(code, message, data) {
        super(message);
        this.name = 'MCPError';
        this.code = code;
        this.data = data;
    }
}
//# sourceMappingURL=types.js.map