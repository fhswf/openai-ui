import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

import { Avatar, Card, HStack, Stack, Text, IconButton, Button, Menu, Popover } from '@chakra-ui/react';
import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverTitle } from '../components/ui/popover';

import { useTranslation } from 'react-i18next';
import { IoLogoMarkdown, IoSettingsOutline, IoReloadOutline, IoLogoGithub } from 'react-icons/io5';
import { BiSolidFileJson } from "react-icons/bi";
import { LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { MdOutlineSimCardDownload } from 'react-icons/md';
import { CgOptions } from "react-icons/cg";
import { useGlobal } from './context';
import { useMessage } from './hooks';
import { MessageMenu } from './MessageMenu';
import { modelOptions, toolOptions } from './utils/options'
import { OptionActionType } from './context/types';
import { GitHubMenu } from './GitHubMenu';




export function MessageHeader() {
    const { is, setIs, setOptions, setState, clearThread, newChat, reloadThread, downloadThread, showSettings, options, user, chat, currentChat } = useGlobal();
    const { message } = useMessage();
    const messages = message?.messages;
    const columnIcon = is.toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />;

    const { t } = useTranslation();


    const logout = () => {
        console.log('Logout');
        window.location.href = import.meta.env.VITE_LOGOUT_URL || '/';
    };


    function setWebSearch(e: boolean): void {
        console.log('Set web search: %o', e);
        setOptions({ type: OptionActionType.OPENAI, data: { ...options.openai, tools: { ...options.openai.tools, "web-search": e } } });
    }

    return (
        <HStack as="header"
            spacing={2} padding={2} borderBottomWidth="1px"
            justifyContent="space-between"
            data-testid="ChatHeader">

            <IconButton
                hideFrom="md"
                variant="ghost"
                title={is.toolbar ? t("hide_toolbar") : t("show_toolbar")}
                onClick={() => setIs({ toolbar: !is.toolbar })}>{columnIcon}</IconButton>
            <Stack flexGrow={1} gap="1px" paddingInlineStart={2}>
                <Text data-testid="HeaderTitle" textStyle="lg">{message?.title}</Text>
                <Text textStyle="xs">{t('count_messages', { count: messages?.filter(item => item.role !== "system").length })}</Text>
            </Stack>

            <Menu.Root>
                <Menu.Trigger asChild>
                    <IconButton variant="ghost" accessKey="o" title={t("chat_options")}><CgOptions /></IconButton>
                </Menu.Trigger>
                <Menu.Positioner>
                    <Menu.Content>
                        <Menu.RadioItemGroup
                            value={options.openai?.model}
                            onValueChange={(e) => setOptions({ type: OptionActionType.OPENAI, data: { ...options.openai, model: e.value } })}>
                            <Menu.ItemGroupLabel>{t("model_options")}</Menu.ItemGroupLabel>
                            {
                                modelOptions.map((item) => (
                                    <Menu.RadioItem key={item.value} value={item.value}
                                    >
                                        {item.label}
                                        <Menu.ItemIndicator />
                                    </Menu.RadioItem>
                                ))
                            }
                        </Menu.RadioItemGroup>

                        <Menu.ItemGroup>
                            <Menu.ItemGroupLabel>{t("tool_options")}</Menu.ItemGroupLabel>
                            {
                                toolOptions.map((item) => (
                                    <Menu.CheckboxItem
                                        value={item.value}
                                        key={item.value}
                                        checked={options.openai?.tools && item.value in options.openai.tools}
                                        onCheckedChange={(e) => setOptions({ type: OptionActionType.OPENAI, data: { ...options.openai, tools: { ...options.openai.tools, [item.value]: e } } })}>
                                        {item.label}
                                        <Menu.ItemIndicator />
                                    </Menu.CheckboxItem>
                                ))
                            }
                        </Menu.ItemGroup>
                    </Menu.Content>
                </Menu.Positioner>
            </Menu.Root>

            <MessageMenu />
            {options.openai.mode == "assistant" ? <IconButton variant="ghost" title={t("chat_settings")} onClick={showSettings}><IoSettingsOutline /></IconButton> : null}
            {false && <IconButton variant="ghost" title={t("reload_thread")} onClick={reloadThread}><IoReloadOutline /></IconButton>}
            <MenuRoot>
                <MenuTrigger asChild>
                    <IconButton variant="ghost" title={t("download_thread")}><MdOutlineSimCardDownload /></IconButton>
                </MenuTrigger>
                <MenuContent>
                    <MenuItem value="json" onClick={() => downloadThread("json")} >
                        <BiSolidFileJson /> {t("download_json")}
                    </MenuItem>
                    <MenuItem value="markdown" onClick={() => downloadThread("markdown")} >
                        <IoLogoMarkdown /> {t("download_markdown")}
                    </MenuItem>
                </MenuContent>
            </MenuRoot>
            <GitHubMenu />
            <PopoverRoot>
                <PopoverTrigger data-testid="UserInformationBtn">
                    <Avatar.Root size="sm">
                        <Avatar.Fallback name={user?.name} />
                        <Avatar.Image src={user?.avatar} />
                    </Avatar.Root>
                </PopoverTrigger>
                <PopoverContent data-testid="UserInformation">
                    <PopoverArrow />
                    <PopoverBody>
                        <PopoverTitle fontWeight="bold" paddingBlockEnd={"15px"}>{t('User information')}</PopoverTitle>
                        <Stack spacing={2}>
                            <Text>{user?.name}</Text>
                            <Text>{user?.email}</Text>
                            <Button type="primary" onClick={logout}>Logout</Button>
                        </Stack>
                    </PopoverBody>
                </PopoverContent>
            </PopoverRoot>

        </HStack >
    );


}
