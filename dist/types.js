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