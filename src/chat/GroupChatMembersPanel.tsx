import { useEffect, useState } from "react";
import { Button, Field, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { toaster } from "../components/ui/toaster";
import type { VaultGroupChat } from "./service/chatVault";
import type {
  GroupInviteTarget,
  GroupManagementActions,
} from "./groupChatManagerTypes";
import { reportGroupError } from "./groupChatManagerUtils";

type GroupMembersPanelProps = {
  active: boolean;
  open: boolean;
  chatId: string;
  actions: GroupManagementActions;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

type GroupMembersViewProps = {
  group: VaultGroupChat | null;
  isOwner: boolean;
  busy: boolean;
  loading: boolean;
  inviteEmail: string;
  inviteTarget: GroupInviteTarget | null;
  inviteFingerprintVerified: boolean;
  onEmailChange: (email: string) => void;
  onLookup: () => void;
  onInvite: () => void;
  onVerifyFingerprint: (verified: boolean) => void;
  onRemove: (memberId: string) => void;
};

function useGroupInfo(props: GroupMembersPanelProps) {
  const [group, setGroup] = useState<VaultGroupChat | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!props.open) return;
    if (!props.active) {
      setGroup(null);
      setIsOwner(false);
      return;
    }
    let current = true;
    setLoading(true);
    void props.actions
      .getGroupChatInfo(props.chatId)
      .then((info) => {
        if (!current) return;
        setGroup(info);
        setIsOwner(props.actions.isGroupChatOwner(props.chatId));
      })
      .catch((error) => {
        if (current) reportGroupError(error, t("share_chat_error"));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [
    props.active,
    props.open,
    props.chatId,
    props.actions.getGroupChatInfo,
    props.actions.isGroupChatOwner,
    t,
  ]);

  return { group, setGroup, isOwner, setIsOwner, loading };
}

type LookupInviteInput = {
  actions: GroupManagementActions;
  email: string;
  setBusy: (busy: boolean) => void;
  setTarget: (target: GroupInviteTarget | null) => void;
  setVerified: (verified: boolean) => void;
  onError: (error: unknown) => void;
};

async function lookupInviteTarget(input: LookupInviteInput): Promise<void> {
  if (!input.email.trim()) return;
  input.setBusy(true);
  input.setTarget(null);
  input.setVerified(false);
  try {
    input.setTarget(
      await input.actions.lookupGroupInviteTarget(input.email.trim())
    );
  } catch (error) {
    input.onError(error);
  } finally {
    input.setBusy(false);
  }
}

type InviteMemberInput = {
  actions: GroupManagementActions;
  chatId: string;
  email: string;
  target: GroupInviteTarget | null;
  verified: boolean;
  setBusy: (busy: boolean) => void;
  setEmail: (email: string) => void;
  setTarget: (target: GroupInviteTarget | null) => void;
  setVerified: (verified: boolean) => void;
  reloadGroup: () => Promise<void>;
  successTitle: string;
  onError: (error: unknown) => void;
};

async function inviteMember(input: InviteMemberInput): Promise<void> {
  if (
    !input.target ||
    input.target.email !== input.email.trim().toLowerCase() ||
    !input.verified
  )
    return;
  input.setBusy(true);
  try {
    await input.actions.inviteGroupChatMember(
      input.chatId,
      input.target.email,
      input.target.publicKeyFingerprint
    );
    input.setEmail("");
    input.setTarget(null);
    input.setVerified(false);
    await input.reloadGroup();
    toaster.create({
      title: input.successTitle,
      duration: 5000,
      type: "success",
    });
  } catch (error) {
    input.onError(error);
  } finally {
    input.setBusy(false);
  }
}

type RemoveMemberInput = {
  actions: GroupManagementActions;
  chatId: string;
  memberId: string;
  setBusy: (busy: boolean) => void;
  reloadGroup: () => Promise<void>;
  confirmMessage: string;
  successTitle: string;
  onError: (error: unknown) => void;
};

async function removeMember(input: RemoveMemberInput): Promise<void> {
  if (!window.confirm(input.confirmMessage)) return;
  input.setBusy(true);
  try {
    await input.actions.removeGroupChatMember(input.chatId, input.memberId);
    await input.reloadGroup();
    toaster.create({
      title: input.successTitle,
      duration: 5000,
      type: "success",
    });
  } catch (error) {
    input.onError(error);
  } finally {
    input.setBusy(false);
  }
}

type MemberCallbackInput = {
  props: GroupMembersPanelProps;
  setGroup: (group: VaultGroupChat) => void;
  inviteEmail: string;
  inviteTarget: GroupInviteTarget | null;
  inviteFingerprintVerified: boolean;
  setBusy: (busy: boolean) => void;
  setInviteEmail: (email: string) => void;
  setInviteTarget: (target: GroupInviteTarget | null) => void;
  setInviteFingerprintVerified: (verified: boolean) => void;
  errorTitle: string;
  addedTitle: string;
  removedTitle: string;
  confirmMessage: string;
};

function createEmailChangeCallback(input: MemberCallbackInput) {
  return (email: string) => {
    input.setInviteEmail(email);
    input.setInviteTarget(null);
    input.setInviteFingerprintVerified(false);
  };
}

function createLookupCallback(
  input: MemberCallbackInput,
  onError: (error: unknown) => void
) {
  return () =>
    void lookupInviteTarget({
      actions: input.props.actions,
      email: input.inviteEmail,
      setBusy: input.setBusy,
      setTarget: input.setInviteTarget,
      setVerified: input.setInviteFingerprintVerified,
      onError,
    });
}

function createInviteCallback(
  input: MemberCallbackInput,
  reloadGroup: () => Promise<void>,
  onError: (error: unknown) => void
) {
  return () =>
    void inviteMember({
      actions: input.props.actions,
      chatId: input.props.chatId,
      email: input.inviteEmail,
      target: input.inviteTarget,
      verified: input.inviteFingerprintVerified,
      setBusy: input.setBusy,
      setEmail: input.setInviteEmail,
      setTarget: input.setInviteTarget,
      setVerified: input.setInviteFingerprintVerified,
      reloadGroup,
      successTitle: input.addedTitle,
      onError,
    });
}

function createRemoveCallback(
  input: MemberCallbackInput,
  reloadGroup: () => Promise<void>,
  onError: (error: unknown) => void
) {
  return (memberId: string) =>
    void removeMember({
      actions: input.props.actions,
      chatId: input.props.chatId,
      memberId,
      setBusy: input.setBusy,
      reloadGroup,
      confirmMessage: input.confirmMessage,
      successTitle: input.removedTitle,
      onError,
    });
}

function createMemberCallbacks(input: MemberCallbackInput) {
  const onError = (error: unknown) => reportGroupError(error, input.errorTitle);
  const reloadGroup = async () =>
    input.setGroup(
      await input.props.actions.getGroupChatInfo(input.props.chatId)
    );
  return {
    onEmailChange: createEmailChangeCallback(input),
    onLookup: createLookupCallback(input, onError),
    onInvite: createInviteCallback(input, reloadGroup, onError),
    onVerifyFingerprint: input.setInviteFingerprintVerified,
    onRemove: createRemoveCallback(input, reloadGroup, onError),
  };
}

function useMemberControls(
  props: GroupMembersPanelProps,
  setGroup: MemberCallbackInput["setGroup"]
) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTarget, setInviteTarget] = useState<GroupInviteTarget | null>(
    null
  );
  const [inviteFingerprintVerified, setInviteFingerprintVerified] =
    useState(false);
  const { t } = useTranslation();
  return {
    busy: props.busy,
    inviteEmail,
    inviteTarget,
    inviteFingerprintVerified,
    ...createMemberCallbacks({
      props,
      setGroup,
      inviteEmail,
      inviteTarget,
      inviteFingerprintVerified,
      setBusy: props.setBusy,
      setInviteEmail,
      setInviteTarget,
      setInviteFingerprintVerified,
      errorTitle: t("share_chat_error"),
      addedTitle: t("zk_group_member_added"),
      removedTitle: t("zk_group_member_removed"),
      confirmMessage: t("zk_group_history_warning"),
    }),
  };
}

