import React, { useRef, useState, useCallback, useEffect } from "react";

import { Tool, OptionActionType, McpAuthConfig } from "./context/types";

import {
  Avatar,
  HStack,
  Stack,
  Text,
  IconButton,
  Button,
  Menu,
  Popover,
  Dialog,
  CloseButton,
  Heading,
  Portal,
  Field,
  Input,
  Select,
  Checkbox,
  Separator,
  createListCollection,
  Badge,
} from "@chakra-ui/react";

import { useTranslation } from "react-i18next";
import { IoLogoMarkdown, IoSettingsOutline } from "react-icons/io5";
import { BiSolidFileJson } from "react-icons/bi";
import {
  LuChevronRight,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from "react-icons/lu";
import { MdDelete, MdEdit, MdOutlineSimCardDownload } from "react-icons/md";
import { CgOptions } from "react-icons/cg";
import { useGlobal } from "./context";
import { useApps } from "./apps/context";
import { useMessage } from "./hooks";
import { classnames } from "../components/utils";
import styles from "./style/menu.module.less";
import { MessageMenu } from "./MessageMenu";
import { modelOptions } from "./utils/options";
import { GitHubMenu } from "./GitHubMenu";
import { RiChatNewLine } from "react-icons/ri";

import "../assets/icon/style.css";
import { UsageInformationDialog } from "./UsageInformationDialog";
import { McpAuthFields } from "./McpAuthFields";
import { useMcpAuth } from "./hooks/useMcpAuth";
import { getOpenMcpSettingsEventName } from "./component/McpSettingsAction";
import {
  createDefaultMcpAuthConfig,
  discoverMcpServerScopes,
  mergeDiscoveryIntoConfig,
  isConsentRequired,
  normalizeMcpAuthConfig,
  needsConsent,
  getMcpUserDataSupportState,
  validateMcpAuthConfigForSave,
} from "./utils/mcp";
import { normalizeOpenAIOptions } from "./utils/mcpOptions";

export function MessageHeader() {
  const {
    is,
    setIs,
    setOptions,
    newChat,
    downloadThread,
    showSettings,
    options,
    user,
  } = useGlobal();
  const { message } = useMessage();
  const { apps, category } = useApps();
  const messages = message?.messages;
  const columnIcon = is.toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />;

  const openaiOptions = normalizeOpenAIOptions(options.openai);
  let tools: Map<string, Tool> = openaiOptions.tools;

  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  const [editMCPServices, setEditMCPServices] = useState(false);
  const [editingMcpKey, setEditingMcpKey] = useState<string | null>(null);

  const { getAuthorization, userFields } = useMcpAuth(user);

  const [mcpToolForm, setMcpToolForm] = useState({
    label: "",
    server_url: "",
    require_approval: "never",
    allowed_tools: [],
    authConfig: createDefaultMcpAuthConfig(),
  });
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const approval_options = createListCollection({
    items: [
      { label: t("Always"), value: "always" },
      { label: t("Never"), value: "never" },
    ],
  });

  const logout = () => {
    console.log("Logout");
    globalThis.location.href = import.meta.env.VITE_LOGOUT_URL || "/";
  };

  const editMCP = useCallback(() => {
    console.log("Edit MCP Services");
    setEditingMcpKey(null);
    setCheckError(null);
    setMcpToolForm({
      label: "",
      server_url: "",
      require_approval: "never",
      allowed_tools: [],
      authConfig: createDefaultMcpAuthConfig(),
    });
    setEditMCPServices(true);
  }, []);

  function setTool(key: string, tool: Tool, checked: boolean): void {
    console.log("Set tool: %s %o", key, checked);
    const nextToolsEnabled = new Set(openaiOptions.toolsEnabled);
    if (checked) {
      nextToolsEnabled.add(key);
    } else {
      nextToolsEnabled.delete(key);
    }
    setOptions({
      type: OptionActionType.OPENAI,
      data: { ...openaiOptions, toolsEnabled: nextToolsEnabled },
    });
  }

  const editTool = useCallback((key: string, tool: Tool.Mcp): void => {
    const savedAuthConfig = openaiOptions.mcpAuthConfigs.get(key);
    setEditingMcpKey(key);
    setCheckError(null);
    setMcpToolForm({
      label: tool.server_label || "",
      server_url: tool.server_url || "",
      require_approval: (tool.require_approval as string) || "never",
      allowed_tools: (tool.allowed_tools as string[]) || [],
      authConfig: savedAuthConfig
        ? normalizeMcpAuthConfig(savedAuthConfig)
        : createDefaultMcpAuthConfig(),
    });
    setEditMCPServices(true);
  }, [openaiOptions.mcpAuthConfigs]);

  function cleanupRenamedTool(
    oldKey: string | null,
    newKey: string,
    tools: Map<string, Tool>,
    openai: typeof openaiOptions
  ) {
    if (oldKey && oldKey !== newKey) {
      tools.delete(oldKey);
      openai.toolsEnabled.delete(oldKey);
      openai.mcpAuthConfigs.delete(oldKey);
    }
  }

  const inspectServerAuthConfig = useCallback(
    async (serverUrl: string, authConfig: McpAuthConfig) => {
      const discoveryResult = await discoverMcpServerScopes(serverUrl);
      let updatedConfig = mergeDiscoveryIntoConfig(authConfig, discoveryResult);

      if (needsConsent(updatedConfig)) {
        updatedConfig = {
          ...updatedConfig,
          mode: "user-data",
          staticToken: "",
        };
      }

      return { discoveryResult, updatedConfig };
    },
    []
  );

  const handleCheckServer = useCallback(async () => {
    const serverUrl = mcpToolForm.server_url;
    if (!serverUrl) return;

    setIsChecking(true);
    setCheckError(null);

    try {
      const { discoveryResult, updatedConfig } = await inspectServerAuthConfig(
        serverUrl,
        mcpToolForm.authConfig
      );

      if (discoveryResult.kind === "unreachable") {
        setCheckError(discoveryResult.error || t("server_unreachable"));
      }

      setMcpToolForm((f) => ({ ...f, authConfig: updatedConfig }));
    } catch (_error) {
      setCheckError(t("server_unreachable"));
    } finally {
      setIsChecking(false);
    }
  }, [inspectServerAuthConfig, mcpToolForm.server_url, mcpToolForm.authConfig, t]);

  async function handleAddService() {
    const nextLabel = mcpToolForm.label.trim();
    const nextServerUrl = mcpToolForm.server_url.trim();
    const nextAllowedTools = mcpToolForm.allowed_tools.filter(
      (tool) => typeof tool === "string" && tool.length > 0
    );

    if (!nextLabel || !nextServerUrl) {
      alert(t("Please fill in all required fields"));
      return;
    }

    if (editingMcpKey !== nextLabel && tools.has(nextLabel)) {
      alert(t("Label already exists"));
      return;
    }

    setIsChecking(true);
    setCheckError(null);

    let config = mcpToolForm.authConfig;
    try {
      const { discoveryResult, updatedConfig } = await inspectServerAuthConfig(
        nextServerUrl,
        mcpToolForm.authConfig
      );
      config = updatedConfig;
      setMcpToolForm((f) => ({
        ...f,
        label: nextLabel,
        server_url: nextServerUrl,
        allowed_tools: nextAllowedTools,
        authConfig: updatedConfig,
      }));

      if (discoveryResult.kind === "unreachable") {
        setCheckError(discoveryResult.error || t("server_unreachable"));
      }
    } catch (_error) {
      const errorMessage = t("server_unreachable");
      setCheckError(errorMessage);
      config = {
        ...normalizeMcpAuthConfig(mcpToolForm.authConfig),
        discoveryState: "unreachable",
        availabilityState: "unavailable",
        discoveryError: errorMessage,
      };
    } finally {
      setIsChecking(false);
    }

    const validation = validateMcpAuthConfigForSave(config);
    if (validation.blockingReason !== "none") {
      const errorMessage =
        validation.blockingReason === "server-unreachable"
          ? config.discoveryError || t("server_unreachable")
          : validation.blockingReason === "user-data-required"
            ? t("mcp_user_data_required")
          : validation.blockingReason === "consent-missing"
            ? t("consent_missing_userdata")
          : getMcpUserDataSupportState(config) === "plain-server"
              ? t("mcp_user_data_plain_server")
              : t("mcp_user_data_check_server_hint");
      alert(errorMessage);
      return;
    }

    let authorization: string | undefined;
    try {
      authorization = await getAuthorization(
        config,
        nextServerUrl
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Autorisierung konnte nicht erstellt werden"
      );
      return;
    }

    const newTool: Tool.Mcp = {
      type: "mcp",
      server_label: nextLabel,
      server_url: nextServerUrl,
      require_approval: mcpToolForm.require_approval as "always" | "never",
      authorization: authorization,
    };

    if (nextAllowedTools.length > 0) {
      newTool.allowed_tools = nextAllowedTools;
    }

    const wasEnabled = editingMcpKey
      ? openaiOptions.toolsEnabled.has(editingMcpKey)
      : openaiOptions.toolsEnabled.has(nextLabel);

    const nextMcpAuthConfigs = new Map(openaiOptions.mcpAuthConfigs);
    const nextToolsEnabled = new Set(openaiOptions.toolsEnabled);
    cleanupRenamedTool(editingMcpKey, nextLabel, tools, {
      ...openaiOptions,
      mcpAuthConfigs: nextMcpAuthConfigs,
      toolsEnabled: nextToolsEnabled,
    });
    setEditingMcpKey(null);

    tools.set(nextLabel, newTool);
    nextMcpAuthConfigs.set(nextLabel, config);
    if (wasEnabled) {
      nextToolsEnabled.add(nextLabel);
    }
    setOptions({
      type: OptionActionType.OPENAI,
      data: {
        ...openaiOptions,
        tools,
        toolsEnabled: nextToolsEnabled,
        mcpAuthConfigs: nextMcpAuthConfigs,
      },
    });
  }

  function handleDeleteService(key: string) {
    console.log("Delete MCP Service", key);
    if (!tools.has(key)) {
      console.error(`Tool with key ${key} does not exist.`);
      return;
    }
    tools.delete(key);
    const nextToolsEnabled = new Set(openaiOptions.toolsEnabled);
    const nextMcpAuthConfigs = new Map(openaiOptions.mcpAuthConfigs);
    nextToolsEnabled.delete(key);
    nextMcpAuthConfigs.delete(key);
    setOptions({
      type: OptionActionType.OPENAI,
      data: {
        ...openaiOptions,
        tools,
        toolsEnabled: nextToolsEnabled,
        mcpAuthConfigs: nextMcpAuthConfigs,
      },
    });
  }
  const mcpTools: Record<string, Tool.Mcp> = {};
  const missingPermissionsMessage = t("mcp_missing_permissions");

  function isMcpToolSelectable(key: string): boolean {
    const cfg = openaiOptions.mcpAuthConfigs.get(key);
    if (!cfg) return true;
    if (cfg.serverType === "scoped" && cfg.availabilityState === "unavailable")
      return false;
    if (needsConsent(cfg)) return false;
    return true;
  }

  for (const [key, value] of tools) {
    if (value.type === "mcp") mcpTools[key] = value as Tool.Mcp;
  }

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      const serviceKey = detail?.key;
      if (serviceKey) {
        const tool = tools.get(serviceKey);
        if (tool?.type === "mcp") {
          editTool(serviceKey, tool as Tool.Mcp);
          return;
        }
      }
      editMCP();
    };

    const eventName = getOpenMcpSettingsEventName();
    window.addEventListener(eventName, handleOpenSettings);
    return () => {
      window.removeEventListener(eventName, handleOpenSettings);
    };
  }, [editMCP, editTool, tools]);

  const userDataSupportState = getMcpUserDataSupportState(mcpToolForm.authConfig);
  const userDataSupportMessage =
    userDataSupportState === "unknown"
      ? t("mcp_user_data_check_server_hint")
      : userDataSupportState === "plain-server"
        ? t("mcp_user_data_plain_server")
          : null;

  return (
    <HStack
      as="header"
      padding={1}
      borderBottomWidth="1px"
      justifyContent="space-between"
      data-testid="ChatHeader"
    >
      <IconButton
        hideFrom="md"
        variant="ghost"
        title={is.toolbar ? t("hide_toolbar") : t("show_toolbar")}
        onClick={() => setIs({ toolbar: !is.toolbar })}
      >
        {columnIcon}
      </IconButton>
      <Stack
        flexGrow={1}
        gap="1px"
        paddingInlineStart={2}
        className={styles.title}
      >
        <Heading data-testid="HeaderTitle" textStyle="lg">
          {message?.title}
        </Heading>
        <Text textStyle="xs">
          {t("count_messages", {
            count: messages?.filter((item) => item.role !== "system").length,
          })}
        </Text>
      </Stack>

      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton
            variant="ghost"
            title={t("chat_options")}
            data-testid="chat-options-btn"
          >
            <CgOptions aria-label={t("chat_options")} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.RadioItemGroup
              value={openaiOptions.model}
              onValueChange={(e) =>
                setOptions({
                  type: OptionActionType.OPENAI,
                  data: { ...openaiOptions, model: e.value },
                })
              }
            >
              <Menu.ItemGroupLabel>{t("model_options")}</Menu.ItemGroupLabel>
              {modelOptions.map((item) => (
                <Menu.RadioItem key={item.value} value={item.value}>
                  {item.label}
                  <Menu.ItemIndicator />
                </Menu.RadioItem>
              ))}
            </Menu.RadioItemGroup>

            <Menu.ItemGroup>
              <Menu.ItemGroupLabel>{t("tool_options")}</Menu.ItemGroupLabel>
              {Array.from(tools.entries())
                .filter(
                  ([key, value]) =>
                    value.type !== "mcp" || isMcpToolSelectable(key)
                )
                .map(([key, value]) => (
                  <Menu.CheckboxItem
                    value={
                      value.type === "mcp" ? value.server_label : value.type
                    }
                    key={key}
                    checked={openaiOptions.toolsEnabled.has(key)}
                    onCheckedChange={(e) => setTool(key, value, e)}
                  >
                    <Menu.ItemIndicator />
                    {key}
                  </Menu.CheckboxItem>
                ))}

              <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
                <Menu.TriggerItem data-testid="mcp-services-menu-trigger">
                  {t("MCP Services")} <LuChevronRight />
                </Menu.TriggerItem>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      {Object.entries(mcpTools)
                        .filter(([key]) => isMcpToolSelectable(key))
                        .map(([key, tool]) => (
                          <Menu.CheckboxItem
                            key={tool.server_label}
                            value={key}
                            checked={openaiOptions.toolsEnabled.has(key)}
                            onCheckedChange={(e) => setTool(key, tool, e)}
                          >
                            <Menu.ItemIndicator />
                            {tool.title || key}
                          </Menu.CheckboxItem>
                        ))}

                      <Menu.Item
                        onClick={editMCP}
                        value="edit_mcp_services"
                        data-testid="mcp-add-remove-services"
                      >
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

      <Dialog.Root
        data-testid="mcp-services-dialog"
        open={editMCPServices}
        onOpenChange={(e) => setEditMCPServices(e.open)}
        lazyMount
        size="cover"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content ref={contentRef}>
              <Dialog.Header>
                <Dialog.Title>{t("Edit MCP Services")}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body overflowY="auto">
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
                        onChange={(e) =>
                          setMcpToolForm((f) => ({
                            ...f,
                            label: e.target.value,
                          }))
                        }
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label htmlFor="server_url">
                        {t("Server URL")}
                      </Field.Label>
                      <Input
                        id="server_url"
                        name="server_url"
                        type="url"
                        required
                        className={styles.input}
                        value={mcpToolForm.server_url}
                        onChange={(e) =>
                          setMcpToolForm((f) => ({
                            ...f,
                            server_url: e.target.value,
                          }))
                        }
                      />
                    </Field.Root>
                    <Field.Root>
                      <Select.Root
                        data-testid="mcp-require-approval-select"
                        collection={approval_options}
                        size="sm"
                        width="320px"
                        value={[mcpToolForm.require_approval]}
                        onValueChange={(e) => {
                          console.log("Selected approval option:", e);
                          setMcpToolForm((f) => ({
                            ...f,
                            require_approval: e.value[0],
                          }));
                        }}
                      >
                        <Select.HiddenSelect />
                        <Select.Label>{t("Require Approval")}</Select.Label>
                        <Select.Control>
                          <Select.Trigger data-testid="mcp-require-approval-trigger">
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
                                <Select.Item
                                  item={framework}
                                  key={framework.value}
                                >
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
                      <Field.Label htmlFor="allowed_tools">
                        {t("Allowed Tools")}
                      </Field.Label>
                      <Input
                        id="allowed_tools"
                        name="allowed_tools"
                        placeholder={t("Comma separated")}
                        className={styles.input}
                        value={mcpToolForm.allowed_tools}
                        onChange={(e) =>
                          setMcpToolForm((f) => ({
                            ...f,
                            allowed_tools: e.target.value
                              .split(",")
                              .map((item) => item.trim()),
                          }))
                        }
                      />
                    </Field.Root>
                  </Stack>
                  <Button
                    data-testid="mcp-check-server-btn"
                    onClick={handleCheckServer}
                    variant="outline"
                    size="sm"
                    loading={isChecking}
                    disabled={!mcpToolForm.server_url}
                  >
                    {t("check_server")}
                  </Button>

                  {checkError && (
                    <Text color="red.500" fontSize="sm">
                      {checkError}
                    </Text>
                  )}

                  <McpAuthFields
                    config={mcpToolForm.authConfig}
                    onChange={(authConfig) => {
                      setMcpToolForm((f) => ({ ...f, authConfig }));
                    }}
                    userFields={userFields}
                    user={user}
                  />
                  {userDataSupportMessage && (
                    <Text
                      data-testid="mcp-user-data-support-message"
                      fontSize="xs"
                      color={userDataSupportState === "unreachable" ? "red.500" : "gray.500"}
                    >
                      {userDataSupportMessage}
                    </Text>
                  )}
                  <Button
                    data-testid="mcp-add-service-btn"
                    onClick={handleAddService}
                    colorPalette="blue"
                  >
                    {t("Add/Save Service")}
                  </Button>
                </Stack>

                <Separator marginBlockStart={4} marginBlockEnd={4} />

                <Stack
                  padding={2}
                  gap={2}
                  as="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                  }}
                >
                  <Text fontWeight="bold">{t("MCP Services")}</Text>
                  <Stack padding={2} gap={2} className={styles.mcpServices}>
                    {Object.entries(mcpTools).map(([key, tool]) => {
                      const authConfig = openaiOptions.mcpAuthConfigs.get(key);
                      const isUnavailable =
                        authConfig?.serverType === "scoped" &&
                        authConfig?.availabilityState === "unavailable" &&
                        authConfig?.discoveryState === "unreachable";
                      const isConsentPending =
                        !!authConfig && needsConsent(authConfig);
                      const isDisabled = isUnavailable || isConsentPending;
                      return (
                        <HStack
                          key={key}
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <HStack flexWrap="wrap">
                            <Checkbox.Root
                              size="sm"
                              variant={"outline"}
                              checked={openaiOptions.toolsEnabled.has(key)}
                              onCheckedChange={(e) =>
                                setTool(key, tool, !!e.checked)
                              }
                              disabled={isDisabled}
                            >
                              <Checkbox.HiddenInput />
                              <Checkbox.Control />
                            </Checkbox.Root>
                            <Text>{tool.title || key}</Text>
                            {isConsentPending && (
                              <Text fontSize="xs" color="red.600">
                                {missingPermissionsMessage}
                              </Text>
                            )}
                            {isUnavailable && !isConsentPending && (
                              <Badge
                                colorPalette="gray"
                                size="sm"
                                variant="subtle"
                              >
                                {t("currently_unavailable")}
                              </Badge>
                            )}
                          </HStack>
                          <HStack gap={1} alignItems="center">
                            <Button
                              data-testid={`mcp-edit-${key}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                editTool(key, tool);
                              }}
                            >
                              <MdEdit />
                            </Button>
                            <Button
                              data-testid={`mcp-delete-${key}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteService(key)}
                            >
                              <MdDelete />
                            </Button>
                          </HStack>
                        </HStack>
                      );
                    })}
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
          <IconButton variant="ghost" title={t("new_chat")}>
            <RiChatNewLine aria-label={t("new_chat")} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Content>
          <Menu.ItemGroup title={t("new_chat")}>
            {apps.map((app, index) => {
              const cat = category.find((item) => item.id == app.category);
              return (
                <Menu.Item
                  key={app.id}
                  onClick={() => newChat(app)}
                  value={app.id}
                  aria-keyshortcuts={index}
                >
                  <span
                    className={classnames(styles.icon, `ico - ${cat.icon} `)}
                  ></span>{" "}
                  {app.title}
                </Menu.Item>
              );
            })}
          </Menu.ItemGroup>
        </Menu.Content>
      </Menu.Root>

      <MessageMenu />

      {openaiOptions.mode == "assistant" ? (
        <IconButton
          variant="ghost"
          title={t("chat_settings")}
          onClick={showSettings}
        >
          <IoSettingsOutline />
        </IconButton>
      ) : null}

      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton variant="ghost" title={t("download_thread")}>
            <MdOutlineSimCardDownload aria-label={t("download_thread")} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Content>
          <Menu.Item value="json" onClick={() => downloadThread("json")}>
            <BiSolidFileJson /> {t("download_json")}
          </Menu.Item>
          <Menu.Item
            value="markdown"
            onClick={() => downloadThread("markdown")}
          >
            <IoLogoMarkdown /> {t("download_markdown")}
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <GitHubMenu />

      <UsageInformationDialog />

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
              <Popover.Title fontWeight="bold" paddingBlockEnd={"15px"}>
                {t("User information")}
              </Popover.Title>
              <Stack gap={2}>
                <Text>{user?.name}</Text>
                <Text>{user?.email}</Text>
                <Button colorPalette="blue" onClick={logout}>
                  Logout
                </Button>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>
    </HStack>
  );
}
