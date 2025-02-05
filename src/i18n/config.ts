import i18n from "i18next";
// Bindings for React: allow components to
// re-render when language changes.
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { max } from "cypress/types/lodash";

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
                    hello_world: "Hello, World!",
                    count_messages: "{{count}} messages",
                    chatbot_title: "K!mpuls, the privacy-friendly chatbot of FH Südwestfalen",
                    system_welcome: "Hello, I'm K!mpuls, your university chatbot. How can I help you?",
                    new_conversation: "This is a New Conversation",
                    top_p_help: "Top_p is a parameter that controls the randomness in the model's output by limiting the token pool, specifying that only those tokens with a cumulative probability that adds up to the top_p value can be considered for selection.",
                    temperature_help: "Temperature is a parameter that controls the randomness in the model's output by scaling the logits before applying softmax.",
                    theme_help: "Select a color scheme for the user interface.",
                    language_help: "Select a language for the user interface.",
                    send_help: "Select a button for sending messages.",
                    fontsize_help: "Select the font size of the user interface.",
                    openai_model_help: "Select a model for AI support.",
                    custom_endpoint_desc: "If you don't want to use our proxy server, you can configure a different endpoint, e.g. api.openai.com",
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
                },
            },
            // German
            de: {
                translation: {
                    hello_world: "Hallo, Welt!",
                    chatbot_title: "K!mpuls, der datenschutzfreundliche Chatbot der FH Südwestfalen",
                    system_welcome: "Hallo, ich bin K!mpuls, Dein FH-Chatbot. Wie kann ich Dir helfen?",
                    "copy": "Kopieren",
                    "Enter something....": "Geben Sie etwas ein …",
                    "Remove Messages": "Nachrichten entfernen",
                    "Remove Message": "Nachricht entfernen",
                    "Search...": "Suche …",
                    count_messages_one: "Eine Nachricht",
                    count_messages_other: "{{count}} Nachrichten",
                    new_conversation: "Dies ist ein neues Gespräch",
                    "New Conversation": "Neues Gespräch",
                    "Start a new conversation to begin storing them locally.": "Beginnen Sie ein neues Gespräch. Die Nachrichten werden lokal gespeichert.",
                    theme_help: "Wählen Sie ein Farbschema für die Benutzeroberfläche aus.",
                    language_help: "Wählen Sie eine Sprache für die Benutzeroberfläche aus.",
                    send_help: "Wählen Sie eine Taste für das Senden von Nachrichten aus.",
                    fontsize: "Schriftgröße",
                    fontsize_help: "Wählen Sie die Schriftgröße der Benutzeroberfläche aus.",
                    openai_model_help: "Wählen Sie ein Modell für die KI-Unterstützung aus.",
                    custom_endpoint_desc: "Wenn Sie unseren Proxy-Server nicht verwenden möchten, können Sie einen anderen Endpunkt konfigurieren, z.B. api.openai.com",
                    about: "Infos",
                    chat_settings: "Chat-Einstellungen",
                    clear_thread: "Unterhaltung löschen",
                    reload_thread: "Unterhaltung neu laden",
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
                    help_code_editor: "Aktivieren Sie den Code-Editor für die Bearbeitung von Skripten, etwa für einen Python-Tutor.",
                    tools: "Werkzeuge",
                    tool_retrieval: "Informationssuche",
                    tool_code_interpreter: "Code-Interpreter",
                    help_delete_file: "Löschen Sie die Datei aus dem Chatbot.",
                    send: "Senden",
                    clear: "Löschen",
                    description: "Beschreibung",
                    help_description: "Geben Sie eine Beschreibung des Chatbots ein.",
                    help_gravatar: "Falls Sie bei Gravatar registriert sind, aktivieren Sie diese Option, um Ihr Profilbild anzuzeigen. Gravatar ist ein Dienst, der Ihr Profilbild anhand Ihrer E-Mail-Adresse erkennt. <strong>Achtung</strong>: Ihre IP-Adresse wird an Gravatar übertragen.",
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
                    top_p_help: "Top_p ist ein Parameter, der die Zufälligkeit in der Ausgabe des Modells steuert, indem der Token-Pool begrenzt wird und festgelegt wird, dass nur diejenigen Token mit einer kumulativen Wahrscheinlichkeit, die sich auf den top_p-Wert addiert, für die Auswahl in Betracht gezogen werden können.",
                    temperature: "Temperatur",
                    temperature_help: "Die Temperatur ist ein Parameter, der die Zufälligkeit in der Ausgabe des Modells steuert, indem die Logits skaliert werden, bevor die Softmax-Funktion angewendet wird. Eine höhere Temperatur führt zu zufälligeren Ausgaben.",
                    api_base_url: "API-Basis-URL",
                    api_base_url_help: "Hier können Sie eine eigene API-Basis-URL eingeben.",
                    api_key: "API-Schlüssel",
                    api_key_help: "Hier können Sie einen eigenen API-Schlüssel eingeben.",
                    organization_id: "Organisations-ID",
                    organization_id_help: "Hier können Sie eine eigene Organisations-ID eingeben.",
                },
            },
        },
    });

export default i18n;