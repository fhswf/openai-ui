import { createParser } from "eventsource-parser";
import { setAbortController } from "./abortController.mjs";
import { Options, OpenAIOptions, Chat, Message, Messages, GlobalActions, GlobalState } from "../context/types";
import * as MessagesAPI from "openai/resources/beta/threads/messages.mjs";
import * as StepsAPI from "openai/resources/beta/threads/runs/steps.mjs";
import { processLaTeX } from "../utils/latex";
import { initChat, createMessage, createRun, getImageURL } from "./openai_assistant";
import OpenAI, { APIError } from "openai";

import { t } from "i18next";
import { ResponseStream } from "openai/lib/responses/ResponseStream.mjs";
import { Stream } from "openai/streaming.mjs";
import { ResponseImageGenCallCompletedEvent, ResponseImageGenCallPartialImageEvent, ResponseInput, ResponseInputItem, ResponseStreamEvent, Tool } from "openai/resources/responses/responses.mjs";
import { Tooltip } from "@chakra-ui/react";
import React from "react";
import { toaster } from "../../components/ui/toaster";
import { url } from "inspector";

export async function* streamAsyncIterable(stream) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.API_BASE_URL || "https://api.openai.com/v1";


export const fetchBaseUrl = (baseUrl) =>
  baseUrl || "https://api.openai.com/v1/chat/completions";

export const fetchHeaders = (options: Partial<OpenAIOptions>) => {
  const { organizationId, apiKey } = options;
  return {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
    ...(organizationId && { "OpenAI-Organization": organizationId }),
  };
};

export const throwError = async (response) => {
  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
      console.log(errorPayload);
    } catch (e) {
      // ignore
    }
  }
};

export const fetchBody = (options: OpenAIOptions, messages = []) => {
  const { top_p, n, max_tokens, temperature, model, stream } = options;
  return {
    messages,
    stream,
    n: 1,
    ...(model && { model }),
    ...(temperature && { temperature }),
    ...(max_tokens && { max_tokens }),
    ...(top_p && { top_p }),
    ...(n && { n }),
  };
};

export const fetchAction = async (method: string,
  messages = [], options: OpenAIOptions, signal) => {
  const baseUrl = options.baseUrl;
  console.log("fetchAction", options);
  const url = fetchBaseUrl(baseUrl);
  const headers = fetchHeaders(options);
  const body = JSON.stringify(fetchBody(options, messages));
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal,
    credentials: "include"
  });
  return response;
};

export const fetchStream = async (options: OpenAIOptions, messages, onMessage, onEnd, onError, onStar) => {
  let answer = "";
  const { controller, signal } = setAbortController();
  console.log(signal, controller);
  const result = await fetchAction("POST", messages, options, signal)
    .catch((error) => {
      onError && onError(error, controller);
    });
  if (!result) return;
  if (!result.ok) {
    if (result.status === 401) {
      console.log("Unauthorized");
      onError && onError({ code: result.status, message: "Unauthorized" }, controller);
      return;
    }
    const error = await result.json();
    onError && onError(error);
    return;
  }



  const parser = createParser((event) => {
    console.log(event);
    if (event.type === "event") {
      if (event.data === "[DONE]") {
        return;
      }
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if ("content" in data.choices[0].delta) {
        answer += data.choices[0].delta.content;
        console.log(data);
        onMessage && onMessage(answer, controller);
      }
    }
  });
  let hasStarted = false;
  for await (const chunk of streamAsyncIterable(result.body)) {
    const str = new TextDecoder().decode(chunk);
    parser.feed(str);
    if (!hasStarted) {
      hasStarted = true;
      onStar && onStar(str, controller);
    }
  }
  await onEnd();
};

const client = new OpenAI({
  apiKey: "unused",
  dangerouslyAllowBrowser: true,
  baseURL: apiBaseUrl,
  fetch: (input, init: any) => {
    return fetch(input, { credentials: "include", ...init })
  }
});

export async function getResponse(id: string) {
  const response = await client.responses.retrieve(id);
  return response;
}

