import React, { useState } from 'react'
import { Icon, Panel } from '../components'
import { Tooltip } from "../components/ui/tooltip"
import {
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverRoot,
  PopoverTitle,
  PopoverTrigger,
} from "../components/ui/popover"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog"
import { Avatar, Button, IconButton, Stack, Text } from "@chakra-ui/react"
import { IoHelpCircleOutline } from "react-icons/io5";
import { IoSettingsOutline } from "react-icons/io5";
import { IoApps } from "react-icons/io5";
import { RiChatHistoryLine } from "react-icons/ri";
import { MdOutlineDarkMode } from "react-icons/md";
import { MdOutlineLightMode } from "react-icons/md";
import { TbArrowsMinimize } from "react-icons/tb";
import { TbArrowsMaximize } from "react-icons/tb";
import { useGlobal } from './context'
import { classnames } from '../components/utils'
import { useOptions } from './hooks'
import { t } from 'i18next'
import Markdown from 'react-markdown'
import remarkMath from 'remark-math'
import smartypants from 'remark-smartypants'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'

import styles from './style/sider.module.less'
import 'katex/dist/katex.min.css'


const ICONS = {
  "help": IoHelpCircleOutline,
  "apps": IoApps,
  "history": RiChatHistoryLine,
  "config": IoSettingsOutline,
  "dark": MdOutlineDarkMode,
  "light": MdOutlineLightMode,
  "min-screen": TbArrowsMinimize,
  "full-screen": TbArrowsMaximize
}

const Option = (props) => {

  const { type, onClick, tooltip, dataTestId } = props
  let testId = dataTestId ? { 'data-testid': dataTestId } : {}
  if (!ICONS[type]) {
    console.error(`Icon ${type} not found`)
    return null
  }
  return (
    <Tooltip content={tooltip}><IconButton aria-label={tooltip} variant="ghost" onClick={onClick} {...testId} >{ICONS[type]()}</IconButton></Tooltip>
  )
}

let text = `

## Datenschutzhinweise

Diese Anwendung ermöglicht den Zugriff auf die Chat-Funktion von
[OpenAI](https://openai.com) (inklusive *gpt-4o-mini*) **ohne Übertragung von personenbezogenen Daten des Benutzers
an OpenAI**. 

Technisch wird dies durch die Verwendung eines API-Schlüssels erreicht, der in der Anwendung hinterlegt ist.
Aus Sicht von OpenAI lassen sich die Anfragen an die API lediglich auf den API-Schlüssel der 
Fachhochschule Südwestfalen zurückführen, sodass die Anfragen nicht auf 
eine einzelne Benutzer*in zurückgeführt werden können.

Bitte beachten Sie, dass OpenAI jedoch die Inhalte der Nachrichten "sieht" und für eine gewisse Zeir speichert (s.u.).
*Sie **dürfen** daher gemäß [Nutzungsordnung](https://publikationen.fhb.fh-swf.de/receive/fhswf_mods_00002695) **keine sensible Informationen** in den Chat eingeben*.

## Verarbeitung personenbezogener Daten

Die Anwendung leitet keine personenbezogenen Daten (etwa den Benutzername oder die IP-Adresse) an OpenAI 
oder andere Dritte weiter. 

Bei der Nutzung des OpenAI-Proxy werden gemäß [Nutzungsordnung](https://publikationen.fhb.fh-swf.de/receive/fhswf_mods_00002695) 
folgende personenbezogene Daten verarbeitet:
  
1. Vor- und Nachname,
2. Benutzerkennung,
3. E-Mail-Adresse,
4. Scoped Affiliation (Statusgruppe innerhalb der Hochschule),
5. verwendetes KI-Modell,
6. Anzahl und Datum der API-Aufrufe,
7. IP-Adresse

Die Chat-Verläufe werden lokal auf Ihrem Gerät (im \`LocalStorage\` des Browsers) gespeichert. 
Die Anwendung der FH speichert lediglich statistische 
Informationen wie die Zahl und der von einer Benutzer*in versendeten Nachrichten.

Laut den [Nutzungsbedingungen von OpenAI](https://openai.com/api-data-privacy) werden eingegebene Texte von 
OpenAI nicht für Trainingszwecke verwendet.
Seitens OpenAI wird der Zugriff auf die API protokolliert, um die Nutzung zu überwachen und die Einhaltung der
Nutzungsbedingungen sicherzustellen.

## Cookies
Die Anwendung verwendet lediglich technisch notwendige Session-Cookies, um die Funktionalität der 
Anwendung zu gewährleisten (Anmeldung an der Anwendung).

## Quellcode
Der Quellcode der Anwendung ist auf GitHub in folgenden Repositories verfügbar:

- Chat-Client: [github.com/fhswf/openai-ui](https://github.com/fhswf/openai-ui)
- Proxy-Server: [github.com/fhswf/openai-proxy](https://github.com/fhswf/openai-proxy)
`

