"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const manager_1 = require("./manager");
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
describe('ConfigurationManager', () => {
    let tempDir;
    let configPath;
    let manager;
    beforeEach(async () => {
        // Create temporary directory for testing
        tempDir = await fs_1.promises.mkdtemp((0, path_1.join)((0, os_1.tmpdir)(), 'config-test-'));
        configPath = (0, path_1.join)(tempDir, '.env');
        // Create initial config file
        const initialConfig = `# Test config
PORT=3000
DATABASE_URL=postgresql://test:test@localhost:5432/test
REDIS_URL=redis://localhost:6379
TOKEN_HMAC_SECRET=test-secret
SECRETS_BACKEND=env
HTTP_TIMEOUT_MS=6000
DEFAULT_TIMEZONE=America/Toronto
KEK_BASE64=crYlXV6CYnkGQyRd2mVYghJOXydJK49v9kohRWtBjy8=
FF_CHAOS=off
`;
        await fs_1.promises.writeFile(configPath, initialConfig);
        manager = new manager_1.ConfigurationManager(configPath);
    });
    afterEach(async () => {
        // Clean up temp directory
        await fs_1.promises.rm(tempDir, { recursive: true, force: true });
    });
    test('should create backup before updates', async () => {
        const backupId = await manager.createBackup();
        expect(backupId).toMatch(/^env-backup-\d{4}-\d{2}-\d{2}T/);
        const backups = await manager.listBackups();
        expect(backups).toContain(backupId);
    });
    test('should safely toggle chaos mode', async () => {
        await manager.toggleChaos(true);
        const content = await fs_1.promises.readFile(configPath, 'utf-8');
        expect(content).toContain('FF_CHAOS=on');
        await manager.toggleChaos(false);
        const updatedContent = await fs_1.promises.readFile(configPath, 'utf-8');
        expect(updatedContent).toContain('FF_CHAOS=off');
    });
    test('should rollback on validation failure', async () => {
        const originalContent = await fs_1.promises.readFile(configPath, 'utf-8');
        // Try to set invalid configuration
        try {
            await manager.updateConfig({ HTTP_TIMEOUT_MS: 'invalid' });
            fail('Should have thrown validation error');
        }
        catch (error) {
            expect(error.message).toContain('Configuration update failed');
        }
        // Verify original config is preserved
        const currentContent = await fs_1.promises.readFile(configPath, 'utf-8');
        expect(currentContent).toBe(originalContent);
    });
    test('should handle atomic writes', async () => {
        await manager.updateConfig({ PORT: '4000' });
        const content = await fs_1.promises.readFile(configPath, 'utf-8');
        expect(content).toContain('PORT=4000');
        // Verify no temp files left behind
        const files = await fs_1.promises.readdir(tempDir);
        expect(files.filter(f => f.endsWith('.tmp'))).toHaveLength(0);
    });
});
//# sourceMappingURL=manager.test.js.map