import { test, expect } from "@playwright/test";

test.describe("Obsidian Export", () => {
    test.beforeEach(async ({ page, context, browserName }) => {
        // Firefox and WebKit do not support granting clipboard permissions
        test.skip(browserName === "firefox" || browserName === "webkit", "Clipboard permissions not supported on Firefox and WebKit");

        if (browserName !== "firefox" && browserName !== "webkit") {
            await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        }
        // Mock user API
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "Test User",
                    email: "test@fh-swf.de",
                    affiliations: { "fh-swf.de": true },
                }),
            });
        });

        const state = {
            current: 0,
            chat: [
                {
                    title: "Obsidian Test Chat",
                    id: 1,
                    ct: Date.now(),
                    thread: "",
                    botStarts: false,
                    messages: [
                        {
                            content: "Hello Obsidian",
                            sentTime: Math.floor(Date.now() / 1000),
                            role: "user",
                            id: 123,
                        },
                    ],
                    app: 0,
                },
            ],
            currentChat: 0,
            currentApp: {
                id: 0,
                title: "Chat",
                desc: "",
                content: "",
                botStarts: false,
                category: 0,
            },
            options: {
                account: { name: "Test", avatar: "", terms: true },
                general: {
                    language: "en",
                    theme: "dark",
                    sendCommand: "Enter",
                    size: "normal",
                    codeEditor: false,
                    gravatar: false,
                },
                openai: {
                    baseUrl: "",
                    apiKey: "",
                    tools: {},
                    toolsEnabled: [],
                    model: "gpt-4",
                },
            },
            is: {},
            typeingMessage: {},
            user: {
                affiliations: {
                    "fh-swf.de": true,
                },
            },
            version: "0.1.0",
        };

        await page.goto("/");
        await page.evaluate((s) => {
            localStorage.setItem("SESSIONS", JSON.stringify(s));
            localStorage.removeItem("CHAT_HISTORY");
        }, state);
        await page.reload();
        await expect(page.getByText("Hello Obsidian")).toBeVisible();
    });



    test("should copy to clipboard and open URI for Obsidian Open", async ({ page }) => {
        // Mock window.open
        await page.addInitScript(() => {
            // @ts-ignore
            Object.defineProperty(globalThis, "open", {
                value: (url) => {
                    // @ts-ignore
                    globalThis.__lastOpenedUrl = url;
                },
                configurable: true,
            });
        });
        await page.reload();

        await page.getByTestId("download-thread-button").click();
        await expect(page.getByTestId("open-obsidian-menu-item")).toBeVisible();
        await page.getByTestId("open-obsidian-menu-item").click();

        // Verify window.open was called with correct URL
        const openedUrl = await page.evaluate(() => {
            // @ts-ignore
            return globalThis.__lastOpenedUrl;
        });
        expect(openedUrl).toMatch(/obsidian:\/\/new\?name=.*%20\d{4}-\d{2}-\d{2}%20\d{2}-\d{2}&clipboard=true/);

        // Verify clipboard content
        const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });
        expect(clipboardText).toContain("## User");
        expect(clipboardText).toContain("Hello Obsidian");
    });


    test("should export images correctly", async ({ page }) => {
        // Mock window.open
        await page.addInitScript(() => {
            // @ts-ignore
            Object.defineProperty(globalThis, "open", {
                value: (url) => {
                    // @ts-ignore
                    globalThis.__lastOpenedUrl = url;
                },
                configurable: true,
            });
        });
        await page.reload();

        // Inject a message with an image into the state
        const state = {
            current: 0,
            chat: [
                {
                    title: "Image Export Test",
                    id: 1,
                    ct: Date.now(),
                    thread: "",
                    botStarts: false,
                    messages: [
                        {
                            content: [
                                { type: "input_text", text: "Look at this:" },
                                {
                                    type: "input_image",
                                    image_url: "http://example.com/image.png",
                                },
                            ],
                            sentTime: Math.floor(Date.now() / 1000),
                            role: "user",
                            id: 999,
                        },
                    ],
                    app: 0,
                },
            ],
            currentChat: 0,
            currentApp: {
                id: 0,
                title: "Chat",
                desc: "",
                content: "",
                botStarts: false,
                category: 0,
            },
            options: {
                account: { name: "Test", avatar: "", terms: true },
                general: {
                    language: "en",
                    theme: "dark",
                    sendCommand: "Enter",
                    size: "normal",
                    codeEditor: false,
                    gravatar: false,
                },
                openai: {
                    baseUrl: "",
                    apiKey: "",
                    tools: {},
                    toolsEnabled: [],
                    model: "gpt-4",
                },
            },
            is: {},
            typeingMessage: {},
            user: {
                affiliations: {
                    "fh-swf.de": true,
                },
            },
            version: "0.1.0",
        };

        await page.evaluate((s) => {
            localStorage.setItem("SESSIONS", JSON.stringify(s));
            localStorage.removeItem("CHAT_HISTORY");
        }, state);
        await page.reload();

        await page.getByTestId("download-thread-button").click();

        await expect(page.getByTestId("open-obsidian-menu-item")).toBeVisible();
        await page.getByTestId("open-obsidian-menu-item").click();

        const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });
        expect(clipboardText).toContain("Look at this:");
        expect(clipboardText).toContain("![Image](http://example.com/image.png)");
    });

    test("should export OPFS images as Data URIs", async ({ page }) => {
        // Mock window.open and OPFS
        await page.addInitScript(() => {
            // @ts-ignore
            Object.defineProperty(globalThis, "open", {
                value: (url) => {
                    // @ts-ignore
                    globalThis.__lastOpenedUrl = url;
                },
                configurable: true,
            });
            // Mock OPFS
            Object.defineProperty(navigator, "storage", {
                value: {
                    getDirectory: async () => ({
                        getFileHandle: async (name) => ({
                            getFile: async () => new File(["fake image content"], name, { type: "image/png" }),
                        }),
                    }),
                },
                configurable: true,
            });
        });
        await page.reload();

        // Inject a message with an OPFS image into the state
        const state = {
            current: 0,
            chat: [
                {
                    title: "OPFS Export Test",
                    id: 1,
                    ct: Date.now(),
                    thread: "",
                    botStarts: false,
                    messages: [
                        {
                            content: [
                                { type: "input_text", text: "Look at this OPFS image:" },
                                {
                                    type: "input_image",
                                    image_url: "opfs://test-image.png",
                                },
                            ],
                            sentTime: Math.floor(Date.now() / 1000),
                            role: "user",
                            id: 999,
                        },
                    ],
                    app: 0,
                },
            ],
            currentChat: 0,
            currentApp: {
                id: 0,
                title: "Chat",
                desc: "",
                content: "",
                botStarts: false,
                category: 0,
            },
            options: {
                account: { name: "Test", avatar: "", terms: true },
                general: {
                    language: "en",
                    theme: "dark",
                    sendCommand: "Enter",
                    size: "normal",
                    codeEditor: false,
                    gravatar: false,
                },
                openai: {
                    baseUrl: "",
                    apiKey: "",
                    tools: {},
                    toolsEnabled: [],
                    model: "gpt-4",
                },
            },
            is: {},
            typeingMessage: {},
            user: {
                affiliations: {
                    "fh-swf.de": true,
                },
            },
            version: "0.1.0",
        };

        await page.evaluate((s) => {
            localStorage.setItem("SESSIONS", JSON.stringify(s));
            localStorage.removeItem("CHAT_HISTORY");
        }, state);
        await page.reload();

        await page.getByTestId("download-thread-button").click();
        await expect(page.getByTestId("open-obsidian-menu-item")).toBeVisible();
        await page.getByTestId("open-obsidian-menu-item").click();

        const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });
        expect(clipboardText).toContain("Look at this OPFS image:");
        expect(clipboardText).toContain("![Image](data:image/png;base64,");
    });

    test("should export generated images (message.images) as Data URIs", async ({ page }) => {
        // Mock window.open and OPFS
        await page.addInitScript(() => {
            // @ts-ignore
            Object.defineProperty(globalThis, "open", {
                value: (url) => {
                    // @ts-ignore
                    globalThis.__lastOpenedUrl = url;
                },
                configurable: true,
            });
            // Mock OPFS
            Object.defineProperty(navigator, "storage", {
                value: {
                    getDirectory: async () => ({
                        getFileHandle: async (name) => ({
                            getFile: async () => new File(["fake generated image content"], name, { type: "image/png" }),
                        }),
                    }),
                },
                configurable: true,
            });
        });
        await page.reload();

        // Inject a message with a generated image into the state
        const state = {
            current: 0,
            chat: [
                {
                    title: "Generated Image Export Test",
                    id: 1,
                    ct: Date.now(),
                    thread: "",
                    botStarts: false,
                    messages: [
                        {
                            role: "assistant",
                            content: "Here is a generated image:",
                            sentTime: Math.floor(Date.now() / 1000),
                            id: 999,
                            images: {
                                "gen-image-1": {
                                    name: "gen-image.png",
                                    type: "png",
                                    src: "blob:http://localhost:3000/fake-blob-url",
                                    size: 1024,
                                    lastModified: Date.now(),
                                    file_id: "gen-image-1"
                                }
                            }
                        },
                    ],
                    app: 0,
                },
            ],
            currentChat: 0,
            currentApp: {
                id: 0,
                title: "Chat",
                desc: "",
                content: "",
                botStarts: false,
                category: 0,
            },
            options: {
                account: { name: "Test", avatar: "", terms: true },
                general: {
                    language: "en",
                    theme: "dark",
                    sendCommand: "Enter",
                    size: "normal",
                    codeEditor: false,
                    gravatar: false,
                },
                openai: {
                    baseUrl: "",
                    apiKey: "",
                    tools: {},
                    toolsEnabled: [],
                    model: "gpt-4",
                },
            },
            is: {},
            typeingMessage: {},
            user: {
                affiliations: {
                    "fh-swf.de": true,
                },
            },
            version: "0.1.0",
        };

        await page.evaluate((s) => {
            localStorage.setItem("SESSIONS", JSON.stringify(s));
            localStorage.removeItem("CHAT_HISTORY");
        }, state);
        await page.reload();

        await page.getByTestId("download-thread-button").click();
        await expect(page.getByTestId("open-obsidian-menu-item")).toBeVisible();
        await page.getByTestId("open-obsidian-menu-item").click();

        const clipboardText = await page.evaluate(async () => {
            return await navigator.clipboard.readText();
        });
        expect(clipboardText).toContain("Here is a generated image:");
        expect(clipboardText).toContain("![Generated Image](data:image/png;base64,");
    });
});

