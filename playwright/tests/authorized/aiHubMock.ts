import type { Page, Route } from "@playwright/test";

export const HUB_KEY = "sk-hub-playwright";

// The marker keeps the app's own Keycloak login (real SSO) unmocked.
const KEYCLOAK_URL =
  "https://keycloak.ki.fh-swf.de/realms/cluster/protocol/openid-connect/auth?client_id=openai-proxy&playwright_hub_login=1";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/*
 * In-memory stand-in for hub.ki.fh-swf.de. Until `signIn()` is called, key
 * generation answers 401 like the hub does without a session.
 */
export class MockAiHub {
  signedIn = false;
  keysCreated = 0;

  signIn() {
    this.signedIn = true;
  }

  async install(page: Page) {
    await page.route(/hub\.ki\.fh-swf\.de/, (route) => this.handle(route));
    // The login popup is a separate page, so mock Keycloak for the context.
    await page.context().route(/playwright_hub_login=1/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<h1>Keycloak login</h1>",
      })
    );
  }

  private async handle(route: Route) {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
    } else if (path === "/api/key/generate") {
      await this.generateKey(route);
    } else if (path === "/api/login") {
      await json(route, { login_url: KEYCLOAK_URL });
    } else if (path === "/v1/models") {
      await json(route, { data: [{ id: "gpt-4o-mini" }] });
    } else if (path === "/api/user/budget") {
      await json(route, { max_budget_in_team: 10, spend: 1, available: 9 });
    } else {
      await route.fulfill({ status: 404, body: `Unhandled ${path}` });
    }
  }

  private async generateKey(route: Route) {
    if (!this.signedIn) {
      await json(route, { detail: "Invalid session" }, 401);
      return;
    }
    this.keysCreated++;
    await json(route, {
      key: HUB_KEY,
      key_alias: "KImpuls-playwright@fh-swf.de",
    });
  }
}