export async function createResponse(global: Partial<GlobalState> & Partial<GlobalActions>, parent) {

  const { options, chat, currentChat, is, setState, setIs } = global;

  console.log("messages: %o", chat[currentChat].messages);
  console.log("parent: %o", parent);

  const input: ResponseInput = chat[currentChat].messages.map((item) => {
    const { role, content, ...rest } = item;
    return { role, content } as ResponseInputItem;
  });

  const tools: Tool[] = [];

  options.openai.toolsEnabled.forEach((tool) => {
    tools.push(options.openai.tools.get(tool));
  });
  console.log("createResponse: tools: %o", tools);

  client.responses.create({
    model: options.openai.model,
    tools,
    input,
    stream: true,
    include: ['web_search_call.action.sources'],
    //reasoning: { effort: "medium", summary: "detailed" }
  })
    .then((stream: Stream<ResponseStreamEvent>) => {
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
        return
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
  opfs: FileSystemDirectoryHandle;

  constructor(stream: Stream<ResponseStreamEvent>, global: Partial<GlobalState> & Partial<GlobalActions>) {
    const { chat, currentChat, setState, setIs } = global;
    this.stream = stream;
    this.chat = chat;
    this.currentChat = currentChat;
    this.setState = setState;
    this.setIs = setIs;

    navigator.storage.getDirectory()
      .then((dir) => {
        console.log("Directory: %o", dir);
        this.opfs = dir;
      })
      .catch((error) => {
        console.warn("Origin Private File System not supported: ", error);
        toaster.create({
          title: t("opfs_not_supported"),
          description: t("opfs_not_supported_description"),
          duration: 5000,
          type: "warning",
        });
        this.opfs = null;
      });
    console.log("EventProcessor initialized: %o", this);
  }

  appendMessage(delta) {
    let message = this.chat[this.currentChat].messages[this.chat[this.currentChat].messages.length - 1];
    message.content += delta;
    this.updateChat();
  }

  appendImageToMessage(image_base64: string, message: Message, file_id: string) {
    const fileContent = atob(image_base64);

    let writable: FileSystemWritableFileStream;
    let fileHandle: FileSystemFileHandle;
    let file: File;

    console.log("appendImageToMessage: %s %o", file_id, message);
    if (!this.opfs) {
      console.warn("OPFS not available, cannot append image to message");
      toaster.create({
        title: t("opfs_not_supported"),
        description: t("opfs_not_supported_description"),
        duration: 5000,
        type: "warning",
      });
      return;
    }

    this.opfs.getFileHandle(`${file_id}.png`, { create: true })
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
        fileHandle.getFile()
          .then((_file) => {
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
    let newChat = [...this.chat];
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

  process(event) {
    console.log("event: %s %o", event.type, event);
    let message = this.chat[this.currentChat].messages[this.chat[this.currentChat].messages.length - 1];;

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

      case "response.output_item.done":
        console.log(event.item);
        let toolIndex = message.toolsUsed?.findIndex((tool) => tool.id === event.item.id);
        if (toolIndex >= 0) {
          message.toolsUsed[toolIndex] = event.item;
        }
        if (event.item.output_format === "png") {
          // event.item.result is a base64-encoded PNG string, decode it
          const base64Data = event.item.result;
          this.appendImageToMessage(base64Data, message, event.item.id);
        }
        this.updateChat();
        break;

      case "response.output_item.added":
        switch (event.item.type) {
          case "mcp_call":
          case "web_search_call":
          case "image_generation_call":
          case "code_interpreter_call":
            if (!message.toolsUsed) {
              message.toolsUsed = [];
            }
            message.toolsUsed.push(event.item);
            this.updateChat();
        }
        break;

      case "response.content_part.added":
        console.log(event.part);
        break;

      case "response.output_text.delta":
        //console.log(event.delta);
        this.appendMessage(event.delta);
        break;

      case "response.image_generation_call.partial_image":
        console.log(event.call);
        const image_base64 = event.partial_image_b64;
        if (image_base64) {
          this.appendImageToMessage(image_base64, message, event.item_id);
        }
        this.setIs({ tool: "image_generation", thinking: true });
        break;

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
        })
    }
  }


}

export async function executeAssistantRequest(setState, is, newChat: Chat[], messages: Messages, options: Options, currentChat: number, chat: Chat[], user) {

  let currentMessage: Message = null;
  let currentSnippet = "";
  let snippets = [];

  setState({
    is: { ...is, thinking: true },
    typeingMessage: {},
    chat: newChat,
  });
  console.log("executeAssistantRequest, chat: %o, currentChat: %d ", newChat, currentChat);
  let _chat = newChat[currentChat];
  const controller = new AbortController();
  console.log("executeAssistantRequest, chat: ", _chat, messages);

  if (!_chat.thread) {
    console.log("initChat: ", user);
    try {
      _chat = await initChat(_chat, user?.sub);
    } catch (error) {
      console.log(error);
    }
  }
  console.log("executeAssistantRequest, chat: ", _chat);

  _chat.messages?.map(async (message) => {
    console.log("message: ", message);
    if (!message.thread_id) {
      let _message = await createMessage(_chat, message);
      console.log("message: ", _message);
      message.thread_id = _message.thread_id;
    }
    return message;
  });

  const newSnippet = () => {
    snippets.push(currentSnippet);
    currentSnippet = "";
  };

  const newMessage = (message: MessagesAPI.Message | StepsAPI.RunStep) => {
    console.log("new message: %o", message);
    let role = "assistant";
    if (role in message) {
      role = (<MessagesAPI.Message>(message)).role;
    }
    currentMessage = {
      content: "",
      role,
      sentTime: message.created_at,
      id: message.id,
    };
    postMessage("");
  };

  const postMessage = (content: string) => {
    console.log("post message: %o %s", currentMessage, content);
    currentSnippet = processLaTeX(content);
    currentMessage.content = snippets.join("\n") + currentSnippet;
    newChat.splice(currentChat, 1, {
      ...chat[currentChat],
      messages: [
        ...messages,
        currentMessage,
      ],
    });
    setState({
      is: { ...is, thinking: content.length },
      chat: newChat,
    });
  };

  const stream = createRun(_chat.thread, options.openai.assistant);
  stream
    .on('messageCreated', (message) => newMessage(message))
    .on('runStepCreated', (runStep) => {
      if (!currentMessage) {
        newMessage(runStep);
      }
    })
    .on('textCreated', (text) => {
      newSnippet();
      postMessage(text.value);
    })
    .on('textDelta', (textDelta, snapshot) => postMessage(snapshot.value))
    .on('toolCallCreated', (toolCall) => {
      console.log(`\nassistant > ${toolCall.type}\n\n`);
      newSnippet();
    })
    .on('toolCallDelta', (toolCallDelta, snapshot) => {
      if (toolCallDelta.type === 'code_interpreter') {
        if (toolCallDelta.code_interpreter.input) {
          console.log(toolCallDelta.code_interpreter.input);
          postMessage("```Python\n" + toolCallDelta.code_interpreter.input + "\n```");
        }
        if (toolCallDelta.code_interpreter.outputs) {
          console.log("\noutput >\n");
          toolCallDelta.code_interpreter.outputs.forEach(output => {
            if (output.type === "logs") {
              console.log(`\n${output.logs}\n`);
              postMessage("```Python\n" + output.logs + "\n```");
            }
          });
        }
      }
    })
    .on('imageFileDone', (imageFile) => {
      console.log(`\nassistant > image file: ${imageFile.file_id}\n\n`);
      newSnippet();
      postMessage(`![Image](${getImageURL(_chat.thread, "", imageFile.file_id)})`);
    })
    .on('end', () => {
      console.log('done');
      setState({
        is: { ...is, thinking: false },
      });
    });
}

export async function executeChatRequest(setState, is, newChat, messages: Messages, options: Options, currentChat, chat) {
  setState({
    is: { ...is, thinking: true },
    typeingMessage: {},
    chat: newChat,
    currentChat
  });
  const controller = new AbortController();
  try {
    console.log("executeChatRequest, options: ", options.openai);
    const res = await fetchStream(options.openai,
      messages.map((item) => {
        const { sentTime, id, ...rest } = item;
        return { ...rest };
      }),
      (content) => {
        newChat.splice(currentChat, 1, {
          ...chat[currentChat],
          messages: [
            ...messages,
            {
              content,
              role: "assistant",
              sentTime: Math.floor(Date.now() / 1000),
              id: Date.now(),
            },
          ],
        });
        setState({
          is: { ...is, thinking: content.length },
          chat: newChat,
        });
        document.getElementById("chat_list").scrollTo({
          top: document.getElementById("chat_list").scrollHeight,
          behavior: "smooth"
        });
      },
      () => {
        setState({
          is: { ...is, thinking: false },
        });
      },
      (res) => {
        console.log(res);
        const error = res || {};
        if (error) {
          if (error.message === "Unauthorized") {
            console.log("Unauthorized");
            window.location.href = import.meta.env.VITE_LOGIN_URL;
          }
          else {
            newChat.splice(currentChat, 1, {
              ...chat[currentChat],
              messages,
              error,
            });
          }


          setState({
            chat: newChat,
            is: { ...is, thinking: false },
          });
        }
      },
      () => { });
    console.log(res);
  } catch (error) {
    console.log(error);
  }
}

