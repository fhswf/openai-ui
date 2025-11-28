import {
  OpenAIOptions,
  Chat,
  Message,
  GlobalActions,
  GlobalState,
} from "../context/types";
import * as MessagesAPI from "openai/resources/beta/threads/messages.mjs";
import * as StepsAPI from "openai/resources/beta/threads/runs/steps.mjs";
import { processLaTeX } from "../utils/latex";
import OpenAI, { APIError } from "openai";

import { t } from "i18next";
import { Stream } from "openai/streaming.mjs";
import {
  ResponseImageGenCallCompletedEvent,
  ResponseImageGenCallPartialImageEvent,
  ResponseIncludable,
  ResponseInput,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";
import { toaster } from "../../components/ui/toaster";

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
  parent
) {
  const { options, chat, currentChat, is, setState, setIs } = global;

  console.log("messages: %o", chat[currentChat].messages);
  console.log("parent: %o", parent);

  const input: ResponseInput = await Promise.all(
    chat[currentChat].messages.map(async (item) => {
      console.log("input item: %o", item);
      const { role, content, ...rest } = item;
      if (content && typeof content === "object" && Array.isArray(content)) {
        const cleaned = await Promise.all(
          content.map(async (item) => {
            if (item.type === "input_image") {
              const { name, ...rest } = item;
              if (rest.image_url?.startsWith("opfs://")) {
                try {
                  const filename = rest.image_url.replace("opfs://", "");
                  const opfs = await navigator.storage.getDirectory();
                  const fileHandle = await opfs.getFileHandle(filename);
                  const file = await fileHandle.getFile();
                  const arrayBuffer = await file.arrayBuffer();
                  const bytes = new Uint8Array(arrayBuffer);
                  let binary = "";
                  for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                  }
                  const base64 = btoa(binary);
                  let mimeType = file.type;
                  if (!mimeType) {
                    if (filename.toLowerCase().endsWith(".png")) mimeType = "image/png";
                    else if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) mimeType = "image/jpeg";
                    else if (filename.toLowerCase().endsWith(".webp")) mimeType = "image/webp";
                    else if (filename.toLowerCase().endsWith(".gif")) mimeType = "image/gif";
                    else mimeType = "image/png"; // Fallback
                  }
                  console.log("Converted OPFS file to base64: %s (%s) (%d bytes)", filename, mimeType, base64.length);
                  rest.image_url = `data:${mimeType};base64,${base64}`;
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
          message.toolsUsed[toolIndex] = event.item;
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
          case "mcp_approval_request":
            console.log("MCP Approval Request: %o", event.item);
            toaster.create({
              title: t("mcp_approval_request"),
              description: t("mcp_approval_request_description"),
              duration: 10000,
              type: "info",
            });
            break;
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
