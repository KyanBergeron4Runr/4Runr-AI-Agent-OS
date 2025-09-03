import { platform, arch, cpus, totalmem, freemem } from 'os'
import { promises as fs } from 'fs'
import { join } from 'path'
import { executeCommand } from './cross-platform-executor'

export interface PlatformInfo {
  platform: string
  architecture: string
  isWSL: boolean
  isDocker: boolean
  cpuCount: number
  totalMemory: number
  freeMemory: number
  nodeVersion: string
  optimizations: PlatformOptimizations
}

export interface PlatformOptimizations {
  fileHandling: FileHandlingOptimizations
  processManagement: ProcessManagementOptimizations
  memoryManagement: MemoryManagementOptimizations
  networkOptimizations: NetworkOptimizations
  dockerOptimizations: DockerOptimizations
}

export interface FileHandlingOptimizations {
  useAsyncIO: boolean
  batchSize: number
  bufferSize: number
  concurrentOperations: number
  fsyncEnabled: boolean
  tempDirectory: string
}

export interface ProcessManagementOptimizations {
  maxWorkers: number
  processTimeout: number
  gracefulShutdownTimeout: number
  processPooling: boolean
  signalHandling: string[]
}

export interface MemoryManagementOptimizations {
  gcStrategy: 'aggressive' | 'balanced' | 'conservative'
  heapSizeLimit: number
  gcInterval: number
  memoryThreshold: number
  enableMemoryProfiling: boolean
}

export interface NetworkOptimizations {
  keepAliveTimeout: number
  maxConnections: number
  connectionPooling: boolean
  tcpNoDelay: boolean
  socketTimeout: number
}

export interface DockerOptimizations {
  useDockerAPI: boolean
  healthCheckInterval: number
  restartPolicy: string
  resourceLimits: {
    memory: string
    cpu: string
  }
  logDriver: string
}

/**
 * Platform-Specific Optimizations Manager
 * Provides optimized configurations and utilities for different platforms
 */
export class PlatformOptimizer {
  private platformInfo: PlatformInfo
  private optimizations: PlatformOptimizations

  constructor() {
    this.platformInfo = this.detectPlatform()
    this.optimizations = this.generateOptimizations()
    
    console.log(`🔧 Platform Optimizer initialized for ${this.platformInfo.platform} (${this.platformInfo.architecture})`)
    if (this.platformInfo.isWSL) {
      console.log('🐧 WSL environment detected - applying WSL-specific optimizations')
    }
    if (this.platformInfo.isDocker) {
      console.log('🐳 Docker environment detected - applying container optimizations')
    }
  }

  /**
   * Get platform information and optimizations
   */
  getPlatformInfo(): PlatformInfo {
    return this.platformInfo
  }

  /**
   * Get optimized file handling configuration
   */
  getFileHandlingOptimizations(): FileHandlingOptimizations {
    return this.optimizations.fileHandling
  }

  /**
   * Get optimized process management configuration
   */
  getProcessManagementOptimizations(): ProcessManagementOptimizations {
    return this.optimizations.processManagement
  }

  /**
   * Get optimized memory management configuration
   */
  getMemoryManagementOptimizations(): MemoryManagementOptimizations {
    return this.optimizations.memoryManagement
  }

  /**
   * Get optimized network configuration
   */
  getNetworkOptimizations(): NetworkOptimizations {
    return this.optimizations.networkOptimizations
  }

  /**
   * Get optimized Docker configuration
   */
  getDockerOptimizations(): DockerOptimizations {
    return this.optimizations.dockerOptimizations
  }

  /**
   * Apply platform-specific file system optimizations
   */
  async optimizeFileOperations(filePath: string, data: string | Buffer): Promise<void> {
    const opts = this.optimizations.fileHandling
    
    try {
      if (this.platformInfo.platform === 'win32') {
        // Windows-specific file handling
        await this.writeFileWindows(filePath, data, opts)
      } else {
        // Unix-like file handling
        await this.writeFileUnix(filePath, data, opts)
      }
    } catch (error) {
      console.error(`❌ Optimized file operation failed: ${error}`)
      throw error
    }
  }

