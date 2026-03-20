/**
 * Error handling utilities for GraphQL and network errors
 */

/**
 * Detects if an error is a 429 rate limit error
 */
export function is429Error(error: any): boolean {
  if (!error) return false;

  const errorMessage = error?.message || '';
  const errorString = JSON.stringify(error).toLowerCase();

  return (
    errorMessage.includes('429') ||
    errorMessage.includes('Too many requests') ||
    errorMessage.includes('rate limit') ||
    errorString.includes('429') ||
    errorString.includes('too many requests')
  );
}

/**
 * Extracts retry-after time from error or returns default
 * @param error - The error object
 * @returns Milliseconds until retry is allowed
 */
export function getRateLimitRetryTime(error: any): number {
  // Try to parse retry-after header if available
  try {
    const retryAfter = error?.response?.headers?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  } catch (e) {
    // Ignore parsing errors
  }

  // Default to 60 seconds
  return 60000;
}

/**
 * Formats milliseconds into human-readable time
 * @example formatTimeRemaining(65000) => "1m 5s"
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);

  if (seconds < 0) return '0s';
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Checks if error is a network error (not rate limit)
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error?.message || '';

  return (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection')
  );
}

/**
 * Gets a user-friendly error message from any error
 */
export function getUserFriendlyError(error: any): string {
  if (is429Error(error)) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  if (isNetworkError(error)) {
    return 'Network connection error. Please check your internet connection.';
  }

  return error?.message || 'An unexpected error occurred. Please try again.';
}
