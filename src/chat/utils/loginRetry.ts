export const LOGIN_RETRY_KEY = "LOGIN_RETRY_PENDING";

export function getLoginUrl(): string {
  return import.meta.env.VITE_LOGIN_URL || "/api/login";
}

/**
 * Remember that the last request was interrupted by an expired session so it
 * can be retried automatically once the user is authenticated again.
 */
export function markLoginRetry(): void {
  try {
    localStorage.setItem(LOGIN_RETRY_KEY, "1");
  } catch (error) {
    console.warn("Unable to persist login retry flag: %o", error);
  }
}

export function hasLoginRetry(): boolean {
  try {
    return localStorage.getItem(LOGIN_RETRY_KEY) === "1";
  } catch (error) {
    console.warn("Unable to read login retry flag: %o", error);
    return false;
  }
}

export function clearLoginRetry(): void {
  try {
    localStorage.removeItem(LOGIN_RETRY_KEY);
  } catch (error) {
    console.warn("Unable to clear login retry flag: %o", error);
  }
}

/**
 * Read and reset the flag. Returns `true` exactly once per persisted flag so a
 * single interrupted request is retried once after logging in.
 */
export function consumeLoginRetry(): boolean {
  if (!hasLoginRetry()) {
    return false;
  }
  clearLoginRetry();
  return true;
}

/**
 * Prepare the redirect to the login page. When `retry` is set, the pending
 * request is flagged so it can be resumed after authentication.
 */
export function beginLoginRedirect(options: { retry?: boolean } = {}): string {
  if (options.retry) {
    markLoginRetry();
  }
  return getLoginUrl();
}

/**
 * A message can be retried automatically only if it was the user's own last
 * message, i.e. the assistant never started answering it.
 */
export function isRetryableMessage(message: unknown): boolean {
  return (message as { role?: string } | undefined)?.role === "user";
}
