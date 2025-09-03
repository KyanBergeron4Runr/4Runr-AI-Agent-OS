/**
 * Token rotation and validation utilities
 */
/**
 * Check if a token is expired
 * @param expires_at - ISO string date
 * @returns boolean
 */
export declare function isTokenExpired(expires_at: string): boolean;
/**
 * Check if a token is expiring soon (within 5 minutes)
 * @param expires_at - ISO string date
 * @returns boolean
 */
export declare function isTokenExpiringSoon(expires_at: string): boolean;
/**
 * Get time until token expires in milliseconds
 * @param expires_at - ISO string date
 * @returns number of milliseconds until expiry
 */
export declare function getTimeUntilExpiry(expires_at: string): number;
/**
 * Format time until expiry as human readable string
 * @param expires_at - ISO string date
 * @returns formatted string like "2 hours 30 minutes"
 */
export declare function formatTimeUntilExpiry(expires_at: string): string;
//# sourceMappingURL=token-utils.d.ts.map