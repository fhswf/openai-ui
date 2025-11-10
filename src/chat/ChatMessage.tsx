import React, { useEffect } from 'react'
import { Tool } from "openai/resources/responses/responses.mjs";

import { Accordion, Avatar, Badge, Card, Heading, HStack, Icon, IconButton, Popover, Skeleton, Spacer, Span, Stack, Tag, Text, VStack } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip"
import { GrDocumentDownload } from "react-icons/gr";
import { AiOutlineOpenAI } from "react-icons/ai";
import { AiOutlineDelete } from "react-icons/ai";
import { MdOutlineCancel, MdOutlineInput, MdOutlineOutput } from "react-icons/md";
import { MdOutlineSend } from "react-icons/md";
import { RiSendPlane2Line } from "react-icons/ri";
import { MdEdit } from "react-icons/md";
import { classnames } from '../components/utils'

import { useGlobal } from './context'
import { CopyIcon, ScrollView } from './component'
import { LazyRenderer } from './MessageRender'
import { useMessage } from './hooks/useMessage'
import { dateFormat } from './utils'
import avatar_black from '../assets/images/OpenAI-black-monoblossom.svg'
import avatar_white from '../assets/images/OpenAI-white-monoblossom.svg'
import styles from './style/message.module.less'

import { useTranslation } from "react-i18next";

import { MessageInput } from './MessageInput';
import { processLaTeX } from "./utils/latex";
import { MessagesPage } from 'openai/resources/beta/threads/messages.mjs';
import { IoTimerOutline } from 'react-icons/io5';


