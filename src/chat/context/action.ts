import i18next, { t, use } from "i18next";
import * as StepsAPI from "openai/resources/beta/threads/runs/steps";
import { Chat, GlobalState, OptionAction, GlobalActions, Message, Messages, GlobalAction, GlobalActionType, OptionActionType } from "./types";
import React from "react";
import { getMessages, getRunSteps, initChat, retrieveRun, getImageURL, retrieveAssistant, modifyAssistant, getFileURL, retrieveFile } from "../service/openai_assistant";
import { processLaTeX } from "../utils/latex";
import { useApps } from "../apps/context";
import { createResponse, executeChatRequest } from "../service/openai";
import { executeAssistantRequest } from "../service/openai";



export default function action(state: Partial<GlobalState>, dispatch: React.Dispatch<GlobalAction>): GlobalActions {
  const setState = (payload: Partial<GlobalState> = {}) =>
    dispatch({
      type: GlobalActionType.SET_STATE,
      payload: { ...payload },
    });

  const setIs = (arg) => {
    const { is } = state;
    setState({ is: { ...is, ...arg } });
  }

  const startChat = (chat: Chat[], currentChat: number) =>
    dispatch({
      type: GlobalActionType.START_CHAT,
      payload: { chat, currentChat },
    });

  const sendMessage = () => {
    const { typeingMessage, options, chat, is, currentChat, user } = state;
    if (typeingMessage?.content) {
      let newMessage = null;
      if (typeingMessage.images) {
        const text = typeingMessage.content;
        const images = typeingMessage.images;
        newMessage = { sentTime: Math.floor(Date.now() / 1000), role: "user" };
        newMessage.content = [];
        newMessage.content.push({ type: "input_text", text });
        images.forEach((image) => {
          newMessage.content.push({ type: "input_image", image_url: image });
        });
        console.log("sendMessage: %o", newMessage);
      }
      else {
        newMessage = {
          ...typeingMessage,
          sentTime: Math.floor(Date.now() / 1000),
        };
      }
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
        createResponse({ ...state, chat: newChat, setState, setIs }, this)
          .then(() => {
            setState({ typeingMessage: {} });
          })
      }
    }
  }

  return {
    setState,
    setIs,
    doLogin(): void {
      console.log("doLogin");
      window.location.href = import.meta.env.VITE_LOGIN_URL;
    },
    clearTypeing() {
      console.log("clear");
      setState({ typeingMessage: {} });
    },

    sendMessage,

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

    newChat(app) {
      const { currentApp, is, options, currentChat, chat } = state;
      const newApp = app || currentApp;
      console.log("newChat: ", currentApp, newApp, chat, newApp?.title, newApp?.role)
      let messages: Messages = [
        {
          content: newApp?.content || t("system_welcome"),
          sentTime: Math.floor(Date.now() / 1000),
          role: newApp.role,
          id: Date.now(),
        }
      ]

      const chatList = [
        {
          title: newApp?.title || t("new_conversation"),
          id: Date.now(),
          app: newApp.id,
          messages,
          ct: Date.now(),
          botStart: newApp.botStarts,
        },
        ...chat,
      ];
      let _chat: Chat[] = chatList;
      if (newApp.botStarts) {
        console.log("botStarts");
        executeChatRequest(setState, is, _chat, messages, options, 0, _chat);
      }
      else {
        console.debug("starting chat: %o", _chat);
        startChat(_chat, 0)
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
        state.currentChat === index && index > 0
          ? { chat, currentChat: index - 1 }
          : { chat };
      console.log("removeChat: %o", payload);
      setState(payload);
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

    downloadThread(format = "json") {
      const chat = state.chat[state.currentChat];
      const messages = chat.messages;

      if (format === "markdown") {
        const content = messages
          .map((m) => {
            return `${m.role === "assistant" ? "## Assistant\n" : "## User\n"}${m.content}\n\n`;
          })
          .join("\n");
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat_${chat.id}.md`;
        a.click();
      } else if (format === "json") {
        const content = JSON.stringify(messages, null, 2);
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chat_${chat.id}.json`;
        a.click();
      }
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
                                  content: "\n",
                                  sentTime: step.created_at,
                                  id: m.id,
                                  role: m.role
                                };
                              return m.content.map((c) => {
                                if (c.type === "text") {
                                  let references = "";
                                  c.text.annotations.forEach((a, index) => {
                                    console.log("annotation: %o", a);
                                    if (a.type === "file_citation") {
                                      c.text.value = c.text.value.replace(a.text, ` [${index + 1}]`);
                                      references += `- [\[${index + 1}\]](${getFileURL(a.file_citation.file_id)})\n`;
                                    }
                                  })
                                  return {
                                    content: c.text.value + (references ? `\n\n${references}` : ""),
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
                          c.text.annotations.forEach((a) => {
                            console.log("annotation: %o", a);
                          })
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

    currentList() {
      return state.chat[state.currentChat];
    },

    stopResponse() {
      setState({
        is: { ...state.is, thinking: false },
      });
    },
  };
}


