import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
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
import type { SavedGroupRoster } from "./service/groupChatRosters";
import type { GroupManagementActions } from "./groupChatManagerTypes";
import { reportGroupError } from "./groupChatManagerUtils";

type GroupRosterPanelProps = {
  active: boolean;
  open: boolean;
  chatId: string;
  actions: GroupManagementActions;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

type GroupRosterViewProps = {
  rosters: SavedGroupRoster[];
  selectedRoster: SavedGroupRoster | undefined;
  selectedRosterId: string;
  verifiedRosterId: string;
  rosterName: string;
  rosterEmails: string;
  busy: boolean;
  loading: boolean;
  onSelectRoster: (rosterId: string) => void;
  onVerifyRoster: (verified: boolean) => void;
  onRosterNameChange: (name: string) => void;
  onRosterEmailsChange: (emails: string) => void;
  onCreateGroup: () => void;
  onDeleteRoster: () => void;
  onSaveRoster: () => void;
};

type RosterStateSetters = {
  setRosters: (rosters: SavedGroupRoster[]) => void;
  setSelectedRosterId: Dispatch<SetStateAction<string>>;
  setLoading: (loading: boolean) => void;
};

function useLoadRosters(
  props: GroupRosterPanelProps,
  setters: RosterStateSetters
) {
  const { t } = useTranslation();
  const { setRosters, setSelectedRosterId, setLoading } = setters;
  useEffect(() => {
    if (!props.active || !props.open) return;
    let current = true;
    setLoading(true);
    void props.actions
      .loadGroupRosters()
      .then((saved) => {
        if (!current) return;
        setRosters(saved);
        setSelectedRosterId((currentId) =>
          saved.some((roster) => roster.id === currentId)
            ? currentId
            : saved[0]?.id ?? ""
        );
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
    props.actions.loadGroupRosters,
    setLoading,
    setRosters,
    setSelectedRosterId,
    t,
  ]);
}

type SaveRosterInput = {
  name: string;
  emailsText: string;
  save: GroupManagementActions["saveGroupRoster"];
  setBusy: (busy: boolean) => void;
  onSaved: (rosters: SavedGroupRoster[]) => void;
  onSuccess: () => void;
  onError: (error: unknown) => void;
};

async function saveRoster(input: SaveRosterInput): Promise<void> {
  const emails = input.emailsText
    .split(/[\n,]/)
    .map((email) => email.trim())
    .filter(Boolean);
  if (!input.name.trim() || emails.length === 0) return;
  input.setBusy(true);
  try {
    input.onSaved(await input.save(input.name, emails));
    input.onSuccess();
  } catch (error) {
    input.onError(error);
  } finally {
    input.setBusy(false);
  }
}

type DeleteRosterInput = {
  rosterId: string;
  remove: GroupManagementActions["deleteGroupRoster"];
  setBusy: (busy: boolean) => void;
  onDeleted: (rosters: SavedGroupRoster[]) => void;
  onError: (error: unknown) => void;
};

async function deleteRoster(input: DeleteRosterInput): Promise<void> {
  if (!input.rosterId) return;
  input.setBusy(true);
  try {
    input.onDeleted(await input.remove(input.rosterId));
  } catch (error) {
    input.onError(error);
  } finally {
    input.setBusy(false);
  }
}

type CreateGroupInput = {
  chatId: string;
  rosterId: string;
  verifiedRosterId: string;
  create: GroupManagementActions["createGroupChatFromRoster"];
  confirmMessage: string;
  successTitle: string;
  setBusy: (busy: boolean) => void;
  onError: (error: unknown) => void;
};

async function createGroup(input: CreateGroupInput): Promise<void> {
  if (
    !input.rosterId ||
    input.verifiedRosterId !== input.rosterId ||
    !window.confirm(input.confirmMessage)
  )
    return;
  input.setBusy(true);
  try {
    await input.create(input.chatId, input.rosterId);
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

type RosterValues = Omit<
  GroupRosterViewProps,
  | "onSelectRoster"
  | "onVerifyRoster"
  | "onCreateGroup"
  | "onDeleteRoster"
  | "onSaveRoster"
>;

type RosterCallbackSetters = {
  setRosters: (rosters: SavedGroupRoster[]) => void;
  setBusy: (busy: boolean) => void;
  setSelectedRosterId: (rosterId: string) => void;
  setVerifiedRosterId: (rosterId: string) => void;
};

type RosterCallbackStrings = {
  errorTitle: string;
  successTitle: string;
  createdTitle: string;
  confirmMessage: string;
};

type RosterCallbackInput = {
  props: GroupRosterPanelProps;
  state: RosterValues;
  setters: RosterCallbackSetters;
  strings: RosterCallbackStrings;
};

function createRosterSelectionCallbacks(input: RosterCallbackInput) {
  return {
    onSelectRoster: (rosterId: string) => {
      input.setters.setSelectedRosterId(rosterId);
      input.setters.setVerifiedRosterId("");
    },
    onVerifyRoster: (verified: boolean) =>
      input.setters.setVerifiedRosterId(
        verified ? input.state.selectedRosterId : ""
      ),
  };
}

function createSaveRosterCallback(input: RosterCallbackInput) {
  const onError = (error: unknown) =>
    reportGroupError(error, input.strings.errorTitle);
  return () =>
    void saveRoster({
      name: input.state.rosterName,
      emailsText: input.state.rosterEmails,
      save: input.props.actions.saveGroupRoster,
      setBusy: input.setters.setBusy,
      onSaved: (saved) => {
        input.setters.setRosters(saved);
        input.setters.setSelectedRosterId(saved[saved.length - 1]?.id ?? "");
        input.state.onRosterNameChange("");
        input.state.onRosterEmailsChange("");
      },
      onSuccess: () =>
        toaster.create({
          title: input.strings.successTitle,
          duration: 4000,
          type: "success",
        }),
      onError,
    });
}

function createDeleteRosterCallback(input: RosterCallbackInput) {
  const onError = (error: unknown) =>
    reportGroupError(error, input.strings.errorTitle);
  return () =>
    void deleteRoster({
      rosterId: input.state.selectedRosterId,
      remove: input.props.actions.deleteGroupRoster,
      setBusy: input.setters.setBusy,
      onDeleted: (saved) => {
        input.setters.setRosters(saved);
        input.setters.setSelectedRosterId(saved[0]?.id ?? "");
      },
      onError,
    });
}

function createCreateGroupCallback(input: RosterCallbackInput) {
  const onError = (error: unknown) =>
    reportGroupError(error, input.strings.errorTitle);
  return () =>
    void createGroup({
      chatId: input.props.chatId,
      rosterId: input.state.selectedRosterId,
      verifiedRosterId: input.state.verifiedRosterId,
      create: input.props.actions.createGroupChatFromRoster,
      confirmMessage: input.strings.confirmMessage,
      successTitle: input.strings.createdTitle,
      setBusy: input.setters.setBusy,
      onError,
    });
}

function createRosterCallbacks(input: RosterCallbackInput) {
  return {
    ...createRosterSelectionCallbacks(input),
    onSaveRoster: createSaveRosterCallback(input),
    onDeleteRoster: createDeleteRosterCallback(input),
    onCreateGroup: createCreateGroupCallback(input),
  };
}

function useRosterManager(props: GroupRosterPanelProps): GroupRosterViewProps {
  const [rosters, setRosters] = useState<SavedGroupRoster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [verifiedRosterId, setVerifiedRosterId] = useState("");
  const [rosterName, setRosterName] = useState("");
  const [rosterEmails, setRosterEmails] = useState("");
  const [loading, setLoading] = useState(false);
  useLoadRosters(props, { setRosters, setSelectedRosterId, setLoading });
  const { t } = useTranslation();
  const state = {
    rosters,
    selectedRoster: rosters.find((roster) => roster.id === selectedRosterId),
    selectedRosterId,
    verifiedRosterId,
    rosterName,
    rosterEmails,
    busy: props.busy,
    loading,
    onRosterNameChange: setRosterName,
    onRosterEmailsChange: setRosterEmails,
  };
  return {
    ...state,
    ...createRosterCallbacks({
      props,
      state,
      setters: {
        setRosters,
        setBusy: props.setBusy,
        setSelectedRosterId,
        setVerifiedRosterId,
      },
      strings: {
        errorTitle: t("share_chat_error"),
        successTitle: t("zk_group_save_roster"),
        createdTitle: t("zk_group_created"),
        confirmMessage: t("zk_group_convert_warning"),
      },
    }),
  };
}

function RosterPicker(
  props: Pick<
    GroupRosterViewProps,
    "rosters" | "selectedRosterId" | "loading" | "onSelectRoster"
  >
) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("zk_group_saved_rosters")}</Field.Label>
      <select
        value={props.selectedRosterId}
        onChange={(event) => props.onSelectRoster(event.target.value)}
        disabled={props.loading || props.rosters.length === 0}
        style={{
          minHeight: "2.5rem",
          padding: "0.5rem",
          borderRadius: "0.375rem",
        }}
      >
        <option value="">{t("zk_group_select_roster")}</option>
        {props.rosters.map((roster) => (
          <option key={roster.id} value={roster.id}>
            {roster.name}
          </option>
        ))}
      </select>
    </Field.Root>
  );
}

function SelectedRosterDetails(props: GroupRosterViewProps) {
  const { t } = useTranslation();
  const roster = props.selectedRoster;
  if (!roster) return null;
  return (
    <Stack gap="1">
      {roster.members.map((member) => (
        <Text
          key={member.userId}
          fontSize="xs"
          color="fg.muted"
          wordBreak="break-all"
        >
          {member.email}: {member.publicKeyFingerprint}
        </Text>
      ))}
      <Text fontSize="xs" color="fg.muted">
        {t("zk_group_fingerprint_warning")}
      </Text>
      <label>
        <input
          type="checkbox"
          checked={props.verifiedRosterId === roster.id}
          onChange={(event) => props.onVerifyRoster(event.target.checked)}
        />{" "}
        {t("zk_group_fingerprint_verified")}
      </label>
      <HStack>
        <Button
          disabled={props.busy || props.verifiedRosterId !== roster.id}
          loading={props.busy}
          onClick={props.onCreateGroup}
        >
          {t("zk_group_create")}
        </Button>
        <Button
          variant="outline"
          colorPalette="red"
          disabled={props.busy}
          onClick={props.onDeleteRoster}
        >
          {t("zk_group_delete_roster")}
        </Button>
      </HStack>
    </Stack>
  );
}

function SaveRosterForm(props: GroupRosterViewProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="2" borderTopWidth="1px" pt="3">
      <Text fontWeight="medium">{t("zk_group_save_roster")}</Text>
      <Field.Root>
        <Field.Label>{t("zk_group_roster_name")}</Field.Label>
        <Input
          value={props.rosterName}
          onChange={(event) => props.onRosterNameChange(event.target.value)}
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>{t("zk_group_roster_emails")}</Field.Label>
        <Textarea
          value={props.rosterEmails}
          onChange={(event) => props.onRosterEmailsChange(event.target.value)}
          placeholder={t("zk_group_roster_emails_help")}
          rows={3}
        />
      </Field.Root>
      <Button
        alignSelf="start"
        disabled={
          props.busy || !props.rosterName.trim() || !props.rosterEmails.trim()
        }
        loading={props.busy}
        onClick={props.onSaveRoster}
      >
        {t("zk_group_save_roster")}
      </Button>
    </Stack>
  );
}

function GroupRosterView(props: GroupRosterViewProps) {
  const { t } = useTranslation();
  return (
    <>
      <Text color="fg.muted" fontSize="sm">
        {t("zk_group_help")}
      </Text>
      <RosterPicker {...props} />
      <SelectedRosterDetails {...props} />
      <SaveRosterForm {...props} />
    </>
  );
}

export function GroupChatRosterPanel(props: GroupRosterPanelProps) {
  const view = useRosterManager(props);
  return (
    <Stack gap="3" display={props.active ? "flex" : "none"}>
      <GroupRosterView {...view} />
    </Stack>
  );
}
