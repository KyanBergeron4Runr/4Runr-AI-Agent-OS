import { 
  PlatformOptimizer, 
  platformOptimizer, 
  getPlatformInfo, 
  applyPlatformOptimizations,
  optimizedFileWrite 
} from '../platform-optimizations'
import { platform } from 'os'
import { promises as fs } from 'fs'
import { join } from 'path'

describe('PlatformOptimizer', () => {
  let optimizer: PlatformOptimizer

  beforeEach(() => {
    optimizer = new PlatformOptimizer()
  })

  describe('Platform Detection', () => {
    test('should detect current platform correctly', () => {
      const platformInfo = optimizer.getPlatformInfo()
      
      expect(platformInfo.platform).toBe(platform())
      expect(platformInfo.architecture).toBeTruthy()
      expect(typeof platformInfo.isWSL).toBe('boolean')
      expect(typeof platformInfo.isDocker).toBe('boolean')
      expect(platformInfo.cpuCount).toBeGreaterThan(0)
      expect(platformInfo.totalMemory).toBeGreaterThan(0)
      expect(platformInfo.nodeVersion).toBeTruthy()
    })

    test('should provide platform-specific optimizations', () => {
      const platformInfo = optimizer.getPlatformInfo()
      const optimizations = platformInfo.optimizations
      
      expect(optimizations.fileHandling).toBeDefined()
      expect(optimizations.processManagement).toBeDefined()
      expect(optimizations.memoryManagement).toBeDefined()
      expect(optimizations.networkOptimizations).toBeDefined()
      expect(optimizations.dockerOptimizations).toBeDefined()
    })
  })

  describe('File Handling Optimizations', () => {
    test('should provide file handling configuration', () => {
      const fileOpts = optimizer.getFileHandlingOptimizations()
      
      expect(fileOpts.bufferSize).toBeGreaterThan(0)
      expect(fileOpts.concurrentOperations).toBeGreaterThan(0)
      expect(fileOpts.tempDirectory).toBeTruthy()
      expect(typeof fileOpts.useAsyncIO).toBe('boolean')
      expect(typeof fileOpts.fsyncEnabled).toBe('boolean')
    })

    test('should have platform-specific buffer sizes', () => {
      const fileOpts = optimizer.getFileHandlingOptimizations()
      const currentPlatform = platform()
      
      if (currentPlatform === 'win32') {
        expect(fileOpts.bufferSize).toBeLessThanOrEqual(32 * 1024)
        expect(fileOpts.fsyncEnabled).toBe(true)
      } else if (currentPlatform === 'linux') {
        expect(fileOpts.bufferSize).toBeGreaterThanOrEqual(48 * 1024)
      }
    })
  })

  describe('Process Management Optimizations', () => {
    test('should provide process management configuration', () => {
      const processOpts = optimizer.getProcessManagementOptimizations()
      
      expect(processOpts.maxWorkers).toBeGreaterThan(0)
      expect(processOpts.processTimeout).toBeGreaterThan(0)
      expect(processOpts.gracefulShutdownTimeout).toBeGreaterThan(0)
      expect(Array.isArray(processOpts.signalHandling)).toBe(true)
      expect(processOpts.signalHandling.length).toBeGreaterThan(0)
    })

    test('should have platform-specific signal handling', () => {
      const processOpts = optimizer.getProcessManagementOptimizations()
      const currentPlatform = platform()
      
      expect(processOpts.signalHandling).toContain('SIGTERM')
      expect(processOpts.signalHandling).toContain('SIGINT')
      
      if (currentPlatform === 'win32') {
        expect(processOpts.signalHandling).toContain('SIGBREAK')
      } else {
        expect(processOpts.signalHandling.length).toBeGreaterThanOrEqual(2)
      }
    })
  })

  describe('Memory Management Optimizations', () => {
    test('should provide memory management configuration', () => {
      const memoryOpts = optimizer.getMemoryManagementOptimizations()
      
      expect(['aggressive', 'balanced', 'conservative']).toContain(memoryOpts.gcStrategy)
      expect(memoryOpts.heapSizeLimit).toBeGreaterThan(0)
      expect(memoryOpts.gcInterval).toBeGreaterThan(0)
      expect(memoryOpts.memoryThreshold).toBeGreaterThan(0)
      expect(memoryOpts.memoryThreshold).toBeLessThanOrEqual(1)
    })

    test('should have platform-specific GC strategies', () => {
      const memoryOpts = optimizer.getMemoryManagementOptimizations()
      const currentPlatform = platform()
      
      if (currentPlatform === 'win32') {
        expect(memoryOpts.gcStrategy).toBe('conservative')
        expect(memoryOpts.memoryThreshold).toBeLessThanOrEqual(0.8)
      } else if (currentPlatform === 'linux') {
        expect(memoryOpts.gcStrategy).toBe('aggressive')
      }
    })
  })

  describe('Network Optimizations', () => {
    test('should provide network configuration', () => {
      const networkOpts = optimizer.getNetworkOptimizations()
      
      expect(networkOpts.keepAliveTimeout).toBeGreaterThan(0)
      expect(networkOpts.maxConnections).toBeGreaterThan(0)
      expect(typeof networkOpts.connectionPooling).toBe('boolean')
      expect(typeof networkOpts.tcpNoDelay).toBe('boolean')
      expect(networkOpts.socketTimeout).toBeGreaterThan(0)
    })

    test('should have platform-specific connection limits', () => {
      const networkOpts = optimizer.getNetworkOptimizations()
      const currentPlatform = platform()
      
      if (currentPlatform === 'win32') {
        expect(networkOpts.maxConnections).toBeLessThanOrEqual(500)
      } else if (currentPlatform === 'linux') {
        expect(networkOpts.maxConnections).toBeGreaterThanOrEqual(1000)
      }
    })
  })

  describe('Docker Optimizations', () => {
    test('should provide Docker configuration', () => {
      const dockerOpts = optimizer.getDockerOptimizations()
      
      expect(dockerOpts.healthCheckInterval).toBeGreaterThan(0)
      expect(dockerOpts.restartPolicy).toBeTruthy()
      expect(dockerOpts.resourceLimits.memory).toBeTruthy()
      expect(dockerOpts.resourceLimits.cpu).toBeTruthy()
      expect(dockerOpts.logDriver).toBeTruthy()
    })

    test('should generate valid Docker Compose config', () => {
      const dockerConfig = optimizer.getOptimizedDockerConfig()
      
      expect(dockerConfig.version).toBeTruthy()
      expect(dockerConfig.services.gateway).toBeDefined()
      expect(dockerConfig.services.gateway.healthcheck).toBeDefined()
      expect(dockerConfig.services.gateway.deploy).toBeDefined()
    })
  })

  describe('Node.js Options', () => {
    test('should generate valid Node.js options', () => {
      const nodeOptions = optimizer.getNodeOptions()
      
      expect(typeof nodeOptions).toBe('string')
      
      if (nodeOptions.length > 0) {
        expect(nodeOptions).toMatch(/--[\w-]+/)
      }
    })

    test('should include platform-specific options', () => {
      const nodeOptions = optimizer.getNodeOptions()
      const currentPlatform = platform()
      
      if (currentPlatform === 'win32' && nodeOptions.includes('--max-semi-space-size')) {
        expect(nodeOptions).toContain('--max-semi-space-size=64')
      }
    })
  })
})

