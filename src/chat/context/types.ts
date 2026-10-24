import {
  ToolChoiceTypes,
  Tool,
} from "openai/resources/responses/responses.mjs";
import type { ReasoningEffort } from "openai/resources/shared.mjs";

export type { Tool, ToolChoiceTypes };

export enum GlobalActionType {
  SET_STATE = "SET_STATE",
  CHANGE_MESSAGE = "CHANGE_MESSAGE",
  IS_CONFIG = "IS_CONFIG",
  START_CHAT = "START_CHAT",
  SET_OPTIONS = "SET_OPTIONS",
}

export enum OptionActionType {
  GENERAL = "general",
  ACCOUNT = "account",
  OPENAI = "openai",
}

export type GeneralOptions = {
  gravatar: boolean;
  language: string;
  theme: string;
  sendCommand: string;
  size: string;
  codeEditor: boolean;
  zkStorage: boolean;
  /** Keep only a lightweight chat list in this browser and load transcripts from the vault on demand. */
  zkLazyHistory: boolean;
  /** User-defined system prompts that can be selected for shared content. */
  customGpts?: CustomGpt[];
};

export type CustomGpt = {
  id: string;
  name: string;
  systemPrompt: string;
  /** Task instruction added when this GPT receives shared content. */
  sharePurpose?: string;
  /** Label shown on the share action and used in the resulting chat title. */
  shareTitle?: string;
  botStarts?: boolean;
};

export type SharedTargetContent = {
  title: string;
  text: string;
  url: string;
  files: File[];
};

export type AccountOptions = {
  name: string;
  avatar: string;
  terms: boolean;
};

export type OpenAIOptions = {
  baseUrl: string;
  organizationId: string;
  temperature: number;
  top_p: number;
  mode: string;
  model: string;
  reasoningEffort: NonNullable<ReasoningEffort>;
  assistant: string;
  apiKey: string;
  max_tokens: number;
  n: number;
  stream: boolean;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
  vectorStoreBaseUrl?: string;
  mcpAuthConfigs?: Map<string, McpAuthConfig>;
  aiHubEnabled?: boolean;
  aiHubApiKey?: string;
  aiHubKeyAlias?: string;
  aiHubKeyName?: string;
  aiHubModels?: string[];
  aiHubPreviousApiKey?: string;
  aiHubPreviousBaseUrl?: string;
  aiHubPreviousModel?: string;
};

export type Options = {
  account: AccountOptions;
  general: GeneralOptions;
  openai: OpenAIOptions;
};

export type AnyOptions = GeneralOptions | AccountOptions | OpenAIOptions;

export type GlobalState = {
  current: number;
  chat: Chat[];
  currentChat: number;
  currentApp: App | null;
  currentEditor?: any;
  options: Options;
  is: {
    typeing: boolean;
    config: boolean;
    fullScreen: boolean;
    sidebar: boolean;
    toolbar: boolean;
    inputing: boolean;
    thinking: boolean;
    apps: boolean;
    tool: string;
  };
  typeingMessage: any;
  user: any;
  eventProcessor?: any;
  version: string;
  release?: any;
};

export type GlobalAction =
  | { type: GlobalActionType.SET_STATE; payload: Partial<GlobalState> }
  | { type: GlobalActionType.CHANGE_MESSAGE; payload: Partial<GlobalState> }
  | { type: GlobalActionType.IS_CONFIG; payload: Partial<GlobalState> }
  | { type: GlobalActionType.START_CHAT; payload: Partial<GlobalState> }
  | { type: GlobalActionType.SET_OPTIONS; payload: OptionAction };

export type OptionAction =
  | { type: OptionActionType.GENERAL; data: Partial<GeneralOptions> }
  | { type: OptionActionType.ACCOUNT; data: Partial<AccountOptions> }
  | { type: OptionActionType.OPENAI; data: Partial<OpenAIOptions> };

