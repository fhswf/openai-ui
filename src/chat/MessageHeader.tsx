import React, { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  Tool,
  App,
  McpAuthConfig,
  OpenAIOptions,
  GlobalActions,
  OptionActionType,
} from "./context/types";
import {
  Avatar,
  HStack,
  Stack,
  Text,
  Progress,
  IconButton,
  Button,
  Menu,
  Popover,
  Heading,
  Portal,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { IoLogoMarkdown, IoSettingsOutline } from "react-icons/io5";
import { BiSolidFileJson } from "react-icons/bi";
import {
  LuEllipsis,
  LuMenu,
} from "react-icons/lu";
import {
  MdOutlineSimCardDownload,
  MdVpnKey,
} from "react-icons/md";
import { CgOptions } from "react-icons/cg";
import { RiChatNewLine } from "react-icons/ri";
import { useGlobal } from "./context";
import { useApps } from "./apps/context";
import { useMessage } from "./hooks";
import { classnames } from "../components/utils";
import styles from "./style/menu.module.less";
import chatStyles from "./style/chat.module.less";
import { MessageMenu } from "./MessageMenu";
import {
  McpServicesDialog,
  McpServicesMenu,
  ToolOptionsGroup,
} from "./McpServiceComponents";
import { GitHubMenu } from "./GitHubMenu";
import { UsageInformationDialog } from "./UsageInformationDialog";
import {
  AiHubError,
  AiHubBudget,
  aiHubApiBaseUrl,
  fetchAiHubBudget,
  fetchAiHubModels,
  generateAiHubKey,
} from "./service/aiHub";
import { defaultOpenAIBaseUrl, defaultOpenAIModel } from "./context/initState";
import { toaster } from "../components/ui/toaster";
import { isMcpAuthorizationIncomplete, useMcpAuth } from "./hooks/useMcpAuth";
import {
  ApprovalOptions,
  buildMcpTools,
  createDeleteMcpServiceHandler,
  createEditToolHandler,
  createEmptyMcpToolForm,
  createOpenMcpEditorHandler,
  createSaveMcpServiceHandler,
  createToolChangeHandler,
  EditToolRequest,
  ensureToolCollections,
  getApprovalOptions,
  getNormalizedTools,
  McpToolFormState,
  McpToolMap,
  ToolChangeRequest,
} from "./utils/mcpServices";

import "../assets/icon/style.css";

interface CategoryItem {
  id: number;
  icon: string;
}
function logout(): void {
  console.log("Logout");
  globalThis.location.assign(import.meta.env.VITE_LOGOUT_URL || "/");
}

interface ToolbarToggleButtonProps {
  onOpenNavigation?: VoidFunction;
  navigationOpen?: boolean;
}

function ToolbarToggleButton({
  onOpenNavigation,
  navigationOpen = false,
}: ToolbarToggleButtonProps) {
  const { t } = useTranslation();
  const label = navigationOpen ? t("hide_sidebar") : t("show_sidebar");

  if (!onOpenNavigation) return null;

  return (
    <IconButton
      hideFrom="md"
      variant="ghost"
      aria-label={label}
      aria-expanded={navigationOpen}
      aria-controls="mobile-chat-navigation"
      title={label}
      className={chatStyles["mobile-nav-toggle"]}
      onClick={onOpenNavigation}
    >
      <LuMenu />
    </IconButton>
  );
}

interface HeaderTitleBlockProps {
  messages?: { role: string }[];
  title?: string;
}

function HeaderTitleBlock({ messages, title }: HeaderTitleBlockProps) {
  const { t } = useTranslation();
  const count = messages?.filter((item) => item.role !== "system").length;

  return (
    <Stack
      flexGrow={1}
      gap="1px"
      paddingInlineStart={2}
      minWidth={0}
      className={chatStyles["chat-header-title"]}
    >
      <Text className={chatStyles["chat-header-brand"]} title={t("chatbot_title")}>
        {t("chatbot_title")}
      </Text>
      <Heading
        data-testid="HeaderTitle"
        textStyle="lg"
        title={title}
        className={chatStyles["chat-title-text"]}
      >
        {title}
      </Heading>
      <Text textStyle="xs" className={chatStyles["chat-header-count"]}>
        {t("count_messages", { count })}
      </Text>
    </Stack>
  );
}

function HeaderActionItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={chatStyles["header-action-item"]}>
      <Text className={chatStyles["header-action-label"]}>{label}</Text>
      {children}
    </div>
  );
}

