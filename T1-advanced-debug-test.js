const http = require('http');
const crypto = require('crypto');
const fs = require('fs');

// Advanced test configuration
const BASE_URL = 'http://localhost:3000';
const WORKSPACE_ID = 'debug-workspace-' + Date.now();
const WORKSPACE_ID_2 = 'debug-workspace-2-' + Date.now();

// Advanced logging system
class DebugLogger {
    constructor() {
        this.logs = [];
        this.startTime = Date.now();
        this.testResults = {
            summary: {
                totalTests: 0,
                passedTests: 0,
                failedTests: 0,
                skippedTests: 0,
                criticalIssues: 0,
                performanceIssues: 0,
                securityIssues: 0,
                missingFeatures: 0
            },
            details: {
                apiResponses: [],
                timingAnalysis: {},
                errorAnalysis: {},
                performanceMetrics: {},
                securityChecks: {},
                featureGaps: {},
                sseAnalysis: {},
                registryAnalysis: {},
                sentinelAnalysis: {}
            },
            recommendations: []
        };
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const elapsed = Date.now() - this.startTime;
        const logEntry = {
            timestamp,
            elapsed: `${elapsed}ms`,
            level,
            message,
            data
        };
        
        this.logs.push(logEntry);
        
        const prefix = `[${timestamp}] [${elapsed}ms] [${level.toUpperCase()}]`;
        console.log(`${prefix} ${message}`);
        
        if (data) {
            console.log(`${prefix} DATA:`, JSON.stringify(data, null, 2));
        }
    }

    info(message, data = null) { this.log('info', message, data); }
    warn(message, data = null) { this.log('warn', message, data); }
    error(message, data = null) { this.log('error', message, data); }
    debug(message, data = null) { this.log('debug', message, data); }
    success(message, data = null) { this.log('success', message, data); }

    addTestResult(testName, result) {
        this.testResults.details[testName] = result;
    }

    addRecommendation(priority, category, description, impact) {
        this.testResults.recommendations.push({
            priority,
            category,
            description,
            impact,
            timestamp: new Date().toISOString()
        });
    }

    saveResults() {
        const filename = `T1-advanced-results-${Date.now()}.json`;
        fs.writeFileSync(filename, JSON.stringify(this.testResults, null, 2));
        this.info(`Detailed results saved to: ${filename}`);
        return filename;
    }
}

const logger = new DebugLogger();

// Enhanced HTTP client with detailed debugging
class DebugHTTPClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.requestCount = 0;
        this.responseTimes = [];
    }

    async makeRequest(path, method = 'GET', body = null, headers = {}, timeout = 30000) {
        const requestId = ++this.requestCount;
        const startTime = Date.now();
        
        logger.debug(`HTTP Request ${requestId}`, {
            method,
            path,
            body: body ? JSON.stringify(body).substring(0, 200) + '...' : null,
            headers: Object.keys(headers)
        });

        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Workspace-ID': WORKSPACE_ID,
                    'User-Agent': 'T1-Advanced-Test/1.0',
                    ...headers
                },
                timeout: timeout
            };

            const req = http.request(options, (res) => {
                const responseTime = Date.now() - startTime;
                this.responseTimes.push(responseTime);
                
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsedData;
                    try {
                        parsedData = data ? JSON.parse(data) : null;
                    } catch (e) {
                        parsedData = data;
                    }

                    const response = {
                        status: res.statusCode,
                        data: parsedData,
                        headers: res.headers,
                        responseTime,
                        requestId
                    };

                    logger.debug(`HTTP Response ${requestId}`, {
                        status: res.statusCode,
                        responseTime: `${responseTime}ms`,
                        dataSize: data.length,
                        contentType: res.headers['content-type']
                    });

                    // Analyze response for issues
                    this.analyzeResponse(path, response);
                    
                    resolve(response);
                });
            });

            req.on('error', (err) => {
                const responseTime = Date.now() - startTime;
                logger.error(`HTTP Error ${requestId}`, {
                    error: err.message,
                    responseTime: `${responseTime}ms`,
                    path,
                    method
                });
                reject(err);
            });

            req.on('timeout', () => {
                logger.error(`HTTP Timeout ${requestId}`, {
                    timeout: `${timeout}ms`,
                    path,
                    method
                });
                req.destroy();
                reject(new Error(`Request timeout after ${timeout}ms`));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    analyzeResponse(path, response) {
        // Performance analysis
        if (response.responseTime > 5000) {
            logger.warn(`Slow response detected`, {
                path,
                responseTime: `${response.responseTime}ms`,
                threshold: '5000ms'
            });
            logger.testResults.details.performanceMetrics[path] = {
                responseTime: response.responseTime,
                status: 'SLOW',
                timestamp: new Date().toISOString()
            };
        }

        // Error analysis
        if (response.status >= 400) {
            logger.error(`HTTP Error detected`, {
                path,
                status: response.status,
                data: response.data
            });
            logger.testResults.details.errorAnalysis[path] = {
                status: response.status,
                error: response.data,
                timestamp: new Date().toISOString()
            };
        }

        // Security analysis
        if (response.headers['x-frame-options'] === undefined) {
            logger.warn(`Missing security header`, {
                path,
                missingHeader: 'X-Frame-Options'
            });
        }
    }

    getPerformanceStats() {
        if (this.responseTimes.length === 0) return null;
        
        const sorted = this.responseTimes.sort((a, b) => a - b);
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];
        
        return {
            totalRequests: this.requestCount,
            average: this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length,
            p50,
            p95,
            p99,
            min: Math.min(...this.responseTimes),
            max: Math.max(...this.responseTimes)
        };
    }
}

