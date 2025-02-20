import React from 'react'
import { Avatar, Icon, IconButton } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip"
import { GrDocumentDownload } from "react-icons/gr";
import { AiOutlineOpenAI } from "react-icons/ai";
import { MdOutlineCancel } from "react-icons/md";
import { MdOutlineSend } from "react-icons/md";
import { RiSendPlane2Line } from "react-icons/ri";
import { MdEdit } from "react-icons/md";

import { CopyIcon, ScrollView, EmptyChat, ChatHelp } from './component'
import { MessageRender } from './MessageRender'
import { ConfigInfo } from './ConfigInfo'
import { useGlobal } from './context'
import { useSendKey } from './hooks/useSendKey'
import { useOptions } from './hooks/useOptions'
import { useMessage } from './hooks/useMessage'
import { dateFormat } from './utils'
import avatar_black from '../assets/images/OpenAI-black-monoblossom.svg'
import avatar_white from '../assets/images/OpenAI-white-monoblossom.svg'
import styles from './style/message.module.less'
import { classnames } from '../components/utils'
import { useTranslation } from "react-i18next";
import { MessageBar } from './MessageBar';
import { processLaTeX } from "./utils/latex";


export function MessageItem(props) {
  const { content, sentTime, role, id, dataTestId } = props
  const { removeMessage, editMessage, user, options } = useGlobal()
  const { t } = useTranslation();
  const avatar = options.general.theme === 'dark' ? avatar_white : avatar_black

  console.log("content: %o", content)
  let message = processLaTeX(content)
  return (
    <div className={classnames(styles.item, styles[role])} data-testid={dataTestId}>
      <Avatar.Root size="xs">
        <Avatar.Fallback name={user?.name} />
        <Avatar.Image src={role === 'user' ? user?.avatar : avatar} />
      </Avatar.Root>
      <div className={classnames(styles.item_content, styles[`item_${role}`])}>
        <div className={styles.item_inner}>
          <div className={styles.item_tool}>
            <div className={styles.item_date}>{dateFormat(sentTime)}</div>
            <div className={styles.item_bar}>
              <Tooltip content={t("Remove Message")}>
                <IconButton minWidth="24px" size="sm" variant="plain" onClick={() => removeMessage(id)} >
                  <MdOutlineCancel />
                </IconButton>
              </Tooltip>
              {role === 'user' ? <React.Fragment>
                {false && <Icon className={styles.icon} type="reload" />}
                <IconButton minWidth="24px" size="sm" variant="plain" onClick={() => editMessage(id)}>
                  <MdEdit />
                </IconButton>
              </React.Fragment> : <CopyIcon value={content} />}
            </div>
          </div>
          <MessageRender>
            {message}
          </MessageRender>
        </div>
      </div>
    </div>
  )
}

export function MessageContainer() {
  const { options } = useGlobal()
  const { message } = useMessage()
  const { messages = [] } = message || {}
  if (options?.openai?.apiKey) {
    return (
      <React.Fragment>
        {
          messages?.length ? <div className={styles.container} data-testid="ChatListContainer">
            {messages
              .filter(message => message.role !== "system")
              .map((item, index) => <MessageItem key={item.id} {...item} dataTestId="ChatMessage" />)}
            {/* message?.error && <Error /> */}
          </div> : <ChatHelp />
        }
      </React.Fragment>
    )
  } else {
    return <EmptyChat />
  }
}

export function ChatMessage() {
  const { is } = useGlobal()

  return (
    <div className={styles.message}>
      <ScrollView data-testid="ChatList">
        <MessageContainer />
      </ScrollView>
      <MessageBar />
    </div>
  )
}

