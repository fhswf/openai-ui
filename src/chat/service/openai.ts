import {
  Chat,
  Message,
  GlobalActions,
  GlobalState,
} from "../context/types";
import OpenAI, { APIError } from "openai";

import { t } from "i18next";
import { Stream } from "openai/streaming.mjs";
import {
  ResponseIncludable,
  ResponseInput,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";
import { toaster } from "../../components/ui/toaster";
import { showMcpApprovalToast } from "../component/McpToast";

export const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.API_BASE_URL ||
  "https://api.openai.com/v1";

const client = new OpenAI({
  apiKey: "unused",
  dangerouslyAllowBrowser: true,
  baseURL: apiBaseUrl,
  fetch: (input, init: any) => {
    return fetch(input, { credentials: "include", ...init });
  },
});

export async function getResponse(id: string) {
  const response = await client.responses.retrieve(id);
  return response;
}

export async function createResponse(
  global: Partial<GlobalState> & Partial<GlobalActions>,
  parent,
  explicitInput?: ResponseInput
) {
  const { options, chat, currentChat, is, setState, setIs } = global;

  console.log("messages: %o", chat[currentChat].messages);
  console.log("parent: %o", parent);

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
                const { name, ...rest } = item;
                if (rest.image_url?.startsWith("opfs://")) {
                  try {
                    const filename = rest.image_url.replace("opfs://", "");
                    const opfs = await navigator.storage.getDirectory();
                    const fileHandle = await opfs.getFileHandle(filename);
                    const file = await fileHandle.getFile();

                    // Use FileReader to get data URL directly from file
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(reader.result as string);
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });

                    // Extract MIME type and base64 length for logging
                    const mimeType = dataUrl.split(';')[0].split(':')[1];
                    const base64 = dataUrl.split(',')[1];

                    console.log("Converted OPFS file to base64: %s (%s) (%d bytes)", filename, mimeType, base64.length);
                    rest.image_url = dataUrl;
                  } catch (error) {
                    console.error("Error reading OPFS file for OpenAI API:", error);
                    // Fallback or rethrow? For now, let's keep the original URL which will likely fail API validation but logs the error.
                  }
                }
                return { ...rest };
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

  const tools: Tool[] = [];

  options.openai.toolsEnabled.forEach((tool) => {
    tools.push(options.openai.tools.get(tool));
  });
  console.log("createResponse: tools: %o", tools);

  const response_options = {
    model: options.openai.model,
    tools,
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
  if (options.openai.model.startsWith("gpt-5")) {
    response_options["reasoning"] = { effort: "medium", summary: "detailed" };
  }

  client.responses
    .create(response_options)
    .then(async (stream: Stream<ResponseStreamEvent>) => {
      setIs({ ...is, thinking: true });
      console.log("stream: %o", stream);

      const eventProcessor = new EventProcessor(stream, global);
      setState({ eventProcessor });

      const processStream = async () => {
        try {
          for await (const event of stream) {
            eventProcessor.process(event);
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
    eventProcessor.stop();
    setIs({ ...is, thinking: false });
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
        window.location.href = import.meta.env.VITE_LOGIN_URL;
        return;
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
  responseId?: string;
  approvalRequests: Map<string, { item: any; decision?: boolean }> = new Map();
  static opfs: FileSystemDirectoryHandle = null;

  constructor(
    stream: Stream<ResponseStreamEvent>,
    global: Partial<GlobalState> & Partial<GlobalActions>
  ) {
    const { chat, currentChat, setState, setIs } = global;
    this.stream = stream;
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
    const fileContent = atob(image_base64);

    let writable: FileSystemWritableFileStream;
    let fileHandle: FileSystemFileHandle;
    let file: File;

    console.log("appendImageToMessage: %s %o", file_id, message);
    if (!EventProcessor.opfs) {
      await this.initOPFS();
      if (!EventProcessor.opfs) {
        console.error("OPFS not initialized");
        return;
      }
    }

    EventProcessor.opfs
      .getFileHandle(`${file_id}.png`, { create: true })
      .then((_fileHandle) => {
        fileHandle = _fileHandle;
        console.log("File handle created: ", fileHandle);
        return fileHandle.createWritable();
      })
      .then((_writable) => {
        writable = _writable;
        console.log("Writable created: ", writable);
        // Convert the base64 string to a Uint8Array
        const byteCharacters = new Uint8Array(fileContent.length);
        for (let i = 0; i < fileContent.length; i++) {
          byteCharacters[i] = fileContent.charCodeAt(i);
        }
        return writable.write(byteCharacters);
      })
      .then(() => {
        console.log("File written successfully");
        return writable.close();
      })
      .then(() => {
        console.log("Writable closed successfully");
        fileHandle.getFile().then((_file) => {
          file = _file;
          console.log("File retrieved: ", file);
          if (!message.images) {
            message.images = {};
          }
          message.images[file_id] = {
            src: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            file_id,
            type: "png",
          };
          this.updateChat();
        });
      })
      .catch((error) => {
        console.error("Error writing file: ", error);
        toaster.create({
          title: t("error_occurred"),
          description: error.message || "",
          duration: 5000,
          type: "error",
        });
      });
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
    this.stream.controller.abort();
    this.setIs({ thinking: false });
  }

  updatePartialImage(image_base64: string, message: Message, file_id: string) {
    const fileContent = atob(image_base64);
    const byteCharacters = new Uint8Array(fileContent.length);
    for (let i = 0; i < fileContent.length; i++) {
      byteCharacters[i] = fileContent.charCodeAt(i);
    }
    const blob = new Blob([byteCharacters], { type: "image/png" });
    const url = URL.createObjectURL(blob);

    if (!message.images) {
      message.images = {};
    }

    // Revoke previous URL if it exists to avoid memory leaks
    if (message.images[file_id]?.src?.startsWith('blob:')) {
      URL.revokeObjectURL(message.images[file_id].src);
    }

    message.images[file_id] = {
      src: url,
      name: `${file_id}.png`,
      size: blob.size,
      lastModified: Date.now(),
      file_id,
      type: "png",
    };
    this.updateChat();
  }

  async process(event) {
    console.log("event: %s %o", event.type, event);
    let message =
      this.chat[this.currentChat].messages[
      this.chat[this.currentChat].messages.length - 1
      ];

    switch (event.type) {
      case "response.created":
        console.log(event.item);
        message = {
          role: "assistant",
          content: "",
          sentTime: Math.floor(Date.now() / 1000),
          startTime: Date.now(),
          id: event.response.id,
        };
        this.responseId = event.response.id;
        this.approvalRequests.clear();
        this.setState({ typeingMessage: {} });
        this.chat[this.currentChat].messages.push(message);
        this.updateChat();
        break;

      case "response.completed":
        console.log("response.completed: %o", event.response.usage);

        message.usage = event.response.usage;
        message.endTime = Date.now();
        this.updateChat();
        this.setIs({ thinking: false });
        break;

      case "response.output_item.done": {
        console.log(event.item);
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
}
