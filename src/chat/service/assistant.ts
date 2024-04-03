import { apiBaseUrl } from "./openai";
import { Chat, Message } from "../context/types";

import OpenAI from "openai";
import { MessageCreateParams } from "openai/resources/beta/threads/messages/messages";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { AssistantStream } from "openai/lib/AssistantStream";

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
    return client.beta.threads.create({ metadata: { title: chat.title, sub } })
        .then((thread) => {
            console.log(thread);
            chat.thread = thread.id;
            return chat;
        })
}


export const getMessages = async (thread_id: string): Promise<any[]> => {
    let messages = await client.beta.threads.messages.list(thread_id, { limit: 100, order: 'asc' })
    console.log(messages);
    return messages.data;
}

export const retrieveRun = async (thread_id: string, run_id: string): Promise<Run> => {
    return client.beta.threads.runs.retrieve(thread_id, run_id);
}

export const getRunSteps = async (thread_id: string, run_id: string): Promise<any[]> => {
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