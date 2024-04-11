import { apiBaseUrl } from "./openai";
import { Chat, Message } from "../context/types";

import OpenAI from "openai";
import { MessageCreateParams } from "openai/resources/beta/threads/messages/messages";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { AssistantStream } from "openai/lib/AssistantStream";
import { Uploadable } from "openai/uploads";
import { FileCreateParams, Models } from "openai/resources";
import { FileDeleteResponse } from "openai/resources/beta/assistants/files";

const MODELS = [
    {
        "object": "model",
        "id": "gpt-3.5-turbo"
    },
    {
        "object": "model",
        "id": "gpt-4-turbo-preview"
    },
    {
        "object": "model",
        "id": "gpt-3.5-turbo-16k"
    },
    {
        "object": "model",
        "id": "gpt-3.5-turbo-16k-0613"
    },
    {
        "object": "model",
        "id": "gpt-4-0125-preview"
    },
    {
        "object": "model",
        "id": "gpt-3.5-turbo-0613"
    },
    {
        "object": "model",
        "id": "gpt-3.5-turbo-1106"
    },
    {
        "object": "model",
        "id": "gpt-4-turbo-2024-04-09"
    },
    {
        "object": "model",
        "id": "gpt-4"
    },
    {
        "object": "model",
        "id": "gpt-4-1106-preview"
    },
    {
        "object": "model",
        "id": "gpt-3.5-turbo-0125"
    },
    {
        "object": "model",
        "id": "gpt-4-0613"
    },
    {
        "object": "model",
        "id": "gpt-4-turbo"
    }
];

const client = new OpenAI({
    apiKey: "unused",
    dangerouslyAllowBrowser: true,
    baseURL: apiBaseUrl,
    fetch: (input, init: any) => {
        return fetch(input, { credentials: "include", ...init })
    }
});

export const getImageURL = (thread: string, m: string, file: string) =>
    `${apiBaseUrl}/files/${file}/content`

export const getAssistants = () => {
    return client.beta.assistants.list();
}


export const initChat = async (chat: Chat, sub: string): Promise<Chat> => {
    console.log("initChat", chat, sub);
    return client.beta.threads.create({ metadata: { title: chat.title, sub } })
        .then((thread) => {
            console.log("thread: ", thread);
            chat.thread = thread.id;
            return chat;
        })
}


export const getMessages = async (thread_id: string): Promise<OpenAI.Beta.Threads.Messages.Message[]> => {
    let messages = await client.beta.threads.messages.list(thread_id, { limit: 100, order: 'asc' })
    console.log(messages);
    return messages.data;
}

export const retrieveRun = async (thread_id: string, run_id: string): Promise<Run> => {
    return client.beta.threads.runs.retrieve(thread_id, run_id);
}

export const getRunSteps = async (thread_id: string, run_id: string): Promise<OpenAI.Beta.Threads.Runs.Steps.RunStep[]> => {
    let steps = await client.beta.threads.runs.steps.list(thread_id, run_id, { limit: 100, order: 'asc' })
    console.log(steps);
    return steps.data;
}

export const createMessage = async (chat: Chat, message: Message): Promise<Message> => {
    if (message.role === "user") {
        let _message = await client.beta.threads.messages.create(chat.thread, { role: "user", content: message.content })
        console.log(_message);
        message.thread_id = _message.thread_id;

    }
    return message;
}

export const createRun = (thread_id: string, assistant_id: string): AssistantStream => {
    return client.beta.threads.runs.createAndStream(thread_id, { assistant_id })
}

export const retrieveAssistant = async (assistant_id: string): Promise<OpenAI.Beta.Assistants.Assistant> => {
    return client.beta.assistants.retrieve(assistant_id);
}

export const retrieveAssistantFile = async (assistant_id: string, file_id: string): Promise<OpenAI.Beta.Assistants.Files.AssistantFile> => {
    return client.beta.assistants.files.retrieve(assistant_id, file_id);
}

export const createAssistantFile = async (assistant_id: string, file_id: string): Promise<OpenAI.Beta.Assistants.Files.AssistantFile> => {
    return client.beta.assistants.files.create(assistant_id, { file_id });
}

export const deleteAssistantFile = async (assistant_id: string, file_id: string): Promise<FileDeleteResponse> => {
    return client.beta.assistants.files.del(assistant_id, file_id);
}

export const retrieveFile = async (file_id: string): Promise<OpenAI.Files.FileObject> => {
    return client.files.retrieve(file_id);
}

export const createFile = async (file: Uploadable): Promise<OpenAI.Files.FileObject> => {
    console.log("createFile: ", file);
    const opts: FileCreateParams = { file: file, purpose: "assistants" }
    console.log("createFile: ", opts, Object.entries(opts));
    return client.files.create(opts, { headers: { "Accept": "*/*" } });
}

export const deleteFile = async (file_id: string): Promise<OpenAI.Files.FileDeleted> => {
    return client.files.del(file_id);
}

export const assistantsModels = () => {
    return MODELS;
}

export const modifyAssistant = async (assistant_id: string, assistant: Partial<OpenAI.Beta.Assistants.Assistant>): Promise<OpenAI.Beta.Assistants.Assistant> => {
    const UPDATE_KEYS = [
        'description',
        'file_ids',
        'instructions',
        'metadata',
        'model',
        'name',
        'tools',
    ]
    const _assistant = Object.fromEntries(
        Object
            .entries(assistant)
            .filter(([key, value]) => UPDATE_KEYS.includes(key))
    )
    return client.beta.assistants.update(assistant_id, _assistant);
}

