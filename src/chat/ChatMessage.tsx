import React, { useEffect } from 'react'
import { Avatar, Badge, Card, HStack, Icon, IconButton, Skeleton, Spacer, Stack, Text } from "@chakra-ui/react";
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
    return toolsUsed.map((tool, index) => {
      return (
        <Tooltip key={index} content={t(tool.type + "_description")}>
          <Badge>{t(tool.type)}</Badge>
        </Tooltip>
      )
    })
  }

  let message = ""
  let image_url = null
  if (typeof content == "string") {
    message = processLaTeX(content)
  }
  else {
    content.map((item, index) => {
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
        {images && images.map((image, index) => {
          console.log("Image:", image);
          // create data URL from blob
          return image.blob.arrayBuffer().then(buffer => {
            const binary = String.fromCharCode(...new Uint8Array(buffer));
            const base64 = btoa(binary);
            const image_url = `data:${image.mime_type};base64,${base64}`;
            console.log("Image URL:", image_url);
            return (<img key={index} src={image_url} alt={`image-${index}`} className={styles.image} />)
          });


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
            .map((item, index) => <MessageItem key={item.id} {...item} dataTestId="ChatMessage" />)}
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

