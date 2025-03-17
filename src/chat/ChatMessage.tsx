import React, { useEffect } from 'react'
import { Avatar, Card, HStack, Icon, IconButton, Skeleton, Spacer, Stack, Text } from "@chakra-ui/react";
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
  const { content, sentTime, role, id, dataTestId, usage, startTime, endTime } = props
  const { removeMessage, editMessage, user, options, is } = useGlobal()
  const { t } = useTranslation();
  const avatar = options.general.theme === 'dark' ? avatar_white : avatar_black

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

    console.log("Usage: %o", usage)
    if (!usage) {
      console.log("no usage data")
      return null
    }
    const elapsed = props.startTime && props.endTime ? props.endTime - props.startTime : null
    console.log("elapsed: %o", elapsed)
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

  let message = processLaTeX(content)
  return (
    <Card.Root data-testid={dataTestId} className={classnames(styles.message, role === "user" ? styles.user : styles.assistant)} >
      <Card.Header justifyContent={role === 'user' ? 'flex-end' : 'flex-start'}>
        <HStack>
          <Avatar.Root size="xs" >
            <Avatar.Fallback name={user?.name} />
            <Avatar.Image src={role === 'user' ? user?.avatar : avatar} />
          </Avatar.Root>
          <Text>{dateFormat(sentTime)}</Text>
        </HStack>
      </Card.Header>
      <Card.Body>
        <LazyRenderer isVisible={is.thinking}>
          {message}
        </LazyRenderer>
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

