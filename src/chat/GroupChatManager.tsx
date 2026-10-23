import React, { useEffect, useState } from "react";
import {
  Button,
  Field,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { toaster } from "../components/ui/toaster";
import type { VaultSharingActions } from "./context/types";
import type { SavedGroupRoster } from "./service/groupChatSync";
import type { VaultGroupChat } from "./service/chatVault";

export type GroupManagementActions = Pick<
  VaultSharingActions,
  | "loadGroupRosters"
  | "saveGroupRoster"
  | "deleteGroupRoster"
  | "createGroupChatFromRoster"
  | "getGroupChatInfo"
  | "lookupGroupInviteTarget"
  | "inviteGroupChatMember"
  | "removeGroupChatMember"
  | "isGroupChatOwner"
>;

function reportGroupError(error: unknown, title: string) {
  toaster.create({
    title,
    description: error instanceof Error ? error.message : undefined,
    duration: 8000,
    type: "error",
  });
}

export function GroupChatManager({
  open,
  chatId,
  isGroupChat,
  actions,
}: {
  open: boolean;
  chatId: string;
  isGroupChat: boolean;
  actions: GroupManagementActions;
}) {
  const { t } = useTranslation();
  const [rosters, setRosters] = useState<SavedGroupRoster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [verifiedRosterId, setVerifiedRosterId] = useState("");
  const [rosterName, setRosterName] = useState("");
  const [rosterEmails, setRosterEmails] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTarget, setInviteTarget] = useState<
    Awaited<ReturnType<GroupManagementActions["lookupGroupInviteTarget"]>> | null
  >(null);
  const [inviteFingerprintVerified, setInviteFingerprintVerified] = useState(false);
  const [group, setGroup] = useState<VaultGroupChat | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const selectedRoster = rosters.find((roster) => roster.id === selectedRosterId);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        if (isGroupChat) {
          const info = await actions.getGroupChatInfo(chatId);
          if (active) {
            setGroup(info);
            setIsOwner(actions.isGroupChatOwner(chatId));
          }
        } else {
          const saved = await actions.loadGroupRosters();
          if (active) {
            setRosters(saved);
            setSelectedRosterId((current) =>
              saved.some((roster) => roster.id === current)
                ? current
                : saved[0]?.id ?? ""
            );
            setGroup(null);
            setIsOwner(false);
          }
        }
      } catch (error) {
        if (active) reportGroupError(error, t("share_chat_error"));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    open,
    chatId,
    isGroupChat,
    actions.getGroupChatInfo,
    actions.isGroupChatOwner,
    actions.loadGroupRosters,
    t,
  ]);

  const reloadGroup = async () => {
    setGroup(await actions.getGroupChatInfo(chatId));
  };

  const saveRoster = async () => {
    const emails = rosterEmails
      .split(/[\n,]/)
      .map((email) => email.trim())
      .filter(Boolean);
    if (!rosterName.trim() || emails.length === 0) return;
    setBusy(true);
    try {
      const saved = await actions.saveGroupRoster(rosterName, emails);
      setRosters(saved);
      setSelectedRosterId(saved[saved.length - 1]?.id ?? "");
      setRosterName("");
      setRosterEmails("");
      toaster.create({
        title: t("zk_group_save_roster"),
        duration: 4000,
        type: "success",
      });
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  const deleteRoster = async () => {
    if (!selectedRosterId) return;
    setBusy(true);
    try {
      const saved = await actions.deleteGroupRoster(selectedRosterId);
      setRosters(saved);
      setSelectedRosterId(saved[0]?.id ?? "");
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (
      !selectedRosterId ||
      verifiedRosterId !== selectedRosterId ||
      !window.confirm(t("zk_group_convert_warning"))
    ) {
      return;
    }
    setBusy(true);
    try {
      await actions.createGroupChatFromRoster(chatId, selectedRosterId);
      await reloadGroup();
      setIsOwner(actions.isGroupChatOwner(chatId));
      toaster.create({
        title: t("zk_group_created"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  const lookupInviteTarget = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setInviteTarget(null);
    setInviteFingerprintVerified(false);
    try {
      setInviteTarget(await actions.lookupGroupInviteTarget(inviteEmail.trim()));
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  const inviteMember = async () => {
    if (
      !inviteTarget ||
      inviteTarget.email !== inviteEmail.trim().toLowerCase() ||
      !inviteFingerprintVerified
    ) return;
    setBusy(true);
    try {
      await actions.inviteGroupChatMember(
        chatId,
        inviteTarget.email,
        inviteTarget.publicKeyFingerprint
      );
      setInviteEmail("");
      setInviteTarget(null);
      setInviteFingerprintVerified(false);
      await reloadGroup();
      toaster.create({
        title: t("zk_group_member_added"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!window.confirm(t("zk_group_history_warning"))) return;
    setBusy(true);
    try {
      await actions.removeGroupChatMember(chatId, memberId);
      await reloadGroup();
      toaster.create({
        title: t("zk_group_member_removed"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      reportGroupError(error, t("share_chat_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="3" borderTopWidth="1px" pt="4">
      <Text fontWeight="semibold">{t("zk_group_title")}</Text>
      {isGroupChat ? (
        <>
          <Text color="fg.muted" fontSize="sm">
            {t("zk_group_epoch", { epoch: group?.currentEpoch ?? "…" })}
          </Text>
          <Text fontSize="sm" fontWeight="medium">
            {t("zk_group_members")}
          </Text>
          {loading && <Text color="fg.muted" fontSize="sm">{t("loading")}</Text>}
          <Stack gap="2">
            {(group?.members ?? []).map((member) => (
              <HStack key={member.userId} justify="space-between" align="start">
                <Text fontSize="sm" wordBreak="break-all">
                  {member.userId}{member.role === "owner" ? " · owner" : ""}
                </Text>
                {isOwner && member.role !== "owner" && (
                  <Button
                    size="sm"
                    variant="outline"
                    colorPalette="red"
                    disabled={busy}
                    onClick={() => void removeMember(member.userId)}
                  >
                    {t("zk_group_remove")}
                  </Button>
                )}
              </HStack>
            ))}
          </Stack>
          {isOwner && (
            <Stack gap="2">
              <Field.Root>
                <Field.Label>{t("share_chat_email_label")}</Field.Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => {
                    setInviteEmail(event.target.value);
                    setInviteTarget(null);
                    setInviteFingerprintVerified(false);
                  }}
                  placeholder={t("share_chat_email_placeholder")}
                />
              </Field.Root>
              <Button
                alignSelf="start"
                variant="outline"
                disabled={busy || !inviteEmail.trim()}
                loading={busy}
                onClick={() => void lookupInviteTarget()}
              >
                {t("zk_group_lookup_fingerprint")}
              </Button>
              {inviteTarget && inviteTarget.email === inviteEmail.trim().toLowerCase() && (
                <Stack gap="1">
                  <Text fontSize="xs" color="fg.muted" wordBreak="break-all">
                    {inviteTarget.email}: {inviteTarget.publicKeyFingerprint}
                  </Text>
                  <label>
                    <input
                      type="checkbox"
                      checked={inviteFingerprintVerified}
                      onChange={(event) => setInviteFingerprintVerified(event.target.checked)}
                    />{" "}
                    {t("zk_group_invite_fingerprint_verified")}
                  </label>
                </Stack>
              )}
              <Button
                alignSelf="start"
                disabled={
                  busy ||
                  !inviteTarget ||
                  inviteTarget.email !== inviteEmail.trim().toLowerCase() ||
                  !inviteFingerprintVerified
                }
                loading={busy}
                onClick={() => void inviteMember()}
              >
                {t("zk_group_invite")}
              </Button>
            </Stack>
          )}
          <Text color="fg.muted" fontSize="sm">
            {t("zk_group_history_warning")}
          </Text>
        </>
      ) : (
        <>
          <Text color="fg.muted" fontSize="sm">{t("zk_group_help")}</Text>
          <Field.Root>
            <Field.Label>{t("zk_group_saved_rosters")}</Field.Label>
            <select
              value={selectedRosterId}
              onChange={(event) => {
                setSelectedRosterId(event.target.value);
                setVerifiedRosterId("");
              }}
              disabled={loading || rosters.length === 0}
              style={{
                minHeight: "2.5rem",
                padding: "0.5rem",
                borderRadius: "0.375rem",
              }}
            >
              <option value="">{t("zk_group_select_roster")}</option>
              {rosters.map((roster) => (
                <option key={roster.id} value={roster.id}>{roster.name}</option>
              ))}
            </select>
          </Field.Root>
          {selectedRoster && (
            <Stack gap="1">
              {selectedRoster.members.map((member) => (
                <Text key={member.userId} fontSize="xs" color="fg.muted" wordBreak="break-all">
                  {member.email}: {member.publicKeyFingerprint}
                </Text>
              ))}
              <Text fontSize="xs" color="fg.muted">
                {t("zk_group_fingerprint_warning")}
              </Text>
              <label>
                <input
                  type="checkbox"
                  checked={verifiedRosterId === selectedRoster.id}
                  onChange={(event) =>
                    setVerifiedRosterId(event.target.checked ? selectedRoster.id : "")
                  }
                />{" "}
                {t("zk_group_fingerprint_verified")}
              </label>
              <HStack>
                <Button
                  disabled={busy || verifiedRosterId !== selectedRoster.id}
                  loading={busy}
                  onClick={() => void createGroup()}
                >
                  {t("zk_group_create")}
                </Button>
                <Button
                  variant="outline"
                  colorPalette="red"
                  disabled={busy}
                  onClick={() => void deleteRoster()}
                >
                  {t("zk_group_delete_roster")}
                </Button>
              </HStack>
            </Stack>
          )}
          <Stack gap="2" borderTopWidth="1px" pt="3">
            <Text fontWeight="medium">{t("zk_group_save_roster")}</Text>
            <Field.Root>
              <Field.Label>{t("zk_group_roster_name")}</Field.Label>
              <Input value={rosterName} onChange={(event) => setRosterName(event.target.value)} />
            </Field.Root>
            <Field.Root>
              <Field.Label>{t("zk_group_roster_emails")}</Field.Label>
              <Textarea
                value={rosterEmails}
                onChange={(event) => setRosterEmails(event.target.value)}
                placeholder={t("zk_group_roster_emails_help")}
                rows={3}
              />
            </Field.Root>
            <Button
              alignSelf="start"
              disabled={busy || !rosterName.trim() || !rosterEmails.trim()}
              loading={busy}
              onClick={() => void saveRoster()}
            >
              {t("zk_group_save_roster")}
            </Button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
