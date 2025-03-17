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

    return (
        <MenuRoot onOpenChange={(e) => setMenuOpen(e)}>
            <MenuTrigger asChild>
                <IconButton variant="ghost" title={t("more_actions")}><RiChatHistoryLine /></IconButton>
            </MenuTrigger>
            <MenuContent className={styles.chatmenu}>
                <MenuItemGroup title={t("new_chat")}>
                    {
                        apps.map((app, index) => {
                            const cat = category.filter(item => item.id == app.category)[0];
                            return (
                                <MenuItem key={app.id} onClick={() => newChat(app)} value={app.id} aria-keyshortcuts={index}>
                                    <span className={classnames(styles.icon, `ico-${cat.icon}`)}></span> {app.title}
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
                >
                    {chat
                        // sort currentChat to the top
                        .toSorted((a, b) => a.id == chat[currentChat].id ? -1 : b.id == chat[currentChat].id ? 1 : 0)
                        .map((c, index) => {

                            const itemProps = chat[currentChat].id == c.id ? { ref: currentRef, className: styles.current } : {};

                            return (
                                <MenuItem key={c.id}
                                    className={styles.chatitem}
                                    valueText={String(index)}
                                    value={String(c.id)} {...itemProps}
                                    onClick={
                                        () => {
                                            console.log('Select chat: %o', c);
                                            let index = chat.findIndex(item => item.id == c.id);
                                            setState({ currentChat: index });
                                        }
                                    }
                                    as="div">
                                    <Card.Root size="sm" className={styles.chatcard}>
                                        <Card.Header>
                                            <HStack>
                                                {c.title}
                                                <Spacer />
                                                <IconButton variant="ghost" size="xs" focusRing="none" title={t("delete_chat")} onClick={() => deleteChat(c.id)}><MdOutlineDeleteOutline /></IconButton>
                                            </HStack>
                                        </Card.Header>
                                        <Card.Body>
                                            <Card.Description asChild><Text truncate>{c.messages.filter((m) => m.role == "user")[0]?.content}</Text></Card.Description>
                                            <HStack>
                                                <Text textStyle="xs">{new Date(c.ct).toLocaleString()}</Text>
                                                <Spacer />
                                                <Text>{t('count_messages', { count: c.messages?.filter(item => item.role !== "system").length })}</Text>
                                            </HStack>
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