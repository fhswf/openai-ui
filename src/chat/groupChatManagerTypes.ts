import type { VaultSharingActions } from "./context/types";

export type GroupManagementActions = Pick<
  VaultSharingActions,
  | "loadGroupRosters"
  | "resetGroupRosters"
  | "saveGroupRoster"
  | "deleteGroupRoster"
  | "createGroupChatFromRoster"
  | "getGroupChatInfo"
  | "lookupGroupInviteTarget"
  | "inviteGroupChatMember"
  | "removeGroupChatMember"
  | "isGroupChatOwner"
>;

export type GroupInviteTarget = Awaited<
  ReturnType<GroupManagementActions["lookupGroupInviteTarget"]>
>;
