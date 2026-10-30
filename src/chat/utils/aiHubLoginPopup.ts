import { aiHubBaseUrl, fetchAiHubLoginUrl } from "../service/aiHub";

const popupName = "ai-hub-login";
const popupFeatures = "popup,width=520,height=720";

/**
 * Opens an empty popup for the AI-Hub login. Browsers only allow popups
 * shortly after a user click, so call this before awaiting anything else.
 * Returns null when the browser blocked the popup.
 */
export function openAiHubLoginPopup(): Window | null {
  const popup = window.open("", popupName, popupFeatures);
  if (popup) {
    // The login pages do not need access to the chat window.
    popup.opener = null;
  }
  return popup;
}

/**
 * Sends the popup to the Keycloak login of the hub. Falls back to the hub
 * start page, which offers its own login button.
 */
export async function navigateAiHubLoginPopup(popup: Window) {
  try {
    popup.location.href = await fetchAiHubLoginUrl();
  } catch (error) {
    console.warn("Unable to load the AI-Hub login URL:", error);
    popup.location.href = aiHubBaseUrl;
  }
}