function Modal(props) {
  return (
    <>
      <div className={styles.backdrop} />
      <div className={styles.modal}>
        {props.children}
      </div>
    </>
  )
}


export function ChatSideBar() {
  const [showUserModal, setUserModal] = useState(false)
  const [showAboutModal, setAboutModal] = useState(false)
  const { is, setState, options, user } = useGlobal()
  const { setGeneral } = useOptions()

  const userClick = () => {
    console.log('User clicked')
    setUserModal(!showUserModal)
  }

  const logout = () => {
    console.log('Logout')
    window.location.href = import.meta.env.VITE_LOGOUT_URL
  }

  return (
    <div className={classnames(styles.sider, 'flex-c-sb flex-column')} data-testid="LeftSideBar">
      <div className={classnames(styles.tool, 'flex-c-sb flex-column')}>
        <PopoverRoot>
          <PopoverTrigger>
            <Avatar.Root>
              <Avatar.Fallback name={user?.name} />
              <Avatar.Image src={user?.avatar} />
            </Avatar.Root>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverArrow />
            <PopoverBody>
              <PopoverTitle fontWeight="bold" fontSizeAdjust={"+1"} paddingBlockEnd={"15px"}>{t('User information')}</PopoverTitle>
              <Stack spacing={2}>
                <Text>{user?.name}</Text>
                <Text>{user?.email}</Text>
                <Button type="primary" onClick={logout}>Logout</Button>
              </Stack>
            </PopoverBody>
          </PopoverContent>
        </PopoverRoot>

        <DialogRoot>
          <DialogTrigger asChild>

            <IconButton aria-label={t("about")} variant="ghost" >
              <Tooltip content={t("about")}>
                {ICONS["help"]()}
              </Tooltip>
            </IconButton>

          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('About')}</DialogTitle>
              <DialogCloseTrigger />
            </DialogHeader>
            <DialogBody>
              <Markdown
                className="z-ui-markdown"
                remarkPlugins={[remarkGfm, remarkMath, smartypants]}
                rehypePlugins={[rehypeKatex]}
              >
                {(text)}
              </Markdown>
            </DialogBody>
          </DialogContent>
        </DialogRoot>

      </div>
      <div className={classnames(styles.tool, 'flex-c-sb flex-column')} data-testid="BottomLeftSideBar">
        <Option type="apps" onClick={() => setState({ is: { ...is, apps: true } })} tooltip="Apps" />
        <Option type="history" onClick={() => setState({ is: { ...is, apps: false } })} tooltip="History" />
        <Option type={options.general.theme}
          onClick={() => setGeneral({ theme: options.general.theme === 'light' ? 'dark' : 'light' })}
          tooltip="Theme"
          data-testid="OptionDarkModeSelect" />
        <Option dataTestId="OpenConfigBtn" type="config" onClick={() => setState({ is: { ...is, config: !is.config } })} tooltip="Config" />
        <Option type={`${is.fullScreen ? 'min' : 'full'}-screen`} onClick={() => setState({ is: { ...is, fullScreen: !is.fullScreen } })}
          tooltip={`${is.fullScreen ? 'Minimize' : 'Maximize'}`} />
      </div>
    </div >
  )
}
