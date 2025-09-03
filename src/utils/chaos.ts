import { getChaosState } from '../api/admin'

export interface ChaosConfig {
  mode: 'timeout' | '500' | 'jitter'
  pct: number
}

export function shouldInjectChaos(tool: string): boolean {
  const chaos = getChaosState(tool)
  if (!chaos) return false
  
  const random = Math.random() * 100
  return random < chaos.pct
}

export function injectChaos(tool: string): Promise<never> {
  const chaos = getChaosState(tool)
  if (!chaos) {
    throw new Error('No chaos configured for tool')
  }

  switch (chaos.mode) {
    case 'timeout':
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Chaos: Simulated timeout'))
        }, 10000) // 10 second timeout
      })

    case '500':
      throw new Error('Chaos: Simulated 500 error')

    case 'jitter':
      const delay = Math.random() * 5000 + 1000 // 1-6 second random delay
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined as never)
        }, delay)
      })

    default:
      throw new Error(`Chaos: Unknown mode ${chaos.mode}`)
  }
}

export function maybeInjectChaos(tool: string): Promise<void> {
  if (shouldInjectChaos(tool)) {
    return injectChaos(tool)
  }
  return Promise.resolve()
}
