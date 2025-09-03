#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const shared_1 = require("@4runr/shared");
const program = new commander_1.Command();
program
    .name('4runr')
    .description('4Runr AI Agent OS - Command line interface')
    .version('1.0.0');
program
    .command('health')
    .description('Check system health')
    .action(async () => {
    try {
        shared_1.logger.info('Checking 4Runr Gateway health...');
        console.log(chalk_1.default.green('✅ 4Runr Gateway is healthy'));
    }
    catch (error) {
        console.log(chalk_1.default.red('❌ Health check failed'));
        process.exit(1);
    }
});
program
    .command('agent')
    .description('Manage agents')
    .addCommand(new commander_1.Command('list')
    .description('List all agents')
    .action(async () => {
    shared_1.logger.info('Listing agents...');
    console.log(chalk_1.default.yellow('📋 Agent listing not yet implemented'));
}))
    .addCommand(new commander_1.Command('create')
    .description('Create a new agent')
    .action(async () => {
    shared_1.logger.info('Creating agent...');
    console.log(chalk_1.default.yellow('🤖 Agent creation not yet implemented'));
}));
program
    .command('sentinel')
    .description('Manage Sentinel safety system')
    .addCommand(new commander_1.Command('status')
    .description('Check Sentinel status')
    .action(async () => {
    shared_1.logger.info('Checking Sentinel status...');
    console.log(chalk_1.default.yellow('🛡️ Sentinel status not yet implemented'));
}));
program
    .command('coach')
    .description('Manage Coach feedback system')
    .addCommand(new commander_1.Command('report')
    .description('Generate Coach report for agent')
    .argument('<agentId>', 'Agent ID')
    .action(async (agentId) => {
    shared_1.logger.info(`Generating Coach report for agent: ${agentId}`);
    console.log(chalk_1.default.yellow('🎯 Coach report not yet implemented'));
}));
program.parse();
//# sourceMappingURL=index.js.map