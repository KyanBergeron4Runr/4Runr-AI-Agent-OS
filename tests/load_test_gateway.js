"use strict";
const axios = require('axios');
const { performance } = require('perf_hooks');
const { exec } = require('child_process');

const GATEWAY_URL = 'http://localhost:3000'; // Replace with your gateway URL
const REQUESTS_COUNT = 100; // Total requests
const CONCURRENT_REQUESTS = 50; // Concurrent requests
const TEST_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const METRICS_INTERVAL = 30 * 1000; // 30 seconds in milliseconds
function logMetrics() {
    setInterval(async () => {
        const cpuUsage = await getCpuUsage();
        const memoryUsage = await getMemoryUsage();
        const openFiles = await getOpenFileDescriptors();
        const diskUsage = await getDiskUsage();
        console.log(`Metrics: CPU: ${cpuUsage}%, Memory: ${memoryUsage}MB, Open Files: ${openFiles}, Disk Usage: ${diskUsage}`);
    }, METRICS_INTERVAL);
}

async function getCpuUsage() {
    return new Promise((resolve) => {
        exec('top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk \'{print 100 - $1}\'', (error, stdout) => {
                        resolve(parseFloat(stdout.trim()).toFixed(2));
                    });
        });
}
async function getMemoryUsage() {
    return new Promise((resolve) => {
        exec('free -m | awk \'NR==2{print $3}\'', (error, stdout) => {
                        resolve(parseInt(stdout.trim()));
                    });
        });
}

async function getOpenFileDescriptors() {
    return new Promise((resolve) => {
        exec('lsof | wc -l', (error, stdout) => {
            resolve(parseInt(stdout.trim()));
        });
    });
}
async function getDiskUsage() {
    return new Promise((resolve) => {
        exec('du -sh /path/to/logs', (error, stdout) => {
                        resolve(stdout.split('\t')[0]);
                    });
        });
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
            console.error(`Error in request ${index}:`, error.message);
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

