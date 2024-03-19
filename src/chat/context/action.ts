import { fetchStream } from "../service/index";
import i18next, { t, use } from "i18next";
import { useApps } from "../apps/context";
import { AccountOptions, GeneralOptions, GlobalState, OpenAIOptions, Options, OptionAction } from ".";

export type GlobalAction = {
  setState: (payload: Partial<GlobalState>) => void;
  clearTypeing: () => void;
  sendMessage: () => void;
  setApp: (app: any) => void;
  newChat: (app: any) => void;
  modifyChat: (arg: any, index: number) => void;
  editChat: (index: number, title: string) => void;
  removeChat: (index: number) => void;
  setMessage: (content: string) => void;
  clearMessage: () => void;
  removeMessage: (id: number) => void;
  setOptions: (arg: OptionAction) => void;
  setIs: (arg: any) => void;
  currentList: () => any;
  stopResonse: () => void;
};

export default function action(state, dispatch): GlobalAction {
  const setState = (payload = {}) =>
    dispatch({
      type: "SET_STATE",
      payload: { ...payload },
    });
  return {
    setState,
    clearTypeing() {
      console.log("clear");
      setState({ typeingMessage: {} });
    },
    async sendMessage() {
      const { typeingMessage, options, chat, is, currentChat } = state;
      if (typeingMessage?.content) {
        const newMessage = {
          ...typeingMessage,
          sentTime: Date.now(),
        };
        const messages = [...chat[currentChat].messages, newMessage];
        let newChat = [...chat];
        newChat.splice(currentChat, 1, { ...chat[currentChat], messages });
        await executeChatRequest(setState, is, newChat, messages, options, currentChat, chat);
      }
    },

    setApp(app) {
      console.log("setApp", app);
      setState({ currentApp: app });
    },

    async newChat(app) {
      const { _currentApp, is, options, currentChat, chat } = state;
      const currentApp = app || _currentApp;
      let messages = [{ content: currentApp?.content || t("system_welcome"), sentTime: Date.now(), role: "system", id: 1, }]
      console.log("newChat: ", currentApp, chat)
      const chatList = [
        {
          title: currentApp?.title || t("new_conversation"),
          id: Date.now(),
          messages,
          ct: Date.now(),
          icon: [2, "files"],
        },
        ...chat,
      ];
      let _chat = chatList;
      setState({ chat: _chat, currentChat: 0 });
      console.log("newChat: ", _chat)
      if (currentApp.botStarts) {
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
      chat.splice(index, 1, [...chat[index], title]);
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

    clearMessage() {
      const chat = [...state.chat];
      chat[state.currentChat].messages = [];
      setState({
        chat,
      });
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

    setOptions({ type, data }: OptionAction) {
      console.log('set options: ', type, data);
      let options = { ...state.options };
      options[type] = { ...options[type], ...data };
      if (type === "general") {
        if (data.language) {
          i18next.changeLanguage(data.language);
        }
      }
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

async function executeChatRequest(setState, is, newChat, messages, options, currentChat, chat) {
  setState({
    is: { ...is, thinking: true },
    typeingMessage: {},
    chat: newChat,
  });
  const controller = new AbortController();
  try {
    const res = await fetchStream({
      messages: messages.map((item) => {
        const { sentTime, id, ...rest } = item;
        return { ...rest };
      }),
      options: options.openai,
      //TODO: clarify if this is indeed no longer needed
      // signal: controller.signal,
      onMessage(content) {
        newChat.splice(currentChat, 1, {
          ...chat[currentChat],
          messages: [
            ...messages,
            {
              content,
              role: "assistant",
              sentTime: Date.now(),
              id: Date.now(),
            },
          ],
        });
        setState({
          is: { ...is, thinking: content.length },
          chat: newChat,
        });
      },
      onStar() { },
      onEnd() {
        setState({
          is: { ...is, thinking: false },
        });
      },
      onError(res) {
        console.log(res);
        const error = res || {};
        if (error) {
          if (error.message === "Unauthorized") {
            console.log("Unauthorized");
            if (!import.meta.env.DEV)
              window.location.href = import.meta.env.VITE_LOGIN_URL;
          }

          newChat.splice(currentChat, 1, {
            ...chat[currentChat],
            messages,
            error,
          });


          setState({
            chat: newChat,
            is: { ...is, thinking: false },
          });
        }
      },
    });
    console.log(res);
  } catch (error) {
    console.log(error);
  }
}

