import React, { useEffect, useState } from "react";
import { Tooltip } from "../components/ui/tooltip";

import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Button,
  IconButton,
  Link,
  Spacer,
  Text,
  VStack,
} from "@chakra-ui/react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { IoSettingsOutline } from "react-icons/io5";
import { IoApps } from "react-icons/io5";
import { RiChatHistoryLine } from "react-icons/ri";
import { MdOutlineDarkMode } from "react-icons/md";
import { MdOutlineLightMode } from "react-icons/md";
import { TbArrowsMinimize } from "react-icons/tb";
import { TbArrowsMaximize } from "react-icons/tb";
import { useGlobal } from "./context";
import { classnames } from "../components/utils";
import { useOptions } from "./hooks";
import { t } from "i18next";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import smartypants from "remark-smartypants";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";

import styles from "./style/sider.module.less";
import "katex/dist/katex.min.css";
import semver from "semver";

const ICONS = {
  help: IoInformationCircleOutline,
  apps: IoApps,
  history: RiChatHistoryLine,
  config: IoSettingsOutline,
  dark: MdOutlineDarkMode,
  light: MdOutlineLightMode,
  "min-screen": TbArrowsMinimize,
  "full-screen": TbArrowsMaximize,
};

const Option = (props) => {
  const { type, onClick, tooltip, dataTestId } = props;
  const testId = dataTestId ? { "data-testid": dataTestId } : {};
  if (!ICONS[type]) {
    console.error(`Icon ${type} not found`);
    return null;
  }
  return (
    <Tooltip content={tooltip}>
      <IconButton
        aria-label={tooltip}
        variant={props.variant || "ghost"}
        onClick={onClick}
        {...testId}
      >
        {ICONS[type]()}
      </IconButton>
    </Tooltip>
  );
};

const text = `
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

### MCP-Dienste und Benutzerdatenübertragung

Die Anwendung unterstützt die Anbindung von **MCP-Servern** (Model Context Protocol), die erweiterte 
Funktionen wie Raumbuchungen, Terminvereinbarungen oder personalisierte Informationsabfragen ermöglichen.

#### Optionale Datenübertragung

Die Übertragung von Benutzerdaten an MCP-Server ist **freiwillig** und erfolgt nur nach 
**ausdrücklicher Einwilligung** des Nutzers. Ohne Ihre Zustimmung werden keine personenbezogenen 
Daten an MCP-Server übertragen.

Sie können individuell auswählen, welche der folgenden Daten übertragen werden sollen:

- Ihr vollständiger Name
- Ihre Hochschul-E-Mail-Adresse
- Ihre Benutzerkennung
- Ihre eindeutige Benutzer-ID
- Ihre Zugehörigkeiten und Rollen an der Hochschule

#### Ende-zu-Ende-Verschlüsselung

Übertragene Benutzerdaten werden **Ende-zu-Ende verschlüsselt**. Dies bedeutet:

- Die Daten werden vor der Übertragung verschlüsselt
- **Nur autorisierte MCP-Server der FH Südwestfalen** können die Daten entschlüsseln
- OpenAI, andere LLM-Anbieter oder unbefugte Dritte können die verschlüsselten Daten **nicht** lesen
- Die Verschlüsselung erfolgt mit einem öffentlichen Schlüssel, der nur den autorisierten MCP-Servern der FH bekannt ist

#### Widerruf der Einwilligung

Sie können Ihre Einwilligung zur Datenübertragung **jederzeit widerrufen**, indem Sie:

1. Die Autorisierungseinstellungen des jeweiligen MCP-Dienstes aufrufen
2. Die Option "Keine" auswählen oder die gewünschten Felder abwählen
3. Die Änderungen speichern

Nach dem Widerruf werden bei zukünftigen Anfragen keine personenbezogenen Daten mehr an den 
betreffenden MCP-Server übertragen.
### Cookies
Die Anwendung verwendet lediglich technisch notwendige Session-Cookies, um die Funktionalität der 
Anwendung zu gewährleisten (Anmeldung an der Anwendung).

## Quellcode
Der Quellcode der Anwendung ist auf GitHub in folgenden Repositories verfügbar:

- Chat-Client: [github.com/fhswf/openai-ui](https://github.com/fhswf/openai-ui)
- Proxy-Server: [github.com/fhswf/openai-proxy](https://github.com/fhswf/openai-proxy)
`;