function useGroupMembers(props: GroupMembersPanelProps): GroupMembersViewProps {
  const info = useGroupInfo(props);
  const controls = useMemberControls(props, info.setGroup);
  return { ...info, ...controls };
}

function GroupMemberList(
  props: Pick<GroupMembersViewProps, "group" | "isOwner" | "busy" | "onRemove">
) {
  const { t } = useTranslation();
  return (
    <Stack gap="2">
      {(props.group?.members ?? []).map((member) => (
        <HStack key={member.userId} justify="space-between" align="start">
          <Text fontSize="sm" wordBreak="break-all">
            {member.userId}
            {member.role === "owner" ? ` · ${t("zk_group_creator")}` : ""}
          </Text>
          {props.isOwner && member.role !== "owner" && (
            <Button
              size="sm"
              variant="outline"
              colorPalette="red"
              disabled={props.busy}
              onClick={() => props.onRemove(member.userId)}
            >
              {t("zk_group_remove")}
            </Button>
          )}
        </HStack>
      ))}
    </Stack>
  );
}

function InviteEmailField(
  props: Pick<GroupMembersViewProps, "inviteEmail" | "onEmailChange">
) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("share_chat_email_label")}</Field.Label>
      <Input
        type="email"
        value={props.inviteEmail}
        onChange={(event) => props.onEmailChange(event.target.value)}
        placeholder={t("share_chat_email_placeholder")}
      />
    </Field.Root>
  );
}

