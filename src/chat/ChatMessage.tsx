import React, { useEffect, useState } from "react";
import { Tool } from "openai/resources/responses/responses.mjs";

import {
  Avatar,
  Badge,
  Card,
  HStack,
  IconButton,
  Skeleton,
  Spacer,
  Stack,
  Tag,
  Text,
} from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip";
import { AiOutlineDelete } from "react-icons/ai";
import {
  MdOutlineInput,
  MdOutlineOutput,
  MdEdit
} from "react-icons/md";
import { classnames } from "../components/utils";

import { useGlobal } from "./context";
import { CopyIcon, ScrollView, OPFSImage, ToolUsagePopup } from "./component";
import { LazyRenderer } from "./MessageRender";
import { useMessage } from "./hooks/useMessage";
import { dateFormat } from "./utils";
import avatar_black from "../assets/images/OpenAI-black-monoblossom.svg";
import avatar_white from "../assets/images/OpenAI-white-monoblossom.svg";
import styles from "./style/message.module.less";
import { useTranslation } from "react-i18next";
import { processLaTeX } from "./utils/latex";
import { IoTimerOutline } from "react-icons/io5";

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
  const formatter = new Intl.NumberFormat();

  if (!usage) {
    return null;
  }
  const elapsed =
    props.startTime && props.endTime ? props.endTime - props.startTime : null;

  return (
    <HStack>
      {elapsed !== null && (
        <HStack gap="0.2ex">
          <IoTimerOutline />
          <Text>{formatter.format(elapsed)}ms</Text>
        </HStack>
      )}
      <HStack gap="0.2ex">
        <MdOutlineInput />
        <Text>{formatter.format(usage.input_tokens)}t</Text>
      </HStack>
      <HStack gap="0.2ex">
        <MdOutlineOutput />
        <Text>{formatter.format(usage.output_tokens)}t</Text>
      </HStack>
    </HStack>
  );
}



function ToolUse(props) {
  const { toolsUsed } = props;
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!toolsUsed) {
    return null;
  }

  const groupedTools = Array.from(
    Map.groupBy<string, Tool>(toolsUsed, (tool) => tool.type)
  );
  console.log("Grouped tools:", groupedTools);

  return (
    <HStack>
      {groupedTools.map(([key, tools]) => (
        <Tooltip content={t(key + "_description")} key={key.toString()}>
          <Tag.Root size={"md"} onClick={() => setIsOpen(true)} cursor="pointer" data-testid={`tool-usage-badge-${key}`}>
            <Tag.Label>{t(key.toString())}</Tag.Label>
            <Tag.EndElement alignSelf={"baseline"}>
              <Badge colorPalette="green" size={"xs"}>
                {tools.length}
              </Badge>
            </Tag.EndElement>
          </Tag.Root>
        </Tooltip>
      ))}
      <ToolUsagePopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        toolsUsed={toolsUsed}
      />
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
  const { removeMessage, editMessage, user, options, is } = useGlobal();
  const { t } = useTranslation();
  const avatar = options.general.theme === "dark" ? avatar_white : avatar_black;

  //console.log("MessageItem props:", props);





  let message = "";
  let image_url = null;
  let image_name = null;
  if (typeof content == "string") {
    message = processLaTeX(content);
  } else {
    content?.map((item, index) => {
      if (item.type === "input_text") {
        message += item.text;
      } else if (item.type === "input_image") {
        image_url = item.image_url;
        image_name = item.name;
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
      <Card.Header justifyContent={role === "user" ? "flex-end" : "flex-start"}>
        <HStack>
          <Avatar.Root size="sm">
            <Avatar.Fallback name={user?.name} />
            <Avatar.Image src={role === "user" ? user?.avatar : avatar} />
          </Avatar.Root>
          <Text>{dateFormat(sentTime)}</Text>
          <ToolUse toolsUsed={toolsUsed} />
        </HStack>
      </Card.Header>
      <Card.Body>
        <LazyRenderer isVisible={is.thinking}>{message}</LazyRenderer>
        {images &&
          Object.entries(images)?.map(([fileName, image]: [string, any], index) => {
            if (image.src) {
              // If image has a src, use it directly
              return (
                <img
                  key={fileName}
                  src={image.src}
                  alt={fileName}
                  className={styles.generated_image}
                  data-testid={`generated-image-${fileName}`}
                />
              );
            } else if (image.url?.startsWith("opfs://")) {
              return (
                <OPFSImage
                  key={fileName}
                  src={image.url}
                  alt={fileName}
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
      </Card.Body>
      <Card.Footer>
        <HStack width={"100%"} justifyContent="space-between">
          <Usage usage={usage} startTime={startTime} endTime={endTime} />
          <Spacer />
          <Tooltip content={t("Remove Message")}>
            <IconButton
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
  const { options } = useGlobal();
  const { message } = useMessage();
  const { messages = [] } = message || {};

  return (
    <React.Fragment>
      {
        <Stack data-testid="ChatListContainer">
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
                dataTestId={`ChatMessage-${index}`}
              />
            ))}
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
