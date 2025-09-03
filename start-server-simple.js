// Simple Server Startup - Handle Redis Failures Gracefully
const { spawn } = require('child_process');

console.log('🚀 Starting 4Runr Gateway with Sentinel/Shield...');

// Set environment variables to handle Redis failures
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'file:./prisma/dev.db';
process.env.DEMO_MODE = 'on';

// Start the server
const server = spawn('npm', ['run', 'start'], {
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
});

server.on('close', (code) => {
  console.log(`🛑 Server exited with code ${code}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  server.kill('SIGTERM');
});
