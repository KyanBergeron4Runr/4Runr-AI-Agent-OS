"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldInjectChaos = shouldInjectChaos;
exports.injectChaos = injectChaos;
exports.maybeInjectChaos = maybeInjectChaos;
const admin_1 = require("../api/admin");
function shouldInjectChaos(tool) {
    const chaos = (0, admin_1.getChaosState)(tool);
    if (!chaos)
        return false;
    const random = Math.random() * 100;
    return random < chaos.pct;
}
function injectChaos(tool) {
    const chaos = (0, admin_1.getChaosState)(tool);
    if (!chaos) {
        throw new Error('No chaos configured for tool');
    }
    switch (chaos.mode) {
        case 'timeout':
            return new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Chaos: Simulated timeout'));
                }, 10000); // 10 second timeout
            });
        case '500':
            throw new Error('Chaos: Simulated 500 error');
        case 'jitter':
            const delay = Math.random() * 5000 + 1000; // 1-6 second random delay
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(undefined);
                }, delay);
            });
        default:
            throw new Error(`Chaos: Unknown mode ${chaos.mode}`);
    }
}
function maybeInjectChaos(tool) {
    if (shouldInjectChaos(tool)) {
        return injectChaos(tool);
    }
    return Promise.resolve();
}
//# sourceMappingURL=chaos.js.map