export function MessageItem(props) {
  const { content, images, sentTime, role, id, dataTestId, usage, startTime, endTime, toolsUsed } = props
  const { removeMessage, editMessage, user, options, is } = useGlobal()
  const { t } = useTranslation();
  const avatar = options.general.theme === 'dark' ? avatar_white : avatar_black

  //console.log("MessageItem props:", props);

  type UsageProps = {
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
    startTime?: number;
    endTime?: number;
  };

  function Usage(props: UsageProps) {
    const { usage, startTime, endTime } = props
    const formatter = new Intl.NumberFormat()

    if (!usage) {
      return null
    }
    const elapsed = props.startTime && props.endTime ? props.endTime - props.startTime : null

    return (
      <HStack>
        {elapsed &&
          <HStack gap="0.2ex">
            <IoTimerOutline />
            <Text>{formatter.format(elapsed)}ms</Text>
          </HStack>
        }
        <HStack gap="0.2ex">
          <MdOutlineInput />
          <Text>{formatter.format(usage.input_tokens)}t</Text>
        </HStack>
        <HStack gap="0.2ex">
          <MdOutlineOutput />
          <Text>{formatter.format(usage.output_tokens)}t</Text>
        </HStack>
      </HStack >
    )
  }

  function ToolUse(props) {
    const { toolsUsed } = props

    if (!toolsUsed) {
      return null;
    }

    const groupedTools = Array.from(Map.groupBy<String, Tool>(toolsUsed, tool => tool.type));
    console.log("Grouped tools:", groupedTools);

    return (
      <HStack>
        {groupedTools.map(([key, tools]) => (
          <Popover.Root key={key.toString()} size="lg">
            <Popover.Trigger>
              <Tooltip content={t(key + "_description")}>
                <Tag.Root size={'md'}>
                  <Tag.Label>{t(key.toString())}</Tag.Label>
                  <Tag.EndElement alignSelf={"baseline"}><Badge colorPalette="green" size={'xs'}>{tools.length}</Badge></Tag.EndElement>
                </Tag.Root>
              </Tooltip>
            </Popover.Trigger>
            <Popover.Positioner>
              <Popover.Content width="70vw" height="70vh">
                <Popover.CloseTrigger />
                <Popover.Arrow>
                  <Popover.ArrowTip />
                </Popover.Arrow>
                <Popover.Body overflowY={"auto"}>
                  <Popover.Title><Heading>{t(key + "_title")}</Heading></Popover.Title>
                  <Popover.Description >
                    {renderToolDetails(tools, key)}
                  </Popover.Description>
                </Popover.Body>
              </Popover.Content>
            </Popover.Positioner>
          </Popover.Root>
        ))}
      </HStack>
    );

    function renderToolDetails(tools: Tool[], key: String) {
      return <Accordion.Root>
        {tools
          .map((tool, index) => {
            const info = { ...tool };
            console.log("Tool:", tool);
            switch (tool.type) {
              case "mcp_list_tools":
                info.title = "" + tool.server_label;
                info.items = (<dl>{tool.tools.map(_t => <><dt key={_t.id}>{_t.name}</dt> <dd>{_t.description || t("No description available.")} </dd></>)}</dl>);
                break;
              case "mcp_call":
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(tool.arguments || '{}');
                } catch (error) {
                  console.error("Error parsing tool arguments:", error);
                  parsedArgs = {};
                }
                info.title = "" + tool.name;
                info.items = (
                  <VStack alignItems="flex-start">
                    <Text>{Object.entries(parsedArgs).map(([key, value], index) => <React.Fragment key={index}><dt>{key}</dt><dd>{value}</dd></React.Fragment>) || t("No arguments provided.")}</Text>
                    <LazyRenderer>{tool.output || t("No additional information available.")}</LazyRenderer>
                  </VStack>
                );
                break;
              case "reasoning":
                info.title = t("Reasoning Step") + " " + (index + 1);
                info.items = info.summary?.length ? (<ul>{info.summary.map((item, index) => (<li key={index}>{(<LazyRenderer>{item.text}</LazyRenderer>)}</li>))}</ul>) : (<Text>{t("No information available.")}</Text>);
                break;
              case "web_search_call":
                info.title = "" + tool.action?.query;
                info.items = (
                  <VStack alignItems="flex-start">
                    <Text>{t("Search Results:")}</Text>
                    <ul>{tool.action?.sources?.map((result, index) => <React.Fragment key={index}><li><a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a> </li></React.Fragment>)}</ul>
                  </VStack>
                );
                break;
              case "code_interpreter_call":
                info.title = t("Code Interpreter Step") + " " + (index + 1);
                info.items = (
                  <VStack alignItems="flex-start">
                    <Text>{t("Code")}:</Text>
                    <LazyRenderer>{"```python\n" + tool.code + "\n```" || t("No additional information available.")}</LazyRenderer>
                    <Text>{t("Outputs")}:</Text>
                    {tool.outputs?.map((output, index) => <LazyRenderer key={index}>{"```json\n" + JSON.stringify(output) + "\n```"}</LazyRenderer>)}
                  </VStack>
                );
                break;
            }
            return info;
          })
          ?.map((tool, index) => (
            <Accordion.Item key={index} value={tool.id} justifyContent="space-between" padding="2">
              <Accordion.ItemTrigger>
                <Span flex="1">{tool.title || tool.action?.query || (t(key) + " " + (index + 1))}</Span>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>
                  {tool.items || t("No additional information available.")}
                </Accordion.ItemBody>
              </Accordion.ItemContent>

            </Accordion.Item>
          ))}
      </Accordion.Root>;
    }
  }

  let message = ""
  let image_url = null
  if (typeof content == "string") {
    message = processLaTeX(content)
  }
  else {
    content?.map((item, index) => {
      if (item.type === "input_text") {
        message += item.text
      }
      else if (item.type === "input_image") {
        image_url = item.image_url
      }
    })
  }

  return (
    <Card.Root data-testid={dataTestId} className={classnames(styles.message, role === "user" ? styles.user : styles.assistant)} >
      <Card.Header justifyContent={role === 'user' ? 'flex-end' : 'flex-start'}>
        <HStack>
          <Avatar.Root size="sm">
            <Avatar.Fallback name={user?.name} />
            <Avatar.Image src={role === 'user' ? user?.avatar : avatar} />
          </Avatar.Root>
          <Text>{dateFormat(sentTime)}</Text>
          <ToolUse toolsUsed={toolsUsed} />
        </HStack>
      </Card.Header>
      <Card.Body>
        <LazyRenderer isVisible={is.thinking}>
          {message}
        </LazyRenderer>
        {images && Object.entries(images)?.map(([fileName, image], index) => {
          if (image.src) {
            // If image has a src, use it directly
            return (<img key={fileName} src={image.src} alt={fileName} className={styles.generated_image} />)
          } else if (image.url) {
            // create data URL from blob
            return image.blob.arrayBuffer().then(buffer => {
              const binary = String.fromCharCode(...new Uint8Array(buffer));
              const base64 = btoa(binary);
              const image_url = `data:${image.mime_type};base64,${base64}`;
              console.log("Image URL:", image_url);
              return (<img key={fileName} src={image_url} alt={fileName} className={styles.image} />)
            });
          }
          return (
            <Skeleton key={fileName} className={styles.image} />
          )
        })}
        {image_url && <img src={image_url} alt="image" className={styles.image} />}
      </Card.Body>
      <Card.Footer>
        <HStack width={"100%"} justifyContent="space-between">
          <Usage usage={usage} startTime={startTime} endTime={endTime} />
          <Spacer />
          <Tooltip content={t("Remove Message")}>
            <IconButton minWidth="24px" size="sm" variant="ghost" onClick={() => removeMessage(id)} >
              <AiOutlineDelete />
            </IconButton>
          </Tooltip>
          {
            role === 'user' ?
              <React.Fragment>
                {false && <Icon className={styles.icon} type="reload" />}
                <IconButton minWidth="24px" size="sm" variant="ghost" onClick={() => editMessage(id)}>
                  <MdEdit />
                </IconButton>
              </React.Fragment>
              :
              <CopyIcon value={content} />}
        </HStack>
      </Card.Footer>
    </Card.Root>
  )
}

export function MessageContainer() {
  const { options } = useGlobal()
  const { message } = useMessage()
  const { messages = [] } = message || {}

  return (
    <React.Fragment>
      {
        <Stack data-testid="ChatListContainer">
          {messages
            .filter(message => message.role !== "system")
            .map((item, index) => <MessageItem key={item.id || item.sentTime} {...item} dataTestId="ChatMessage" />)}
        </Stack>
      }
    </React.Fragment>
  )

}

export function ChatMessage() {
  const { is, setState } = useGlobal()


  return (

    <ScrollView id="chat_list" data-testid="ChatList">
      <MessageContainer />
    </ScrollView>

  )
}

