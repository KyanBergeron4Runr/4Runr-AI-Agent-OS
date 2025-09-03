/**
 * Token rotation and validation utilities
 */

/**
 * Check if a token is expired
 * @param expires_at - ISO string date
 * @returns boolean
 */
export function isTokenExpired(expires_at: string): boolean {
  return new Date(expires_at) < new Date()
}

/**
 * Check if a token is expiring soon (within 5 minutes)
 * @param expires_at - ISO string date
 * @returns boolean
 */
export function isTokenExpiringSoon(expires_at: string): boolean {
  const timeLeft = new Date(expires_at).getTime() - Date.now()
  return timeLeft < 5 * 60 * 1000 // 5 minutes
}

/**
 * Get time until token expires in milliseconds
 * @param expires_at - ISO string date
 * @returns number of milliseconds until expiry
 */
export function getTimeUntilExpiry(expires_at: string): number {
  return new Date(expires_at).getTime() - Date.now()
}

/**
 * Format time until expiry as human readable string
 * @param expires_at - ISO string date
 * @returns formatted string like "2 hours 30 minutes"
 */
export function formatTimeUntilExpiry(expires_at: string): string {
  const ms = getTimeUntilExpiry(expires_at)
  if (ms <= 0) return 'Expired'
  
  const hours = Math.floor(ms / (1000 * 60 * 60))
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((ms % (1000 * 60)) / 1000)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}
