import { useCallback, useEffect, useRef, useState } from "react";
import {
    MenuContent,
    MenuItem,
    MenuItemCommand,
    MenuItemGroup,
    MenuRadioItem,
    MenuRadioItemGroup,
    MenuRoot,
    MenuSeparator,
    MenuTrigger,
} from "../components/ui/menu"
import { useGlobal } from "./context";
import { useApps } from "./apps/context";
import React from "react";
import { Card, HStack, IconButton, Kbd, Spacer, Text } from "@chakra-ui/react";
import { classnames } from '../components/utils'
import styles from './style/menu.module.less';
import { useTranslation } from "react-i18next";
import { IoChatboxOutline } from "react-icons/io5";
import { MdOutlineDeleteOutline } from "react-icons/md";
import { RiChatHistoryLine } from "react-icons/ri";

export function MessageMenu() {
    const { is, setIs, setState, clearThread, newChat, removeChat, reloadThread, downloadThread, showSettings, options, user, chat, currentChat } = useGlobal();
    const { apps } = useApps();
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

    return (
        <MenuRoot
            onOpenChange={(e) => setMenuOpen(e)}
            onHighlightChange={(e) => console.log('Highlight: %o', e)}>
            <MenuTrigger>
                <IconButton variant="ghost" title={t("more_actions")}><RiChatHistoryLine /></IconButton>
            </MenuTrigger>
            <MenuContent className={styles.chatmenu}>
                <MenuItemGroup title={t("new_chat")}>
                    {
                        apps.map((app, index) => {
                            return (
                                <MenuItem key={app.id} onClick={() => newChat(app)} value={app.id} aria-keyshortcuts={index}>
                                    {app.title}
                                </MenuItem>
                            )
                        })
                    }
                </MenuItemGroup>
                <MenuSeparator />
                <MenuItemGroup
                    title={t("chats")}
                    className={styles.chatlist}
                    value={chat[currentChat].id}
                    onValueChange={(e) => {
                        let index = chat.findIndex(item => item.id == e.value);
                        setState({ currentChat: index });
                    }}>
                    {chat
                        // sort currentChat to the top
                        .toSorted((a, b) => a.id == chat[currentChat].id ? -1 : b.id == chat[currentChat].id ? 1 : 0)
                        .map((c, index) => {
                            console.log('Chat: %o', c);
                            if (chat[currentChat].id == c.id) {
                                console.log('Current chat: %o', c);
                            }
                            const itemProps = chat[currentChat].id == c.id ? { ref: currentRef, className: styles.current } : {};

                            return (
                                <MenuItem key={c.id}
                                    className={styles.chatitem}
                                    valueText={index}
                                    value={c.id} {...itemProps}
                                    onClick={
                                        () => {
                                            console.log('Select chat: %o', c);
                                            let index = chat.findIndex(item => item.id == c.id);
                                            setState({ currentChat: index });
                                        }
                                    }
                                    aria-keyshortcuts={index}>
                                    <Card.Root size="sm" className={styles.chatcard}>
                                        <Card.Header>
                                            <HStack>
                                                {new Date(c.ct).toLocaleString()}
                                                <Spacer />
                                                <IconButton variant="ghost" size="xs" focusRing="none" title={t("delete_chat")} onClick={() => deleteChat(c.id)}><MdOutlineDeleteOutline /></IconButton>
                                            </HStack>
                                        </Card.Header>
                                        <Card.Body>
                                            <Card.Title>{c.title}</Card.Title>
                                            <Text textStyle="xs">{t('count_messages', { count: c.messages?.filter(item => item.role !== "system").length })}</Text>
                                        </Card.Body>
                                    </Card.Root>
                                </MenuItem>
                            )
                        })}
                </MenuItemGroup>
            </MenuContent>
        </MenuRoot>
    );
}