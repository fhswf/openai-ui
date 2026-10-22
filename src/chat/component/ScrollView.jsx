import React, { useCallback, useEffect, useRef } from "react";
import { classnames } from "../../components/utils";
import { useGlobal } from "../context";
import styles from "./style.module.less";

// Distance from the bottom (in px) within which the view still counts as
// "pinned" to the newest message.
const PIN_THRESHOLD = 60;

export const ScrollView = (props) => {
  const { children, className, ...rest } = props;
  const scrollRef = useRef(null);
  const pinnedRef = useRef(true);
  const chatIndexRef = useRef(null);
  const messageCountRef = useRef(0);
  const { is, chat, currentChat } = useGlobal();

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Keep the newest message in view. Switching chats or appending a message
  // always scrolls down; in-place growth from a streaming answer only follows
  // while the user stays at the bottom, so reading history is not interrupted.
  useEffect(() => {
    const count = chat?.[currentChat]?.messages?.length ?? 0;
    const switchedChat = chatIndexRef.current !== currentChat;
    const appendedMessage = !switchedChat && count > messageCountRef.current;

    chatIndexRef.current = currentChat;
    messageCountRef.current = count;

    if (switchedChat || appendedMessage || pinnedRef.current) {
      pinnedRef.current = true;
      scrollToBottom();
    }
  }, [is.thinking, chat, currentChat, scrollToBottom]);

  return (
    <div
      ref={scrollRef}
      className={classnames(styles.scroll, className)}
      {...rest}
    >
      {" "}
      {children}
    </div>
  );
};
