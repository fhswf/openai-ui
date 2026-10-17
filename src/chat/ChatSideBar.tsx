import React, { useEffect, useState } from "react";
import { Tooltip } from "../components/ui/tooltip";
import { Button, IconButton, Spacer, VStack } from "@chakra-ui/react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { IoSettingsOutline } from "react-icons/io5";
import { IoApps } from "react-icons/io5";
import { RiChatHistoryLine } from "react-icons/ri";
import { MdOutlineDarkMode } from "react-icons/md";
import { MdOutlineLightMode } from "react-icons/md";
import { TbArrowsMinimize } from "react-icons/tb";
import { TbArrowsMaximize } from "react-icons/tb";
import { LuMonitor } from "react-icons/lu";
import { useGlobal } from "./context";
import { classnames } from "../components/utils";
import { useOptions } from "./hooks";
import { t } from "i18next";
import { MobileSidebarDrawer, SidebarAboutDialog } from "./ChatSideBarOverlays";

import styles from "./style/sider.module.less";
import semver from "semver";

const ICONS = {
  help: IoInformationCircleOutline,
  apps: IoApps,
  history: RiChatHistoryLine,
  config: IoSettingsOutline,
  dark: MdOutlineDarkMode,
  light: MdOutlineLightMode,
  auto: LuMonitor,
  "min-screen": TbArrowsMinimize,
  "full-screen": TbArrowsMaximize,
};

const Option = (props) => {
  const { type, onClick, tooltip, dataTestId, expanded = false } = props;
  const testId = dataTestId ? { "data-testid": dataTestId } : {};
  if (!ICONS[type]) {
    console.error(`Icon ${type} not found`);
    return null;
  }

  const icon = ICONS[type]();
  const control = expanded ? (
    <Button
      width="100%"
      justifyContent="flex-start"
      variant="ghost"
      onClick={onClick}
      aria-label={tooltip}
      {...testId}
    >
      {icon}
      <span>{tooltip}</span>
    </Button>
  ) : (
    <IconButton
      aria-label={tooltip}
      variant={props.variant || "ghost"}
      onClick={onClick}
      {...testId}
    >
      {icon}
    </IconButton>
  );

  return (
    <Tooltip content={tooltip}>
      {control}
    </Tooltip>
  );
};

interface PrimarySidebarOptionsProps {
  expanded: boolean;
  fullScreen: boolean;
  theme: string;
  onToggleConfig: VoidFunction;
  onToggleFullScreen: VoidFunction;
  onToggleTheme: VoidFunction;
}

function PrimarySidebarOptions({
  expanded,
  fullScreen,
  theme,
  onToggleConfig,
  onToggleFullScreen,
  onToggleTheme,
}: PrimarySidebarOptionsProps) {
  return (
    <div
      className={classnames(styles.tool, "flex-c-sb flex-column", {
        [styles["drawer-options"]]: expanded,
      })}
      data-testid={expanded ? "MobileSidebarActions" : "BottomLeftSideBar"}
    >
      <Option
        type={theme}
        onClick={onToggleTheme}
        tooltip={t("Theme")}
        dataTestId="OptionDarkModeSelect"
        expanded={expanded}
      />
      <Option
        dataTestId="OpenConfigBtn"
        type="config"
        onClick={onToggleConfig}
        tooltip={t("Config")}
        expanded={expanded}
      />
      <Option
        type={`${fullScreen ? "min" : "full"}-screen`}
        onClick={onToggleFullScreen}
        tooltip={`${fullScreen ? t("Minimize") : t("Maximize")}`}
        expanded={expanded}
      />
    </div>
  );
}

