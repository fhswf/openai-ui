import { ToolChoiceTypes, Tool } from "openai/resources/responses/responses.mjs";
import { Tooltip } from "recharts";
import internal from "stream";


export type { Tool, ToolChoiceTypes };

export enum GlobalActionType {
    SET_STATE = "SET_STATE",
    CHANGE_MESSAGE = "CHANGE_MESSAGE",
    IS_CONFIG = "IS_CONFIG",
    START_CHAT = "START_CHAT",
}

export enum OptionActionType {
    GENERAL = "general",
    ACCOUNT = "account",
    OPENAI = "openai"
}

export type GeneralOptions = {
    gravatar: boolean;
    language: string;
    theme: string;
    sendCommand: string;
    size: string;
    codeEditor: boolean;
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
    assistant: string;
    apiKey: string;
    max_tokens: number;
    n: number;
    stream: boolean;
    tools: Map<string, Tool>;
    toolsEnabled: Set<string>;
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

export type GlobalAction = { type: GlobalActionType.SET_STATE; payload: Partial<GlobalState>; } |
{ type: GlobalActionType.CHANGE_MESSAGE; payload: Partial<GlobalState>; } |
{ type: GlobalActionType.IS_CONFIG; payload: Partial<GlobalState>; } |
{ type: GlobalActionType.START_CHAT; payload: Partial<GlobalState>; };

export type OptionAction = { type: OptionActionType.GENERAL; data: Partial<GeneralOptions>; } |
{ type: OptionActionType.ACCOUNT; data: Partial<AccountOptions>; } |
{ type: OptionActionType.OPENAI; data: Partial<OpenAIOptions>; };


export type GlobalActions = {
    setState: (payload: Partial<GlobalState>) => void;
    doLogin: () => void;
    clearTypeing: () => void;
    sendMessage: () => void;
    setApp: (app: any) => void;
    showSettings: () => void;
    newChat: (app: any) => void;
    modifyChat: (arg: any, index: number) => void;
    editChat: (index: number, title: string) => void;
    removeChat: (index: number) => void;
    setMessage: (content: string) => void;
    clearThread: () => void;
    downloadThread: (format?: string) => void;
    editMessage: (id: number) => void;
    removeMessage: (id: number) => void;
    setOptions: (arg: OptionAction) => void;
    setIs: (arg: any) => void;
    currentList: () => any;
    stopResponse: () => void;
};

export type Message = {
    images?: any;
    content: string;
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
    app: number;
    id: number;
    thread?: string;
    ct: number;
    messages: Messages;
    error?: any;
    botStarts?: boolean;
};

export type App = {
    category: number;
    title: string;
    desc: string;
    id: number;
    content: string;
    botStarts: boolean;
};