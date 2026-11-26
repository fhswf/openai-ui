import type { Meta, StoryObj } from "@storybook/react";
import { useEffect } from "react";
import { Provider } from "../components/ui/provider";
import "../i18n/config";
import {
  ChatShareDialogView,
  type ShareDialogViewProps,
} from "./ChatShareDialogView";

const sampleRoster = {
  id: "contrast-check-roster",
  name: "Test",
  members: [],
};

const actions: ShareDialogViewProps["actions"] = {
  shareChatWithUser: async () => {},
  createChatShareLink: async () => ({
    url: "https://example.org/share",
    token: "contrast-check-token",
    expiresAt: "2030-01-01T00:00:00.000Z",
  }),
  revokeChatShareLink: async () => {},
  loadGroupRosters: async () => [sampleRoster],
  resetGroupRosters: async () => [],
  saveGroupRoster: async () => [sampleRoster],
  deleteGroupRoster: async () => [],
  createGroupChatFromRoster: async () => {},
  getGroupChatInfo: async () => {
    throw new Error("This chat is not a group chat");
  },
  lookupGroupInviteTarget: async (email) => ({
    userId: "contrast-check-user",
    email,
    publicKeyFingerprint: "contrast-check-fingerprint",
  }),
  inviteGroupChatMember: async () => {},
  removeGroupChatMember: async () => {},
  isGroupChatOwner: () => true,
};

const meta = {
  title: "Chat/Share Dialog",
  component: ChatShareDialogView,
} satisfies Meta<typeof ChatShareDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

function ContrastCheckStory({ theme }: { theme: "light" | "dark" }) {
  useEffect(() => {
    const exposeDisabledStylesToAxe = () => {
      document
        .querySelectorAll<HTMLButtonElement>('[role="dialog"] button:disabled')
        .forEach((button) => {
          // Axe correctly ignores disabled controls. Preserve Chakra's disabled
          // styling while making it scan those colors in this audit-only story.
          button.dataset.disabled = "";
          button.removeAttribute("disabled");
          button.removeAttribute("aria-disabled");
        });
    };

    const observer = new MutationObserver(exposeDisabledStylesToAxe);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["disabled", "aria-disabled"],
      childList: true,
      subtree: true,
    });
    exposeDisabledStylesToAxe();

    return () => observer.disconnect();
  }, []);

  return (
    <Provider defaultTheme={theme}>
      <ChatShareDialogView
        open
        setOpen={() => {}}
        chatId="contrast-check-chat"
        isGroupChat={false}
        actions={actions}
        email=""
        setEmail={() => {}}
        busy={false}
        setBusy={() => {}}
        generatedLink={null}
        setGeneratedLink={() => {}}
      />
    </Provider>
  );
}

export const ContrastCheck: Story = {
  render: () => <ContrastCheckStory theme="light" />,
};

export const ContrastCheckDark: Story = {
  render: () => <ContrastCheckStory theme="dark" />,
};
