import { test, expect } from "../baseFixtures";

test.describe("ToolUsagePopup Coverage", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "Coverage User",
                    email: "coverage@test.com",
                    affiliations: { "fh-swf.de": ["member"] },
                }),
            });
        });
        await page.route("**/gravatar.com/**", (route) => route.fulfill({ status: 200 }));
        await page.goto("/");
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) await termsBtn.click();
    });

    test("should exercise tool usage popup variations", async ({ page }) => {
        // We'll inject a message with various tool types to test `getToolInfo` cases
        await page.route("**/v1/responses", async (route) => {
            const streamBody = [
                `data: {"type":"response.created","response":{"id":"resp_tool","status":"in_progress"},"item":null}\n\n`,

                // function_call
                `data: {"type":"response.output_item.added","item":{"type":"function_call","id":"fc_1","name":"get_weather","arguments":"{\\"city\\":\\"Berlin\\"}"}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"function_call","id":"fc_1","name":"get_weather","output":"{\\"temp\\":15,\\"condition\\":\\"sunny\\"}"}}\n\n`,

                // mcp_call (same logic as function_call)
                `data: {"type":"response.output_item.added","item":{"type":"mcp_call","id":"mcp_1","name":"github_search","arguments":"{\\"query\\":\\"react\\"}"}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"mcp_call","id":"mcp_1","name":"github_search","output":"{\\"results\\":[]}"}}\n\n`,

                // mcp_list_tools
                `data: {"type":"response.output_item.added","item":{"type":"mcp_list_tools","id":"mcp_list_1","server_label":"GitHub MCP","tools":[{"id":"1","name":"search","description":"Search GitHub"}]}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"mcp_list_tools","id":"mcp_list_1","server_label":"GitHub MCP","tools":[{"id":"1","name":"search","description":"Search GitHub"}]}}\n\n`,

                // reasoning
                `data: {"type":"response.output_item.added","item":{"type":"reasoning","id":"rs_1","summary":[{"text":"**Thinking Process** First I need to..."},{"text":"Next, I will..."}]}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"reasoning","id":"rs_1","summary":[{"text":"**Thinking Process** First I need to..."},{"text":"Next, I will..."}]}}\n\n`,

                // reasoning without title format
                `data: {"type":"response.output_item.added","item":{"type":"reasoning","id":"rs_2","summary":[{"text":"Just thinking about things..."}]}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"reasoning","id":"rs_2","summary":[{"text":"Just thinking about things..."}]}}\n\n`,

                // web_search_call
                `data: {"type":"response.output_item.added","item":{"type":"web_search_call","id":"ws_1","action":{"query":"Playwright coverage","sources":[{"url":"https://playwright.dev"}]}}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"web_search_call","id":"ws_1","action":{"query":"Playwright coverage","sources":[{"url":"https://playwright.dev"}]}}}\n\n`,

                // code_interpreter_call
                `data: {"type":"response.output_item.added","item":{"type":"code_interpreter_call","id":"code_1","code":"print('Hello')","outputs":[{"type":"console","text":"Hello"}]}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"code_interpreter_call","id":"code_1","code":"print('Hello')","outputs":[{"type":"console","text":"Hello"}]}}\n\n`,

                // mcp_approval_request
                `data: {"type":"response.output_item.added","item":{"type":"mcp_approval_request","id":"approval_1","server_label":"SafeMCP","name":"delete_file","params":{"file":"test.txt"},"message":"Please approve this action","approval_decision":true}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"mcp_approval_request","id":"approval_1","server_label":"SafeMCP","name":"delete_file","params":{"file":"test.txt"},"message":"Please approve this action","approval_decision":true}}\n\n`,

                // image_generation_call
                `data: {"type":"response.output_item.added","item":{"type":"image_generation_call","id":"img_1","arguments":{"prompt":"A sunset over the ocean"}}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"image_generation_call","id":"img_1","arguments":{"prompt":"A sunset over the ocean"}}}\n\n`,

                // default/unknown tool
                `data: {"type":"response.output_item.added","item":{"type":"unknown_tool","id":"unk_1","title":"Unknown Tool Action"}}\n\n`,
                `data: {"type":"response.output_item.done","item":{"type":"unknown_tool","id":"unk_1","title":"Unknown Tool Action"}}\n\n`,

                `data: {"type":"response.output_text.delta","delta":"Here is the information."}\n\n`,
                `data: {"type":"response.completed","response":{"id":"resp_tool","status":"completed"}}\n\n`,
            ].join("");

            await route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: streamBody,
            });
        });

        await page.getByTestId("ChatTextArea").fill("Run all tools");
        await page.getByTestId("SendMessageBtn").click();
        await page.waitForTimeout(2000);

        // Click on the tool names to open popups
        const toolIndicators = ["get_weather", "github_search", "GitHub MCP", "Thinking Process", "Playwright coverage", "mcp_approval_request_title", "A sunset over the ocean"];

        for (const toolName of toolIndicators) {
            const toolElement = page.getByText(toolName).first();
            if (await toolElement.isVisible({ timeout: 1000 })) {
                await toolElement.click();
                await page.waitForTimeout(500);

                // Wait for dialog to open and look for something inside
                const dialogContent = page.getByTestId("tool-usage-popup-content");
                if (await dialogContent.isVisible({ timeout: 1000 })) {
                    // Look through accordion items
                    const triggers = dialogContent.locator('[data-testid^="tool-trigger-"]');
                    const triggerCount = await triggers.count();
                    for (let i = 0; i < triggerCount; i++) {
                        await triggers.nth(i).click();
                        await page.waitForTimeout(200);
                    }

                    // Close via escape
                    await page.keyboard.press("Escape");
                    await page.waitForTimeout(300);
                }
            }
        }
    });
});
