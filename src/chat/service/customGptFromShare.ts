import { t } from "i18next";
import { v7 as uuidv7 } from "uuid";
import { toaster } from "../../components/ui/toaster";
import {
  buildInputFile,
  ensureFileName,
  getInputFileMimeType,
  isImageFile,
  isPdfFile,
  isSupportedFile,
  PDF_MIME_TYPE,
} from "../utils/attachments";
import type {
  App,
  Chat,
  CustomGpt,
  GlobalState,
  MessageAttachment,
  SharedTargetContent,
} from "../context/types";

type ShareDependencies = {
  state: Partial<GlobalState>;
  customGpt: CustomGpt;
  shared: SharedTargetContent;
  setState: (payload: Partial<GlobalState>) => void;
  setIs: (arg: any) => void;
  setOptions: (arg: any) => void;
  startResponse: (state: any, parent: any) => void;
  parent: any;
};

type StoredAttachments = {
  imageAttachments: MessageAttachment[];
  fileAttachments: MessageAttachment[];
};

function getSupportedFiles(files: File[]) {
  const supported: File[] = [];
  const unsupported: File[] = [];
  files.forEach((file) =>
    (isSupportedFile(file) ? supported : unsupported).push(file)
  );
  if (unsupported.length) {
    toaster.create({
      title: t("share_unsupported_files_title"),
      description: t("share_unsupported_files_description"),
      duration: 5000,
      type: "warning",
    });
  }
  return supported;
}

function getSharedUrl(shared: SharedTargetContent) {
  const textUrl = shared.text.match(/https?:\/\/[^\s<>"')]+/)?.[0];
  return shared.url.trim() || textUrl?.replace(/[.,;!?]+$/, "") || "";
}

function validateSharedContent(
  shared: SharedTargetContent,
  sharedUrl: string,
  files: File[]
) {
  if (!sharedUrl.trim() && !shared.text.trim() && files.length === 0) {
    throw new Error(t("share_no_content"));
  }
}

async function storeSharedFile(
  file: File,
  index: number,
  opfs: FileSystemDirectoryHandle
): Promise<MessageAttachment> {
  const name = ensureFileName(file, index);
  const id = uuidv7();
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const opfsName = `attachment-${id}${extension}`;
  const handle = await opfs.getFileHandle(opfsName, { create: true });
  const writable = await handle.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
  return {
    id,
    name,
    opfsName,
    url: `opfs://${opfsName}`,
    size: file.size,
    lastModified: file.lastModified,
    type: isPdfFile(file)
      ? PDF_MIME_TYPE
      : file.type || getInputFileMimeType(name),
  };
}

async function storeSharedFiles(files: File[]): Promise<StoredAttachments> {
  const opfs = await navigator.storage.getDirectory();
  const imageAttachments: MessageAttachment[] = [];
  const fileAttachments: MessageAttachment[] = [];
  for (const [index, file] of files.entries()) {
    const attachment = await storeSharedFile(file, index, opfs);
    (isImageFile(file) ? imageAttachments : fileAttachments).push(attachment);
  }
  return { imageAttachments, fileAttachments };
}

function toImageInput(attachment: MessageAttachment) {
  return {
    type: "input_image",
    image_url: attachment.url,
    name: attachment.name,
    attachmentId: attachment.id,
    size: attachment.size,
    mimeType: attachment.type,
  };
}

function buildSharedDetails(
  shared: SharedTargetContent,
  customGpt: CustomGpt,
  sharedUrl: string,
  files: File[]
) {
  return [
    customGpt.sharePurpose?.trim()
      ? `${t("share_purpose_label")}: ${customGpt.sharePurpose.trim()}`
      : "",
    t("share_content_instruction"),
    shared.title ? `${t("share_title_label")}: ${shared.title}` : "",
    sharedUrl ? `${t("share_url_label")}: ${sharedUrl}` : "",
    shared.text ? `${t("share_text_label")}:\n${shared.text}` : "",
    files.length
      ? `${t("share_files_label")}: ${files
          .map((file, index) => ensureFileName(file, index))
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function createUserMessage(
  shared: SharedTargetContent,
  customGpt: CustomGpt,
  sharedUrl: string,
  files: File[],
  attachments: StoredAttachments
) {
  const content = [
    {
      type: "input_text",
      text: buildSharedDetails(shared, customGpt, sharedUrl, files),
    },
    ...attachments.imageAttachments.map(toImageInput),
    ...attachments.fileAttachments
      .filter((file) => Boolean(file.name))
      .map((file) => buildInputFile(file)),
  ];
  return {
    role: "user",
    id: uuidv7(),
    sentTime: Math.floor(Date.now() / 1000),
    content,
    images: attachments.imageAttachments,
    files: attachments.fileAttachments,
  };
}

function createSharedContentChat(
  customGpt: CustomGpt,
  shared: SharedTargetContent,
  files: File[],
  sharedUrl: string,
  userMessage: ReturnType<typeof createUserMessage>
): { chat: Chat; app: App } {
  const sourceTitle =
    shared.title || files[0]?.name || sharedUrl || t("shared_content");
  const shareTitle = customGpt.shareTitle?.trim();
  const title = shareTitle
    ? t("share_chat_title", {
        purpose: shareTitle,
        title: sourceTitle.slice(0, 80),
      })
    : sourceTitle.slice(0, 80);
  const name = customGpt.name.trim() || t("custom_gpt_default_name");
  const app: App = {
    category: 0,
    title: name,
    desc: "",
    id: customGpt.id,
    content: customGpt.systemPrompt,
    role: "system",
    botStarts: true,
  };
  return {
    app,
    chat: {
      id: uuidv7(),
      title,
      app: customGpt.id,
      ct: Date.now(),
      botStarts: true,
      messages: [
        {
          role: "system",
          id: uuidv7(),
          sentTime: Math.floor(Date.now() / 1000),
          content: customGpt.systemPrompt.trim(),
        },
        userMessage,
      ],
    },
  };
}

function enableWebSearch(options: GlobalState["options"], sharedUrl: string) {
  const nextOptions = {
    ...options,
    openai: {
      ...options.openai,
      toolsEnabled: new Set(options.openai.toolsEnabled ?? []),
    },
  };
  if (sharedUrl && nextOptions.openai.tools?.has("Web Search")) {
    nextOptions.openai.toolsEnabled.add("Web Search");
  }
  return nextOptions;
}

export async function createCustomGptFromShare({
  state,
  customGpt,
  shared,
  setState,
  setIs,
  setOptions,
  startResponse,
  parent,
}: ShareDependencies) {
  const files = getSupportedFiles(shared.files ?? []);
  const sharedUrl = getSharedUrl(shared);
  validateSharedContent(shared, sharedUrl, files);
  const attachments = await storeSharedFiles(files);
  const userMessage = createUserMessage(
    shared,
    customGpt,
    sharedUrl,
    files,
    attachments
  );
  const { chat, app } = createSharedContentChat(
    customGpt,
    shared,
    files,
    sharedUrl,
    userMessage
  );
  const nextChats = [chat, ...(state.chat ?? [])];
  const nextIs = { ...state.is, thinking: true, tool: null };
  const options = enableWebSearch(state.options, sharedUrl);
  setState({
    chat: nextChats,
    currentChat: 0,
    currentApp: app,
    typeingMessage: {},
    is: nextIs,
  });
  startResponse(
    {
      ...state,
      chat: nextChats,
      currentChat: 0,
      currentApp: app,
      options,
      is: nextIs,
      setState,
      setIs,
      setOptions,
    },
    parent
  );
}