const httpClient = new DebugHTTPClient(BASE_URL);

// Enhanced SSE client with detailed analysis
class DebugSSEClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    async connectSSE(runId, eventType = 'logs', timeout = 15000) {
        const startTime = Date.now();
        logger.debug(`SSE Connection Start`, {
            runId,
            eventType,
            timeout: `${timeout}ms`
        });

        return new Promise((resolve, reject) => {
            const url = new URL(`/api/runs/${runId}/${eventType}/stream`, this.baseUrl);
            const req = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                headers: {
                    'X-Workspace-ID': WORKSPACE_ID,
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                },
                timeout: timeout
            }, (res) => {
                const connectionTime = Date.now() - startTime;
                logger.debug(`SSE Connection Established`, {
                    runId,
                    eventType,
                    connectionTime: `${connectionTime}ms`,
                    status: res.statusCode,
                    headers: res.headers
                });

                let events = [];
                let buffer = '';
                let eventCount = 0;
                let lastEventTime = Date.now();
                
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const eventData = JSON.parse(line.substring(6));
                                events.push(eventData);
                                eventCount++;
                                lastEventTime = Date.now();
                                
                                if (eventCount <= 5) {
                                    logger.debug(`SSE Event ${eventCount}`, {
                                        runId,
                                        eventType,
                                        event: eventData
                                    });
                                }
                            } catch (e) {
                                logger.warn(`SSE Parse Error`, {
                                    runId,
                                    eventType,
                                    line: line.substring(0, 100),
                                    error: e.message
                                });
                            }
                        }
                    }
                });
                
                res.on('end', () => {
                    const totalTime = Date.now() - startTime;
                    const timeSinceLastEvent = Date.now() - lastEventTime;
                    
                    logger.debug(`SSE Connection End`, {
                        runId,
                        eventType,
                        totalTime: `${totalTime}ms`,
                        eventsReceived: eventCount,
                        timeSinceLastEvent: `${timeSinceLastEvent}ms`
                    });

                    // Analyze SSE performance
                    const sseAnalysis = {
                        connectionTime,
                        totalTime,
                        eventsReceived: eventCount,
                        timeSinceLastEvent,
                        eventsPerSecond: eventCount / (totalTime / 1000),
                        status: res.statusCode
                    };

                    logger.testResults.details.sseAnalysis[`${runId}-${eventType}`] = sseAnalysis;

                    if (eventCount === 0) {
                        logger.warn(`No SSE events received`, {
                            runId,
                            eventType,
                            totalTime: `${totalTime}ms`
                        });
                    }

                    if (connectionTime > 1000) {
                        logger.warn(`Slow SSE connection`, {
                            runId,
                            eventType,
                            connectionTime: `${connectionTime}ms`
                        });
                    }

                    resolve({ events, status: res.statusCode, analysis: sseAnalysis });
                });
                
                res.on('error', (err) => {
                    logger.error(`SSE Connection Error`, {
                        runId,
                        eventType,
                        error: err.message
                    });
                    reject(err);
                });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
                logger.error(`SSE Connection Timeout`, {
                    runId,
                    eventType,
                    timeout: `${timeout}ms`
                });
                req.destroy();
                reject(new Error(`SSE timeout after ${timeout}ms`));
            });
            
            req.end();
        });
    }
}