export function ChatSideBar() {
  const [open, setOpen] = useState(false);
  const [metadata, setMetadata] = useState({});
  const [newRelease, setNewRelease] = useState(false);
  const { is, setState, options, version, release } = useGlobal();
  const { setGeneral, setAccount } = useOptions();

  const acceptTerms = () => {
    setAccount({ terms: true });
    setOpen(false);
  };

  useEffect(() => {
    fetch("/metadata.json", { cache: "no-cache" })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        setMetadata(data);
        if (semver.gt(data.release, version) || !release) {
          console.log("New release: %s", data.release);
          setNewRelease(true);
          setState({ version: data.release });
          fetch(`${data.repo_url}/releases/tags/v${data.release}`)
            .then((response) => response.json())
            .then((data) => {
              console.log("release data: %j", data);
              setState({ release: data });
            })
            .catch((error) => {
              console.error("Error fetching release data: %s", error);
            });
        }
      });
  }, [version]);

  return (
    <VStack
      role="toolbar"
      as="aside"
      hideBelow={is.toolbar ? "base" : "md"}
      className={classnames(styles.sider, "flex-c-sb flex-column")}
      data-testid="LeftSideBar"
    >
      <div
        className={classnames(styles.tool, "flex-c-sb flex-column")}
        data-testid="BottomLeftSideBar"
      >
        <Option
          type={options.general.theme}
          onClick={() =>
            setGeneral({
              theme: options.general.theme === "light" ? "dark" : "light",
            })
          }
          tooltip={t("Theme")}
          dataTestId="OptionDarkModeSelect"
        />
        <Option
          dataTestId="OpenConfigBtn"
          type="config"
          onClick={() => setState({ is: { ...is, config: !is.config } })}
          tooltip={t("Config")}
        />
        <Option
          type={`${is.fullScreen ? "min" : "full"}-screen`}
          onClick={() =>
            setState({ is: { ...is, fullScreen: !is.fullScreen } })
          }
          tooltip={`${is.fullScreen ? t("Minimize") : t("Maximize")}`}
        />
      </div>
      <Spacer />
      <div className={classnames(styles.tool, "flex-c-sb flex-column")}>
        <DialogRoot
          open={!options.account.terms || open}
          onOpenChange={(e) => setOpen(e.open)}
          size="lg"
        >
          <DialogTrigger asChild>
            <IconButton
              aria-label={t("about")}
              variant="ghost"
              data-testid="aboutBtn"
            >
              <Tooltip content={t("about")}>{ICONS["help"]()}</Tooltip>
            </IconButton>
          </DialogTrigger>
          <DialogContent data-testid="InformationWindow">
            <DialogHeader>
              <DialogTitle>{t("About")}</DialogTitle>
              {options.account.terms ? <DialogCloseTrigger /> : null}
            </DialogHeader>
            <DialogBody className="z-ui-markdown">
              {metadata.release ? (
                <Text>
                  Version:{" "}
                  <Link
                    target="blank"
                    href={
                      "https://github.com/fhswf/openai-ui/releases/tag/v" +
                      metadata?.release
                    }
                  >
                    {metadata?.release}
                  </Link>{" "}
                  (
                  <Link
                    target="blank"
                    href={
                      "https://github.com/fhswf/openai-ui/commit/" +
                      metadata?.build_sha
                    }
                  >
                    commit {String(metadata?.build_sha).substring(0, 7)}
                  </Link>
                  )
                </Text>
              ) : null}
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath, smartypants]}
                rehypePlugins={[rehypeKatex]}
              >
                {text}
              </Markdown>
            </DialogBody>
            <DialogFooter>
              <Button
                type="primary"
                onClick={acceptTerms}
                data-testid="accept-terms-btn"
              >
                {t("Accept Terms")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      </div>
    </VStack>
  );
}
