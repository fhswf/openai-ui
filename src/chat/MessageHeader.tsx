import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Tool, ToolChoiceTypes } from './context/types';

import { Avatar, Card, HStack, Stack, Text, IconButton, Button, Menu, Popover, Dialog, CloseButton, Heading, Portal, Field, Input, Select, Checkbox, Separator, createListCollection } from '@chakra-ui/react';

import { useTranslation } from 'react-i18next';
import { IoLogoMarkdown, IoSettingsOutline, IoReloadOutline, IoLogoGithub } from 'react-icons/io5';
import { BiSolidFileJson } from "react-icons/bi";
import { LuChevronRight, LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { MdDelete, MdEdit, MdOutlineSimCardDownload } from 'react-icons/md';
import { CgOptions } from "react-icons/cg";
import { useGlobal } from './context';
import { useApps } from "./apps/context";
import { useMessage } from './hooks';
import { classnames } from '../components/utils'
import styles from './style/menu.module.less';
import { MessageMenu } from './MessageMenu';
import { modelOptions, toolOptions } from './utils/options'
import { OptionActionType } from './context/types';
import { GitHubMenu } from './GitHubMenu';
import { RiChatNewFill, RiChatNewLine } from 'react-icons/ri';
import { FaChartBar } from "react-icons/fa";
import DashboardChart from './DashboardChart';
import { AiOutlineBarChart } from 'react-icons/ai';

import '../assets/icon/style.css';
import { ErrorBoundary } from 'react-error-boundary';




export function MessageHeader() {
    const { is, setIs, setOptions, newChat, downloadThread, showSettings, options, user, chat, currentChat } = useGlobal();
    const { message } = useMessage();
    const { apps, category } = useApps();
    const messages = message?.messages;
    const columnIcon = is.toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />;

    const { t } = useTranslation();
    const contentRef = useRef<HTMLDivElement>(null)

    const [editMCPServices, setEditMCPServices] = useState(false);

    const [mcpToolForm, setMcpToolForm] = useState({
        label: "",
        server_url: "",
        require_approval: "never",
        allowed_tools: [],
    });

    const approval_options = createListCollection({
        items: [
            { label: t("Always"), value: "always" },
            { label: t("Never"), value: "never" }
        ]
    });

    const logout = () => {
        console.log('Logout');
        window.location.href = import.meta.env.VITE_LOGOUT_URL || '/';
    };

    const editMCP = () => {
        console.log('Edit MCP Services');
        setEditMCPServices(true);
    };

    if (!(typeof options.openai.tools === "object")) {
        options.openai.tools = {};
    }

    function setTool(key: string, tool: Tool, checked: boolean): void {
        console.log('Set tool: %s %o', tool, checked);
        let tools = options.openai.tools;
        if (checked) {
            if (!(key in Object.keys(tools))) {
                tools[key] = tool;
            }
        } else {
            delete tools[key];
        }
        setOptions({
            type: OptionActionType.OPENAI,
            data: { ...options.openai, tools }
        });
    }

    function editTool(key: string, tool: Tool.Mcp): void {
        console.log('Edit tool: %s %o', key, tool);
        setMcpToolForm({
            label: tool.server_label || "",
            server_url: tool.server_url || "",
            require_approval: tool.require_approval as string || "never",
            allowed_tools: tool.allowed_tools as string[] || [],
        });
        setEditMCPServices(true);
    }

    const mcpTools: Record<string, Tool> = {}  // Filter MCP tools from toolOptions

    toolOptions.forEach((value, key) => {
        if (value.type === "mcp")
            mcpTools[key] = value;
    });

    return (
        <HStack as="header"
            padding={1} borderBottomWidth="1px"
            justifyContent="space-between"
            data-testid="ChatHeader">

            <IconButton
                hideFrom="md"
                variant="ghost"
                title={is.toolbar ? t("hide_toolbar") : t("show_toolbar")}
                onClick={() => setIs({ toolbar: !is.toolbar })}>{columnIcon}</IconButton>
            <Stack flexGrow={1} gap="1px" paddingInlineStart={2} className={styles.title}>
                <Heading data-testid="HeaderTitle" textStyle="lg">{message?.title}</Heading>
                <Text textStyle="xs">{t('count_messages', { count: messages?.filter(item => item.role !== "system").length })}</Text>
            </Stack>



            <Menu.Root>
                <Menu.Trigger asChild>
                    <IconButton variant="ghost" accessKey="o" title={t("chat_options")}>
                        <CgOptions aria-label={t("chat_options")} />
                    </IconButton>
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
                                Array.from(toolOptions.entries()).map(([key, value]) => (
                                    <Menu.CheckboxItem
                                        value={value.type}
                                        key={key}
                                        checked={Object.keys(options.openai?.tools).find(k => k === key) !== undefined}
                                        onCheckedChange={(e) => setTool(key, value, e)}>
                                        <Menu.ItemIndicator />
                                        {key}
                                    </Menu.CheckboxItem>
                                ))
                            }

                            <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
                                <Menu.TriggerItem>
                                    {t("MCP Services")} <LuChevronRight />
                                </Menu.TriggerItem>
                                <Portal>
                                    <Menu.Positioner>
                                        <Menu.Content>
                                            {Object.entries(mcpTools).map(([key, tool]) => (
                                                <Menu.CheckboxItem
                                                    key={key}
                                                    value={key}
                                                    checked={Object.keys(options.openai?.tools).find(k => k === key) !== undefined}
                                                    onCheckedChange={(e) => setTool(key, tool, e)}>
                                                    <Menu.ItemIndicator />
                                                    {tool.title || key}
                                                </Menu.CheckboxItem>
                                            ))}

                                            <Menu.Item onClick={editMCP} value="edit_mcp_services">
                                                {t("Add/Remove MCP Services")}
                                            </Menu.Item>
                                        </Menu.Content>
                                    </Menu.Positioner>
                                </Portal>
                            </Menu.Root>
                        </Menu.ItemGroup>
                    </Menu.Content>
                </Menu.Positioner>
            </Menu.Root>


            <Dialog.Root open={editMCPServices} onOpenChange={(e) => setEditMCPServices(e.open)} lazyMount size="cover">
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content ref={contentRef}>

                            <Dialog.Header>
                                <Dialog.Title>
                                    {t("Edit MCP Services")}
                                </Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Stack gap={4}>
                                    <Stack gap={4}>
                                        <Field.Root>
                                            <Field.Label htmlFor="label">{t("Label")}</Field.Label>
                                            <Input
                                                id="label"
                                                name="label"
                                                required
                                                className={styles.input}
                                                value={mcpToolForm.label}
                                                onChange={e => setMcpToolForm(f => ({ ...f, label: e.target.value }))}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label htmlFor="server_url">{t("Server URL")}</Field.Label>
                                            <Input
                                                id="server_url"
                                                name="server_url"
                                                type="url"
                                                required
                                                className={styles.input}
                                                value={mcpToolForm.server_url}
                                                onChange={e => setMcpToolForm(f => ({ ...f, server_url: e.target.value }))}
                                            />
                                        </Field.Root>
                                        <Field.Root>
                                            <Select.Root collection={approval_options} size="sm" width="320px"
                                                value={[mcpToolForm.require_approval]}
                                                onValueChange={(e) => {
                                                    console.log("Selected approval option:", e);
                                                    setMcpToolForm(f => ({ ...f, require_approval: e.value[0] }))
                                                }}>
                                                <Select.HiddenSelect />
                                                <Select.Label>{t("Require Approval")}</Select.Label>
                                                <Select.Control>
                                                    <Select.Trigger>
                                                        <Select.ValueText placeholder="Select" />
                                                    </Select.Trigger>

                                                    <Select.IndicatorGroup>
                                                        <Select.Indicator />
                                                    </Select.IndicatorGroup>
                                                </Select.Control>
                                                <Portal container={contentRef}>
                                                    <Select.Positioner>
                                                        <Select.Content>
                                                            {approval_options.items.map((framework) => (
                                                                <Select.Item item={framework} key={framework.value}>
                                                                    {framework.label}
                                                                    <Select.ItemIndicator />
                                                                </Select.Item>
                                                            ))}
                                                        </Select.Content>
                                                    </Select.Positioner>
                                                </Portal>
                                            </Select.Root>
                                        </Field.Root>
                                        <Field.Root>
                                            <Field.Label htmlFor="allowed_tools">{t("Allowed Tools")}</Field.Label>
                                            <Input
                                                id="allowed_tools"
                                                name="allowed_tools"
                                                placeholder={t("Comma separated")}
                                                className={styles.input}
                                                value={mcpToolForm.allowed_tools}
                                                onChange={e => setMcpToolForm(f => ({ ...f, allowed_tools: e.target.value.split(',').map(item => item.trim()) }))}
                                            />
                                        </Field.Root>
                                    </Stack>
                                    <Button type="submit" colorScheme="blue">{t("Add/Save Service")}</Button>
                                </Stack>


                                <Separator marginBlockStart={4} marginBlockEnd={4} />

                                <Stack padding={2} gap={2} as="form" onSubmit={e => { e.preventDefault(); /* handle submit here */ }}>
                                    <Text fontWeight="bold">{t("MCP Services")}</Text>
                                    <Stack padding={2} gap={2} className={styles.mcpServices}>
                                        {Object.entries(mcpTools).map(([key, tool]) => (
                                            <HStack key={key} justifyContent="space-between" alignItems="center">
                                                <HStack>
                                                    <Checkbox.Root
                                                        size="sm"
                                                        variant={"outline"}
                                                        checked={Object.keys(options.openai?.tools).find(k => k === key) !== undefined}
                                                        onCheckedChange={(e) => setTool(key, tool, e.checked)}>
                                                        <Checkbox.HiddenInput />
                                                        <Checkbox.Control />
                                                    </Checkbox.Root>
                                                    <Text>{tool.title || key}</Text>
                                                </HStack>
                                                <HStack gap={1} alignItems="center">

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            editTool(key, tool)
                                                        }}>
                                                        <MdEdit />
                                                    </Button>
                                                    <Button variant="ghost" size="sm">
                                                        <MdDelete />
                                                    </Button>
                                                </HStack>
                                            </HStack>
                                        ))}
                                    </Stack>


                                </Stack>
                            </Dialog.Body>
                            <Dialog.Footer />
                            <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" />
                            </Dialog.CloseTrigger>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>

            <Menu.Root>
                <Menu.Trigger asChild>
                    <IconButton variant="ghost" accessKey="n" title={t("new_chat")}>
                        <RiChatNewLine aria-label={t("new_chat")} />
                    </IconButton>
                </Menu.Trigger>
                <Menu.Content>
                    <Menu.ItemGroup title={t("new_chat")}>
                        {
                            apps.map((app, index) => {
                                const cat = category.filter(item => item.id == app.category)[0];
                                return (
                                    <Menu.Item key={app.id} onClick={() => newChat(app)} value={app.id} aria-keyshortcuts={index}>
                                        <span className={classnames(styles.icon, `ico-${cat.icon}`)}></span> {app.title}
                                    </Menu.Item>
                                )
                            })
                        }
                    </Menu.ItemGroup>
                </Menu.Content>
            </Menu.Root>

            <MessageMenu />

            {options.openai.mode == "assistant" ? <IconButton variant="ghost" title={t("chat_settings")} onClick={showSettings}><IoSettingsOutline /></IconButton> : null}

            <Menu.Root>
                <Menu.Trigger asChild>
                    <IconButton variant="ghost" title={t("download_thread")}>
                        <MdOutlineSimCardDownload aria-label={t("download_thread")} />
                    </IconButton>
                </Menu.Trigger>
                <Menu.Content>
                    <Menu.Item value="json" onClick={() => downloadThread("json")} >
                        <BiSolidFileJson /> {t("download_json")}
                    </Menu.Item>
                    <Menu.Item value="markdown" onClick={() => downloadThread("markdown")} >
                        <IoLogoMarkdown /> {t("download_markdown")}
                    </Menu.Item>
                </Menu.Content>
            </Menu.Root>
            <GitHubMenu />

            <Dialog.Root lazyMount size="cover">
                <Dialog.Trigger data-testid="UsageInformationBtn" asChild>
                    <IconButton variant="ghost" title={t("usage_information")}>
                        <AiOutlineBarChart aria-label={t("usage_information")} />
                    </IconButton>
                </Dialog.Trigger>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content data-testid="UsageInformation" >
                        <Dialog.Header>
                            <Dialog.Title fontWeight="bold" paddingBlockEnd={"15px"}>{t('usage_information')}</Dialog.Title>
                            <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" />
                            </Dialog.CloseTrigger>
                        </Dialog.Header>
                        <Dialog.Body className={styles.dashboard}>
                            <ErrorBoundary fallbackRender={() => <div>{t("error")}</div>}>
                                <DashboardChart />
                            </ErrorBoundary>
                        </Dialog.Body>

                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>

            <Popover.Root lazyMount>
                <Popover.Trigger data-testid="UserInformationBtn">
                    <Avatar.Root size="sm">
                        <Avatar.Fallback name={user?.name} />
                        <Avatar.Image src={user?.avatar} />
                    </Avatar.Root>
                </Popover.Trigger>
                <Popover.Positioner>
                    <Popover.Content data-testid="UserInformation">
                        <Popover.Arrow />
                        <Popover.Body>
                            <Popover.Title fontWeight="bold" paddingBlockEnd={"15px"}>{t('User information')}</Popover.Title>
                            <Stack gap={2}>
                                <Text>{user?.name}</Text>
                                <Text>{user?.email}</Text>
                                <Button type="primary" onClick={logout}>Logout</Button>
                            </Stack>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Popover.Root>

        </HStack >
    );


}