const sseClient = new DebugSSEClient(BASE_URL);

// Enhanced metrics analysis
async function analyzeMetrics(label) {
    logger.debug(`Analyzing metrics: ${label}`);
    
    const response = await httpClient.makeRequest('/metrics');
    if (response.status !== 200) {
        logger.error(`Metrics endpoint failed`, { status: response.status });
        return null;
    }

    const metrics = response.data;
    const analysis = {
        timestamp: new Date().toISOString(),
        label,
        responseTime: response.responseTime,
        metricsSize: metrics.length,
        counters: {},
        gauges: {},
        histograms: {},
        issues: []
    };

    // Parse Prometheus format
    const lines = metrics.split('\n');
    lines.forEach(line => {
        if (line.startsWith('#') || line.trim() === '') return;
        
        const parts = line.split(' ');
        if (parts.length < 2) return;
        
        const metricName = parts[0];
        const value = parseFloat(parts[1]);
        
        if (isNaN(value)) return;
        
        if (metricName.includes('_total')) {
            analysis.counters[metricName] = value;
        } else if (metricName.includes('_gauge')) {
            analysis.gauges[metricName] = value;
        } else if (metricName.includes('_bucket') || metricName.includes('_sum') || metricName.includes('_count')) {
            analysis.histograms[metricName] = value;
        }
    });

    // Analyze for issues
    const sentinelMetrics = Object.keys(analysis.counters).filter(k => k.includes('sentinel'));
    const registryMetrics = Object.keys(analysis.counters).filter(k => k.includes('registry'));
    
    if (sentinelMetrics.length === 0) {
        analysis.issues.push('No Sentinel metrics found');
        logger.warn(`No Sentinel metrics detected`, { label });
    }
    
    if (registryMetrics.length === 0) {
        analysis.issues.push('No Registry metrics found');
        logger.warn(`No Registry metrics detected`, { label });
    }

    logger.debug(`Metrics analysis complete`, {
        label,
        counters: Object.keys(analysis.counters).length,
        gauges: Object.keys(analysis.gauges).length,
        histograms: Object.keys(analysis.histograms).length,
        issues: analysis.issues.length
    });

    return analysis;
}

