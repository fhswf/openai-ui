import {
  Chat,
  Message,
  GlobalActions,
  GlobalState,
  Options,
  OptionActionType,
} from "../context/types";
import OpenAI, { APIError } from "openai";

import { t } from "i18next";
import { Stream } from "openai/streaming.mjs";
import {
  ResponseFunctionToolCall,
  ResponseIncludable,
  ResponseInput,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";
import { toaster } from "../../components/ui/toaster";
import { showMcpApprovalToast } from "../component/McpToast";
import { beginLoginRedirect } from "../utils/loginRetry";
import {
  getAttachmentStorageId,
  readOpfsFileAsDataUrl,
} from "../utils/attachments";
import { supportsReasoningEffort } from "../utils/options";
import {
  createClientFileSearchTool,
  uniqueClientFileSearchToolName,
  searchDocuments,
  splitFileSearchTools,
} from "../utils/fileSearch";
import * as Sentry from "@sentry/react";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.API_BASE_URL ||
  "https://api.openai.com/v1";

const legacyProxyBaseUrl = "https://openai.ki.fh-swf.de/api";

function decodeBase64Image(image_base64: string) {
  return Uint8Array.from(atob(image_base64), (character) =>
    character.charCodeAt(0)
  );
}

function setMessageImage(message: Message, fileId: string, image: any) {
  const images = Object.entries(message.images ?? {});
  images.push([fileId, image]);
  // fromEntries defines keys as own properties, including special names such
  // as "__proto__", instead of invoking inherited setters.
  message.images = Object.fromEntries(images);
}

function normalizeApiBaseUrl(baseUrl?: string) {
  if (!baseUrl || baseUrl === legacyProxyBaseUrl) {
    baseUrl = apiBaseUrl;
  }

  if (baseUrl.startsWith("/")) {
    return new URL(baseUrl, window.location.origin).toString();
  }

  return baseUrl;
}

export function createClient(options?: Options, baseURL?: string) {
  return new OpenAI({
    apiKey: options?.openai.apiKey ?? "unused",
    dangerouslyAllowBrowser: true,
    baseURL: baseURL || normalizeApiBaseUrl(options?.openai.baseUrl),
    organization: options?.openai.organizationId || undefined,
    fetch: (input, init: any) => {
      return fetch(input, { credentials: "include", ...init });
    },
  });
}

export async function getResponse(id: string, options?: Options) {
  const client = createClient(options);
  const response = await client.responses.retrieve(id);
  return response;
}

export async function createResponse(
  global: Partial<GlobalState> & Partial<GlobalActions>,
  parent,
  explicitInput?: ResponseInput
) {
  const { options, chat, currentChat, setState, setIs, setOptions } = global;
  const client = createClient(options);

  console.log("messages: %o", chat[currentChat].messages);
  console.log("parent: %o", parent);
  const activeChatId = String(chat[currentChat].id);

  let input: ResponseInput;
  if (explicitInput) {
    input = explicitInput;
  } else {
    input = await Promise.all(
      chat[currentChat].messages.map(async (item) => {
        console.log("input item: %o", item);
        const { role, content, ...rest } = item;

        // Check if content acts as a container for special items (like mcp_approval_response)
        if (Array.isArray(content) && content.length === 1 && (content[0] as any).type === 'mcp_approval_response') {
          return content[0] as any;
        }

        if (content && typeof content === "object" && Array.isArray(content)) {
          const cleaned = await Promise.all(
            (content as any[]).map(async (item) => {
              if (item.type === "input_image") {
                const {
                  name,
                  attachmentId,
                  mimeType: _mimeType,
                  size: _size,
                  ...rest
                } = item;
                if (rest.image_url?.startsWith("opfs://")) {
                  try {
                    const filename = rest.image_url.replace("opfs://", "");
                    const storageId = await getAttachmentStorageId(
                      attachmentId,
                      filename
                    );
                    const dataUrl = await readOpfsFileAsDataUrl(
                      filename,
                      activeChatId,
                      storageId
                    );

                    // Extract MIME type and base64 length for logging
                    const mimeType = dataUrl.split(';')[0].split(':')[1];
                    const base64 = dataUrl.split(',')[1];

                    console.log("Converted OPFS file to base64: %s (%s) (%d bytes)", filename, mimeType, base64.length);
                    rest.image_url = dataUrl;
                  } catch (error) {
                    console.error("Error reading OPFS file for OpenAI API:", error);
                    throw error;
                  }
                }
                return { ...rest };
              }
              if (item.type === "input_file" && !item.file_data && !item.file_id) {
                // PDFs are stored in OPFS and sent inline as base64 `input_file`
                // `file_data` per request instead of via the files API.
                const {
                  attachmentId: _attachmentId,
                  opfsName: _opfsName,
                  mimeType: _mimeType,
                  size: _size,
                  ...apiItem
                } = item;
                try {
                  const filename = item.filename;
                  const storageId = await getAttachmentStorageId(
                    item.attachmentId,
                    item.opfsName || filename
                  );
                  const fileData = await readOpfsFileAsDataUrl(
                    item.opfsName || filename,
                    activeChatId,
                    storageId
                  );
                  console.log(
                    "Converted OPFS file to base64 input_file: %s (%d bytes)",
                    filename,
                    fileData.length
                  );
                  return { ...apiItem, file_data: fileData };
                } catch (error) {
                  console.error("Error reading OPFS file for OpenAI API:", error);
                  throw error;
                }
              }
              return item;
            })
          );
          return { role, content: cleaned } as ResponseInputItem;
        }
        return { role, content } as ResponseInputItem;
      })
    );
  }

  const enabledTools: Tool[] = [];

  options.openai.toolsEnabled.forEach((tool) => {
    enabledTools.push(options.openai.tools.get(tool));
  });
  const { tools, vectorStoreIds } = splitFileSearchTools(enabledTools);
  const fileSearchToolName =
    vectorStoreIds.length > 0
      ? uniqueClientFileSearchToolName(tools)
      : undefined;
  if (fileSearchToolName) {
    tools.push(createClientFileSearchTool(fileSearchToolName));
  }
  console.log("createResponse: tools: %o", tools);

  const response_options: any = {
    model: options.openai.model,
    tools,
    tool_choice: "auto",
    input,
    stream: true,
    include: [
      "web_search_call.action.sources",
      "code_interpreter_call.outputs",
    ] as ResponseIncludable[],
  };
  /*
   * Filter input to only include new items if we are chaining.
   * Currently we don't track "new" items robustly, but for approval flow:
   * If input contains mcp_approval_response, it should be the only input if we are chaining.
   */
  if (parent) {
    if (typeof parent === 'string') {
      (response_options as any).previous_response_id = parent;
    } else if (parent && parent.id) {
      (response_options as any).previous_response_id = parent.id;
    }

    // If we found approval responses, send ONLY them.
    // const approvalItems = input.filter((item: any) => item.type === 'mcp_approval_response');
    // if (approvalItems.length > 0) {
    //  response_options.input = approvalItems;
    // }
    // TODO: Handle general case of new messages + parent.
  }
  if (supportsReasoningEffort(options.openai.model)) {
    response_options.reasoning = {
      effort: options.openai.reasoningEffort,
      summary: "detailed",
    };
  }

  client.responses
    .create(response_options)
    .then(async (stream: Stream<ResponseStreamEvent>) => {
      setIs({ thinking: true });
      console.log("stream: %o", stream);

      const eventProcessor = new EventProcessor(
        stream,
        global,
        client,
        response_options,
        fileSearchToolName,
        vectorStoreIds
      );
      setState({ eventProcessor });

      const processStream = async () => {
        try {
          for await (const event of stream) {
            await eventProcessor.process(event);
          }
          console.log("Stream ended");
        } catch (error) {
          handleStreamError(error, eventProcessor);
        }
      };

      processStream();
    })
    .catch((error) => {
      handleError(error);
    });

  function handleStreamError(error, eventProcessor) {
    console.log("Stream error: %o", error);
    Sentry.captureException(error);
    eventProcessor.stop();
    setIs({ thinking: false, tool: null });
    setState({ eventProcessor: null });
    toaster.create({
      title: t("error_occurred"),
      description: error.message || "",
      duration: 5000,
      type: "error",
    });
  }

  function handleError(error) {
    console.log("Error: %o %s", error, typeof error);
    Sentry.captureException(error);
    if (error && error instanceof APIError) {
      const apiError = error as APIError;
      console.log("APIError: %o %o", apiError, apiError?.status);
      if (apiError.status === 401) {
        console.log("Unauthorized");
        toaster.create({
          title: t("login_required"),
          description: t("login_required_description"),
          duration: 2000,
          type: "info",
        });
        window.location.assign(beginLoginRedirect({ retry: true }));
        return;
      }

      // Check for "Unknown parameter: 'model'" error when using incompatible endpoint
      if (apiError.status === 400 &&
          error.message?.includes("Unknown parameter") &&
          error.message?.includes("'model'")) {
        // Check if using a Chat Completions endpoint with Responses API
        const baseUrl = options?.openai.baseUrl ?? "";
        const isChatCompletionsEndpoint = baseUrl.includes("/chat/completions");
        const isLegacyProxy = baseUrl.includes("openai.ki.fh-swf.de/api");

        if (isChatCompletionsEndpoint || isLegacyProxy) {
          toaster.create({
            title: t("ai_hub_not_supported_title") || t("error_occurred"),
            description: t("ai_hub_responses_api_not_supported") ||
              "The Responses API requires a compatible endpoint. Please check your Base URL setting or reset to the default OpenAI API endpoint.",
            duration: 10000,
            type: "error",
            action: {
              label: t("reset_to_default") || "Reset to Default",
              onClick: () => {
                if (setOptions) {
                  setOptions({
                    type: OptionActionType.OPENAI,
                    data: {
                      baseUrl: apiBaseUrl,
                    },
                  });
                }
              },
            },
          });
          return;
        }
      }
    }

    toaster.create({
      title: t("error_occurred"),
      description: error.message || "",
      duration: 5000,
      type: "error",
    });
  }
}

class EventProcessor {
  chat: Chat[];
  currentChat: number;
  setState: (payload: Partial<GlobalState>) => void;
  setIs: (arg: any) => void;
  mainRef: any;
  stream: Stream<ResponseStreamEvent>;
  global: Partial<GlobalState> & Partial<GlobalActions>;
  client: OpenAI;
  responseOptions: any;
  fileSearchToolName?: string;
  vectorStoreIds: string[];
  responseId?: string;
  approvalRequests: Map<string, { item: any; decision?: boolean }> = new Map();
  pendingFileSearchCalls: ResponseFunctionToolCall[] = [];
  currentMessage?: Message;
  stopped = false;
  static opfs: FileSystemDirectoryHandle = null;

  constructor(
    stream: Stream<ResponseStreamEvent>,
    global: Partial<GlobalState> & Partial<GlobalActions>,
    client: OpenAI,
    responseOptions: any,
    fileSearchToolName?: string,
    vectorStoreIds: string[] = []
  ) {
    const { chat, currentChat, setState, setIs } = global;
    this.stream = stream;
    this.client = client;
    this.responseOptions = responseOptions;
    this.fileSearchToolName = fileSearchToolName;
    this.vectorStoreIds = vectorStoreIds;
    this.chat = chat;
    this.currentChat = currentChat;
    this.setState = setState;
    this.setIs = setIs;
    this.global = global;
  }

  async initOPFS() {
    console.log("Initializing EventProcessor OPFS");
    if (!EventProcessor.opfs) {
      await navigator.storage
        .getDirectory()
        .then((dir) => {
          console.log("Directory: %o", dir);
          EventProcessor.opfs = dir;
        })
        .catch((error) => {
          console.warn("Origin Private File System not supported: ", error);
          toaster.create({
            title: t("opfs_not_supported"),
            description: t("opfs_not_supported_description"),
            duration: 5000,
            type: "warning",
          });
          EventProcessor.opfs = null;
        });
      console.log("EventProcessor initialized: %o", this);
    }
  }

  appendMessage(delta) {
    const message =
      this.chat[this.currentChat].messages[
      this.chat[this.currentChat].messages.length - 1
      ];
    message.content += delta;
    this.updateChat();
  }

  async appendImageToMessage(
    image_base64: string,
    message: Message,
    file_id: string
  ) {
    const bytes = decodeBase64Image(image_base64);
    const preview = new Blob([bytes], { type: "image/png" });
    const previewUrl = URL.createObjectURL(preview);

    console.log("appendImageToMessage: %s %o", file_id, message);
    setMessageImage(message, file_id, {
      src: previewUrl,
      name: `${file_id}.png`,
      size: preview.size,
      lastModified: Date.now(),
      file_id,
      id: file_id,
      type: "png",
    });
    this.updateChat();

    if (!EventProcessor.opfs) {
      await this.initOPFS();
      if (!EventProcessor.opfs) {
        console.error("OPFS not initialized");
        return;
      }
    }

    try {
      const fileHandle = await EventProcessor.opfs.getFileHandle(
        `${file_id}.png`,
        { create: true }
      );
      const writable = await fileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();

      const file = await fileHandle.getFile();
      setMessageImage(message, file_id, {
        src: previewUrl,
        url: `opfs://${file.name}`,
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
        file_id,
        id: file_id,
        type: "png",
      });
      this.updateChat();
    } catch (error) {
      console.error("Error writing file: ", error);
      Sentry.captureException(error);
      toaster.create({
        title: t("error_occurred"),
        description: error.message || "",
        duration: 5000,
        type: "error",
      });
    }
  }

  updateChat() {
    const newChat = [...this.chat];
    console.log("updateChat: %o", newChat);
    this.setState({
      chat: newChat,
    });
  }

  stop() {
    console.log("stop");
    this.stopped = true;
    this.stream.controller.abort();
    this.setIs({ thinking: false, tool: null });
  }

  updatePartialImage(image_base64: string, message: Message, file_id: string) {
    const bytes = decodeBase64Image(image_base64);
    const blob = new Blob([bytes], { type: "image/png" });
    const url = URL.createObjectURL(blob);

    // Revoke previous URL if it exists to avoid memory leaks
    const previousImage = Object.entries(message.images ?? {}).find(
      ([imageId]) => imageId === file_id
    )?.[1];
    if (previousImage?.src?.startsWith("blob:")) {
      URL.revokeObjectURL(previousImage.src);
    }

    setMessageImage(message, file_id, {
      src: url,
      url: `opfs://${file_id}.png`,
      name: `${file_id}.png`,
      size: blob.size,
      lastModified: Date.now(),
      file_id,
      id: file_id,
      type: "png",
    });
    this.updateChat();
  }

  async process(event) {
    console.log("event: %s %o", event.type, event);
    let message = this.currentMessage ?? this.chat[this.currentChat].messages[
      this.chat[this.currentChat].messages.length - 1
    ];

    switch (event.type) {
      case "response.created":
        console.log(event.item);
        this.responseId = event.response.id;
        if (!this.currentMessage) {
          message = {
            role: "assistant",
            content: "",
            sentTime: Math.floor(Date.now() / 1000),
            startTime: Date.now(),
            id: event.response.id,
          };
          this.currentMessage = message;
          this.chat[this.currentChat].messages.push(message);
        }
        this.approvalRequests.clear();
        this.setState({ typeingMessage: {} });
        this.updateChat();
        break;

      case "response.completed": {
        console.log("response.completed: %o", event.response.usage);
        this.responseId = event.response.id;
        if (this.pendingFileSearchCalls.length > 0) {
          await this.runFileSearchCalls();
          break;
        }

        message.usage = event.response.usage;
        message.endTime = Date.now();
        this.updateChat();
        this.setIs({ thinking: false, tool: null });
        break;
      }

      case "response.output_item.done": {
        console.log(event.item);
        if (
          event.item.type === "function_call" &&
          event.item.name === this.fileSearchToolName
        ) {
          this.pendingFileSearchCalls.push(event.item);
          break;
        }
        const toolIndex = message.toolsUsed?.findIndex(
          (tool) => tool.id === event.item.id
        );
        if (toolIndex >= 0) {
          message.toolsUsed[toolIndex] = { ...message.toolsUsed[toolIndex], ...event.item };
        }
        if (event.item.output_format === "png") {
          // event.item.result is a base64-encoded PNG string, decode it
          const base64Data = event.item.result;
          await this.appendImageToMessage(base64Data, message, event.item.id);
          // Clear the base64 data from the item to avoid storing it in the state
          event.item.result = "";
        }

        // Detect unauthorized MCP call responses from the server
        if (
          event.item.type === "mcp_call" &&
          typeof event.item.output === "string" &&
          event.item.output.toLowerCase().includes("unauthorized")
        ) {
          toaster.create({
            title: t("mcp_unauthorized_error"),
            description: event.item.output,
            duration: 8000,
            type: "error",
          });
        }

        this.updateChat();
        break;
      }

      case "response.output_item.added":
        switch (event.item.type) {
          case "mcp_call":
          case "mcp_list_tools":
          case "reasoning":
          case "custom_tool_call":
          case "function_call":
          case "web_search_call":
          case "image_generation_call":
          case "code_interpreter_call":
            if (
              event.item.type === "function_call" &&
              event.item.name === this.fileSearchToolName
            ) {
              break;
            }
            if (!message.toolsUsed) {
              message.toolsUsed = [];
            }
            // We push the item here, but for image generation, we might want to be careful about what's inside.
            // The 'result' field comes in 'output_item.done', so 'added' is usually safe.
            message.toolsUsed.push(event.item);
            this.updateChat();
            break;
          case "mcp_approval_request": {
            console.log("MCP Approval Request: %o", event.item);
            if (!message.toolsUsed) {
              message.toolsUsed = [];
            }
            message.toolsUsed.push(event.item);
            this.updateChat();

            this.approvalRequests.set(event.item.id, { item: event.item });
            const handleApproval = (approve: boolean) => {
              const req = this.approvalRequests.get(event.item.id);
              if (req) {
                req.decision = approve;
              }
              // Update the item in the message toolsUsed list with the decision
              // We must search for it because 'event.item' might be stale if 'done' event replaced it.
              const chatMessages = this.chat[this.currentChat].messages;
              // We can search backwards as it's likely recent
              for (let i = chatMessages.length - 1; i >= 0; i--) {
                const msg = chatMessages[i];
                if (msg.toolsUsed) {
                  const tool = msg.toolsUsed.find(t => t.id === event.item.id);
                  if (tool) {
                    (tool as any).approval_decision = approve;
                    break;
                  }
                }
              }
              this.updateChat();

              const responseItem = {
                type: 'mcp_approval_response',
                approval_request_id: event.item.id,
                approve: approve,
              };

              const approvalMessage: Message = {
                role: 'user',
                sentTime: Math.floor(Date.now() / 1000),
                startTime: Date.now(),
                id: Date.now(), // temporary ID
                content: [responseItem] as any
              };

              this.chat[this.currentChat].messages.push(approvalMessage);
              this.updateChat();

              // Check if all requests are decided
              const allDecided = Array.from(this.approvalRequests.values()).every(
                (r) => r.decision !== undefined
              );

              if (allDecided) {
                const approvalResponses = Array.from(this.approvalRequests.values()).map(r => ({
                  type: 'mcp_approval_response',
                  approval_request_id: r.item.id,
                  approve: r.decision
                }));
                // Trigger response generation
                createResponse(
                  this.global,
                  this.responseId,
                  approvalResponses as any
                );
              }
            };

            showMcpApprovalToast(
              event.item,
              () => { // Approve
                handleApproval(true);
              },
              () => { // Deny
                handleApproval(false);
              }
            );
            break;
          }
        }
        break;

      case "response.content_part.added":
        console.log(event.part);
        break;

      case "response.output_text.delta":
        //console.log(event.delta);
        this.appendMessage(event.delta);
        break;

      case "response.image_generation_call.partial_image": {
        console.log(event.call);
        const image_base64 = event.partial_image_b64;
        if (image_base64) {
          this.updatePartialImage(image_base64, message, event.item_id);
        }
        this.setIs({ tool: "image_generation", thinking: true });
        break;
      }

      case "response.image_generation_call.completed": {
        console.log(event.call);
        const image_base64 = event.image_b64;
        if (image_base64) {
          this.appendImageToMessage(image_base64, message, event.item_id);
          // Clear the base64 data to avoid storing it in the state if event is stored somewhere
          event.image_b64 = "";
        }
        this.setIs({ tool: null, thinking: true });
        break;
      }

      case "response.web_search_call.in_progress":
        console.log(event.call);
        this.setIs({ tool: "web_search", thinking: true });
        break;

      case "response.web_search_call.completed":
        console.log(event.call);
        this.setIs({ tool: null, thinking: true });
        break;

      case "error":
        console.log(event.error);
        this.setIs({ tool: null, thinking: false });
        this.stop();
        toaster.create({
          title: t("error_occurred"),
          description: event.error.message || "",
          duration: 5000,
          type: "error",
        });
    }
  }

  async runFileSearchCalls() {
    const calls = this.pendingFileSearchCalls;
    this.pendingFileSearchCalls = [];
    const message = this.currentMessage;
    const options = this.global.options;
    if (!message || !options || !this.fileSearchToolName) return;

    this.setIs({ thinking: true, tool: "file_search" });
    const results = await Promise.all(
      calls.map(async (call) => {
        let query = "";
        try {
          const args = JSON.parse(call.arguments || "{}");
          if (typeof args.query !== "string" || !args.query.trim()) {
            throw new Error("The search query must be a non-empty string.");
          }
          query = args.query.trim();
        } catch (error) {
          const messageText =
            error instanceof Error ? error.message : String(error);
          return {
            output: JSON.stringify({ error: messageText }),
            toolCall: {
              id: `fs_local_${call.call_id}`,
              type: "file_search_call",
              status: "failed",
              queries: [query],
              results: [],
            } as any,
          };
        }

        const retrieval = await searchDocuments(
          options,
          this.vectorStoreIds,
          query,
          call.call_id
        );
        if (retrieval.failedStoreIds.length > 0) {
          toaster.create({
            title: t("file_search_failed"),
            description: t("file_search_failed_description"),
            duration: 5000,
            type: "warning",
          });
        }
        return { output: retrieval.output, toolCall: retrieval.toolCall };
      })
    );

    message.toolsUsed = [
      ...(message.toolsUsed ?? []),
      ...results.map((result) => result.toolCall),
    ];
    this.updateChat();
    if (this.stopped) return;
    this.setIs({ thinking: true, tool: null });

    const outputs = calls.map((call, index) => ({
      type: "function_call_output" as const,
      call_id: call.call_id,
      output: results[index].output,
    }));
    const continuationOptions = {
      ...this.responseOptions,
      input: outputs,
      previous_response_id: this.responseId,
      tool_choice: "auto",
    };
    const stream = await this.client.responses.create(continuationOptions);
    if (this.stopped) {
      stream.controller.abort();
      return;
    }
    this.stream = stream;
    for await (const event of stream) {
      await this.process(event);
    }
  }
}