  /**
   * Apply platform-specific process optimizations
   */
  applyProcessOptimizations(): void {
    const opts = this.optimizations.processManagement
    
    // Set process title for easier identification
    process.title = `4runr-gateway-${this.platformInfo.platform}`
    
    // Configure process limits based on platform
    if (this.platformInfo.platform !== 'win32') {
      try {
        // Set nice value for better process scheduling on Unix-like systems
        process.setpriority?.(0, -5) // Slightly higher priority
      } catch (error) {
        console.log('⚠️ Could not set process priority:', error)
      }
    }
    
    // Configure signal handling
    opts.signalHandling.forEach(signal => {
      process.on(signal as NodeJS.Signals, () => {
        console.log(`📡 Received ${signal}, initiating graceful shutdown...`)
        setTimeout(() => {
          console.log('🚨 Graceful shutdown timeout, forcing exit')
          process.exit(1)
        }, opts.gracefulShutdownTimeout)
      })
    })
    
    console.log(`⚙️ Applied process optimizations for ${this.platformInfo.platform}`)
  }

  /**
   * Apply platform-specific memory optimizations
   */
  applyMemoryOptimizations(): void {
    const opts = this.optimizations.memoryManagement
    
    // Configure garbage collection based on platform
    if (global.gc) {
      const gcInterval = setInterval(() => {
        const memUsage = process.memoryUsage()
        const heapUsedPercent = memUsage.heapUsed / memUsage.heapTotal
        
        if (heapUsedPercent > opts.memoryThreshold) {
          console.log(`🧹 Memory threshold exceeded (${(heapUsedPercent * 100).toFixed(1)}%), triggering GC`)
          global.gc()
        }
      }, opts.gcInterval)
      
      // Clear interval on process exit
      process.on('exit', () => clearInterval(gcInterval))
    }
    
    // Set heap size limits if supported
    if (opts.heapSizeLimit > 0) {
      console.log(`💾 Memory limit set to ${Math.round(opts.heapSizeLimit / 1024 / 1024)}MB`)
    }
    
    console.log(`🧠 Applied memory optimizations (${opts.gcStrategy} strategy)`)
  }

  /**
   * Get optimized Docker Compose configuration
   */
  getOptimizedDockerConfig(): any {
    const dockerOpts = this.optimizations.dockerOptimizations
    
    return {
      version: '3.8',
      services: {
        gateway: {
          build: '.',
          ports: ['3000:3000'],
          environment: {
            NODE_ENV: 'production',
            NODE_OPTIONS: this.getNodeOptions()
          },
          deploy: {
            resources: {
              limits: dockerOpts.resourceLimits,
              reservations: {
                memory: '256M',
                cpus: '0.5'
              }
            },
            restart_policy: {
              condition: dockerOpts.restartPolicy,
              delay: '5s',
              max_attempts: 3,
              window: '120s'
            }
          },
          healthcheck: {
            test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
            interval: `${dockerOpts.healthCheckInterval}s`,
            timeout: '10s',
            retries: 3,
            start_period: '30s'
          },
          logging: {
            driver: dockerOpts.logDriver,
            options: {
              'max-size': '10m',
              'max-file': '3'
            }
          }
        }
      }
    }
  }

  /**
   * Get optimized Node.js options
   */
  getNodeOptions(): string {
    const memOpts = this.optimizations.memoryManagement
    const options: string[] = []
    
    // Memory optimizations
    if (memOpts.heapSizeLimit > 0) {
      options.push(`--max-old-space-size=${Math.round(memOpts.heapSizeLimit / 1024 / 1024)}`)
    }
    
    // Garbage collection optimizations
    if (memOpts.gcStrategy === 'aggressive') {
      options.push('--expose-gc')
      options.push('--optimize-for-size')
    } else if (memOpts.gcStrategy === 'balanced') {
      options.push('--expose-gc')
    }
    
    // Platform-specific optimizations
    if (this.platformInfo.platform === 'win32') {
      options.push('--max-semi-space-size=64')
    }
    
    if (this.platformInfo.isDocker) {
      options.push('--unhandled-rejections=strict')
    }
    
    return options.join(' ')
  }

