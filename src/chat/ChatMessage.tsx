import React, { useEffect, useState } from "react";
import type { Tool } from "openai/resources/responses/responses.mjs";

import {
  Avatar,
  Badge,
  Button,
  Card,
  HStack,
  IconButton,
  Progress,
  Skeleton,
  Spacer,
  Stack,
  Switch as ChakraSwitch,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip";
import { AiOutlineDelete } from "react-icons/ai";
import {
  MdOutlineCancel,
  MdOutlineInput,
  MdOutlineOutput,
  MdEdit,
} from "react-icons/md";
import { IoTimerOutline } from "react-icons/io5";
import { classnames } from "../components/utils";

import { useGlobal } from "./context";
import type { Message } from "./context/types";
import { CopyIcon, ScrollView, OPFSImage, ToolUsagePopup, FilePreview } from "./component";
import { LazyRenderer } from "./MessageRender";
import { useMessage } from "./hooks/useMessage";
import { dateFormat } from "./utils";
import avatar_black from "../assets/images/OpenAI-black-monoblossom.svg";
import avatar_white from "../assets/images/OpenAI-white-monoblossom.svg";
import styles from "./style/message.module.less";
import { useTranslation } from "react-i18next";
import { processLaTeX } from "./utils/latex";
import { LuChevronDown } from "react-icons/lu";

type UsageProps = {
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  startTime?: number;
  endTime?: number;
};

function Usage(props: UsageProps) {
  const { usage, startTime, endTime } = props;
  const { t } = useTranslation();
  const formatter = new Intl.NumberFormat();
  const elapsed =
    startTime !== undefined && endTime !== undefined
      ? endTime - startTime
      : undefined;

  if (!usage && elapsed === undefined) {
    return null;
  }

  return (
    <HStack wrap="wrap">
      {elapsed !== undefined && (
        <HStack gap="0.2ex">
          <IoTimerOutline />
          <Text>
            {t("elapsed_time_short", {
              count: Math.max(1, Math.round(elapsed / 1000)),
            })}
          </Text>
        </HStack>
      )}
      {usage && (
        <>
          <HStack gap="0.2ex">
            <MdOutlineInput />
            <Text>{formatter.format(usage.input_tokens)}t</Text>
          </HStack>
          <HStack gap="0.2ex">
            <MdOutlineOutput />
            <Text>{formatter.format(usage.output_tokens)}t</Text>
          </HStack>
        </>
      )}
    </HStack>
  );
}

function groupToolsByType(toolsUsed: Tool[]) {
  const grouped = new Map<string, Tool[]>();

  toolsUsed.forEach((tool) => {
    const key = tool.type;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(tool);
      return;
    }
    grouped.set(key, [tool]);
  });

  return Array.from(grouped.entries());
}

const bubbleActivityTypes = new Set([
  "mcp_call",
  "mcp_approval_request",
  "function_call",
  "custom_tool_call",
  "reasoning",
  "web_search_call",
  "image_generation_call",
  "code_interpreter_call",
]);

function getBubbleActivities(toolsUsed?: Tool[]) {
  return (toolsUsed || []).filter((tool) => {
    const activity = tool as any;
    if (!bubbleActivityTypes.has(activity.type)) return false;
    if (activity.type !== "reasoning") return true;

    return (
      (typeof activity.title === "string" && activity.title.trim().length > 0) ||
      (Array.isArray(activity.summary) &&
        activity.summary.some(
          (item: any) =>
            typeof item?.text === "string" && item.text.trim().length > 0
        ))
    );
  });
}

