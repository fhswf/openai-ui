import { test as setup, expect } from "../baseFixtures";
import path from "node:path";

const authFile = path.join("playwright/.auth/user.json");

setup("Prepare authenticated UI test state", async ({ page, context }) => {
  // CI serves the static frontend, so it has no deployment SSO gateway.
  // Visit a same-origin static asset and seed the state used by authorized UI tests.
  await page.goto("/favicon.png");
  await page.evaluate(() => {
    localStorage.setItem(
      "SESSIONS",
      JSON.stringify({
        user: {
          name: "Playwright",
          email: "playwright@fh-swf.de",
          sub: "playwright",
          preferred_username: "playwright",
          affiliations: { "fh-swf.de": ["member"] },
        },
        options: {
          account: { name: "Playwright", avatar: "", terms: true },
          general: {
            language: "de",
            theme: "light",
            sendCommand: "COMMAND_ENTER",
            size: "normal",
            codeEditor: false,
            gravatar: false,
            zkStorage: false,
            zkLazyHistory: false,
            customGpts: [],
          },
          openai: {
            baseUrl: `${window.location.origin}/api/v1`,
            organizationId: "",
            temperature: 1,
            top_p: 1,
            mode: "chat",
            model: "gpt-6-luna",
            reasoningEffort: "medium",
            assistant: "",
            apiKey: "unused",
            max_tokens: 2048,
            n: 1,
            stream: true,
            tools: {
              dataType: "Map",
              value: [
                ["Web Search", { type: "web_search_preview" }],
                [
                  "Image Generation",
                  {
                    type: "image_generation",
                    model: "gpt-image-2.6-sunburst",
                    complexity: "high",
                  },
                ],
                [
                  "Code Interpreter",
                  { type: "code_interpreter", container: { type: "auto" } },
                ],
              ],
            },
            toolsEnabled: { dataType: "Set", value: [] },
            vectorStoreBaseUrl: "https://pgvector.fh-swf.cloud/v1",
            mcpAuthConfigs: { dataType: "Map", value: [] },
            aiHubEnabled: false,
            aiHubApiKey: "",
            aiHubKeyAlias: "KImpuls",
            aiHubModels: [],
            aiHubPreviousApiKey: "",
            aiHubPreviousBaseUrl: "",
            aiHubPreviousModel: "",
          },
        },
      })
    );
  });

  const sessionIsSeeded = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("SESSIONS") || "{}");
    return (
      session?.options?.account?.terms === true &&
      session?.user?.affiliations?.["fh-swf.de"]?.includes("member")
    );
  });
  expect(sessionIsSeeded).toBe(true);

  await context.storageState({ path: authFile });
});