  /**
   * Detect platform information
   */
  private detectPlatform(): PlatformInfo {
    const currentPlatform = platform()
    const currentArch = arch()
    const isWSL = this.detectWSL()
    const isDocker = this.detectDocker()
    
    return {
      platform: currentPlatform,
      architecture: currentArch,
      isWSL,
      isDocker,
      cpuCount: cpus().length,
      totalMemory: totalmem(),
      freeMemory: freemem(),
      nodeVersion: process.version,
      optimizations: {} as PlatformOptimizations // Will be filled by generateOptimizations
    }
  }

  /**
   * Detect if running in WSL
   */
  private detectWSL(): boolean {
    try {
      const procVersion = require('fs').readFileSync('/proc/version', 'utf8')
      return procVersion.toLowerCase().includes('microsoft')
    } catch {
      return false
    }
  }

  /**
   * Detect if running in Docker
   */
  private detectDocker(): boolean {
    try {
      require('fs').readFileSync('/.dockerenv')
      return true
    } catch {
      try {
        const cgroup = require('fs').readFileSync('/proc/1/cgroup', 'utf8')
        return cgroup.includes('docker') || cgroup.includes('containerd')
      } catch {
        return false
      }
    }
  }

  /**
   * Generate platform-specific optimizations
   */
  private generateOptimizations(): PlatformOptimizations {
    const baseOptimizations: PlatformOptimizations = {
      fileHandling: {
        useAsyncIO: true,
        batchSize: 100,
        bufferSize: 64 * 1024,
        concurrentOperations: 10,
        fsyncEnabled: false,
        tempDirectory: '/tmp'
      },
      processManagement: {
        maxWorkers: this.platformInfo.cpuCount,
        processTimeout: 30000,
        gracefulShutdownTimeout: 10000,
        processPooling: true,
        signalHandling: ['SIGTERM', 'SIGINT']
      },
      memoryManagement: {
        gcStrategy: 'balanced',
        heapSizeLimit: Math.min(this.platformInfo.totalMemory * 0.8, 2 * 1024 * 1024 * 1024),
        gcInterval: 60000,
        memoryThreshold: 0.8,
        enableMemoryProfiling: false
      },
      networkOptimizations: {
        keepAliveTimeout: 5000,
        maxConnections: 1000,
        connectionPooling: true,
        tcpNoDelay: true,
        socketTimeout: 30000
      },
      dockerOptimizations: {
        useDockerAPI: true,
        healthCheckInterval: 30,
        restartPolicy: 'on-failure',
        resourceLimits: {
          memory: '1G',
          cpu: '1.0'
        },
        logDriver: 'json-file'
      }
    }

    // Platform-specific adjustments
    switch (this.platformInfo.platform) {
      case 'win32':
        return this.getWindowsOptimizations(baseOptimizations)
      case 'linux':
        return this.platformInfo.isWSL 
          ? this.getWSLOptimizations(baseOptimizations)
          : this.getLinuxOptimizations(baseOptimizations)
      case 'darwin':
        return this.getMacOSOptimizations(baseOptimizations)
      default:
        console.log(`⚠️ Unknown platform: ${this.platformInfo.platform}, using default optimizations`)
        return baseOptimizations
    }
  }

  /**
   * Windows-specific optimizations
   */
  private getWindowsOptimizations(base: PlatformOptimizations): PlatformOptimizations {
    return {
      ...base,
      fileHandling: {
        ...base.fileHandling,
        bufferSize: 32 * 1024, // Smaller buffer for Windows
        concurrentOperations: 5, // Fewer concurrent operations
        fsyncEnabled: true, // Enable fsync for data integrity
        tempDirectory: process.env.TEMP || 'C:\\temp'
      },
      processManagement: {
        ...base.processManagement,
        processTimeout: 45000, // Longer timeout for Windows
        gracefulShutdownTimeout: 15000,
        signalHandling: ['SIGTERM', 'SIGINT', 'SIGBREAK']
      },
      memoryManagement: {
        ...base.memoryManagement,
        gcStrategy: 'conservative', // More conservative GC on Windows
        gcInterval: 90000, // Less frequent GC
        memoryThreshold: 0.75 // Lower threshold
      },
      networkOptimizations: {
        ...base.networkOptimizations,
        keepAliveTimeout: 10000, // Longer keep-alive
        maxConnections: 500 // Fewer max connections
      }
    }
  }

