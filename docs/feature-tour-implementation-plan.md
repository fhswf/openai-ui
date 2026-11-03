# Implementierungsplan: Interaktive Feature-Tour

## Ziel

Die Anwendung bietet eine jederzeit erreichbare Sammlung kurzer, interaktiver Anleitungen. Nutzer können ein Feature gezielt auswählen und sich die dazugehörigen Schritte direkt an der Oberfläche zeigen lassen. Neue oder wesentlich geänderte Anleitungen werden nach einem Update dezent hervorgehoben.

Der Fortschritt wird lokal im Browser gespeichert. Es werden dafür keine Chat-Inhalte, Einstellungen oder personenbezogenen Daten erfasst.

## Nutzerablauf

1. Ein Eintrag **Hilfe & Touren** ist auf Desktop und Mobilgeräten erreichbar.
2. Das Menü zeigt alle verfügbaren Anleitungen. Neue Inhalte tragen ein **Neu**-Abzeichen; bereits abgeschlossene Anleitungen sind weiterhin jederzeit startbar.
3. Nach einem Update erscheint einmalig ein nicht blockierender Hinweis auf neue Anleitungen. Die Nutzer können eine Anleitung öffnen oder den Hinweis schließen. Ungesehene Anleitungen bleiben im Menü markiert.
4. Eine Anleitung führt mit Weiter-, Zurück- und Beenden-Aktionen durch die passenden UI-Elemente. Beim Abschluss wird der aktuelle Stand der Anleitung als gesehen gespeichert.

Beim ersten Start wird kein vollständiger Rundgang automatisch geöffnet. Für die erstmalige Einführung des Tour-Menüs kann optional ein eigener einmaliger Hinweis aktiviert werden.

## Feature- und Versionskonfiguration

Jede Anleitung wird als Eintrag in einem zentralen, mit dem Frontend ausgelieferten Registry gepflegt. Es ist keine Laufzeitkonfiguration auf dem Server erforderlich.

Empfohlene Felder:

| Feld | Zweck |
| --- | --- |
| `id` | Dauerhafte, sprachunabhängige Kennung, z. B. `document-search` |
| `revision` | Inhaltliche Version der Anleitung; bei wesentlichen Änderungen erhöhen |
| `announceIn` | App-Version, in der diese Revision neu ist, z. B. `0.60.0` |
| `titleKey`, `descriptionKey` | Übersetzungsschlüssel für Menü und Kurzbeschreibung |
| `steps` | Geordnete Schritte mit Ziel, Textschlüsseln und Platzierung |
| `prepare` (optional) | Aktion, die vor einem Schritt eine Ansicht oder ein Menü öffnet |

Beispiel für die geplante Konfiguration:

```ts
{
  id: "document-search",
  revision: 1,
  announceIn: "0.60.0",
  titleKey: "tour.documentSearch.title",
  descriptionKey: "tour.documentSearch.description",
  steps: [
    {
      target: "document-search-menu",
      titleKey: "tour.documentSearch.step1.title",
      bodyKey: "tour.documentSearch.step1.body",
      placement: "bottom",
    },
  ],
}
```

**Pflegeregeln:**

- Eine bestehende `id` bleibt stabil. Ein neues Feature bekommt eine neue ID.
- Eine wesentlich überarbeitete Anleitung erhält eine höhere `revision` und das passende `announceIn`. Dadurch kann sie auch Nutzern, die eine ältere Revision gesehen haben, erneut angeboten werden.
- `announceIn` wird an die veröffentlichte App-Version gebunden. Die Versionsquelle soll die vorhandenen Release-Metadaten verwenden; für lokale Entwicklung dient die Paketversion oder ein Build-Kennzeichen als Rückfallwert.
- Texte liegen in der vorhandenen i18n-Konfiguration und werden mindestens auf Deutsch und Englisch gepflegt.
- Tour-Ziele verwenden stabile Attribute wie `data-tour="document-search-menu"`. Übersetzte UI-Texte und CSS-Klassennamen werden nicht als Selektoren verwendet.

## Speicherung und Update-Erkennung

Der Fortschritt liegt unter einem eigenen `localStorage`-Schlüssel, unabhängig von Chat-Verlauf und Einstellungen, zum Beispiel `openai-ui:feature-tour:v1`.

```json
{
  "schemaVersion": 1,
  "lastKnownBuild": "0.59.0",
  "seen": {
    "document-search": 1,
    "chat-history-search": 2
  }
}
```

Beim Start wird die zuletzt bekannte App-Version mit der aktuellen Version verglichen. Für den Update-Hinweis werden Anleitungen berücksichtigt, deren `announceIn` im übersprungenen Versionsbereich liegt und deren aktuelle Revision noch nicht gesehen wurde. Der aktuelle Build wird anschließend gespeichert, damit derselbe Hinweis nicht bei jedem Laden erneut erscheint. Eine verschobene oder geschlossene Ankündigung lässt das **Neu**-Abzeichen im Tour-Menü bestehen.

