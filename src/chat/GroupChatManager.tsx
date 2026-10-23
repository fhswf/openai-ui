import { Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { GroupChatMembersPanel } from "./GroupChatMembersPanel";
import { GroupChatRosterPanel } from "./GroupChatRosterPanel";
import type { GroupManagementActions } from "./groupChatManagerTypes";

export type { GroupManagementActions } from "./groupChatManagerTypes";

type GroupChatManagerProps = {
  open: boolean;
  chatId: string;
  isGroupChat: boolean;
  actions: GroupManagementActions;
};

export function GroupChatManager(props: GroupChatManagerProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="3" borderTopWidth="1px" pt="4">
      <Text fontWeight="semibold">{t("zk_group_title")}</Text>
      <GroupChatMembersPanel
        active={props.isGroupChat}
        open={props.open}
        chatId={props.chatId}
        actions={props.actions}
      />
      <GroupChatRosterPanel
        active={!props.isGroupChat}
        open={props.open}
        chatId={props.chatId}
        actions={props.actions}
      />
    </Stack>
  );
}
