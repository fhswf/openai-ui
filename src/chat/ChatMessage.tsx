import React from 'react'
import { Avatar, Icon, Loading, Button, Popover } from '../components'
import { Icon as ChakraIcon, IconButton, Textarea } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip"
import { AiOutlineClear } from "react-icons/ai";
import { IoReloadOutline } from "react-icons/io5";
import { IoSettingsOutline } from "react-icons/io5";
import { IoLogoGithub } from "react-icons/io5";
import { GrDocumentDownload } from "react-icons/gr";
import { MdOutlineSimCardDownload } from "react-icons/md";

import { CopyIcon, ScrollView, Error, EmptyChat, ChatHelp } from './component'
import { MessageRender } from './MessageRender'
import { ConfigInfo } from './ConfigInfo'
import { useGlobal } from './context'
import { useSendKey } from './hooks/useSendKey'
import { useOptions } from './hooks/useOptions'
import { useMessage } from './hooks/useMessage'
import { dateFormat } from './utils'
import avatar from '../assets/images/avatar-gpt.png'
import styles from './style/message.module.less'
import { classnames } from '../components/utils'
import { useTranslation } from "react-i18next";
import CodeEditor from '@uiw/react-textarea-code-editor';

export function MessageHeader() {
  const { is, setIs, clearThread, reloadThread, downloadThread, showSettings, options } = useGlobal()
  const { message } = useMessage()
  const messages = message.messages;
  const columnIcon = is.sidebar ? 'column-close' : 'column-open'
  const { setGeneral } = useOptions()
  const { t } = useTranslation();
  const issueUrl = import.meta.env.VITE_ISSUE_URL || 'https://github.com/fhswf/openai-ui/issues/new?template=Blank+issue'

  return (
    <div className={classnames(styles.header)}>
      <Button type="icon" icon={columnIcon} onClick={() => setIs({ sidebar: !is.sidebar })} data-testid="ConversationSideBarBtn" />
      <div className={styles.header_title} data-testid="HeaderTitle">
        {message?.title}
        <div className={styles.length}>{t('count_messages', { count: messages.length })}</div>
      </div>
      <div className={styles.header_bar}>
        <IconButton variant="ghost" title={t("chat_settings")} onClick={showSettings}><IoSettingsOutline /></IconButton>
        <IconButton variant="ghost" title={t("reload_thread")} onClick={reloadThread}><IoReloadOutline /></IconButton>
        <IconButton variant="ghost" title={t("clear_thread")} onClick={clearThread} data-testid="ClearChatBtn"><AiOutlineClear /></IconButton>
        <IconButton variant="ghost" title={t("download_thread")} onClick={downloadThread}><MdOutlineSimCardDownload /></IconButton>
        <a href={issueUrl} target="_blank" title={t("open_issue")}><IconButton variant="ghost" aria-label={t("open_issue")}><IoLogoGithub /></IconButton></a>
      </div>
    </div >
  )
}

export function EditorMessage() {
  return (
    <div>
      <Textarea rows="3" />
    </div>)
}

export function MessageItem(props) {
  const { content, sentTime, role, id, dataTestId } = props
  const { removeMessage, editMessage, user } = useGlobal()
  const { t } = useTranslation();

  return (
    <div className={classnames(styles.item, styles[role])} data-testid={dataTestId}>
      <Avatar src={role === 'user' ? user?.avatar : avatar} />
      <div className={classnames(styles.item_content, styles[`item_${role}`])}>
        <div className={styles.item_inner}>
          <div className={styles.item_tool}>
            <div className={styles.item_date}>{dateFormat(sentTime)}</div>
            <div className={styles.item_bar}>
              <Tooltip content={t("Remove Message")}>
                <Icon className={styles.icon} type="trash" onClick={() => removeMessage(id)} />
              </Tooltip>
              {role === 'user' ? <React.Fragment>
                {false && <Icon className={styles.icon} type="reload" />}
                <Icon className={styles.icon} type="editor" onClick={() => editMessage(id)} />
              </React.Fragment> : <CopyIcon value={content} />}
            </div>
          </div>
          <MessageRender>
            {content}
          </MessageRender>
        </div>
      </div>
    </div>
  )
}

export function MessageBar() {
  const { sendMessage, setMessage, is, options, setIs, typeingMessage, clearTypeing, stopResonse } = useGlobal()
  const { t } = useTranslation();
  useSendKey(sendMessage, options.general.sendCommand)
  return (
    <div className={styles.bar}>
      {is.thinking && <div className={styles.bar_tool}>
        <div className={styles.bar_loading}>
          <div className="flex-c"><span>Thinking</span> <Loading /></div><Button size="min" className={styles.stop} onClick={stopResonse} icon="stop">Stop Resonse</Button>
        </div>
      </div>}
      <div className={styles.bar_inner}>
        <div className={styles.bar_type}>
          {
            options.general.codeEditor ?
              <CodeEditor language='Python' minHeight={256} onChange={(ev) => setMessage(ev.target.value)} /> :
              <Textarea data-testid="ChatTextArea" rows={3} value={typeingMessage?.content || ''}
                onFocus={() => setIs({ inputing: true })} onBlur={() => setIs({ inputing: false })}
                variant="subtle" minHeight="3lh" maxHeight="16lh"
                style={{ borderColor: 'lightgray', outlineColor: 'lightgray' }}
                placeholder={t("Enter something....")} onChange={(ev) => setMessage(ev.target.value)} onEnter={onEnter} />
          }
        </div>
        <div className={styles.bar_icon}>
          {typeingMessage?.content &&
            <Icon className={styles.icon} title={t("cancel")} type="cancel" onClick={clearTypeing} />
          }
          <Icon className={styles.icon} title={t("send")} type="send" onClick={sendMessage} data-testid="SendMessageBtn" />
        </div>
      </div>
    </div>
  )
}

const onEnter = (content, event) => {

  //sendMessage(content)
}

export function MessageContainer() {
  const { options } = useGlobal()
  const { message } = useMessage()
  const { messages = [] } = message || {}
  if (options?.openai?.apiKey) {
    return (
      <React.Fragment>
        {
          messages.length ? <div className={styles.container} data-testid="ChatListContainer">
            {messages
              .filter(message => message.role !== "system")
              .map((item, index) => <MessageItem key={item.id} {...item} dataTestId="ChatMessage" />)}
            {message?.error && <Error />}
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
      <MessageHeader />
      <ScrollView data-testid="ChatList">
        <MessageContainer />
        {is.thinking && <Loading />}
      </ScrollView>
      <MessageBar />
    </div>
  )
}

