import { useState, useEffect } from "react";
import { useGlobal } from "../context";
import { Message } from "../context/types";


export function useMessage() {
  type Messages = {
    messages: Message[];
  };

  const { currentChat, chat, is } = useGlobal();
  const [message, setMessage] = useState<Messages>({ messages: [] });
  useEffect(() => {
    if (chat.length) {
      setMessage(chat[currentChat]);
    }
  }, [chat, is.thinking, currentChat]);
  return { message };
}