Beim ersten Besuch ohne gespeicherten Tour-Stand zeigt das Menü alle Anleitungen an; optional kann dabei der oben beschriebene einmalige Einführungshinweis erscheinen. Fehler beim Lesen oder Schreiben von `localStorage` dürfen die Chat-Anwendung nicht blockieren; in diesem Fall funktioniert die Tour für die aktuelle Sitzung ohne dauerhafte Fortschrittsspeicherung.

Der Fortschritt gilt pro Browserprofil und App-Origin. Er wird nicht mit anderen Geräten synchronisiert. Beim Löschen der Websitedaten wird er zurückgesetzt.

## Geplante Bausteine

Vorgeschlagene Struktur:

```text
src/chat/tours/
  guideRegistry.ts       # Anleitungen, Schritte, Revisionen und Release-Zuordnung
  progressStore.ts       # Laden, Validieren und Speichern des Browserfortschritts
  FeatureTourProvider.tsx
  FeatureTourOverlay.tsx # Positionierung, Fokus, Tastatur- und Schrittsteuerung
  FeatureTourMenu.tsx    # Liste, Neu-Markierungen und Startaktionen
```

- Den Provider innerhalb der bestehenden Chat-Provider-Hierarchie einhängen, sodass er Header, Seitenleiste und Chat-Inhalt steuern kann.
- Das Tour-Menü in den vorhandenen Info-/Hilfebereich integrieren und auch mobil erreichbar machen.
- Für Overlay und Portal zuerst die vorhandenen Chakra-Komponenten nutzen. Eine zusätzliche Tour-Bibliothek nur einführen, falls Positionierung oder Barrierefreiheit mit den vorhandenen Komponenten nicht zuverlässig abbildbar sind.
- Über `prepare` kann ein Schritt beispielsweise ein Menü öffnen, bevor er dessen Eintrag hervorhebt. Nach Beenden oder Abschluss werden temporär geöffnete Tour-Ansichten bereinigt.
- Tastaturbedienung, sichtbarer Fokus, Escape zum Beenden, Screenreader-Beschriftungen, Theme-Kontrast, kleine Viewports und reduzierte Animationen berücksichtigen.

## Erste Anleitungen

Für die erste Version bieten sich diese einzeln startbaren Rundgänge an:

1. Chatverlauf durchsuchen und eine Unterhaltung fortsetzen
2. Dokumentensuche nutzen und Quellenangaben öffnen
3. Eigene GPT-Profile anlegen und auswählen
4. MCP-Dienste aktivieren und Genehmigungsanfragen verstehen
5. Verschlüsselte, geräteübergreifende Chatspeicherung einrichten

Die Inhalte sollen kurze, konkrete Schritte zeigen und keine echte Nachricht senden oder dauerhafte Nutzereinstellungen ändern. Wo ein Feature eine Aktion zur Demonstration benötigt, werden sichere Demo-Daten und ein klarer Abbruchpfad verwendet.

## Arbeitspakete

1. Registry- und Fortschrittsformat, Release-Erkennung und Verhalten bei leerem/ungültigem Speicher festlegen.
2. Tour-Provider und barrierearme Schrittanzeige erstellen; stabile `data-tour`-Anker an den benötigten Komponenten ergänzen.
3. Hilfe-/Tour-Menü mit Statusanzeige und Startaktionen integrieren.
4. Update-Hinweis und optionale Erststart-Ankündigung ergänzen.
5. Erste Anleitungen sowie deutsche und englische Übersetzungen hinzufügen.
6. Fortschrittsspeicherung, erneute Ankündigung bei geänderter Revision, Menüstart und mobile Bedienung prüfen.

## Akzeptanzkriterien

- Jede Anleitung kann jederzeit über das Tour-Menü gestartet werden.
- Eine abgeschlossene Revision wird nach Neuladen weiterhin als gesehen angezeigt.
- Eine neue Feature-ID oder erhöhte Revision wird als neu erkannt.
- Ein Update-Hinweis erscheint höchstens einmal pro Build; ungesehene Anleitungen bleiben im Menü markiert.
- Abbrechen zählt nicht als Abschluss.
- Touren funktionieren mit Tastatur und auf schmalen Viewports; fehlende Ziele führen zu einer verständlichen Möglichkeit, den Rundgang zu beenden.
- Fehlerhafte oder deaktivierte Browser-Speicherung beeinträchtigt die Chat-Nutzung nicht.

## Anschluss an den aktuellen Code

- Der Einstieg in die Seitenleisten-Information liegt in [ChatSideBarOverlays.tsx](../src/chat/ChatSideBarOverlays.tsx).
- Die Header-Aktionen und der mobile Aktionsbereich liegen in [MessageHeader.tsx](../src/chat/MessageHeader.tsx).
- App- und Provider-Aufbau liegen in [ChatApp.tsx](../src/chat/ChatApp.tsx).
- Deutsche und englische UI-Texte werden in [src/i18n/config.ts](../src/i18n/config.ts) gepflegt.
- Release-Anzeige und Build-Metadaten werden bereits im Info-Bereich verarbeitet; daran kann die Update-Erkennung anschließen.
