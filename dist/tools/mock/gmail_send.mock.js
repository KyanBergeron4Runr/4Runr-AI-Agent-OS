"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.send = send;
async function send(params) {
    return {
        id: `mock_${Math.random().toString(36).slice(2)}`,
        to: params.to,
        status: 'queued',
        subject_len: params.subject.length,
        body_len: params.text.length
    };
}
//# sourceMappingURL=gmail_send.mock.js.map