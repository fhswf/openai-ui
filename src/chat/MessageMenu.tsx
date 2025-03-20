import { useCallback, useEffect, useRef, useState } from "react";

import { useGlobal } from "./context";
import { useApps } from "./apps/context";
import React from "react";
import { Card, HStack, IconButton, Kbd, Dialog, SimpleGrid, Spacer, Text, Heading, Button } from "@chakra-ui/react";
import { classnames } from '../components/utils'
import styles from './style/menu.module.less';
import { useTranslation } from "react-i18next";
import { IoChatboxOutline, IoCloseOutline } from "react-icons/io5";
import { IoIosClose } from "react-icons/io";
import { MdOutlineDeleteOutline } from "react-icons/md";
import { RiChatHistoryLine, RiChatNewLine } from "react-icons/ri";
import { Message } from "./context/types";
import { Toaster, toaster } from "../components/ui/toaster";

export function MessageMenu() {
    const { is, setIs, setState, clearThread, newChat, removeChat, reloadThread, downloadThread, showSettings, options, user, chat, currentApp, currentChat } = useGlobal();
    const { apps, category } = useApps();
    const { t } = useTranslation();

    const [menuOpen, setMenuOpen] = useState(false);

    const currentRef = useCallback((node) => {
        console.log('Current ref: %o', node);
        if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "center" });
            console.log('Scrolling to current ref');
        }
    }, [menuOpen]);

    const deleteChat = (id) => {
        const index = chat.findIndex(item => item.id == id);
        removeChat(index);
    };

    function getTitle(messages: Message[]): React.ReactNode | Iterable<React.ReactNode> {
        const content = messages[0]?.content;
        if (typeof content === 'string') {
            return content;
        }
        else if (Array.isArray(content)) {
            let array = content as any[];
            return array.find((item: { type: string; text: string }) => item.type == "input_text")?.text || t("empty_chat");
        }
        else return t("empty_chat");
    }

    function getImage(messages: Message[]): React.ReactNode | Iterable<React.ReactNode> {
        const content = messages[0]?.content;
        if (typeof content === 'string') {
            return null;
        }
        else if (Array.isArray(content)) {
            let array = content as any[];
            let url = array.find((item: { type: string; text: string }) => item.type == "input_image")?.image_url;
            if (url) {
                return <img src={url} alt="image" className={styles.image} />;
            }
        }
    }

    return (
        <Dialog.Root open={menuOpen} size="full" >
            <Dialog.Trigger asChild>
                <IconButton variant="ghost" title={t("chat_history")}
                    onClick={() => setMenuOpen(true)}
                >
                    <RiChatHistoryLine />
                </IconButton>
            </Dialog.Trigger>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content className={styles.dialog}>
                    <Dialog.CloseTrigger asChild>
                        <IconButton variant="ghost" title={t("close")}
                            onClick={() => setMenuOpen(false)}>
                            <IoCloseOutline />
                        </IconButton>
                    </Dialog.CloseTrigger>
                    <Dialog.Header>
                        <Dialog.Title>
                            {t("chat_history")}
                        </Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Body className={styles.dialog_body}>
                        <SimpleGrid minChildWidth="sm" gap={"2em"} className={styles.grid}>
                            {chat
                                // sort currentChat to the top
                                //.toSorted((a, b) => a.id == chat[currentChat].id ? -1 : b.id == chat[currentChat].id ? 1 : 0)
                                .map((c, index) => {

                                    const itemProps = chat[currentChat].id == c.id ? { ref: currentRef, className: styles.current } : {};


                                    return (
                                        <Card.Root size="sm" key={c.id}
                                            className={styles.card} {...itemProps}
                                            onClick={(e) => {
                                                console.log('Clicking on chat %o', c.id);
                                                setState({ currentChat: index });
                                            }}>
                                            <Card.Header>
                                                <HStack width={"100%"} justifyContent="space-between" alignItems="baseline">
                                                    <Heading>
                                                        {c.title}
                                                    </Heading>
                                                    <Spacer />
                                                    <Text textStyle="xs">{new Date(c.ct).toLocaleString()}</Text>
                                                </HStack>
                                            </Card.Header>
                                            <Card.Body>
                                                <Card.Description className={styles.description} asChild>
                                                    <Text>{getTitle(c.messages.filter((m) => m.role == "user"))}</Text>
                                                </Card.Description>
                                                {getImage(c.messages.filter((m) => m.role == "user"))}
                                            </Card.Body>
                                            <Card.Footer>
                                                <HStack width={"100%"} justifyContent="space-between" alignItems="center">
                                                    <IconButton variant="ghost" size="xs" focusRing="none" title={t("delete_chat")} onClick={() => deleteChat(c.id)}><MdOutlineDeleteOutline /></IconButton>
                                                    <Spacer />
                                                    <Text>{t('count_messages', { count: c.messages?.filter(item => item.role !== "system").length })}</Text>
                                                </HStack>
                                            </Card.Footer>
                                        </Card.Root>
                                    )
                                })}
                        </SimpleGrid>
                    </Dialog.Body>
                    <Dialog.Footer>
                        <HStack width={"100%"} justifyContent="space-between" alignItems="center">
                            <Button
                                size="xs"
                                focusRing="none"
                                title={t("new_chat")}
                                variant="outline"
                                onClick={() => {
                                    newChat(currentApp)
                                }}
                            ><RiChatNewLine />{t("new_chat")}</Button>
                            <Spacer />
                            <Button type="primary"
                                onClick={() => setMenuOpen(false)}>
                                {t("close")}
                            </Button>
                        </HStack>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root >
    );
}