describe('Platform Utility Functions', () => {
  test('getPlatformInfo should return platform information', () => {
    const platformInfo = getPlatformInfo()
    
    expect(platformInfo.platform).toBe(platform())
    expect(platformInfo.optimizations).toBeDefined()
  })

  test('applyPlatformOptimizations should not throw', () => {
    expect(() => {
      applyPlatformOptimizations()
    }).not.toThrow()
  })

  describe('Optimized File Operations', () => {
    const testDir = join(__dirname, 'test-files')
    const testFile = join(testDir, 'test-optimized-write.txt')

    beforeAll(async () => {
      try {
        await fs.mkdir(testDir, { recursive: true })
      } catch (error) {
        // Directory might already exist
      }
    })

    afterAll(async () => {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch (error) {
        // Directory might not exist
      }
    })

    test('should write file with platform optimizations', async () => {
      const testData = 'Hello, platform-optimized world!'
      
      await optimizedFileWrite(testFile, testData)
      
      const readData = await fs.readFile(testFile, 'utf8')
      expect(readData).toBe(testData)
    })

    test('should handle binary data', async () => {
      const testData = Buffer.from([1, 2, 3, 4, 5])
      const binaryFile = join(testDir, 'test-binary.bin')
      
      await optimizedFileWrite(binaryFile, testData)
      
      const readData = await fs.readFile(binaryFile)
      expect(Buffer.compare(readData, testData)).toBe(0)
    })

    test('should handle large files', async () => {
      const largeData = 'x'.repeat(100000) // 100KB
      const largeFile = join(testDir, 'test-large.txt')
      
      await optimizedFileWrite(largeFile, largeData)
      
      const readData = await fs.readFile(largeFile, 'utf8')
      expect(readData.length).toBe(largeData.length)
    }, 10000)
  })
})

describe('Platform-Specific Integration Tests', () => {
  test('should handle Windows-specific scenarios', async () => {
    if (platform() === 'win32') {
      const optimizer = new PlatformOptimizer()
      const fileOpts = optimizer.getFileHandlingOptimizations()
      
      expect(fileOpts.tempDirectory).toMatch(/temp/i)
      expect(fileOpts.fsyncEnabled).toBe(true)
    }
  })

  test('should handle Linux-specific scenarios', async () => {
    if (platform() === 'linux') {
      const optimizer = new PlatformOptimizer()
      const processOpts = optimizer.getProcessManagementOptimizations()
      
      expect(processOpts.signalHandling).toContain('SIGUSR1')
    }
  })

  test('should detect WSL correctly', () => {
    const platformInfo = getPlatformInfo()
    
    // WSL detection is environment-specific, just ensure it doesn't throw
    expect(typeof platformInfo.isWSL).toBe('boolean')
  })

  test('should detect Docker correctly', () => {
    const platformInfo = getPlatformInfo()
    
    // Docker detection is environment-specific, just ensure it doesn't throw
    expect(typeof platformInfo.isDocker).toBe('boolean')
  })
})