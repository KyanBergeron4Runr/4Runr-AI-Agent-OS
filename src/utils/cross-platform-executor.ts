import { spawn, ChildProcess, SpawnOptions } from 'child_process'
import { EventEmitter } from 'events'
import { platform } from 'os'

export interface ExecutionOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
  maxBuffer?: number
  cwd?: string
  env?: Record<string, string>
  shell?: boolean
  windowsHide?: boolean
  killSignal?: string | number
  encoding?: BufferEncoding
}

export interface ExecutionResult {
  success: boolean
  exitCode: number | null
  signal: string | null
  stdout: string
  stderr: string
  duration: number
  retryCount: number
  platform: string
  command: string
  args: string[]
}

export interface PlatformConfig {
  maxBuffer: number
  defaultTimeout: number
  defaultRetries: number
  retryDelay: number
  killSignal: string | number
  shell: boolean
  windowsHide: boolean
  spawnOptions: Partial<SpawnOptions>
}

/**
 * Cross-Platform Command Executor
 * Handles platform-specific command execution with proper error handling,
 * timeouts, retries, and buffer management for Windows/WSL2 compatibility
 */
export class CrossPlatformExecutor extends EventEmitter {
  private platformConfig: PlatformConfig
  private currentPlatform: string

  constructor() {
    super()
    this.currentPlatform = platform()
    this.platformConfig = this.getPlatformConfig()
    
    console.log(`🖥️ Cross-Platform Executor initialized for ${this.currentPlatform}`)
  }

  /**
   * Execute command with cross-platform compatibility
   */
  async execute(
    command: string, 
    args: string[] = [], 
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now()
    const mergedOptions = this.mergeOptions(options)
    
    console.log(`🚀 Executing: ${command} ${args.join(' ')} (Platform: ${this.currentPlatform})`)
    
    let lastError: Error | null = null
    let retryCount = 0
    
    while (retryCount <= mergedOptions.retries!) {
      try {
        const result = await this.executeOnce(command, args, mergedOptions, retryCount)
        
        if (result.success) {
          const duration = Date.now() - startTime
          console.log(`✅ Command completed successfully in ${duration}ms (${retryCount} retries)`)
          
          return {
            ...result,
            duration,
            retryCount,
            platform: this.currentPlatform,
            command,
            args
          }
        } else {
          throw new Error(`Command failed with exit code ${result.exitCode}: ${result.stderr}`)
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (this.shouldRetry(lastError, retryCount, mergedOptions.retries!)) {
          retryCount++
          console.log(`⚠️ Command failed, retrying (${retryCount}/${mergedOptions.retries}): ${lastError.message}`)
          
          if (mergedOptions.retryDelay! > 0) {
            await this.delay(mergedOptions.retryDelay!)
          }
          
          continue
        } else {
          break
        }
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`❌ Command failed after ${retryCount} retries in ${duration}ms: ${lastError?.message}`)
    
    return {
      success: false,
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: lastError?.message || 'Unknown error',
      duration,
      retryCount,
      platform: this.currentPlatform,
      command,
      args
    }
  }

  /**
   * Execute command once with platform-specific handling
   */
  private async executeOnce(
    command: string,
    args: string[],
    options: Required<ExecutionOptions>,
    attempt: number
  ): Promise<Omit<ExecutionResult, 'duration' | 'retryCount' | 'platform' | 'command' | 'args'>> {
    return new Promise((resolve, reject) => {
      // Platform-specific command and argument handling
      const { finalCommand, finalArgs, spawnOptions } = this.prepareCommand(command, args, options)
      
      console.log(`🔧 Attempt ${attempt + 1}: ${finalCommand} ${finalArgs.join(' ')}`)
      
      const childProcess = spawn(finalCommand, finalArgs, spawnOptions)
      
      let stdout = ''
      let stderr = ''
      let isResolved = false
      let timeoutHandle: NodeJS.Timeout | null = null
      
      // Set up timeout
      if (options.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          if (!isResolved) {
            isResolved = true
            
            console.log(`⏰ Command timeout after ${options.timeout}ms, killing process`)
            
            // Platform-specific process killing
            this.killProcess(childProcess, options.killSignal)
            
            reject(new Error(`Command timeout after ${options.timeout}ms`))
          }
        }, options.timeout)
      }
      
      // Handle stdout with buffer management
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data: Buffer) => {
          const chunk = data.toString(options.encoding)
          stdout += chunk
          
          // Check buffer size to prevent ENOBUFS on Windows/WSL2
          if (stdout.length > options.maxBuffer) {
            console.log(`⚠️ Output buffer limit reached (${options.maxBuffer} bytes), truncating`)
            stdout = stdout.substring(0, options.maxBuffer) + '\n[OUTPUT TRUNCATED]'
          }
          
          this.emit('stdout', chunk)
        })
      }
      
