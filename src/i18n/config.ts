import i18n from "i18next";
// Bindings for React: allow components to
// re-render when language changes.
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  // Add React bindings as a plugin.
  .use(initReactI18next)
  // Initialize the i18next instance.
  .init({
    // Config options

    // Fallback locale used when a translation is
    // missing in the active locale. Again, use your
    // preferred locale here.
    fallbackLng: "en",

    // Enables useful output in the browser’s
    // dev console.
    debug: true,

    // Normally, we want `escapeValue: true` as it
    // ensures that i18next escapes any code in
    // translation messages, safeguarding against
    // XSS (cross-site scripting) attacks. However,
    // React does this escaping itself, so we turn
    // it off in i18next.
    interpolation: {
      escapeValue: false,
    },

    // Translation messages. Add any languages
    // you want here.
    resources: {
      // English
      en: {
        // `translation` is the default namespace.
        // More details about namespaces shortly.
        translation: {
          user_not_allowed: `
# No Access

Access to the chat is only available to members of FH SWF. If you are a member, please log in with your university credentials.
`,
          hello_world: "Hello, World!",
          count_messages: "{{count}} messages",
          chatbot_title:
            "K!mpuls, the privacy-friendly chatbot of FH Südwestfalen",
          system_welcome:
            "Hello, I'm K!mpuls, your university chatbot. How can I help you?",
          new_conversation: "This is a New Conversation",
          top_p_help:
            "Top_p is a parameter that controls the randomness in the model's output by limiting the token pool, specifying that only those tokens with a cumulative probability that adds up to the top_p value can be considered for selection.",
          temperature_help:
            "Temperature is a parameter that controls the randomness in the model's output by scaling the logits before applying softmax.",
          theme_help: "Select a color scheme for the user interface.",
          language_help: "Select a language for the user interface.",
          send_help: "Select a button for sending messages.",
          fontsize_help: "Select the font size of the user interface.",
          openai_model_help: "Select a model for AI support.",
          custom_endpoint_desc:
            "If you don't want to use our proxy server, you can configure a different endpoint, e.g. api.openai.com",
          chat_settings: "Chat Settings",
          clear_thread: "Clear Conversation",
          reload_thread: "Reload Conversation",
          general: "General",
          files: "Files",
          name: "Name",
          instructions: "Instructions",
          help_name: "Give the chatbot a name.",
          help_instructions: "Give the chatbot instructions.",
          help: "Help",
          save: "Save",
          cancel: "Cancel",
          title: "Title",
          "Enter something....": "Enter something....",
          "Code Editor": "Code Editor",
          clear: "Clear",
          send: "Send",
          COMMAND_ENTER: "Ctrl + Enter",
          Always: "Always",
          Never: "Never",
          show_toolbar: "Show Toolbar",
          chat_options: "Chat Options",
          model_options: "Model Options",
          tool_options: "Tool Options",
          "MCP Services": "MCP Services",
          "Add/Remove MCP Services": "Add/Remove MCP Services",
          "Edit MCP Services": "Edit MCP Services",
          Label: "Label",
          "Server URL": "Server URL",
          "Require Approval": "Require Approval",
          "Allowed Tools": "Allowed Tools",
          "Comma separated": "Comma separated",
          "Add/Save Service": "Add/Save Service",
          new_chat: "New Chat",
          download_thread: "Download Thread",
          download_json: "Download JSON",
          download_markdown: "Download Markdown",
          download_obsidian: "Download to Obsidian",
          open_obsidian: "Open in Obsidian",
          usage_information: "Usage Information",
          "User information": "User Information",
          chat_history: "Chat History",
          close: "Close",
          empty_chat: "Empty Chat",
          delete_chat: "Delete Chat",
          open_issue: "Open Issue",
          release_notes: "Release Notes",
          Theme: "Theme",
          Config: "Config",
          Minimize: "Minimize",
          about: "About",
          About: "About",
          "Accept Terms": "Accept Terms",
          "Remove Message": "Remove Message",
          chatbot_description:
            "K!mpuls is the privacy-friendly access of the South Westphalia University of Applied Sciences to OpenAI's language models.",
          chat_mode_desc:
            "In chat mode, you can chat with the chatbot. In this mode, you can select the language model used. The chatbot can help you answer questions and solve problems, but it cannot access tools or external APIs.",
          assistant_mode_desc:
            "In assistant mode, you can use the chatbot as an assistant. Currently, only a limited number of pre-configured assistants are available.",
          function_call: "Function Call",
          function_call_description: "A function call was executed.",
          function_call_title: "Function Call",
          "Tool Usage Details": "Tool Usage Details",
          image_generation_call_title: "Image Generation",
        },
      }, // German
      de: {
        translation: {
          user_not_allowed: `
# Kein Zugriff

Der Zugriff auf den Chat ist nur für **Mitglieder der FH SWF** möglich. 
Wenn du ein Mitglied bist, melde dich bitte mit Deiner **Hochschulkennung** an.
`,
          hello_world: "Hallo, Welt!",
          chatbot_title: "K!mpuls",
          chatbot_description:
            "K!mpuls ist der datenschutzfreundliche Zugang der Fachhochschule Südwestfalen zu den Sprachmodellen von OpenAI.",
          system_welcome:
            "Hallo, ich bin K!mpuls, Dein FH-Chatbot. Wie kann ich Dir helfen?",
          copy: "Kopieren",
          "Enter something....": "Gib Deine Frage ein …",
          "Remove Messages": "Nachrichten entfernen",
          "Remove Message": "Nachricht entfernen",
          "Search...": "Suche …",
          count_messages_one: "Eine Nachricht",
          count_messages_other: "{{count}} Nachrichten",
          new_conversation: "Dies ist ein neues Gespräch",
          "New Conversation": "Neues Gespräch",
          "Start a new conversation to begin storing them locally.":
            "Beginnen Sie ein neues Gespräch. Die Nachrichten werden lokal gespeichert.",
          theme_help:
            "Wählen Sie ein Farbschema für die Benutzeroberfläche aus.",
          language_help:
            "Wählen Sie eine Sprache für die Benutzeroberfläche aus.",
          send_help:
            "Wählen Sie eine Taste für das Senden von Nachrichten aus.",
          fontsize: "Schriftgröße",
          fontsize_help:
            "Wählen Sie die Schriftgröße der Benutzeroberfläche aus.",
          openai_model_help:
            "Wählen Sie ein Modell für die KI-Unterstützung aus.",
          custom_endpoint_desc:
            "Wenn Sie unseren Proxy-Server nicht verwenden möchten, können Sie einen anderen Endpunkt konfigurieren, z.B. api.openai.com",
          about: "Infos",
          chat_settings: "Chat-Einstellungen",
          clear_thread: "Chat löschen",
          reload_thread: "Unterhaltung neu laden",
          new_chat: "Neuer Chat",
          delete_chat: "Chat löschen",
          clear_chat: "Chat löschen",
          delete_message: "Nachricht löschen",
          delete_conversation: "Unterhaltung löschen",
          empty_chat: "Noch keine Nachrichten",
          more_actions: "Mehr Aktionen",
          chat_history: "Chat-Verlauf",
          general: "Allgemein",
          files: "Dateien",
          name: "Name",
          help_name: "Dies ist der interne Name des Chatbots",
          instructions: "Anweisungen",
          help_instructions: "Dies sind Arbeitsanweisungen für den Chatbot.",
          help: "Hilfe",
          save: "Speichern",
          cancel: "Abbrechen",
          title: "Titel",
          help_title: "Dieser Titel wird in der Chat-Überschrift angezeigt.",
          code_editor: "Code-Editor",
          help_code_editor:
            "Aktivieren Sie den Code-Editor für die Bearbeitung von Skripten, etwa für einen Python-Tutor.",
          tools: "Werkzeuge",
          tool_retrieval: "Informationssuche",
          tool_code_interpreter: "Code-Interpreter",
          help_delete_file: "Löschen Sie die Datei aus dem Chatbot.",
          send: "Senden",
          clear: "Löschen",
          description: "Beschreibung",
          help_description: "Geben Sie eine Beschreibung des Chatbots ein.",
          help_gravatar:
            "Falls Sie bei Gravatar registriert sind, aktivieren Sie diese Option, um Ihr Profilbild anzuzeigen. Gravatar ist ein Dienst, der Ihr Profilbild anhand Ihrer E-Mail-Adresse erkennt. <strong>Achtung</strong>: Ihre IP-Adresse wird an Gravatar übertragen.",
          gravatar: "Gravatar",
          open_issue: "Melde einen Verbesserungswunsch",
          theme_style: "Farbschema",
          language: "Sprache",

          api_mode: "API-Modus",
          api_mode_help: "Wählen Sie den API-Modus aus.",
          assistant: "Assistent",
          assistent_help: "Wählen Sie den Assistenten aus.",
          max_tokens: "Maximale Tokens",
          max_tokens_help: "Wählen Sie die maximale Anzahl von Tokens aus.",
          top_p: "Top_p",
          top_p_help:
            "Top_p ist ein Parameter, der die Zufälligkeit in der Ausgabe des Modells steuert, indem der Token-Pool begrenzt wird und festgelegt wird, dass nur diejenigen Token mit einer kumulativen Wahrscheinlichkeit, die sich auf den top_p-Wert addiert, für die Auswahl in Betracht gezogen werden können.",
          temperature: "Temperatur",
          temperature_help:
            "Die Temperatur ist ein Parameter, der die Zufälligkeit in der Ausgabe des Modells steuert, indem die Logits skaliert werden, bevor die Softmax-Funktion angewendet wird. Eine höhere Temperatur führt zu zufälligeren Ausgaben.",
          api_base_url: "API-Basis-URL",
          api_base_url_help:
            "Hier können Sie eine eigene API-Basis-URL eingeben.",
          api_key: "API-Schlüssel",
          api_key_help: "Hier können Sie einen eigenen API-Schlüssel eingeben.",
          organization_id: "Organisations-ID",
          organization_id_help:
            "Hier können Sie eine eigene Organisations-ID eingeben.",

          About: "Über die Anwendung",
          "User information": "Benutzerinformationen",

          Title: "Titel",
          Cancel: "Abbrechen",
          Save: "Speichern",
          Close: "Schließen",
          close: "Schließen",
          Reset: "Zurücksetzen",
          "Edit Conversation": "Unterhaltung bearbeiten",
          "Edit the title of the conversation.":
            "Bearbeiten Sie den Titel der Unterhaltung.",
          "Accept Terms": "Ich habe diese Hinweise gelesen und verstanden.",
          download_thread: "Unterhaltung herunterladen",

          chat_mode_desc:
            "Im Chat-Modus können Sie mit dem Chatbbot unterhalten. In diesem Modus können Sie das verwendete Sprachmodell auswählen. Der Chatbot kann Ihnen bei der Beantwortung von Fragen und der Lösung von Problemen helfen, allerdings kann er nicht auf Tools oder externe APIs zugreifen.",
          assistant_mode_desc:
            "Im Assistenten-Modus können Sie den Chatbot als Assistenten verwenden. Aktuell steht nur eine eingeschränkte Anzahl von vorkonfigurierten Assistenten zur Verfügung.",
          "Global OpenAI Config": "Globale OpenAI-Einstellungen",
          "Custom API Endpoint": "Benutzerdefinierter API-Endpunkt",

          "An error occurred": "Ein Fehler ist aufgetreten",
          "Try again": "Erneut versuchen",
          "Reset settings": "Einstellungen zurücksetzen",

          COMMAND_ENTER: "Strg + Enter",
          ALT_ENTER: "Alt + Enter",
          ENTER: "Enter",
          Enter: "Enter",
          "Code Editor": "Code-Editor",
          "Please enter Python code.": "Bitte geben Sie Python-Code ein.",

          Apps: "Apps",
          History: "Chat-Verlauf",
          Config: "Einstellungen",
          Minimize: "Minimieren",
          Maximize: "Maximieren",
          Theme: "Farbschema",
          Language: "Sprache",
          hide_toolbar: "Werkzeugleiste ausblenden",
          show_toolbar: "Werkzeugleiste einblenden",
          hide_sidebar: "Seitenleiste ausblenden",
          show_sidebar: "Seitenleiste einblenden",
          chats: "Chats",
          download_json: "als JSON herunterladen",
          download_markdown: "als Markdown herunterladen",
          download_obsidian: "In Obsidian speichern",
          open_obsidian: "In Obsidian öffnen",
          chat_options: "Chat-Optionen",
          tool_options: "Werkzeug-Optionen",
          model_options: "Modell",
          release_notes: "Versionshinweise",
          thinking: "Denke nach...",
          web_search_call: "Web-Suche",
          web_search: "Web-Suche",
          web_search_call_description:
            "Bei dieser Antwort wurde eine Web-Suche durchgeführt.",
          web_search_call_title: "Web-Suche",
          error_occurred: "Ein Fehler ist aufgetreten",
          not_image: "Kein Bild",
          not_image_description: "Sie können nur Bilder hochladen.",

          total_requests: "Gesamtzahl der Aufrufe (fh-swf.de) über die Monate",
          total_requests_title: "Gesamtzahl der Aufrufe",
          requests_breakdown_legend:
            "Aufschlüsselung der Aufrufe nach Bereichen",
          requests_breakdown_title: "Aufschlüsselung der Aufrufe",
          requests_breakdown_label: "# Zugriffe",
          usage_information: "Nutzungsstatistik",
          usage_information_description:
            "Hier finden Sie eine Übersicht über die Nutzung des Chatbots.",
          scope_breakdown_title: "Aufschlüsselung der Zugriffe nach Bereichen",
          role_breakdown_title: "Aufschlüsselung der Zugriffe nach Rollen",

          import_export: "Import/Export",
          import_export_description:
            "Hier können Sie Ihre Konfiguration (inkl. Chat-Historie) importieren oder exportieren.",
          import: "Importieren",
          import_settings: "Einstellungen importieren",
          import_description: "Hier können Sie Ihre Konfiguration importieren.",
          import_settings_help:
            "Hier können Sie Ihre Konfiguration importieren. Bitte beachten Sie, dass alle bestehenden Einstellungen überschrieben werden.",
          import_settings_error:
            "Beim Importieren der Einstellungen ist ein Fehler aufgetreten. Bitte überprüfen Sie die Datei und versuchen Sie es erneut.",
          import_settings_success: "Einstellungen importiert",
          import_settings_success_desc:
            "Die Einstellungen wurden erfolgreich importiert.",
          export: "Exportieren",
          export_settings: "Einstellungen exportieren",
          export_settings_help:
            "Hier können Sie Ihre Konfiguration exportieren.",

          mcp_call: "MCP-Dienst",
          mcp_call_description:
            "Bei dieser Antwort wurde ein MCP-Dienst aufgerufen.",
          mcp_call_title: "Aufgerufene MCP-Tools",
          mcp_list_tools: "MCP-Tools",
          mcp_list_tools_description: "Auflistung der verfügbaren MCP-Dienste.",
          mcp_list_tools_title: "Gefundene MCP-Tools",
          code_interpreter_call: "Code-Interpreter",
          code_interpreter_call_description:
            "Bei dieser Antwort wurde der Code-Interpreter verwendet.",
          code_interpreter_call_title: "Code-Interpreter",
          reasoning: "Reasoning",
          reasoning_description: "Denke über die nächsten Schritte nach.",
          reasoning_title: "Reasoning Schritte",
          Code: "Code",
          Outputs: "Ausgaben",
          "MCP Services": "MCP-Dienste",
          "Edit MCP Services": "MCP-Dienste bearbeiten",
          "Add/Save Service": "Dienst hinzufügen/speichern",
          "Add/Remove MCP Services": "MCP-Dienste hinzufügen/entfernen",
          "Add Service": "Dienst hinzufügen",
          "Save Service": "Dienst speichern",
          Label: "Bezeichnung",
          "Server URL": "Server-URL",
          "Allowed Tools": "Erlaubte Werkzeuge",
          "Comma separated": "Kommagetrennt",
          "Require Approval": "Genehmigung erforderlich",
          Always: "Immer",
          Never: "Niemals",

          image_generation: "Bildgenerierung",
          image_generation_call: "Bildgenerierung",
          image_generation_call_description:
            "Bei dieser Antwort wurde eine Bildgenerierung durchgeführt.",
          image_generation_call_title: "Bildgenerierung",

          opfs_not_supported:
            "Origin Private File System (OPFS) wird von Ihrem Browser nicht unterstützt.",
          opfs_not_supported_desc:
            "OPFS wird von Ihrem Browser nicht unterstützt, Bilder können nicht gespeichert werden. Bitte aktualisieren Sie Ihren Browser, um diese Funktion zu nutzen.",
          upload_file: "Datei hochladen",
          upload_file_desc:
            "Datei hochladen",
          function_call: "Funktionsaufruf",
          function_call_description: "Ein Funktionsaufruf wurde ausgeführt.",
          function_call_title: "Funktionsaufruf",
          "Tool Usage Details": "Details zur Werkzeugnutzung",
        },
      },
    },
  });

export { default } from "i18next";
