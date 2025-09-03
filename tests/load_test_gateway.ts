import axios from 'axios';
import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const GATEWAY_URL = 'http://localhost:3000';
const REQUESTS_COUNT = 100;
const CONCURRENT_REQUESTS = 50;
const TEST_DURATION = 15 * 60 * 1000;
const METRICS_INTERVAL = 30 * 1000;

function logMetrics() {
    setInterval(async () => {
        try {
            const cpuUsage = await getCpuUsage();
            const memoryUsage = await getMemoryUsage();
            const openFiles = await getOpenFileDescriptors();
            const diskUsage = await getDiskUsage();
            console.log(`Metrics: CPU: ${cpuUsage}%, Memory: ${memoryUsage}MB, Open Files: ${openFiles}, Disk Usage: ${diskUsage}`);
        } catch (error) {
            console.error('Error fetching metrics:', error.message);
        }
    }, METRICS_INTERVAL);
}

async function getCpuUsage() {
    try {
        const { stdout } = await execAsync('wmic cpu get loadpercentage');
        const usage = stdout.match(/\d+/)?.[0];
        return usage ? parseFloat(usage).toFixed(2) : 'N/A';
    } catch {
        return 'N/A';
    }
}

async function getMemoryUsage() {
    try {
        const { stdout } = await execAsync('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value');
        const lines = stdout.split('\n');
        const freeMemory = parseInt(lines.find(line => line.includes('FreePhysicalMemory'))?.split('=')[1] || '0');
        const totalMemory = parseInt(lines.find(line => line.includes('TotalVisibleMemorySize'))?.split('=')[1] || '0');
        return ((totalMemory - freeMemory) / 1024).toFixed(2);
    } catch {
        return 'N/A';
    }
}

async function getOpenFileDescriptors() {
    try {
        const { stdout } = await execAsync('wmic process get HandleCount');
        const handles = stdout.split('\n').slice(1).reduce((sum, line) => sum + parseInt(line.trim() || '0'), 0);
        return handles;
    } catch {
        return 'N/A';
    }
}

async function getDiskUsage() {
    try {
        const { stdout } = await execAsync('wmic logicaldisk get size,freespace,caption');
        return stdout.trim();
    } catch {
        return 'N/A';
    }
}

async function simulateLoad() {
    const loadRequests = Array.from({ length: REQUESTS_COUNT }, async (_, index) => {
        try {
            await axios.post(`${GATEWAY_URL}/api/create-agent`, {
                name: `agent_${index}`,
                created_by: 'test_user',
                role: 'tester'
            });
        } catch (error) {
            console.error(`Error in request ${index}:`, error);
        }
    });

    await Promise.allSettled(loadRequests);
}

(async () => {
    logMetrics();
    const startTime = performance.now();
    await simulateLoad();
    const duration = performance.now() - startTime;
    console.log(`Load test completed in ${(duration / 1000).toFixed(2)} seconds.`);
})();

