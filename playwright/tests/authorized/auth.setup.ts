import { test as setup, expect } from "../baseFixtures";
import { Buffer } from "node:buffer";
import path from "node:path";

const authFile = path.join("playwright/.auth/user.json");
const appOrigin = new URL(
  process.env.PLAYWRIGHT_TEST_BASE_URL || "http://localhost:5173"
).origin;
const username = process.env.PLAYWRIGHT_USERNAME || "playwright";
const password = process.env.PLAYWRIGHT_PASSWORD || "test";

setup("Authenticate browser and save UI state", async ({ page, context }) => {
  setup.slow();

  // The proxy completes OIDC login on the frontend origin and sets its
  // HttpOnly `token` cookie there. Saving storage state preserves that cookie
  // for the sharded browser jobs.
  await page.goto("/");
  await expect(page.locator(".sso-login")).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".cluster-login")).toBeVisible();
  await page.locator(".cluster-login").click();
  await page
    .getByRole("textbox", { name: "Cluster Benutzername:" })
    .fill(username);
  await page
    .getByRole("textbox", { name: "Cluster Kennwort:" })
    .fill(password);
  await page.getByRole("button", { name: "Login Cluster" }).click();

  await page.waitForURL(
    (url) => url.origin === appOrigin && url.pathname === "/",
    { timeout: 60000 }
  );

  const termsButton = page.getByTestId("accept-terms-btn");
  await expect(termsButton).toBeVisible({ timeout: 30000 });
  await termsButton.click();
  await expect(async () => {
    const termsAccepted = await page.evaluate(() => {
      try {
        const session = JSON.parse(localStorage.getItem("SESSIONS") || "{}");
        return session?.options?.account?.terms === true;
      } catch {
        return false;
      }
    });
    expect(termsAccepted).toBe(true);
  }).toPass({ timeout: 10000 });
  await expect(page.getByTestId("ChatTextArea")).toBeVisible();

  const tokenCookie = (await context.cookies(appOrigin)).find(
    (cookie) => cookie.name === "token"
  );
  expect(tokenCookie, "OIDC proxy token cookie was not set").toBeDefined();
  expect(tokenCookie?.httpOnly).toBe(true);
  const jwtParts = tokenCookie!.value.split(".");
  expect(jwtParts).toHaveLength(3);
  expect(jwtParts.every((part) => part.length > 0)).toBe(true);
  const jwtClaims = JSON.parse(
    Buffer.from(jwtParts[1], "base64url").toString("utf8")
  );
  expect(jwtClaims.sub).toBeTruthy();
  expect(jwtClaims.exp * 1000).toBeGreaterThan(Date.now());

  const storageState = await context.storageState({ path: authFile });
  expect(
    storageState.cookies.some(
      (cookie) => cookie.name === "token" && cookie.value === tokenCookie!.value
    ),
    "JWT cookie was not saved to the shared Playwright state"
  ).toBe(true);
});
