import React, { useEffect, useState } from 'react'
import { Icon, Panel } from '../components'
import { Tooltip } from "../components/ui/tooltip"

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
import { Avatar, Box, Button, Heading, IconButton, Link, Spacer, Stack, Text, VStack } from "@chakra-ui/react"
import { IoHelpCircleOutline } from "react-icons/io5";
import { IoInformationCircleOutline } from "react-icons/io5";
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
  "help": IoInformationCircleOutline,
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
    <Tooltip content={tooltip}><IconButton aria-label={tooltip} variant={props.variant || "ghost"} onClick={onClick} {...testId} >{ICONS[type]()}</IconButton></Tooltip>
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

Die Nutzung der Anwendung unterliegt der
**[Nutzungsordnung](https://publikationen.fhb.fh-swf.de/servlets/MCRFileNodeServlet/fhswf_derivate_00002553/Nr.%201328%20vom%2013.02.2025%20-%20Nutzungsordnung%20der%20FH%20SWF%20f%C3%BCr%20den%20OpenAI-Proxy%20KImpuls-Chatb.pdf)**.
Diese regelt unter anderem, dass **keine sensiblen Daten in den Chat eingegeben werden dürfen**, da OpenAI die Inhalte der Nachrichten "sieht" und für eine gewisse Zeir speichert (s.u.).

### Verarbeitung personenbezogener Daten

Die Anwendung leitet keine personenbezogenen Daten (etwa den Benutzername oder die IP-Adresse) an OpenAI 
oder andere Dritte weiter. 

Bei der Nutzung des OpenAI-Proxy werden gemäß [Nutzungsordnung](https://publikationen.fhb.fh-swf.de/servlets/MCRFileNodeServlet/fhswf_derivate_00002553/Nr.%201328%20vom%2013.02.2025%20-%20Nutzungsordnung%20der%20FH%20SWF%20f%C3%BCr%20den%20OpenAI-Proxy%20KImpuls-Chatb.pdf) 
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

### Cookies
Die Anwendung verwendet lediglich technisch notwendige Session-Cookies, um die Funktionalität der 
Anwendung zu gewährleisten (Anmeldung an der Anwendung).

## Quellcode
Der Quellcode der Anwendung ist auf GitHub in folgenden Repositories verfügbar:

- Chat-Client: [github.com/fhswf/openai-ui](https://github.com/fhswf/openai-ui)
- Proxy-Server: [github.com/fhswf/openai-proxy](https://github.com/fhswf/openai-proxy)
`


export function ChatSideBar() {

  const [open, setOpen] = useState(false)
  const [metadata, setMetadata] = useState({})
  const { is, setIs, setState, options, user } = useGlobal()
  const { setGeneral, setAccount } = useOptions()


  const acceptTerms = () => {
    setAccount({ terms: true })
    setOpen(false)
  }



  const toggleHistory = () => {
    if (!is.apps) {
      setIs({ sidebar: !is.sidebar })

    }
    else {
      setIs({ apps: false, sidebar: true })
    }
  }

  const toggleApps = () => {
    if (is.apps) {
      setIs({ sidebar: !is.sidebar })

    }
    else {
      setIs({ apps: true, sidebar: true })
    }
  }

  useEffect(() => {
    fetch("/metadata.json")
      .then((response) => response.json())
      .then((data) => {
        console.log(data)
        setMetadata(data)
      });
  }, []);

  return (
    <VStack role="toolbar"
      as="aside"
      hideBelow={is.toolbar ? "base" : "md"}
      className={classnames(styles.sider, 'flex-c-sb flex-column')}
      data-testid="LeftSideBar">

      <div className={classnames(styles.tool, 'flex-c-sb flex-column')} data-testid="BottomLeftSideBar">
        <Option type={options.general.theme}
          onClick={() => setGeneral({ theme: options.general.theme === 'light' ? 'dark' : 'light' })}
          tooltip={t("Theme")}
          dataTestId="OptionDarkModeSelect" />
        <Option dataTestId="OpenConfigBtn" type="config" onClick={() => setState({ is: { ...is, config: !is.config } })} tooltip={t("Config")} />
        <Option type={`${is.fullScreen ? 'min' : 'full'}-screen`} onClick={() => setState({ is: { ...is, fullScreen: !is.fullScreen } })}
          tooltip={`${is.fullScreen ? t('Minimize') : t('Maximize')}`} />
      </div>
      <Spacer />
      <div className={classnames(styles.tool, 'flex-c-sb flex-column')}>
        <DialogRoot open={!options.account.terms || open}
          onOpenChange={(e) => setOpen(e.open)} size="lg">
          <DialogTrigger asChild>
            <IconButton aria-label={t("about")} variant="ghost" data-testid="aboutBtn">
              <Tooltip content={t("about")}>
                {ICONS["help"]()}
              </Tooltip>
            </IconButton>
          </DialogTrigger>
          <DialogContent data-testid="InformationWindow">
            <DialogHeader>
              <DialogTitle>{t('About')}</DialogTitle>
              {options.account.terms ? <DialogCloseTrigger /> : null}
            </DialogHeader>
            <DialogBody>
              {metadata.release ? (<Text>Version: <Link target="blank" href={"https://github.com/fhswf/openai-ui/releases/tag/v" + metadata?.release}>{metadata?.release}</Link> (
                <Link target="blank" href={"https://github.com/fhswf/openai-ui/commit/" + metadata?.build_sha}>commit {String(metadata?.build_sha).substring(0, 7)}</Link>)</Text>) : null}
              <Markdown
                className="z-ui-markdown"
                remarkPlugins={[remarkGfm, remarkMath, smartypants]}
                rehypePlugins={[rehypeKatex]}
              >
                {(text)}
              </Markdown>
            </DialogBody>
            <DialogFooter>
              <Button type="primary" onClick={acceptTerms} data-testid="accept-terms-btn">{t("Accept Terms")}</Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>

      </div>
    </VStack>
  )


}