// Enhanced agent run analysis
async function analyzeAgentRun(agentSlug, runNumber) {
    logger.info(`Starting agent run analysis`, { agentSlug, runNumber });
    
    const startTime = Date.now();
    
    // Start the run
    const runResponse = await httpClient.makeRequest(`/api/agents/${agentSlug}/run`, 'POST', {
        workspace_id: WORKSPACE_ID,
        input: { 
            message: `Advanced test run ${runNumber} - ${new Date().toISOString()}`,
            testData: {
                runNumber,
                timestamp: new Date().toISOString(),
                debug: true
            }
        }
    });

    if (runResponse.status !== 200 || !runResponse.data?.run_id) {
        logger.error(`Failed to start agent run`, {
            agentSlug,
            runNumber,
            status: runResponse.status,
            data: runResponse.data
        });
        return null;
    }

    const runId = runResponse.data.run_id;
    logger.success(`Agent run started`, { agentSlug, runNumber, runId });

    // Connect to SSE streams immediately
    const ssePromises = [
        sseClient.connectSSE(runId, 'logs', 10000),
        sseClient.connectSSE(runId, 'guard', 10000)
    ];

    // Monitor run status
    let runStatus = null;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await httpClient.makeRequest(`/api/runs/${runId}`);
        if (statusResponse.status === 200) {
            runStatus = statusResponse.data;
            
            if (['complete', 'failed', 'stopped'].includes(runStatus.status)) {
                break;
            }
            
            logger.debug(`Run status update`, {
                runId,
                status: runStatus.status,
                attempt: attempts
            });
        }
    }

    // Wait for SSE results
    const [logsSSE, guardSSE] = await Promise.allSettled(ssePromises);
    
    const runAnalysis = {
        runId,
        agentSlug,
        runNumber,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        status: runStatus?.status || 'unknown',
        attempts: attempts,
        sseResults: {
            logs: logsSSE.status === 'fulfilled' ? logsSSE.value : { error: logsSSE.reason?.message },
            guard: guardSSE.status === 'fulfilled' ? guardSSE.value : { error: guardSSE.reason?.message }
        },
        runData: runStatus,
        issues: []
    };

    // Analyze run data
    if (runStatus) {
        if (!runStatus.spans || runStatus.spans.length === 0) {
            runAnalysis.issues.push('No spans generated');
        }
        if (!runStatus.verdict) {
            runAnalysis.issues.push('No verdict generated');
        }
        if (!runStatus.shield_decision) {
            runAnalysis.issues.push('No shield decision');
        }
        if (!runStatus.guard_events || runStatus.guard_events.length === 0) {
            runAnalysis.issues.push('No guard events');
        }
    }

    // Performance analysis
    if (runAnalysis.duration > 10000) {
        runAnalysis.issues.push(`Run too slow: ${runAnalysis.duration}ms`);
    }

    // SSE analysis
    if (logsSSE.status === 'fulfilled' && logsSSE.value.events.length === 0) {
        runAnalysis.issues.push('No logs SSE events');
    }
    if (guardSSE.status === 'fulfilled' && guardSSE.value.events.length === 0) {
        runAnalysis.issues.push('No guard SSE events');
    }

    logger.info(`Agent run analysis complete`, {
        runId,
        duration: `${runAnalysis.duration}ms`,
        status: runAnalysis.status,
        issues: runAnalysis.issues.length
    });

    return runAnalysis;
}

// Enhanced endpoint testing
async function testEndpoint(path, method = 'GET', expectedStatus = 200, body = null, description = '') {
    logger.info(`Testing endpoint`, { path, method, expectedStatus, description });
    
    const startTime = Date.now();
    const response = await httpClient.makeRequest(path, method, body);
    const duration = Date.now() - startTime;
    
    const result = {
        path,
        method,
        expectedStatus,
        actualStatus: response.status,
        duration,
        success: response.status === expectedStatus,
        data: response.data,
        responseTime: response.responseTime,
        issues: []
    };

    if (response.status !== expectedStatus) {
        result.issues.push(`Expected ${expectedStatus}, got ${response.status}`);
        logger.error(`Endpoint test failed`, result);
    } else {
        logger.success(`Endpoint test passed`, { path, duration: `${duration}ms` });
    }

    return result;
}