export type GlobalActions = {
  setState: (payload: Partial<GlobalState>) => void;
  doLogin: () => void;
  clearTypeing: () => void;
  sendMessage: () => Promise<void>;
  retryPendingMessage: () => void;
  startCustomGptFromShare: (
    customGpt: CustomGpt,
    shared: SharedTargetContent
  ) => Promise<void>;
  setApp: (app: any) => void;
  showSettings: () => void;
  newChat: (app: any) => void;
  modifyChat: (arg: any, index: number) => void;
  editChat: (index: number, title: string) => void;
  removeChat: (index: number) => void;
  setMessage: (content: string) => void;
  downloadThread: (format?: string) => void;
  editMessage: (id: number) => void;
  removeMessage: (id: number) => void;
  setOptions: (arg: OptionAction) => void;
  setIs: (arg: any) => void;
  currentList: () => any;
  stopResponse: () => void;
  /** Load the transcript of a vault-backed chat that is stored as a placeholder. */
  loadChatMessages: (id: number | string) => Promise<void>;
  /** Search the complete history, loading placeholders from the vault on demand. */
  searchChats: (query: string) => Promise<Chat[]>;
  /** True once the encrypted vault has been unlocked for this session. */
  vaultReady: boolean;
  /** Permanently delete an undecryptable chat owned by the current account. */
  deleteUnreadableVaultChat: (id: string) => Promise<void>;
};

export type VaultSharingActions = {
  /** Share a vault-backed chat with an account discoverable by verified email. */
  shareChatWithUser: (chatId: string, email: string) => Promise<void>;
  /** Create a short-lived capability link whose decryption key stays in its fragment. */
  createChatShareLink: (chatId: string) => Promise<{
    url: string;
    token: string;
    expiresAt: string;
  }>;
  revokeChatShareLink: (chatId: string, token: string) => Promise<void>;
  loadGroupRosters: () => Promise<import("../service/groupChatRosters").SavedGroupRoster[]>;
  resetGroupRosters: () => Promise<import("../service/groupChatRosters").SavedGroupRoster[]>;
  saveGroupRoster: (
    name: string,
    emails: string[]
  ) => Promise<import("../service/groupChatRosters").SavedGroupRoster[]>;
  deleteGroupRoster: (rosterId: string) => Promise<import("../service/groupChatRosters").SavedGroupRoster[]>;
  createGroupChatFromRoster: (chatId: string, rosterId: string) => Promise<void>;
  getGroupChatInfo: (chatId: string) => Promise<import("../service/chatVault").VaultGroupChat>;
  lookupGroupInviteTarget: (email: string) => Promise<{
    userId: string;
    email: string;
    publicKeyFingerprint: string;
  }>;
  inviteGroupChatMember: (
    chatId: string,
    email: string,
    expectedFingerprint: string
  ) => Promise<void>;
  removeGroupChatMember: (chatId: string, memberId: string) => Promise<void>;
  isGroupChatOwner: (chatId: string) => boolean;
  /** Add a decrypted chat-link copy to local history. */
  importSharedChat: (chat: Chat) => void;
};

export interface MessageAttachment {
  id?: string;
  name: string;
  opfsName?: string;
  type?: string;
  url?: string;
  size?: number;
  lastModified?: number;
}

export type Message = {
  images?: any;
  files?: MessageAttachment[];
  content: string | any[];
  sentTime?: number;
  startTime?: number;
  endTime?: number;
  role: string;
  id: number | string;
  thread_id?: string;
  usage?: any;
  toolsUsed?: any[];
};

export type Messages = Message[];

export type Chat = {
  title: string;
  app: number | string;
  id: number | string;
  thread?: string;
  ct: number;
  messages: Messages;
  error?: any;
  botStarts?: boolean;
  /** This chat uses the encrypted append-only group event protocol. */
  groupChat?: boolean;
  /**
   * Set when only a lightweight placeholder for this chat is stored locally.
   * The transcript still lives in the encrypted vault and is fetched on demand.
   */
  vault?: ChatVaultDescriptor;
};

export type ChatVaultDescriptor = {
  /** Vault revision the local placeholder was derived from. */
  rev: number;
  /** Owner of the remote chat, used to decide whether edits may be uploaded. */
  ownerId: string;
  /** Number of messages the remote transcript contains. */
  messageCount: number;
  /** Plaintext of the first user message, used as a local search fallback. */
  preview: string;
  updatedAt: number;
  /** The server chat exists, but its key envelope could not be opened. */
  restoreError?: "decrypt_failed";
  /** Only the owner can permanently delete the server record. */
  canDelete?: boolean;
};

export type App = {
  category: number;
  title: string;
  desc: string;
  id: number | string;
  content: string;
  botStarts?: boolean;
  role?: string;
};

export interface McpScopeDefinition {
  scope: string;
}

export interface McpUserDataDiscovery {
  scopes: McpScopeDefinition[];
  consentGranted: boolean;
  consentPrompted?: boolean;
}

export type McpAuthConfig =
  | { mode: "none" }
  | { mode: "static"; staticToken: string }
  | { mode: "user-data"; userData: McpUserDataDiscovery };

export type McpAuthMode = McpAuthConfig["mode"];