      // Handle stderr with buffer management
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString(options.encoding)
          stderr += chunk
          
          // Check buffer size
          if (stderr.length > options.maxBuffer) {
            console.log(`⚠️ Error buffer limit reached (${options.maxBuffer} bytes), truncating`)
            stderr = stderr.substring(0, options.maxBuffer) + '\n[ERROR TRUNCATED]'
          }
          
          this.emit('stderr', chunk)
        })
      }
      
      // Handle process exit
      childProcess.on('close', (code, signal) => {
        if (!isResolved) {
          isResolved = true
          
          if (timeoutHandle) {
            clearTimeout(timeoutHandle)
          }
          
          console.log(`🏁 Process closed with code ${code}, signal ${signal}`)
          
          resolve({
            success: code === 0,
            exitCode: code,
            signal: signal,
            stdout: stdout.trim(),
            stderr: stderr.trim()
          })
        }
      })
      
      // Handle process errors
      childProcess.on('error', (error) => {
        if (!isResolved) {
          isResolved = true
          
          if (timeoutHandle) {
            clearTimeout(timeoutHandle)
          }
          
          console.log(`💥 Process error: ${error.message}`)
          
          // Handle specific Windows/WSL2 errors
          if (this.isWindowsBufferError(error)) {
            reject(new Error(`Windows buffer overflow (ENOBUFS): ${error.message}. Try reducing buffer size or command complexity.`))
          } else {
            reject(error)
          }
        }
      })
      
      // Handle spawn errors
      if (!childProcess.pid) {
        if (!isResolved) {
          isResolved = true
          
          if (timeoutHandle) {
            clearTimeout(timeoutHandle)
          }
          
          reject(new Error(`Failed to spawn process: ${finalCommand}`))
        }
      }
    })
  }

  /**
   * Prepare command and arguments for platform-specific execution
   */
  private prepareCommand(
    command: string,
    args: string[],
    options: Required<ExecutionOptions>
  ): { finalCommand: string; finalArgs: string[]; spawnOptions: SpawnOptions } {
    let finalCommand = command
    let finalArgs = [...args]
    
    // Platform-specific command preparation
    if (this.currentPlatform === 'win32') {
      // Windows-specific handling
      if (options.shell && !command.includes('.exe') && !command.includes('.cmd') && !command.includes('.bat')) {
        // Use cmd.exe for shell commands on Windows
        finalCommand = 'cmd.exe'
        finalArgs = ['/c', command, ...args]
      }
    } else if (this.isWSL()) {
      // WSL-specific handling
      if (command.startsWith('docker') || command.startsWith('docker-compose')) {
        // Handle Docker commands in WSL
        finalCommand = command
        finalArgs = args
      }
    }
    
    const spawnOptions: SpawnOptions = {
      ...this.platformConfig.spawnOptions,
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell,
      windowsHide: options.windowsHide,
      stdio: ['pipe', 'pipe', 'pipe']
    }
    
    return { finalCommand, finalArgs, spawnOptions }
  }

  /**
   * Kill process with platform-specific signal
   */
  private killProcess(childProcess: ChildProcess, killSignal: string | number): void {
    try {
      if (this.currentPlatform === 'win32') {
        // Windows doesn't support POSIX signals, use taskkill
        if (childProcess.pid) {
          spawn('taskkill', ['/pid', childProcess.pid.toString(), '/f', '/t'], { 
            stdio: 'ignore',
            windowsHide: true 
          })
        }
      } else {
        // Unix-like systems
        childProcess.kill(killSignal)
      }
    } catch (error) {
      console.log(`⚠️ Failed to kill process: ${error}`)
    }
  }

  /**
   * Check if error is Windows buffer overflow (ENOBUFS)
   */
  private isWindowsBufferError(error: Error): boolean {
    return (
      this.currentPlatform === 'win32' &&
      (error.message.includes('ENOBUFS') || 
       error.message.includes('buffer overflow') ||
       error.message.includes('No buffer space available'))
    )
  }

  /**
   * Check if running in WSL
   */
  private isWSL(): boolean {
    try {
      const fs = require('fs')
      return fs.existsSync('/proc/version') && 
             fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
    } catch {
      return false
    }
  }

  /**
   * Determine if command should be retried
   */
  private shouldRetry(error: Error, currentRetry: number, maxRetries: number): boolean {
    if (currentRetry >= maxRetries) {
      return false
    }
    
    // Always retry on Windows buffer errors
    if (this.isWindowsBufferError(error)) {
      return true
    }
    
    // Retry on timeout errors
    if (error.message.includes('timeout')) {
      return true
    }
    
    // Retry on network-related errors
    if (error.message.includes('ECONNRESET') || 
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
      return true
    }
    
    // Don't retry on permission errors
    if (error.message.includes('EACCES') || 
        error.message.includes('permission denied')) {
      return false
    }
    
    // Don't retry on file not found errors
    if (error.message.includes('ENOENT') || 
        error.message.includes('command not found')) {
      return false
    }
    
    return true
  }

  /**
   * Get platform-specific configuration
   */
  private getPlatformConfig(): PlatformConfig {
    const baseConfig: PlatformConfig = {
      maxBuffer: 1024 * 1024, // 1MB default
      defaultTimeout: 30000,   // 30 seconds
      defaultRetries: 2,
      retryDelay: 1000,        // 1 second
      killSignal: 'SIGTERM',
      shell: false,
      windowsHide: false,
      spawnOptions: {}
    }
    
    switch (this.currentPlatform) {
      case 'win32':
        return {
          ...baseConfig,
          maxBuffer: 512 * 1024,  // Smaller buffer for Windows to prevent ENOBUFS
          defaultTimeout: 45000,   // Longer timeout for Windows
          defaultRetries: 3,       // More retries for Windows
          retryDelay: 2000,        // Longer delay between retries
          killSignal: 'SIGKILL',   // Use SIGKILL on Windows
          shell: true,             // Use shell by default on Windows
          windowsHide: true,       // Hide windows by default
          spawnOptions: {
            windowsHide: true,
            shell: true
          }
        }
      
      case 'linux':
        if (this.isWSL()) {
          return {
            ...baseConfig,
            maxBuffer: 768 * 1024,  // Medium buffer for WSL
            defaultTimeout: 40000,   // Slightly longer timeout for WSL
            defaultRetries: 3,       // More retries for WSL
            retryDelay: 1500,
            spawnOptions: {
              shell: false
            }
          }
        } else {
          return {
            ...baseConfig,
            spawnOptions: {
              shell: false
            }
          }
        }
      
      case 'darwin':
        return {
          ...baseConfig,
          spawnOptions: {
            shell: false
          }
        }
      
      default:
        console.log(`⚠️ Unknown platform: ${this.currentPlatform}, using default config`)
        return baseConfig
    }
  }

  /**
   * Merge user options with platform defaults
   */
  private mergeOptions(options: ExecutionOptions): Required<ExecutionOptions> {
    return {
      timeout: options.timeout ?? this.platformConfig.defaultTimeout,
      retries: options.retries ?? this.platformConfig.defaultRetries,
      retryDelay: options.retryDelay ?? this.platformConfig.retryDelay,
      maxBuffer: options.maxBuffer ?? this.platformConfig.maxBuffer,
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? {},
      shell: options.shell ?? this.platformConfig.shell,
      windowsHide: options.windowsHide ?? this.platformConfig.windowsHide,
      killSignal: options.killSignal ?? this.platformConfig.killSignal,
      encoding: options.encoding ?? 'utf8'
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get platform information
   */
  getPlatformInfo(): { platform: string; isWSL: boolean; config: PlatformConfig } {
    return {
      platform: this.currentPlatform,
      isWSL: this.isWSL(),
      config: this.platformConfig
    }
  }
}

// Export singleton instance
export const crossPlatformExecutor = new CrossPlatformExecutor()

// Export utility function for easy use
export async function executeCommand(
  command: string,
  args: string[] = [],
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  return crossPlatformExecutor.execute(command, args, options)
}