function FingerprintConfirmation(
  props: Pick<
    GroupMembersViewProps,
    | "inviteEmail"
    | "inviteTarget"
    | "inviteFingerprintVerified"
    | "onVerifyFingerprint"
  >
) {
  const { t } = useTranslation();
  const matchesEmail =
    props.inviteTarget?.email === props.inviteEmail.trim().toLowerCase();
  if (!props.inviteTarget || !matchesEmail) return null;
  return (
    <Stack gap="1">
      <Text fontSize="xs" color="fg.muted" wordBreak="break-all">
        {props.inviteTarget.email}: {props.inviteTarget.publicKeyFingerprint}
      </Text>
      <label>
        <input
          type="checkbox"
          checked={props.inviteFingerprintVerified}
          onChange={(event) => props.onVerifyFingerprint(event.target.checked)}
        />{" "}
        {t("zk_group_invite_fingerprint_verified")}
      </label>
    </Stack>
  );
}

function GroupInviteForm(props: GroupMembersViewProps) {
  const { t } = useTranslation();
  const validTarget =
    props.inviteTarget?.email === props.inviteEmail.trim().toLowerCase();
  return (
    <Stack gap="2">
      <InviteEmailField
        inviteEmail={props.inviteEmail}
        onEmailChange={props.onEmailChange}
      />
      <Button
        alignSelf="start"
        variant="outline"
        disabled={props.busy || !props.inviteEmail.trim()}
        loading={props.busy}
        onClick={props.onLookup}
      >
        {t("zk_group_lookup_fingerprint")}
      </Button>
      <FingerprintConfirmation {...props} />
      <Button
        alignSelf="start"
        disabled={
          props.busy || !validTarget || !props.inviteFingerprintVerified
        }
        loading={props.busy}
        onClick={props.onInvite}
      >
        {t("zk_group_invite")}
      </Button>
    </Stack>
  );
}

function GroupMembersView(props: GroupMembersViewProps) {
  const { t } = useTranslation();
  return (
    <>
      <Text color="fg.muted" fontSize="sm">
        {t("zk_group_epoch", { epoch: props.group?.currentEpoch ?? "…" })}
      </Text>
      <Text fontSize="sm" fontWeight="medium">
        {t("zk_group_members")}
      </Text>
      {props.loading && (
        <Text color="fg.muted" fontSize="sm">
          {t("loading")}
        </Text>
      )}
      <GroupMemberList {...props} />
      {props.isOwner && <GroupInviteForm {...props} />}
      <Text color="fg.muted" fontSize="sm">
        {t("zk_group_history_warning")}
      </Text>
    </>
  );
}

export function GroupChatMembersPanel(props: GroupMembersPanelProps) {
  const view = useGroupMembers(props);
  return (
    <Stack gap="3" display={props.active ? "flex" : "none"}>
      <GroupMembersView {...view} />
    </Stack>
  );
}
