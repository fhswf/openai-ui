import React from 'react'
import { Avatar, Card, HStack, Icon, IconButton, Skeleton, Spacer, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip"
import { GrDocumentDownload } from "react-icons/gr";
import { AiOutlineOpenAI } from "react-icons/ai";
import { AiOutlineDelete } from "react-icons/ai";
import { MdOutlineCancel } from "react-icons/md";
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
import { MessageBar } from './MessageBar';
import { processLaTeX } from "./utils/latex";


export function MessageItem(props) {
  const { content, sentTime, role, id, dataTestId } = props
  const { removeMessage, editMessage, user, options, is } = useGlobal()
  const { t } = useTranslation();
  const avatar = options.general.theme === 'dark' ? avatar_white : avatar_black

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
  const { is } = useGlobal()

  return (
    <div className={styles.message}>
      <ScrollView id="chat_list" data-testid="ChatList">
        <MessageContainer />
      </ScrollView>

    </div>
  )
}