interface ChatOptionsMenuProps {
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  user: Record<string, unknown> | null;
}

interface ChatOptionsMenuStateArgs extends ChatOptionsMenuProps {
  t: TFunction;
}

interface ChatOptionsMenuState {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  consentPromptOpen: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
  form: McpToolFormState;
  handleDeleteTool: React.Dispatch<string>;
  handleEditTool: React.Dispatch<EditToolRequest>;
  handleOpenMcp: VoidFunction;
  handleSave: VoidFunction;
  handleToolChange: React.Dispatch<ToolChangeRequest>;
  mcpTools: McpToolMap;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

interface ChatOptionsMenuCollections {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  mcpTools: McpToolMap;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

interface ChatOptionsMenuHandlers {
  handleDeleteTool: React.Dispatch<string>;
  handleEditTool: React.Dispatch<EditToolRequest>;
  handleOpenMcp: VoidFunction;
  handleSave: VoidFunction;
  handleToolChange: React.Dispatch<ToolChangeRequest>;
}

interface ChatOptionsMenuHandlersArgs extends ChatOptionsMenuCollections {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: ReturnType<typeof useMcpAuth>["getAuthorization"];
  openai: OpenAIOptions;
  setConsentPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}

interface ChatOptionsMenuStateBuilderArgs {
  collections: ChatOptionsMenuCollections;
  consentPromptOpen: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
  form: McpToolFormState;
  handlers: ChatOptionsMenuHandlers;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

interface ChatOptionsMenuContentProps {
  mcpTools: McpToolMap;
  onEditMcp: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

function ChatOptionsMenuContent({
  mcpTools,
  onEditMcp,
  onToolChange,
  openai,
  setOptions,
  tools,
  toolsEnabled,
}: ChatOptionsMenuContentProps) {
  const { t } = useTranslation();

  return (
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
          <ToolOptionsGroup
            tools={tools}
            toolsEnabled={toolsEnabled}
            onToolChange={onToolChange}
          />
          <McpServicesMenu
            mcpTools={mcpTools}
            toolsEnabled={toolsEnabled}
            onEditMcp={onEditMcp}
            onToolChange={onToolChange}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

function getChatOptionsMenuCollections(args: {
  form: McpToolFormState;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}): ChatOptionsMenuCollections {
  const tools = getNormalizedTools(args.openai, args.setOptions);
  const { toolsEnabled, mcpAuthConfigs } = ensureToolCollections(args.openai);

  return {
    approvalOptions: getApprovalOptions(args.t),
    authorizationIncomplete: isMcpAuthorizationIncomplete(args.form.authConfig),
    mcpAuthConfigs,
    mcpTools: buildMcpTools(tools),
    tools,
    toolsEnabled,
  };
}

function createChatOptionsMenuHandlers(
  args: ChatOptionsMenuHandlersArgs
): ChatOptionsMenuHandlers {
  const handleEditTool = createEditToolHandler({
    mcpAuthConfigs: args.mcpAuthConfigs,
    setConsentPromptOpen: args.setConsentPromptOpen,
    setDialogOpen: args.setDialogOpen,
    setEditingKey: args.setEditingKey,
    setForm: args.setForm,
  });
  const handleToolChange = createToolChangeHandler({
    collections: args,
    onEditTool: handleEditTool,
    openai: args.openai,
    setOptions: args.setOptions,
  });

  return {
    handleDeleteTool: createDeleteMcpServiceHandler(args),
    handleEditTool,
    handleOpenMcp: createOpenMcpEditorHandler(args),
    handleSave: createSaveMcpServiceHandler(args),
    handleToolChange,
  };
}

function buildChatOptionsMenuState(
  args: ChatOptionsMenuStateBuilderArgs
): ChatOptionsMenuState {
  return {
    approvalOptions: args.collections.approvalOptions,
    authorizationIncomplete: args.collections.authorizationIncomplete,
    consentPromptOpen: args.consentPromptOpen,
    contentRef: args.contentRef,
    dialogOpen: args.dialogOpen,
    form: args.form,
    handleDeleteTool: args.handlers.handleDeleteTool,
    handleEditTool: args.handlers.handleEditTool,
    handleOpenMcp: args.handlers.handleOpenMcp,
    handleSave: args.handlers.handleSave,
    handleToolChange: args.handlers.handleToolChange,
    mcpTools: args.collections.mcpTools,
    setDialogOpen: args.setDialogOpen,
    setForm: args.setForm,
    tools: args.collections.tools,
    toolsEnabled: args.collections.toolsEnabled,
  };
}

function useChatOptionsMenuState({
  openai,
  setOptions,
  t,
  user,
}: ChatOptionsMenuStateArgs): ChatOptionsMenuState {
  const { getAuthorization } = useMcpAuth(user);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [consentPromptOpen, setConsentPromptOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyMcpToolForm());

  React.useEffect(() => {
    if (!dialogOpen) {
      setConsentPromptOpen(false);
    }
  }, [dialogOpen]);

  const collections = getChatOptionsMenuCollections({
    form,
    openai,
    setOptions,
    t,
  });
  const handlers = createChatOptionsMenuHandlers({
    ...collections,
    editingKey,
    form,
    getAuthorization,
    openai,
    setConsentPromptOpen,
    setEditingKey,
    setOptions,
    setDialogOpen,
    setForm,
    t,
  });

  return buildChatOptionsMenuState({
    collections,
    consentPromptOpen,
    contentRef,
    dialogOpen,
    form,
    handlers,
    setDialogOpen,
    setForm,
  });
}

function ChatOptionsMenu({ openai, setOptions, user }: ChatOptionsMenuProps) {
  const { t } = useTranslation();
  const menuState = useChatOptionsMenuState({ openai, setOptions, t, user });

  return (
    <>
      <ChatOptionsMenuContent
        mcpTools={menuState.mcpTools}
        onEditMcp={menuState.handleOpenMcp}
        onToolChange={menuState.handleToolChange}
        openai={openai}
        setOptions={setOptions}
        tools={menuState.tools}
        toolsEnabled={menuState.toolsEnabled}
      />

      <McpServicesDialog
        approvalOptions={menuState.approvalOptions}
        authorizationIncomplete={menuState.authorizationIncomplete}
        consentPromptOpen={menuState.consentPromptOpen}
        contentRef={menuState.contentRef}
        form={menuState.form}
        mcpTools={menuState.mcpTools}
        onDeleteTool={menuState.handleDeleteTool}
        onEditTool={menuState.handleEditTool}
        onOpenChange={menuState.setDialogOpen}
        onSave={menuState.handleSave}
        onToolChange={menuState.handleToolChange}
        open={menuState.dialogOpen}
        setForm={menuState.setForm}
        toolsEnabled={menuState.toolsEnabled}
        user={user}
      />
    </>
  );
}

interface NewChatMenuProps {
  apps: App[];
  category: CategoryItem[];
  newChat: GlobalActions["newChat"];
}

function NewChatMenu({ apps, category, newChat }: NewChatMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button
          variant="subtle"
          size="sm"
          title={t("new_chat")}
          aria-label={t("new_chat")}
          className={chatStyles["new-chat-button"]}
        >
          <RiChatNewLine aria-hidden="true" />
          <span className={chatStyles["new-chat-label"]}>{t("new_chat")}</span>
        </Button>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.ItemGroup title={t("new_chat")}>
          {apps.map((app, index) => {
            const cat = category.find((item) => item.id == app.category);

            return (
              <Menu.Item
                key={app.id}
                onClick={() => {
                  newChat(app);
                }}
                value={String(app.id)}
                aria-keyshortcuts={String(index)}
              >
                <span
                  className={classnames(styles.icon, `ico - ${cat?.icon} `)}
                ></span>{" "}
                {app.title}
              </Menu.Item>
            );
          })}
        </Menu.ItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

interface AssistantSettingsButtonProps {
  mode: string;
  showSettings: GlobalActions["showSettings"];
}

function AssistantSettingsButton({
  mode,
  showSettings,
}: AssistantSettingsButtonProps) {
  const { t } = useTranslation();

  if (mode !== "assistant") {
    return null;
  }

  return (
    <IconButton
      variant="ghost"
      title={t("chat_settings")}
      onClick={showSettings}
    >
      <IoSettingsOutline />
    </IconButton>
  );
}

interface DownloadThreadMenuProps {
  downloadThread: GlobalActions["downloadThread"];
}

function DownloadThreadMenu({ downloadThread }: DownloadThreadMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton variant="ghost" title={t("download_thread")}>
          <MdOutlineSimCardDownload aria-label={t("download_thread")} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item
          value="json"
          onClick={() => {
            downloadThread("json");
          }}
        >
          <BiSolidFileJson /> {t("download_json")}
        </Menu.Item>
        <Menu.Item
          value="markdown"
          onClick={() => {
            downloadThread("markdown");
          }}
        >
          <IoLogoMarkdown /> {t("download_markdown")}
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

interface UserInformationPopoverProps {
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  user: { avatar?: string | null; email?: string; name?: string } | null;
}

function UserInformationPopover({
  openai,
  setOptions,
  user,
}: UserInformationPopoverProps) {
  const { t } = useTranslation();
  const [isGeneratingHubKey, setIsGeneratingHubKey] = useState(false);
  const [aiHubBudget, setAiHubBudget] = useState<AiHubBudget | null>(null);
  const [isLoadingAiHubBudget, setIsLoadingAiHubBudget] = useState(false);
  const [aiHubBudgetError, setAiHubBudgetError] = useState(false);
  const normalizedOpenAiBaseUrl = openai.baseUrl.replace(/\/$/, "");
  const normalizedAiHubApiBaseUrl = aiHubApiBaseUrl.replace(/\/$/, "");
  const isUsingAiHubBudget =
    openai.aiHubEnabled || normalizedOpenAiBaseUrl === normalizedAiHubApiBaseUrl;
  const aiHubKeyAlias = user?.email
    ? `KImpuls-${user.email.trim().toLowerCase()}`
    : "";

  async function loadAiHubBudget() {
    setIsLoadingAiHubBudget(true);
    setAiHubBudgetError(false);

    try {
      setAiHubBudget(await fetchAiHubBudget());
    } catch (error) {
      console.warn("Unable to load AI-Hub budget:", error);
      setAiHubBudgetError(true);
    } finally {
      setIsLoadingAiHubBudget(false);
    }
  }

  function formatAiHubCurrency(value: number) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  const aiHubBudgetUsagePercentage =
    aiHubBudget && aiHubBudget.max_budget_in_team > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (aiHubBudget.spend / aiHubBudget.max_budget_in_team) * 100
          )
        )
      : 0;

  function getAiHubErrorDescription(error: unknown) {
    if (!(error instanceof AiHubError)) {
      return t("ai_hub_budget_error_desc");
    }

    switch (error.code) {
      case "key_generation_failed":
        return t("ai_hub_key_generation_failed_desc", {
          status: error.status,
        });
      case "key_generation_missing_key":
        return t("ai_hub_key_generation_missing_key_desc");
      case "model_list_failed":
        return t("ai_hub_model_list_failed_desc", {
          status: error.status,
        });
      default:
        return t("ai_hub_budget_error_desc");
    }
  }

  function stopUsingAiHubBudget() {
    const aiHubModels = openai.aiHubModels ?? [];
    const restoredModel =
      openai.aiHubPreviousModel ||
      (aiHubModels.includes(openai.model) ? defaultOpenAIModel : openai.model);

    setOptions({
      type: OptionActionType.OPENAI,
      data: {
        apiKey: openai.aiHubPreviousApiKey || "unused",
        baseUrl: openai.aiHubPreviousBaseUrl || defaultOpenAIBaseUrl,
        aiHubEnabled: false,
        aiHubApiKey:
          openai.aiHubApiKey ||
          (normalizedOpenAiBaseUrl === normalizedAiHubApiBaseUrl
            ? openai.apiKey
            : ""),
        aiHubModels: [],
        model: restoredModel,
      },
    });

    toaster.create({
      title: t("ai_hub_budget_disabled"),
      description: t("ai_hub_budget_disabled_desc"),
      duration: 5000,
      type: "success",
    });
  }

  async function useAiHubBudget() {
    if (isUsingAiHubBudget) {
      stopUsingAiHubBudget();
      return;
    }

    setIsGeneratingHubKey(true);

    try {
      if (!aiHubKeyAlias) {
        throw new Error("AI-Hub key alias requires a user email address.");
      }

      const existingAiHubKey =
        openai.aiHubApiKey ||
        (normalizedOpenAiBaseUrl === normalizedAiHubApiBaseUrl
          ? openai.apiKey
          : "");
      const key = existingAiHubKey
        ? {
            key: existingAiHubKey,
            key_alias: aiHubKeyAlias,
            key_name: openai.aiHubKeyName,
          }
        : await generateAiHubKey(aiHubKeyAlias);
      const models = await fetchAiHubModels(key.key);
      const selectedModel = models.includes(openai.model)
        ? openai.model
        : models[0] ?? openai.model;

      setOptions({
        type: OptionActionType.OPENAI,
        data: {
          apiKey: key.key,
          baseUrl: aiHubApiBaseUrl,
          aiHubEnabled: true,
          aiHubApiKey: key.key,
          aiHubKeyAlias: key.key_alias || aiHubKeyAlias,
          aiHubKeyName: key.key_name,
          aiHubModels: models,
          aiHubPreviousApiKey: openai.apiKey,
          aiHubPreviousBaseUrl: openai.baseUrl,
          aiHubPreviousModel: openai.model,
          model: selectedModel,
        },
      });

      toaster.create({
        title: t("ai_hub_budget_enabled"),
        description: t("ai_hub_budget_enabled_desc", {
          count: models.length,
        }),
        duration: 5000,
        type: "success",
      });
      void loadAiHubBudget();
    } catch (error) {
      console.error("Unable to activate AI-Hub budget:", error);
      toaster.create({
        title: t("ai_hub_budget_error"),
        description: getAiHubErrorDescription(error),
        duration: 5000,
        type: "error",
      });
    } finally {
      setIsGeneratingHubKey(false);
    }
  }

  return (
    <Popover.Root
      lazyMount
      onOpenChange={(event) => {
        if (event.open) {
          void loadAiHubBudget();
        }
      }}
    >
      <Popover.Trigger
        data-testid="UserInformationBtn"
        aria-label={t("User information")}
        title={t("User information")}
      >
        <Avatar.Root size="sm">
          <Avatar.Fallback name={user?.name} />
          <Avatar.Image src={user?.avatar ?? undefined} />
        </Avatar.Root>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content data-testid="UserInformation">
          <Popover.Arrow />
          <Popover.Body>
            <Popover.Title fontWeight="bold" paddingBlockEnd="15px">
              {t("User information")}
            </Popover.Title>
            <Stack gap={2}>
              <Text>{user?.name}</Text>
              <Text>{user?.email}</Text>
              {isUsingAiHubBudget && (
                <Stack
                  gap={1}
                  borderTopWidth="1px"
                  borderTopColor="gray.200"
                  paddingTop={2}
                  data-testid="AiHubBudget"
                >
                  <Text fontSize="sm" color="green.600">
                    {t("ai_hub_budget_active")}
                  </Text>
                  <Text fontSize="sm" fontWeight="semibold">
                    {t("ai_hub_budget_usage")}
                  </Text>
                  {isLoadingAiHubBudget ? (
                    <Text fontSize="sm">{t("ai_hub_budget_loading")}</Text>
                  ) : aiHubBudgetError ? (
                    <Text fontSize="sm" color="red.600">
                      {t("ai_hub_budget_unavailable")}
                    </Text>
                  ) : aiHubBudget ? (
                    <>
                      <Text fontSize="sm">
                        {t("ai_hub_budget_spent", {
                          spend: formatAiHubCurrency(aiHubBudget.spend),
                          budget: formatAiHubCurrency(
                            aiHubBudget.max_budget_in_team
                          ),
                        })}
                      </Text>
                      <Progress.Root
                        size="sm"
                        value={aiHubBudgetUsagePercentage}
                        colorPalette="blue"
                        aria-label={t("ai_hub_budget_usage")}
                      >
                        <Progress.Track>
                          <Progress.Range />
                        </Progress.Track>
                      </Progress.Root>
                      <Text fontSize="sm">
                        {t("ai_hub_budget_remaining", {
                          available: formatAiHubCurrency(
                            aiHubBudget.available
                          ),
                        })}
                      </Text>
                    </>
                  ) : null}
                </Stack>
              )}
              <Button
                colorPalette="green"
                onClick={useAiHubBudget}
                loading={isGeneratingHubKey}
                data-testid="UseAiHubBudgetBtn"
              >
                <MdVpnKey />{" "}
                {isUsingAiHubBudget
                  ? t("stop_using_ai_hub_budget")
                  : t("use_ai_hub_budget")}
              </Button>
              <Button colorPalette="blue" onClick={logout}>
                {t("logout")}
              </Button>
            </Stack>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}

interface HeaderActionListProps {
  downloadThread: GlobalActions["downloadThread"];
  onAction: VoidFunction;
  open: boolean;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  showSettings: GlobalActions["showSettings"];
  user: Record<string, unknown> | null;
}

function HeaderActionList({
  downloadThread,
  onAction,
  open,
  openai,
  setOptions,
  showSettings,
  user,
}: HeaderActionListProps) {
  const { t } = useTranslation();

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    // Rows that open a popup (menu/dialog/popover) must not collapse the sheet.
    // The popup is anchored to a trigger inside the sheet, and a `display: none`
    // sheet would zero out that trigger's box, so the popup would open without a
    // usable position. Keeping the sheet laid out mirrors the desktop toolbar,
    // where the action list stays visible while a popup is open.
    const isPopupInteraction = target?.closest?.(
      '[data-scope="menu"], [data-scope="dialog"], [data-scope="popover"]'
    );
    if (isPopupInteraction) return;
    onAction();
  };

  return (
    <div
      id="mobile-chat-header-actions"
      className={chatStyles["header-action-items"]}
      data-open={open}
      onClickCapture={handleClickCapture}
    >
      <HeaderActionItem label={t("chat_options")}>
        <ChatOptionsMenu openai={openai} setOptions={setOptions} user={user} />
      </HeaderActionItem>
      <HeaderActionItem label={t("chat_history")}>
        <MessageMenu />
      </HeaderActionItem>
      {openai.mode === "assistant" && (
        <HeaderActionItem label={t("chat_settings")}>
          <AssistantSettingsButton
            mode={openai.mode}
            showSettings={showSettings}
          />
        </HeaderActionItem>
      )}
      <HeaderActionItem label={t("download_thread")}>
        <DownloadThreadMenu downloadThread={downloadThread} />
      </HeaderActionItem>
      <HeaderActionItem label={t("open_issue")}>
        <GitHubMenu />
      </HeaderActionItem>
      <HeaderActionItem label={t("usage_information")}>
        <UsageInformationDialog />
      </HeaderActionItem>
    </div>
  );
}

type MobileHeaderActionsProps = Omit<
  HeaderActionListProps,
  "onAction" | "open"
>;

function MobileHeaderActions(props: MobileHeaderActionsProps) {
  const [open, setOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;

    const isInsidePopup = (target: EventTarget | null) =>
      target instanceof Element &&
      !!target.closest(
        '[data-scope="menu"], [data-scope="dialog"], [data-scope="popover"]'
      );

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      // Submenus and dialogs are portalled out of the sheet, so a pointerdown
      // inside them is not a click on the sheet backdrop and must not close it.
      if (actionMenuRef.current?.contains(target) || isInsidePopup(target)) {
        return;
      }
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const { user, ...actionProps } = props;

  return (
    <div className={chatStyles["header-action-menu"]} ref={actionMenuRef}>
      <IconButton
        className={chatStyles["mobile-more-button"]}
        variant="ghost"
        aria-label={t("more_actions")}
        aria-expanded={open}
        aria-controls="mobile-chat-header-actions"
        title={t("more_actions")}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <LuEllipsis />
      </IconButton>
      <HeaderActionList
        {...actionProps}
        open={open}
        onAction={() => setOpen(false)}
        user={user}
      />
      <div className={chatStyles["header-user-info"]}>
        <UserInformationPopover
          openai={props.openai}
          setOptions={props.setOptions}
          user={user}
        />
      </div>
    </div>
  );
}

interface MessageHeaderProps {
  onOpenNavigation?: VoidFunction;
  mobileNavigationOpen?: boolean;
}

export function MessageHeader({
  onOpenNavigation,
  mobileNavigationOpen = false,
}: MessageHeaderProps) {
  const { setOptions, newChat, downloadThread, showSettings, options, user } =
    useGlobal();
  const { message } = useMessage();
  const { apps, category } = useApps();

  return (
    <HStack
      as="header"
      className={chatStyles["chat-header"]}
      borderBottomWidth="1px"
      justifyContent="space-between"
      gap={1}
      data-testid="ChatHeader"
    >
      <ToolbarToggleButton
        onOpenNavigation={onOpenNavigation}
        navigationOpen={mobileNavigationOpen}
      />
      <HeaderTitleBlock title={message.title} messages={message.messages} />
      <NewChatMenu apps={apps} category={category} newChat={newChat} />
      <MobileHeaderActions
        openai={options.openai}
        setOptions={setOptions}
        user={user}
        showSettings={showSettings}
        downloadThread={downloadThread}
      />
    </HStack>
  );
}
