import React, { useRef, useState } from 'react'
import { Icon, Title, Popover } from '../components'
import { Button, Card, Field, Flex, HStack, IconButton, Spacer, Textarea } from "@chakra-ui/react"
import { FiEdit } from "react-icons/fi";
import { MdOutlineDelete } from "react-icons/md";
import { IoAdd } from "react-icons/io5";
import { useGlobal } from './context'
import { classnames } from '../components/utils'
import styles from './style/list.module.less'
import { useTranslation } from 'react-i18next'
import { t } from 'i18next'

export function ListEmpty() {
  return (
    <div className={classnames('flex-column')}>
      <Icon type="message" />
      <Title type="h3">No conversations found<br />{t("Start a new conversation to begin storing them locally.")}</Title>
    </div>
  )
}


export function ColorIcon({ onChange }) {
  const [color, setColor] = useState(1);
  const [ico, setIco] = useState("files");
  const icoRef = useRef(null)
  const iconList = ["files", "scan-text", "message", "translation", "lab", "recommendations", "prompts", "productivity", "game", "engineers", "finance", "social-media", "designers", "programming", "write", "assistants", "education", "shark", "legal", "tape", "ui", "models", "mathematics", "science", "stopwatch"]
  function handleSelectColor(colors, icos) {
    colors && setColor(colors)
    icos && setIco(icos)
    onChange && onChange([color, ico])
  }
  const content = (
    <div className={styles.tip}>
      <div className={styles.colors}>
        <div className={styles.colors_box}>
          {new Array(15).fill(1).map((_, index) =>
            <div
              style={{ backgroundColor: `var(--tag-color-${index})` }}
              key={index}
              onClick={() => handleSelectColor(index)}
              className={classnames(styles.colors_item, styles[`color-${index}`], color === index ? styles.colors_currColor : null)} />
          )}
        </div>
        <div className={styles.colors_box}>
          {iconList.map((item) =>
            <div
              onClick={() => handleSelectColor(null, item)}
              key={item}
              style={{ backgroundColor: ico === item && `var(--tag-color-${color})` }}
              className={classnames(styles.colors_item, `ico-${item}`, ico === item ? styles.colors_currIco : null)} />
          )}
        </div>
      </div>
    </div>
  )
  return (
    <Popover content={content}>
      <TagIco ico={ico} color={color} ref={icoRef} />
    </Popover>
  )
}

export const TagIco = React.forwardRef(({ ico, color, ...rest }, ref) => <div ref={ref} {...rest} className={classnames(styles.colors_item, `ico-${ico}`)} style={{ color: '#fff', backgroundColor: `var(--tag-color-${color})` }} />)

export function EditItem(props) {
  const { modifyChat, setState } = useGlobal()
  const [title, setTitle] = useState(props.title);
  const [icon, setIcon] = useState(props.icon);
  return (
    <Card.Root variant="subtle" colorPalette="teal">
      <Card.Body>
        <Card.Title>{t("Edit Conversation")}</Card.Title>
        <Field.Root>
          <Field.Label>{t("Icon")}</Field.Label>
          <HStack>
            <ColorIcon onChange={setIcon} />
          </HStack>
        </Field.Root>
        <Field.Root>
          <Field.Label>{t("Title")}</Field.Label>
          <Textarea rows={3} variant="filled" value={title} onChange={evt => setTitle(evt.target.value)} data-testid="editConversationTextArea" />
          <Field.HelperText>{t("Edit the title of the conversation.")}</Field.HelperText>
        </Field.Root>
      </Card.Body>
      <Card.Footer justifyContent="center">
        <Button onClick={() => setState({ currentEditor: null })} data-testid="editConversationCancelBtn">{t("Cancel")}</Button>
        <Button onClick={() => modifyChat({ title, icon }, props.index)} type="primary" data-testid="editConversationSaveBtn">{t("Save")}</Button>
      </Card.Footer>
    </Card.Root>
  )
}

export function ChatItem(props) {
  const { icon } = props
  const [color, ico] = icon || [1, 'files']
  const { setState, removeChat, currentChat, currentEditor } = useGlobal()
  const item =
    (
      <Card.Root
        data-testid="ConversationCard" size="sm" onClick={() => setState({ currentChat: props.index })}
        variant={currentChat === props.index ? "elevated" : "solid"}>

        <Card.Header>
          <Flex>
            <TagIco ico={ico} color={color} />
            <Spacer />
            <IconButton aria-label="edit" size="xs" variant="ghost" data-testid="editConversation" onClick={() => setState({ currentEditor: props.index })} >
              <FiEdit />
            </IconButton>
            <IconButton aria-label="delete" size="xs" variant="ghost" onClick={() => removeChat(props.index)} >
              <MdOutlineDelete />
            </IconButton>
          </Flex>
        </Card.Header>
        <Card.Body>
          <Card.Title data-testid="ConversationTitle" as={'h4'}>{props.title}</Card.Title>
          <Card.Description>{t("count_messages", { count: props.messages.length })}</Card.Description>
        </Card.Body>
      </Card.Root >
    )


  if (currentEditor == props.index) {
    return <EditItem {...props} />
  }
  else {
    return item
  }
}


export function ChatList() {
  const { chat, newChat } = useGlobal()
  return (
    <Flex gap="4" direction="column" data-testid="ConversationList">
      {chat.length ? chat.map((item, index) => <ChatItem key={index} index={index} {...item} />) : <ListEmpty />}
      <Button alignSelf="center"
        type="primary"
        onClick={newChat}
        variant="surface"
        data-testid="ConversationCreateBtn"><IoAdd />{t("New Conversation")}</Button>
    </Flex>
  )
}
