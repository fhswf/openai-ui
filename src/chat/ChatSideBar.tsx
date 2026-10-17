import React, { useState } from "react";
import { ChatSideBarView } from "./ChatSideBarOverlays";
import { useChatSideBarState } from "./ChatSideBarHooks";

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
  const {
    acceptTerms,
    is,
    metadata,
    options,
    toggleConfig,
    toggleFullScreen,
    toggleTheme,
  } = useChatSideBarState(onMobileOpenChange, () => setOpen(false));
  const informationWindowOpen = !options.account.terms || open;

  return (
    <ChatSideBarView
      mobileOpen={mobileOpen}
      onMobileOpenChange={onMobileOpenChange}
      aboutOpen={informationWindowOpen}
      acceptedTerms={options.account.terms}
      metadata={metadata}
      termsText={text}
      theme={options.general.theme}
      fullScreen={is.fullScreen}
      onToggleTheme={toggleTheme}
      onToggleConfig={toggleConfig}
      onToggleFullScreen={toggleFullScreen}
      onAboutOpenChange={(nextOpen) => {
        if (options.account.terms) setOpen(nextOpen);
      }}
      onAcceptTerms={acceptTerms}
      onOpenAbout={() => {
        onMobileOpenChange(false);
        setOpen(true);
      }}
    />
  );
}