// Main test execution
async function runAdvancedT1Test() {
    logger.info('🚀 Starting T1 ADVANCED DEBUG Test');
    logger.info('🎯 Comprehensive testing with detailed analysis');
    logger.info(`📊 Workspace ID: ${WORKSPACE_ID}`);

    const overallStartTime = Date.now();
    
    try {
        // Test 1: Enhanced Sanity & Baseline
        logger.info('=== TEST 1: ENHANCED SANITY & BASELINE ===');
        
        const sanityTests = [
            await testEndpoint('/health', 'GET', 200, null, 'Health check'),
            await testEndpoint('/ready', 'GET', 200, null, 'Readiness check'),
            await testEndpoint('/metrics', 'GET', 200, null, 'Metrics endpoint')
        ];

        const baselineMetrics = await analyzeMetrics('baseline');
        
        // Test 2: Enhanced Agent Analysis
        logger.info('=== TEST 2: ENHANCED AGENT ANALYSIS ===');
        
        const agentsResponse = await httpClient.makeRequest('/api/agents');
        if (agentsResponse.status !== 200 || !agentsResponse.data?.length) {
            throw new Error('No agents available for testing');
        }

        logger.info(`Found ${agentsResponse.data.length} agents for testing`);
        
        const agentRuns = [];
        for (let i = 0; i < Math.min(3, agentsResponse.data.length); i++) {
            const agent = agentsResponse.data[i];
            logger.info(`Testing agent: ${agent.name} (${agent.slug})`);
            
            for (let run = 1; run <= 2; run++) {
                const runAnalysis = await analyzeAgentRun(agent.slug, run);
                if (runAnalysis) {
                    agentRuns.push(runAnalysis);
                }
            }
        }

        // Test 3: Enhanced Feature Testing
        logger.info('=== TEST 3: ENHANCED FEATURE TESTING ===');
        
        const featureTests = [
            await testEndpoint('/api/workspace/privacy', 'POST', 404, { storePlain: false }, 'Privacy endpoint (expected 404)'),
            await testEndpoint('/api/workspace/plan', 'POST', 404, { plan: 'free' }, 'Plan endpoint (expected 404)'),
            await testEndpoint('/api/registry/agents', 'GET', 200, null, 'Registry search'),
            await testEndpoint('/api/registry/public-key', 'GET', 200, null, 'Registry public key')
        ];

        // Test 4: Performance Analysis
        logger.info('=== TEST 4: PERFORMANCE ANALYSIS ===');
        
        const performanceStats = httpClient.getPerformanceStats();
        const finalMetrics = await analyzeMetrics('final');

        // Generate comprehensive report
        logger.info('=== GENERATING COMPREHENSIVE REPORT ===');
        
        const report = {
            summary: {
                totalTests: sanityTests.length + agentRuns.length + featureTests.length,
                passedTests: sanityTests.filter(t => t.success).length + agentRuns.filter(r => r.status === 'complete').length + featureTests.filter(t => t.success).length,
                failedTests: sanityTests.filter(t => !t.success).length + agentRuns.filter(r => r.status !== 'complete').length + featureTests.filter(t => !t.success).length,
                totalDuration: Date.now() - overallStartTime,
                performanceStats,
                criticalIssues: agentRuns.filter(r => r.issues.length > 0).length,
                missingFeatures: featureTests.filter(t => t.actualStatus === 404).length
            },
            details: {
                sanityTests,
                agentRuns,
                featureTests,
                baselineMetrics,
                finalMetrics,
                performanceStats
            }
        };

        // Add recommendations
        if (agentRuns.some(r => r.issues.includes('No spans generated'))) {
            logger.addRecommendation('CRITICAL', 'Sentinel', 'Implement span generation', 'Core safety feature missing');
        }
        if (agentRuns.some(r => r.issues.includes('No guard events'))) {
            logger.addRecommendation('CRITICAL', 'Sentinel', 'Implement guard event generation', 'Real-time monitoring broken');
        }
        if (performanceStats?.p95 > 5000) {
            logger.addRecommendation('HIGH', 'Performance', 'Optimize response times', 'P95 response time too high');
        }
        if (featureTests.some(t => t.actualStatus === 404)) {
            logger.addRecommendation('MEDIUM', 'Features', 'Implement missing endpoints', 'Core features not available');
        }

        logger.testResults.summary = report.summary;
        logger.testResults.details = { ...logger.testResults.details, ...report.details };

        // Final summary
        logger.success('🎉 T1 ADVANCED TEST COMPLETE');
        logger.info('📊 FINAL SUMMARY', report.summary);
        
        const resultsFile = logger.saveResults();
        logger.success(`📁 Detailed results saved to: ${resultsFile}`);

        // Print critical issues
        const criticalIssues = agentRuns.filter(r => r.issues.length > 0);
        if (criticalIssues.length > 0) {
            logger.error('🚨 CRITICAL ISSUES FOUND', {
                count: criticalIssues.length,
                issues: criticalIssues.map(r => ({ runId: r.runId, issues: r.issues }))
            });
        }

        return report;

    } catch (error) {
        logger.error('❌ T1 ADVANCED TEST FAILED', {
            error: error.message,
            stack: error.stack
        });
        
        logger.testResults.error = error.message;
        logger.testResults.stack = error.stack;
        logger.saveResults();
        
        throw error;
    }
}

// Run the advanced test
runAdvancedT1Test().catch(console.error);
