import { describe, it, expect, beforeEach } from "vitest";
import {
  LOGIN_RETRY_KEY,
  beginLoginRedirect,
  clearLoginRetry,
  consumeLoginRetry,
  hasLoginRetry,
  isRetryableMessage,
  markLoginRetry,
} from "../loginRetry";

describe("login retry flag", () => {
  beforeEach(() => {
    localStorage.clear();
    clearLoginRetry();
  });

  it("stores and reads the pending retry flag", () => {
    expect(hasLoginRetry()).toBe(false);
    markLoginRetry();
    expect(hasLoginRetry()).toBe(true);
    expect(localStorage.getItem(LOGIN_RETRY_KEY)).toBe("1");
  });

  it("consumes the flag exactly once", () => {
    markLoginRetry();
    expect(consumeLoginRetry()).toBe(true);
    expect(consumeLoginRetry()).toBe(false);
    expect(hasLoginRetry()).toBe(false);
  });

  it("persists the flag across reloads via localStorage", () => {
    markLoginRetry();
    // A fresh read simulates the app being reloaded after the login redirect
    expect(localStorage.getItem(LOGIN_RETRY_KEY)).toBe("1");
    expect(consumeLoginRetry()).toBe(true);
  });
});

describe("beginLoginRedirect", () => {
  beforeEach(() => {
    localStorage.clear();
    clearLoginRetry();
  });

  it("flags the request for retry when requested", () => {
    const url = beginLoginRedirect({ retry: true });
    expect(url).toBeTruthy();
    expect(hasLoginRetry()).toBe(true);
  });

  it("does not flag the request when retry is not requested", () => {
    beginLoginRedirect();
    expect(hasLoginRetry()).toBe(false);
  });
});

describe("isRetryableMessage", () => {
  it("treats the last user message as retryable", () => {
    expect(isRetryableMessage({ role: "user", content: "hi" })).toBe(true);
  });

  it("does not retry assistant messages", () => {
    expect(isRetryableMessage({ role: "assistant", content: "hi" })).toBe(
      false
    );
  });

  it("does not retry missing or malformed messages", () => {
    expect(isRetryableMessage(undefined)).toBe(false);
    expect(isRetryableMessage(null)).toBe(false);
    expect(isRetryableMessage({})).toBe(false);
  });
});
