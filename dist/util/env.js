"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
exports.ENV = {
    GATEWAY_URL: process.env.GATEWAY_URL || "http://localhost:3000",
    // No secrets in containers; runs receive short-lived gateway tokens in future tasks
};
//# sourceMappingURL=env.js.map