const text = `
## Datenschutzhinweise

Diese Anwendung ermöglicht den Zugriff auf die Chat-Funktion von
[OpenAI](https://openai.com) (inklusive *gpt-5.6-luna*) **ohne Übertragung von personenbezogenen Daten des Benutzers
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

### MCP-Dienste und Autorisierung

Die Anwendung unterstützt die Anbindung von **MCP-Servern** (Model Context Protocol), die erweiterte
Funktionen wie Raumbuchungen, Terminvereinbarungen oder personalisierte Informationsabfragen ermöglichen.

#### Mögliche Autorisierungsarten

Je nach MCP-Server können unterschiedliche Autorisierungsarten angeboten werden:

- keine zusätzliche Autorisierung
- ein statischer Token, den Sie selbst hinterlegen
- die verschlüsselte Übertragung freigegebener Benutzerdaten

Wenn ein MCP-Server die Option **Benutzerdaten** unterstützt, liest die Anwendung die angeforderten
Bereiche (*Scopes*) automatisch aus der OpenID-Konfiguration des jeweiligen Servers aus und zeigt diese
vor der Freigabe an.

#### Optionale Übertragung von Benutzerdaten

Die Übertragung von Benutzerdaten an einen MCP-Server ist **freiwillig** und erfolgt nur, wenn Sie für
den jeweiligen Dienst die Option **Benutzerdaten** aktivieren und die Einwilligung ausdrücklich erteilen.
Ohne diese Zustimmung werden keine personenbezogenen Daten an diesen MCP-Server übertragen.

Die konkret übertragenen Angaben ergeben sich aus den vom MCP-Server veröffentlichten Scopes. Je nach
Server können dazu insbesondere Name, E-Mail-Adresse, Benutzerkennung, die interne Kennung \`sub\` sowie
Zugehörigkeiten und Rollen an der Hochschule gehören.

#### Verschlüsselung der Benutzerdaten

Freigegebene Benutzerdaten werden vor der Übertragung verschlüsselt. Dies bedeutet:

- Die Anwendung verschlüsselt die Daten lokal im Browser vor dem Versand.
- Der benötigte öffentliche Schlüssel wird über die OpenID-/JWKS-Endpunkte des jeweiligen MCP-Servers geladen.
- Nur der MCP-Server mit dem passenden privaten Schlüssel kann die Daten entschlüsseln.
- OpenAI oder unbefugte Dritte können die verschlüsselten Daten **nicht** lesen.

Werden keine Scopes bereitgestellt oder keine Einwilligung erteilt, erzeugt die Anwendung kein Token mit
Benutzerdaten.

#### Widerruf der Einwilligung

Sie können Ihre Einwilligung zur Datenübertragung **jederzeit widerrufen**, indem Sie die
Autorisierungseinstellungen des jeweiligen MCP-Dienstes erneut öffnen und entweder die Option **Keine**
auswählen oder die Einwilligung für **Benutzerdaten** wieder deaktivieren.

Nach dem Widerruf werden bei zukünftigen Anfragen keine personenbezogenen Daten mehr an den betreffenden
MCP-Server übertragen.
### Cookies
Die Anwendung verwendet lediglich technisch notwendige Session-Cookies, um die Funktionalität der 
Anwendung zu gewährleisten (Anmeldung an der Anwendung).

## Quellcode
Der Quellcode der Anwendung ist auf GitHub in folgenden Repositories verfügbar:

- Chat-Client: [github.com/fhswf/openai-ui](https://github.com/fhswf/openai-ui)
- Proxy-Server: [github.com/fhswf/openai-proxy](https://github.com/fhswf/openai-proxy)
`;

interface ChatSideBarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function ChatSideBar({
  mobileOpen,
  onMobileOpenChange,
}: ChatSideBarProps) {
  const [open, setOpen] = useState(false);
  const [metadata, setMetadata] = useState<{
    release?: string;
    build_sha?: string;
  }>({});
  const { is, setState, options, version, release } = useGlobal();
  const { setGeneral, setAccount } = useOptions();
  const informationWindowOpen = !options.account.terms || open;

  const acceptTerms = () => {
    setOpen(false);
    setAccount({ terms: true });
  };

  const toggleTheme = () => {
    const currentTheme =
      document.documentElement.dataset.theme ?? options.general.theme;
    setGeneral({
      theme: currentTheme === "light" ? "dark" : "light",
    });
    onMobileOpenChange(false);
  };

  const toggleConfig = () => {
    setState({ is: { ...is, config: !is.config } });
    onMobileOpenChange(false);
  };

  const toggleFullScreen = () => {
    setState({ is: { ...is, fullScreen: !is.fullScreen } });
    onMobileOpenChange(false);
  };

  useEffect(() => {
    fetch("/metadata.json", { cache: "no-cache" })
      .then((response) => response.json())
      .then((data) => {
        console.log(data);
        setMetadata(data);
        if (semver.gt(data.release, version) || !release) {
          console.log("New release: %s", data.release);
          setState({ version: data.release });
          fetch(`${data.repo_url}/releases/tags/openai-ui-v${data.release}`)
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
    <>
      <VStack
        role="toolbar"
        className={classnames(styles.sider, "flex-c-sb flex-column")}
        data-testid="LeftSideBar"
      >
        <PrimarySidebarOptions
          expanded={false}
          theme={options.general.theme}
          fullScreen={is.fullScreen}
          onToggleTheme={toggleTheme}
          onToggleConfig={toggleConfig}
          onToggleFullScreen={toggleFullScreen}
        />
        <Spacer />
        <div className={classnames(styles.tool, "flex-c-sb flex-column")}>
          <SidebarAboutDialog
            open={informationWindowOpen}
            acceptedTerms={options.account.terms}
            metadata={metadata}
            termsText={text}
            onOpenChange={(nextOpen) => {
              if (options.account.terms) setOpen(nextOpen);
            }}
            onAcceptTerms={acceptTerms}
          />
        </div>
      </VStack>

      <MobileSidebarDrawer
        mobileOpen={mobileOpen}
        onMobileOpenChange={onMobileOpenChange}
        onOpenAbout={() => {
          onMobileOpenChange(false);
          setOpen(true);
        }}
        actions={
          <PrimarySidebarOptions
            expanded
            theme={options.general.theme}
            fullScreen={is.fullScreen}
            onToggleTheme={toggleTheme}
            onToggleConfig={toggleConfig}
            onToggleFullScreen={toggleFullScreen}
          />
        }
      />
    </>
  );
}
