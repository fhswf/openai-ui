import { fetchStream } from "../service/index";
import i18next, { t, use } from "i18next";
import * as MessagesAPI from "openai/resources/beta/threads/messages/messages";
import * as StepsAPI from "openai/resources/beta/threads/runs/steps";
import { Chat, GlobalState, Options, OptionAction, GlobalActions, Message, Messages, GlobalAction, GlobalActionType, OptionActionType } from "./types";
import React from "react";
import { createMessage, createRun, getMessages, getRunSteps, initChat, retrieveRun, getImageURL, retrieveAssistant, modifyAssistant } from "../service/assistant";
import { processLaTeX } from "../utils/latex";

import OpenAI from "openai";


export default function action(state: Partial<GlobalState>, dispatch: React.Dispatch<GlobalAction>): GlobalActions {
  const setState = (payload: Partial<GlobalState> = {}) =>
    dispatch({
      type: GlobalActionType.SET_STATE,
      payload: { ...payload },
    });
  return {
    setState,
    doLogin(): void {
      console.log("doLogin");
      window.location.href = import.meta.env.VITE_LOGIN_URL;
    },
    clearTypeing() {
      console.log("clear");
      setState({ typeingMessage: {} });
    },
    sendMessage(): void {
      const { typeingMessage, options, chat, is, currentChat, user } = state;
      if (typeingMessage?.content) {
        const newMessage = {
          ...typeingMessage,
          sentTime: Math.floor(Date.now() / 1000),
        };
        let messages: Messages = [];
        console.log("sendMessage", chat);
        if (chat[currentChat]?.messages) {
          messages = [...chat[currentChat].messages];
        }
        messages.push(newMessage);
        let newChat = [...chat];
        newChat.splice(currentChat, 1, { ...chat[currentChat], messages });
        if (options.openai.mode === "assistant") {
          executeAssistantRequest(setState, is, newChat, messages, options, currentChat, chat, user);
        }
        else {
          executeChatRequest(setState, is, newChat, messages, options, currentChat, chat);
        }
      }
    },

    setApp(app) {
      console.log("setApp", app);
      setState({ currentApp: app });
    },

    showSettings() {
      const { mode, assistant } = state.options.openai;
      const chat = state.chat[state.currentChat];
      if (mode !== "assistant") {
        console.log("no settings for %s", mode);
        return
      }
      console.log("showSettings: %s", assistant);

      setState({
        is: {
          ...state.is,
          config: true,
        },
        currentEditor: {
          assistant,
          type: "assistant",
        }
      });
    },

    async newChat(app) {
      const { currentApp, is, options, currentChat, chat } = state;
      const newApp = app || currentApp;
      let messages: Messages = [{ content: newApp?.content || t("system_welcome"), sentTime: Math.floor(Date.now() / 1000), role: "system", id: 1, }]
      console.log("newChat: ", newApp, chat)
      const chatList = [
        {
          title: newApp?.title || t("new_conversation"),
          id: Date.now(),
          messages,
          ct: Date.now(),
          //icon: [2, "files"],
        },
        ...chat,
      ];
      let _chat: Chat[] = chatList;
      setState({ chat: _chat, currentChat: 0 });
      console.log("newChat: ", _chat)
      if (newApp.botStarts) {
        console.log("botStarts");
        await executeChatRequest(setState, is, _chat, messages, options, 0, chat);
      }
    },

    modifyChat(arg, index) {
      const chat = [...state.chat];
      chat.splice(index, 1, { ...chat[index], ...arg });
      setState({ chat, currentEditor: null });
    },

    editChat(index, title) {
      const chat = [...state.chat];
      const _chat = { ...chat[index], title };
      chat.splice(index, 1, _chat);
      setState({
        chat,
      });
    },
    removeChat(index) {
      const chat = [...state.chat];
      chat.splice(index, 1);
      const payload =
        state.currentChat === index
          ? { chat, currentChat: index - 1 }
          : { chat };
      setState({
        ...payload,
      });
    },

    setMessage(content) {
      const typeingMessage =
        content === ""
          ? {}
          : {
            role: "user",
            content,
            id: Date.now(),
          };
      setState({ is: { ...state.is, typeing: true }, typeingMessage });
    },

    clearThread() {
      const chat = [...state.chat];
      const user = state.user;
      initChat(chat[state.currentChat], user.sub)
        .then((_chat) => {
          chat[state.currentChat] = _chat;
          chat[state.currentChat].messages = [];
          setState({
            chat,
          });
        })
    },

    reloadThread() {
      const thread = state.chat[state.currentChat].thread;
      console.log("reloadThread: %s", thread);
      if (thread) {
        let updatedMsgs = [];
        getMessages(thread)
          .then((_messages) => {
            return Promise.all(
              _messages
                .toSorted((a, b) => a.created_at - b.created_at)
                .map((m) => {
                  console.log("reloadThread: %o", m);
                  if (m.run_id) {
                    return getRunSteps(thread, m.run_id)
                      .then((steps) => {
                        return steps
                          .map((step) => {
                            console.log("reloadThread: %o %o", step, m);
                            if (step.type === "message_creation") {
                              const details = <StepsAPI.MessageCreationStepDetails>(step.step_details)
                              console.log("message_creation: %o", details.message_creation.message_id);
                              if (details.message_creation.message_id != m.id)
                                return {
                                  content: "",
                                  sentTime: step.created_at,
                                  id: m.id,
                                  role: m.role
                                };
                              return m.content.map((c) => {
                                if (c.type === "text") {
                                  return {
                                    content: c.text.value,
                                    role: m.role,
                                    sentTime: step.created_at,
                                    id: m.id
                                  }
                                }
                                else if (c.type === "image_file") {
                                  console.log("image_file: %o", c);
                                  return {
                                    content: `![Image](${getImageURL(thread, m.id, c.image_file.file_id)})`,
                                    sentTime: step.created_at,
                                    id: m.id,
                                    role: m.role
                                  };
                                }
                              })
                            }
                            else if (step.type === "tool_calls") {
                              const details = <StepsAPI.ToolCallsStepDetails>(step.step_details)
                              return details.tool_calls.map((tc) => {
                                if (tc.type === "code_interpreter")
                                  return {
                                    content: "\n\n```Python\n" + tc.code_interpreter.input + "\n```\n\n",
                                    sentTime: step.created_at,
                                    id: m.id,
                                    role: m.role
                                  }
                                else if (tc.type === "file_search") {
                                  return {
                                    content: "",
                                    sentTime: step.created_at,
                                    id: m.id,
                                    role: m.role
                                  }
                                }
                              })
                            }
                          })
                          .flat(1)
                          .sort((a, b) => a.sentTime - b.sentTime)
                          .reduce((acc, val) => {
                            return { ...acc, ...val, content: acc.content + val.content }
                          })
                      })
                  }
                  else {
                    return m.content
                      .map((c) => {
                        let value = "";
                        if (c.type === 'text') {
                          value = c.text.value
                        }
                        const message: Message = {
                          content: value,
                          role: m.role,
                          sentTime: m.created_at,
                          id: m.id
                        }
                        return message;
                      })
                      .reduce((acc, val) => {
                        return { ...acc, ...val, content: acc.content + val.content }
                      })
                  };
                }))
          })
          .then((_msgs) => {
            console.log("updated messages: %o", _msgs);
            _msgs = _msgs.map((m) => {
              return {
                ...m,
                content: processLaTeX(m.content)
              }
            })
            const chat = [...state.chat];
            chat[state.currentChat].messages = _msgs;
            setState({
              chat,
            });
          })

          .catch((error) => {
            console.log(error);
            if (error.status === 401) {
              window.location.href = import.meta.env.VITE_LOGIN_URL;
            }
          })
      }
    },

    removeMessage(id) {
      console.log("removeMessage", id);
      const messages = state.chat[state.currentChat].messages.filter((m) => m.id !== id);
      const chat = [...state.chat];
      chat[state.currentChat].messages = messages;
      setState({
        chat,
      });
    },

    editMessage(id) {
      console.log("editMessage", id);
      const message = state.chat[state.currentChat].messages.find((m) => m.id == id);
      console.log("editMessage: original", message);
      const newMessage = { ...message, id: Date.now() };
      console.log("editMessage: new", newMessage);
      setState({
        typeingMessage: newMessage,
      })
    },

    setOptions({ type, data }: OptionAction) {
      console.log('set options: ', type, data);
      let options = { ...state.options };
      if (type === OptionActionType.OPENAI) {
        options[type] = { ...options[type], ...data };
      }
      else if (type === OptionActionType.GENERAL) {
        options[type] = { ...options[type], ...data };
        if (data.language) {
          i18next.changeLanguage(data.language);
        }
      }
      else if (type === OptionActionType.ACCOUNT) {
        options[type] = { ...options[type], ...data };
      }
      console.log('set options: ', options);
      setState({ options });
    },

    setIs(arg) {
      const { is } = state;
      setState({ is: { ...is, ...arg } });
    },

    currentList() {
      return state.chat[state.currentChat];
    },

    stopResonse() {
      setState({
        is: { ...state.is, thinking: false },
      });
    },
  };
}

async function executeAssistantRequest(setState, is, newChat: Chat[], messages: Messages, options: Options, currentChat: number, chat: Chat[], user) {

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
  }

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
    postMessage("")
  }

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
  }

  const stream = createRun(_chat.thread, options.openai.assistant);
  stream
    .on('messageCreated', (message) => newMessage(message))
    .on('runStepCreated', (runStep) => {
      if (!currentMessage) {
        newMessage(runStep)
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


async function executeChatRequest(setState, is, newChat, messages: Messages, options: Options, currentChat, chat) {
  setState({
    is: { ...is, thinking: true },
    typeingMessage: {},
    chat: newChat,
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

