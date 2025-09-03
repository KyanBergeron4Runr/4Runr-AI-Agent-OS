"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
async function chat(params) {
    return {
        model: params.model,
        output: `SUMMARY: ${params.input.slice(0, 120)}`,
        tokens_est: Math.ceil(params.input.length / 3)
    };
}
//# sourceMappingURL=openai.mock.js.map