function ActivityBubbles({ toolsUsed }: { toolsUsed: Tool[] }) {
  const { t } = useTranslation();

  return (
    <div
      className={styles["activity-bubbles"]}
      role="group"
      aria-label={t("response_activity")}
    >
      {toolsUsed.map((tool, index) => {
        const activity = tool as any;
        const type = activity.type as string;
        const summary = type === "reasoning" && Array.isArray(activity.summary)
          ? activity.summary
              .map((item: any) => item?.text)
              .filter((text: unknown): text is string => typeof text === "string")
              .join("\n")
          : "";
        const title =
          activity.title ||
          activity.name ||
          activity.action?.query ||
          activity.prompt ||
          activity.server_label ||
          (type === "reasoning" ? t("Reasoning Step") : t(type));

        return (
          <div
            className={styles["activity-bubble"]}
            key={activity.id || `${type}-${index}`}
            data-testid="response-activity-bubble"
          >
            <span className={styles["activity-bubble-type"]}>{t(type)}</span>
            <span className={styles["activity-bubble-title"]}>{title}</span>
            {summary && (
              <div className={styles["activity-bubble-summary"]}>
                <LazyRenderer isVisible={true}>{summary}</LazyRenderer>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ToolUse({ toolsUsed }: { toolsUsed?: Tool[] }) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!toolsUsed?.length) {
    return null;
  }

  const groupedTools = groupToolsByType(toolsUsed);
  const toolCount = toolsUsed.filter((tool) => (tool as any).type !== "reasoning").length;

  return (
    <details
      className={styles["response-activity"]}
      data-testid="tool-usage-disclosure"
    >
      <summary
        className={styles["response-activity-summary"]}
        data-tour="tool-usage-disclosure"
      >
        <span className={styles["response-activity-meta"]}>
          {toolCount > 0 && (
            <span>{t("tools_used_count", { count: toolCount })}</span>
          )}
        </span>
        <LuChevronDown
          aria-hidden="true"
          className={styles["response-activity-chevron"]}
        />
      </summary>
      <div className={styles["response-activity-details"]}>
        <HStack wrap="wrap" gap="2">
          {groupedTools.map(([key, tools]) => (
            <Tooltip content={t(key + "_description")} key={key.toString()}>
              <Button
                size="sm"
                variant="outline"
                className={styles["tool-usage-button"]}
                onClick={() => setIsOpen(true)}
                data-testid={`tool-usage-badge-${key}`}
                data-tour="tool-usage-badge"
              >
                {t(key.toString())}
                <Badge colorPalette="green" size="xs">
                  {tools.length}
                </Badge>
              </Button>
            </Tooltip>
          ))}
        </HStack>
        <ToolUsagePopup
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          toolsUsed={toolsUsed}
        />
      </div>
    </details>
  );
}

function ResponseStatus() {
  const { is, eventProcessor } = useGlobal();
  const { t } = useTranslation();

  if (!is.thinking) return null;

  return (
    <HStack
      role="status"
      aria-live="polite"
      className={styles["response-status"]}
      data-testid="ResponseStatus"
    >
      <Progress.Root
        size="xs"
        value={null}
        className={styles["response-status-progress"]}
      >
        <Progress.Label>
          {is.tool ? t(is.tool) : t("thinking")}
        </Progress.Label>
        <Progress.Track>
          <Progress.Range />
        </Progress.Track>
      </Progress.Root>
      <Button
        size="sm"
        variant="ghost"
        className={styles["response-status-cancel"]}
        title={t("cancel")}
        aria-label={t("cancel")}
        onClick={() => eventProcessor?.stop()}
      >
        {t("cancel")} <MdOutlineCancel />
      </Button>
    </HStack>
  );
}

function ImageBlobRenderer({ image, fileName }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (image.blob) {
      image.blob.arrayBuffer().then((buffer) => {
        const base64 = buffer.toString("base64");
        setSrc(`data:${image.mime_type};base64,${base64}`);
      });
    }
  }, [image]);

  if (!src) return <Skeleton className={styles.image} />;

  return (
    <img
      src={src}
      alt={fileName}
      className={styles.image}
      data-testid={`generated-image-${fileName}`}
    />
  );
}

export function MessageItem(props) {
  const {
    content,
    images,
    sentTime,
    role,
    id,
    dataTestId,
    usage,
    startTime,
    endTime,
    toolsUsed,
  } = props;
  const { removeMessage, editMessage, user, options } = useGlobal();
  const { t } = useTranslation();
  const [showActivityBubbles, setShowActivityBubbles] = useState(false);
  const avatar = options.general.theme === "dark" ? avatar_white : avatar_black;
  const bubbleActivities = getBubbleActivities(toolsUsed);

  //console.log("MessageItem props:", props);





  let message = "";
  let image_url = null;
  let image_name = null;
  let image_attachment_id: string | undefined;
  const file_attachments: string[] = [];
  if (typeof content == "string") {
    message = processLaTeX(content);
  } else {
    content?.map((item, index) => {
      if (item.type === "input_text") {
        message += item.text;
      } else if (item.type === "input_image") {
        image_url = item.image_url;
        image_name = item.name;
        image_attachment_id = item.attachmentId;
      } else if (item.type === "input_file") {
        file_attachments.push(item.filename || "document.pdf");
      } else if (item.type === "mcp_approval_response") {
        message += item.approve ? "Approved" : "Denied";
      }
    });
  }

  return (
    <Card.Root
      data-testid={dataTestId}
      className={classnames(
        styles.message,
        role === "user" ? styles.user : styles.assistant
      )}
    >
      <Card.Header
        className={styles["message-header"]}
        justifyContent={role === "user" ? "flex-end" : "flex-start"}
      >
        <HStack
          wrap="wrap"
          className={classnames(
            styles["message-header-content"],
            role === "assistant"
              ? styles["message-header-content-assistant"]
              : styles["message-header-content-user"]
          )}
        >
          <Avatar.Root size="sm">
            <Avatar.Fallback
              name={role === "user" ? user?.name : "K!mpuls"}
            />
            <Avatar.Image src={role === "user" ? user?.avatar : avatar} alt="" />
          </Avatar.Root>
          <Text className={styles["message-author"]}>
            {role === "user" ? user?.name || t("you") : "K!mpuls"}
          </Text>
          <Text as="time" className={styles["message-timestamp"]}>
            {dateFormat(sentTime)}
          </Text>
          {role === "assistant" && <Spacer />}
          {role === "assistant" && <ToolUse toolsUsed={toolsUsed} />}
          {role === "assistant" && bubbleActivities.length > 0 && (
            <Tooltip content={t("response_activity_bubbles_label")}>
              <ChakraSwitch.Root
                size="sm"
                checked={showActivityBubbles}
                onCheckedChange={(event) =>
                  setShowActivityBubbles(event.checked)
                }
                data-testid="response-activity-bubbles-toggle"
              >
                <ChakraSwitch.HiddenInput
                  aria-label={t("response_activity_bubbles_label")}
                />
                <ChakraSwitch.Control>
                  <ChakraSwitch.Thumb />
                </ChakraSwitch.Control>
              </ChakraSwitch.Root>
            </Tooltip>
          )}
        </HStack>
      </Card.Header>
      <Card.Body className={styles["message-body"]}>
        <LazyRenderer isVisible={true} toolsUsed={toolsUsed}>
          {message}
        </LazyRenderer>
        {showActivityBubbles && bubbleActivities.length > 0 && (
          <ActivityBubbles toolsUsed={bubbleActivities} />
        )}
        {images &&
          Object.entries(images)?.map(([fileName, image]: [string, any], index) => {
            if (image.url?.startsWith("opfs://")) {
              return (
                <OPFSImage
                  key={fileName}
                  src={image.url}
                  alt={image.name || fileName}
                  chatId={props.chatId}
                  attachmentId={image.id || image.file_id}
                  fallbackSrc={image.src}
                  className={styles.generated_image}
                  data-testid={`generated-image-${fileName}`}
                />
              );
            } else if (image.src) {
              // Generated images have a blob preview while their OPFS file is
              // being written. Keep showing that preview until the persisted
              // OPFS URL is available.
              return (
                <img
                  key={fileName}
                  src={image.src}
                  alt={fileName}
                  className={styles.generated_image}
                  data-testid={`generated-image-${fileName}`}
                />
              );
            } else if (
              !image.url &&
              image.name &&
              (image.file_id || image.id)
            ) {
              // Older stored images may have a filename and attachment ID but
              // no explicit OPFS URL.
              return (
                <OPFSImage
                  key={fileName}
                  src={`opfs://${image.name}`}
                  alt={image.name || fileName}
                  chatId={props.chatId}
                  attachmentId={image.id || image.file_id}
                  className={styles.generated_image}
                  data-testid={`generated-image-${fileName}`}
                />
              );
            } else if (image.url && image.blob) {
              return (
                <ImageBlobRenderer
                  key={fileName}
                  image={image}
                  fileName={fileName}
                />
              );
            }
            return <Skeleton key={fileName} className={styles.image} />;
          })}
        {image_url &&
          (image_url.startsWith("opfs://") ? (
            <OPFSImage
              src={image_url}
              alt={image_name || "User content"}
                  chatId={props.chatId}
                  attachmentId={image_attachment_id}
              className={styles.image}
              data-testid="included-image"
            />
          ) : (
            <img
              src={image_url}
              alt={image_name || "User content"}
              className={styles.image}
              data-testid="included-image"
            />
          ))}
        {file_attachments.length > 0 && (
          <HStack wrap="wrap">
            {file_attachments.map((name, index) => (
              <FilePreview key={`${name}-${index}`} name={name} />
            ))}
          </HStack>
        )}
      </Card.Body>
      <Card.Footer className={styles["message-footer"]}>
        <HStack
          width={"100%"}
          justifyContent="space-between"
          className={styles["message-footer-content"]}
        >
          <Usage usage={usage} startTime={startTime} endTime={endTime} />
          <Spacer />
          <Tooltip content={t("Remove Message")}>
            <IconButton
              aria-label={t("Remove Message")}
              minWidth="24px"
              size="sm"
              variant="ghost"
              onClick={() => removeMessage(id)}
            >
              <AiOutlineDelete />
            </IconButton>
          </Tooltip>
          {role === "user" ? (
            <React.Fragment>
              <IconButton
                aria-label={t("Edit Message")}
                minWidth="24px"
                size="sm"
                variant="ghost"
                onClick={() => editMessage(id)}
                data-testid="EditMessageBtn"
              >
                <MdEdit />
              </IconButton>
            </React.Fragment>
          ) : (
            <CopyIcon value={content} />
          )}
        </HStack>
      </Card.Footer>
    </Card.Root>
  );
}

export function MessageContainer() {
  const { chat, currentChat, is } = useGlobal();
  const { message } = useMessage();
  const { messages = [] } = message || {};

  return (
    <React.Fragment>
      {
        <Stack data-testid="ChatListContainer" className={styles["message-list"]}>
          {messages
            .filter((message) => {
              if (message.role === "system") return false;
              // Hide explicit approval response messages as they are technical
              if (Array.isArray(message.content) &&
                message.content.length > 0 &&
                (message.content[0] as any).type === 'mcp_approval_response') {
                return false;
              }
              return true;
            })
            .reduce((acc: Message[], message) => {
              if (acc.length === 0) return [message];
              const last = acc[acc.length - 1];
              if (last.role === 'assistant' && message.role === 'assistant') {
                // Merge logic
                const merged = { ...last };
                // Content merge
                if (Array.isArray(last.content) || Array.isArray(message.content)) {
                  const c1 = Array.isArray(last.content) ? last.content : (last.content ? [{ type: 'input_text', text: last.content }] : []);
                  const c2 = Array.isArray(message.content) ? message.content : (message.content ? [{ type: 'input_text', text: message.content }] : []);
                  merged.content = [...c1, ...c2];
                } else {
                  merged.content = (last.content || "") + (message.content || "");
                }
                // Tools merge
                if (message.toolsUsed) {
                  merged.toolsUsed = [...(last.toolsUsed || []), ...message.toolsUsed];
                }
                // Images merge
                if (message.images) {
                  merged.images = { ...(last.images || {}), ...message.images };
                }

                acc[acc.length - 1] = merged;
                return acc;
              }
              return [...acc, message];
            }, [])
            .map((item, index) => (
              <MessageItem
                key={item.id || item.sentTime}
                {...item}
                chatId={String(chat?.[currentChat]?.id ?? "")}
                dataTestId={`ChatMessage-${index}`}
              />
            ))}
          {is.thinking && <ResponseStatus />}
        </Stack>
      }
    </React.Fragment>
  );
}

export function ChatMessage() {
  const { is, setState } = useGlobal();

  return (
    <ScrollView id="chat_list" data-testid="ChatList">
      <MessageContainer />
    </ScrollView>
  );
}
