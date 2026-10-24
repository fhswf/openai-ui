export const LOGIN_RETRY_KEY = "LOGIN_RETRY_PENDING";
let loginRedirectStarted = false;

export function getLoginUrl(): string {
  const isLocalOrigin =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // Playwright serves the production build with `vite preview`, where DEV is
  // false even though the app is still running on localhost.
  if (import.meta.env.DEV || isLocalOrigin) {
    const origin = window.location.origin;
    const params = new URLSearchParams({
      return_url: `${origin}/`,
      callback_uri: `${origin}/api/callback`,
    });

    return `/api/login?${params.toString()}`;
  }

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

export function redirectToLogin(options: { retry?: boolean } = {}): void {
  if (options.retry) {
    markLoginRetry();
  }
  if (loginRedirectStarted) return;
  loginRedirectStarted = true;

  const fragment = new URLSearchParams(window.location.hash.slice(1));
  if (fragment.has("zkShare")) {
    try {
      sessionStorage.setItem("pending-zk-chat-share", window.location.hash);
    } catch (error) {
      console.warn(
        "Unable to preserve the chat share link for sign-in:",
        error
      );
    }
  }

  window.location.assign(getLoginUrl());
}

export function installUnauthorizedFetchRedirect(): void {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    const requestUrl =
      typeof args[0] === "string" || args[0] instanceof URL
        ? args[0].toString()
        : args[0].url;

    try {
      const url = new URL(requestUrl, window.location.href);
      const isSameOriginApi =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/") &&
        !/^\/api\/(?:login|callback|logout)(?:\/|$)/.test(url.pathname);

      if (response.status === 401 && isSameOriginApi) {
        // OpenAI API requests keep their existing retry-after-login behavior.
        redirectToLogin({ retry: /^\/api\/v1(?:\/|$)/.test(url.pathname) });
      }
    } catch (error) {
      console.warn(
        "Unable to check whether an unauthorized request needs login:",
        error
      );
    }

    return response;
  };
}

/**
 * A message can be retried automatically only if it was the user's own last
 * message, i.e. the assistant never started answering it.
 */
export function isRetryableMessage(message: unknown): boolean {
  return (message as { role?: string } | undefined)?.role === "user";
}