  /**
   * WSL-specific optimizations
   */
  private getWSLOptimizations(base: PlatformOptimizations): PlatformOptimizations {
    return {
      ...base,
      fileHandling: {
        ...base.fileHandling,
        bufferSize: 48 * 1024, // Medium buffer for WSL
        concurrentOperations: 8,
        fsyncEnabled: false // WSL handles this
      },
      processManagement: {
        ...base.processManagement,
        processTimeout: 35000,
        maxWorkers: Math.max(2, this.platformInfo.cpuCount - 1) // Leave one CPU for WSL overhead
      },
      memoryManagement: {
        ...base.memoryManagement,
        gcStrategy: 'balanced',
        heapSizeLimit: Math.min(this.platformInfo.totalMemory * 0.6, 1.5 * 1024 * 1024 * 1024) // Less memory for WSL
      },
      dockerOptimizations: {
        ...base.dockerOptimizations,
        resourceLimits: {
          memory: '768M', // Smaller limits for WSL
          cpu: '0.8'
        }
      }
    }
  }

  /**
   * Linux-specific optimizations
   */
  private getLinuxOptimizations(base: PlatformOptimizations): PlatformOptimizations {
    return {
      ...base,
      fileHandling: {
        ...base.fileHandling,
        bufferSize: 128 * 1024, // Larger buffer for Linux
        concurrentOperations: 15,
        fsyncEnabled: false // Linux handles this efficiently
      },
      processManagement: {
        ...base.processManagement,
        maxWorkers: this.platformInfo.cpuCount + 2, // Can handle more workers
        signalHandling: ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2']
      },
      memoryManagement: {
        ...base.memoryManagement,
        gcStrategy: 'aggressive', // More aggressive GC on Linux
        gcInterval: 45000
      },
      networkOptimizations: {
        ...base.networkOptimizations,
        maxConnections: 2000 // Higher connection limit
      }
    }
  }

  /**
   * macOS-specific optimizations
   */
  private getMacOSOptimizations(base: PlatformOptimizations): PlatformOptimizations {
    return {
      ...base,
      fileHandling: {
        ...base.fileHandling,
        bufferSize: 96 * 1024,
        concurrentOperations: 12
      },
      processManagement: {
        ...base.processManagement,
        signalHandling: ['SIGTERM', 'SIGINT', 'SIGUSR1']
      },
      memoryManagement: {
        ...base.memoryManagement,
        gcStrategy: 'balanced'
      }
    }
  }

  /**
   * Windows-specific file writing
   */
  private async writeFileWindows(filePath: string, data: string | Buffer, opts: FileHandlingOptimizations): Promise<void> {
    const tempPath = join(opts.tempDirectory, `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    
    try {
      // Write to temp file first
      await fs.writeFile(tempPath, data, { flag: 'w' })
      
      if (opts.fsyncEnabled) {
        // Force sync on Windows for data integrity
        const fd = await fs.open(tempPath, 'r+')
        await fd.sync()
        await fd.close()
      }
      
      // Atomic move on Windows
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath)
      } catch {}
      throw error
    }
  }

  /**
   * Unix-specific file writing
   */
  private async writeFileUnix(filePath: string, data: string | Buffer, opts: FileHandlingOptimizations): Promise<void> {
    const tempPath = `${filePath}.tmp.${process.pid}.${Date.now()}`
    
    try {
      await fs.writeFile(tempPath, data, { flag: 'w', mode: 0o644 })
      
      // Atomic move on Unix
      await fs.rename(tempPath, filePath)
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath)
      } catch {}
      throw error
    }
  }
}

// Export singleton instance
export const platformOptimizer = new PlatformOptimizer()

// Export utility functions
export function getPlatformInfo(): PlatformInfo {
  return platformOptimizer.getPlatformInfo()
}

export function applyPlatformOptimizations(): void {
  platformOptimizer.applyProcessOptimizations()
  platformOptimizer.applyMemoryOptimizations()
}

export async function optimizedFileWrite(filePath: string, data: string | Buffer): Promise<void> {
  return platformOptimizer.optimizeFileOperations(filePath, data)
}