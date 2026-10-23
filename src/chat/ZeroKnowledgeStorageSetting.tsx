import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  Field,
  Input,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { t } from "i18next";
import { Radio, RadioGroup } from "../components/ui/radio";
import { Switch } from "../components/ui/switch";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import {
  chatVault,
  type VaultCredential,
  type VaultUserKey,
} from "./service/chatVault";
import {
  clearActiveCredentialId,
  clearPrivateKey,
  loadActiveCredentialId,
  loadPrivateKey,
  saveActiveCredentialId,
} from "./utils/zeroKnowledgeKeystore";
import {
  completeVaultLink,
  createVaultLinkRequest,
  createVaultLinkResponse,
  enableZeroKnowledgeStorage,
  getZeroKnowledgeStorageErrorKey,
  isPrivateKeyForUser,
  registerAdditionalPasskey,
  getVaultLinkRequestOrigin,
  type VaultLinkTarget,
} from "./utils/zeroKnowledgeStorage";

type KeyStatus = "idle" | "checking" | "unlocked" | "locked";
type RegistrationMode = "initial" | "additional" | null;
type VaultLinkMode = "destination" | "source" | null;
const DISCOVERABLE_PASSKEY = "__discoverable_passkey__";

function getCredentials(key: VaultUserKey | null): VaultCredential[] {
  if (!key) return [];
  if (key.credentials) return key.credentials;
  if (!key.credentialId) return [];
  return [
    {
      credentialId: key.credentialId,
      name: key.credentialName || t("zk_storage_default_passkey_name"),
      createdAt: "",
    },
  ];
}

export function ZeroKnowledgeStorageSetting() {
  const { options, user } = useGlobal();
  const { setGeneral } = useOptions();
  const enabled = options.general.zkStorage ?? false;
  const lazyHistory = options.general.zkLazyHistory ?? false;
  const userIdentity = user?.sub ?? user?.id ?? user?.email ?? null;
  const [busy, setBusy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [vaultKey, setVaultKey] = useState<VaultUserKey | null>(null);
  const [loadingAccountKey, setLoadingAccountKey] = useState(false);
  const [registrationMode, setRegistrationMode] =
    useState<RegistrationMode>(null);
  const [credentialName, setCredentialName] = useState("");
  const [authorizationCredentialId, setAuthorizationCredentialId] =
    useState("");
  const [activeCredentialId, setActiveCredentialId] = useState<string | null>(
    null
  );
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(
    null
  );
  const [editingCredentialName, setEditingCredentialName] = useState("");
  const [vaultLinkMode, setVaultLinkMode] = useState<VaultLinkMode>(null);
  const [vaultLinkTarget, setVaultLinkTarget] =
    useState<VaultLinkTarget | null>(null);
  const [vaultLinkRequestCode, setVaultLinkRequestCode] = useState("");
  const [vaultLinkResponseCode, setVaultLinkResponseCode] = useState("");
  const [vaultLinkOutputCode, setVaultLinkOutputCode] = useState("");
  const [vaultLinkRequestedOrigin, setVaultLinkRequestedOrigin] = useState("");
  const [vaultLinkSourceCredentialId, setVaultLinkSourceCredentialId] =
    useState("");

  const credentials = useMemo(() => getCredentials(vaultKey), [vaultKey]);

  const markActiveCredential = (credentialId: string) => {
    setActiveCredentialId(credentialId);
    void saveActiveCredentialId(credentialId).catch((error) => {
      console.warn("Could not save the active passkey indicator:", error);
    });
  };

  useEffect(() => {
    if (!userIdentity) {
      setVaultKey(null);
      setKeyStatus("idle");
      setActiveCredentialId(null);
      setLoadingAccountKey(false);
      return;
    }

    let cancelled = false;
    setLoadingAccountKey(true);
    setKeyStatus(enabled ? "checking" : "idle");
    chatVault
      .getMyKey()
      .then(async (key) => {
        const privateKey = enabled ? await loadPrivateKey() : null;
        const unlocked =
          enabled &&
          privateKey &&
          (await isPrivateKeyForUser(privateKey, key));
        let activeCredentialId: string | null = null;
        try {
          activeCredentialId = await loadActiveCredentialId();
        } catch (error) {
          console.warn("Could not load the active passkey indicator:", error);
        }
        const storedCredentialIsRegistered = getCredentials(key).some(
          (credential) => credential.credentialId === activeCredentialId
        ) || getCredentials(key).length === 0;
        if (!cancelled) {
          setVaultKey(key);
          setActiveCredentialId(
            storedCredentialIsRegistered ? activeCredentialId : null
          );
          if (enabled) setKeyStatus(unlocked ? "unlocked" : "locked");
          setLoadingAccountKey(false);
        }
      })
      .catch((error) => {
        if (error?.status !== 404) {
          console.error("Could not inspect the encrypted chat key:", error);
        }
        if (!cancelled) {
          setVaultKey(null);
          if (enabled) setKeyStatus("locked");
          setLoadingAccountKey(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, userIdentity]);

  const openRegistration = (mode: Exclude<RegistrationMode, null>) => {
    setCredentialName("");
    setAuthorizationCredentialId(
      mode === "additional"
        ? vaultKey?.credentialId ?? credentials[0]?.credentialId ?? ""
        : ""
    );
    setRegistrationMode(mode);
  };

  const openVaultLinkDestination = async () => {
    setVaultLinkMode("destination");
    setVaultLinkTarget(null);
    setVaultLinkResponseCode("");
    setCredentialName("");
    setBusy(true);
    try {
      setVaultLinkTarget(await createVaultLinkRequest());
    } catch (error) {
      setVaultLinkMode(null);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const openVaultLinkSource = () => {
    setVaultLinkRequestCode("");
    setVaultLinkOutputCode("");
    setVaultLinkRequestedOrigin("");
    setCredentialName("");
    setVaultLinkSourceCredentialId(
      activeCredentialId ??
        credentials[0]?.credentialId ??
        DISCOVERABLE_PASSKEY
    );
    setVaultLinkMode("source");
  };

  const createVaultLink = async () => {
    if (!vaultLinkSourceCredentialId || !vaultLinkRequestCode.trim()) return;
    if (
      !vaultLinkRequestedOrigin ||
      !window.confirm(
        t("zk_storage_link_confirm", { origin: vaultLinkRequestedOrigin })
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const output = await createVaultLinkResponse(
        vaultLinkRequestCode,
        vaultLinkSourceCredentialId === DISCOVERABLE_PASSKEY
          ? undefined
          : vaultLinkSourceCredentialId
      );
      setVaultLinkOutputCode(output);
      const updatedKey = await chatVault.getMyKey();
      setVaultKey(updatedKey);
      if (updatedKey.credentialId) markActiveCredential(updatedKey.credentialId);
      toaster.create({
        title: t("zk_storage_link_response_ready"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not prepare the vault link:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const finishVaultLink = async () => {
    if (!vaultLinkTarget || !credentialName.trim() || !vaultLinkResponseCode.trim()) {
      return;
    }
    setBusy(true);
    try {
      const updatedKey = await completeVaultLink(
        user,
        credentialName,
        vaultLinkTarget,
        vaultLinkResponseCode
      );
      setVaultKey(updatedKey);
      if (updatedKey.credentialId) markActiveCredential(updatedKey.credentialId);
      setGeneral({ zkStorage: true });
      setKeyStatus("unlocked");
      setVaultLinkMode(null);
      setVaultLinkTarget(null);
      window.dispatchEvent(new Event("zk-storage-key-available"));
      toaster.create({
        title: t("zk_storage_passkey_added"),
        description: t("zk_storage_passkey_added_help"),
        duration: 6000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not link this site to the chat vault:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const closeRegistration = () => {
    if (!busy) setRegistrationMode(null);
  };

  const closeVaultLink = () => {
    if (busy) return;
    setVaultLinkMode(null);
    setVaultLinkTarget(null);
    setVaultLinkRequestCode("");
    setVaultLinkResponseCode("");
    setVaultLinkOutputCode("");
  };

  const updateVaultLinkRequestCode = (value: string) => {
    setVaultLinkRequestCode(value);
    try {
      setVaultLinkRequestedOrigin(getVaultLinkRequestOrigin(value));
    } catch {
      setVaultLinkRequestedOrigin("");
    }
  };

  const copyVaultLinkCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toaster.create({
        title: t("zk_storage_link_code_copied"),
        duration: 3000,
        type: "success",
      });
    } catch (error) {
      console.warn("Could not copy vault link code:", error);
    }
  };

  const registerCredential = async () => {
    const addingToExistingKey = registrationMode === "additional";
    setBusy(true);
    try {
      if (addingToExistingKey) {
        const updatedKey = await registerAdditionalPasskey(
          user,
          credentialName,
          authorizationCredentialId
        );
        setVaultKey(updatedKey);
        markActiveCredential(authorizationCredentialId);
      } else {
        const result = await enableZeroKnowledgeStorage(user, {
          credentialName,
        });
        setVaultKey(result.userKey);
        if (result.userKey.credentialId) {
          markActiveCredential(result.userKey.credentialId);
        }
        setGeneral({ zkStorage: true });
        setKeyStatus("unlocked");
      }
      setRegistrationMode(null);
      toaster.create({
        title: t(
          addingToExistingKey ? "zk_storage_passkey_added" : "zk_storage_enabled"
        ),
        description: t(
          addingToExistingKey
            ? "zk_storage_passkey_added_help"
            : "zk_storage_enabled_help"
        ),
        duration: 6000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not register a passkey:", error);
      const errorKey = getZeroKnowledgeStorageErrorKey(error);
      toaster.create({
        title: t("zk_storage_error"),
        description:
          errorKey
            ? t(errorKey)
            : error instanceof Error
              ? error.message
              : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const unlock = async (credentialId: string) => {
    setBusy(true);
    try {
      const result = await enableZeroKnowledgeStorage(user, { credentialId });
      setVaultKey(result.userKey);
      markActiveCredential(credentialId);
      setGeneral({ zkStorage: true });
      setKeyStatus("unlocked");
      window.dispatchEvent(new Event("zk-storage-key-available"));
    } catch (error) {
      console.error("Could not unlock encrypted chat storage:", error);
      const errorKey = getZeroKnowledgeStorageErrorKey(error);
      toaster.create({
        title: t("zk_storage_error"),
        description:
          errorKey
            ? t(errorKey)
            : error instanceof Error
              ? error.message
              : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const renameCredential = async (credential: VaultCredential) => {
    const name = editingCredentialName.trim();
    if (!name) return;

    setBusy(true);
    try {
      const renamed = await chatVault.renameMyCredential(
        credential.credentialId,
        name
      );
      setVaultKey((current) => {
        if (!current) return current;
        const currentCredentials = getCredentials(current);
        const updatedCredentials = currentCredentials.map((item) =>
          item.credentialId === renamed.credentialId
            ? { ...item, name: renamed.credentialName }
            : item
        );
        return {
          ...current,
          credentialName:
            current.credentialId === renamed.credentialId
              ? renamed.credentialName
              : current.credentialName,
          credentials: updatedCredentials,
        };
      });
      setEditingCredentialId(null);
      toaster.create({
        title: t("zk_storage_passkey_renamed"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not rename a passkey:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteCredential = async (credential: VaultCredential) => {
    const confirmed = window.confirm(
      t("zk_storage_delete_passkey_confirm", { name: credential.name })
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await chatVault.deleteMyCredential(credential.credentialId);
      setVaultKey((current) => {
        if (!current) return current;
        const remainingCredentials = getCredentials(current).filter(
          (item) => item.credentialId !== credential.credentialId
        );
        const primaryCredential =
          remainingCredentials.find(
            (item) => item.credentialId === current.credentialId
          ) ?? remainingCredentials[0];
        return {
          ...current,
          credentialId: primaryCredential?.credentialId ?? current.credentialId,
          credentialName: primaryCredential?.name ?? current.credentialName,
          credentials: remainingCredentials,
        };
      });
      if (editingCredentialId === credential.credentialId) {
        setEditingCredentialId(null);
      }
      if (activeCredentialId === credential.credentialId) {
        void clearActiveCredentialId().catch((error) => {
          console.warn("Could not clear the active passkey indicator:", error);
        });
        setActiveCredentialId(null);
      }
      toaster.create({
        title: t("zk_storage_passkey_deleted"),
        description: t("zk_storage_passkey_deleted_help"),
        duration: 7000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not delete a passkey:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const setEmailDiscovery = async (enabled: boolean) => {
    setBusy(true);
    try {
      const result = await chatVault.setIdentityDisclosure(
        enabled ? "profile" : "subject"
      );
      setVaultKey((current) =>
        current ? { ...current, identityDisclosure: result.identityDisclosure } : current
      );
      toaster.create({
        title: t(
          enabled
            ? "zk_storage_email_discovery_enabled"
            : "zk_storage_email_discovery_disabled"
        ),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not change email discovery:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    const confirmed = window.confirm(t("zk_storage_disable_confirm"));
    if (!confirmed) return;

    setBusy(true);
    try {
      await clearPrivateKey();
      setGeneral({ zkStorage: false });
      setKeyStatus("idle");
      setActiveCredentialId(null);
      toaster.create({
        title: t("zk_storage_disabled"),
        description: t("zk_storage_disabled_help"),
        duration: 6000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not disable encrypted chat storage:", error);
      toaster.create({
        title: t("zk_storage_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field.Root mt="4">
      <Switch
        id="zk-storage"
        checked={enabled}
        disabled={busy || loadingAccountKey || !userIdentity}
        onChange={(event) => {
          if (event.target.checked) {
            if (vaultKey) {
              if (credentials.length === 0 && activeCredentialId) {
                void unlock(activeCredentialId);
              } else if (credentials.length === 0) {
                void openVaultLinkDestination();
              } else {
                setGeneral({ zkStorage: true });
              }
            } else {
              openRegistration("initial");
            }
          } else {
            void disable();
          }
        }}
      >
        {t("zk_storage_label")}
      </Switch>
      <Field.HelperText>{t("zk_storage_help")}</Field.HelperText>
      {enabled && keyStatus === "checking" && (
        <Field.HelperText>{t("zk_storage_checking")}</Field.HelperText>
      )}
      {enabled && keyStatus === "unlocked" && (
        <Stack align="start" gap="1">
          <Field.HelperText>{t("zk_storage_unlocked")}</Field.HelperText>
          <Field.HelperText>
            {t("zk_storage_choose_other_passkey_help")}
          </Field.HelperText>
        </Stack>
      )}
      {enabled && keyStatus === "locked" && (
        <Field.HelperText>{t("zk_storage_locked_help")}</Field.HelperText>
      )}
      {enabled && (
        <Field.Root mt="3">
          <Switch
            id="zk-lazy-history"
            checked={lazyHistory}
            disabled={busy}
            onChange={(event) => {
              setGeneral({ zkLazyHistory: event.target.checked });
            }}
          >
            {t("zk_lazy_history_label")}
          </Switch>
          <Field.HelperText>{t("zk_lazy_history_help")}</Field.HelperText>
        </Field.Root>
      )}
      {vaultKey && keyStatus === "unlocked" && (
        <Field.Root mt="3">
          <Switch
            id="zk-email-discovery"
            checked={vaultKey.identityDisclosure === "profile"}
            disabled={busy}
            onChange={(event) => void setEmailDiscovery(event.target.checked)}
          >
            {t("zk_storage_email_discovery_label")}
          </Switch>
          <Field.HelperText>
            {t("zk_storage_email_discovery_help")}
          </Field.HelperText>
        </Field.Root>
      )}
      {vaultKey && (
        <Stack mt="3" align="start" gap="2" width="full">
          <Text fontWeight="semibold">{t("zk_storage_your_passkeys")}</Text>
          {credentials.length === 0 && (
            <Stack align="start" gap="2" width="full">
              <Field.HelperText>
                {t("zk_storage_no_passkey_for_site")}
              </Field.HelperText>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || loadingAccountKey}
                loading={busy}
                onClick={() => void openVaultLinkDestination()}
              >
                {t("zk_storage_link_vault")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={openVaultLinkSource}
              >
                {t("zk_storage_link_another_site")}
              </Button>
            </Stack>
          )}
          {credentials.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={openVaultLinkSource}
            >
              {t("zk_storage_link_another_site")}
            </Button>
          )}
          {credentials.map((credential) => (
            <Stack
              key={credential.credentialId}
              align="start"
              gap="0"
              borderWidth="1px"
              borderRadius="md"
              padding="2"
              width="full"
            >
              {editingCredentialId === credential.credentialId ? (
                <Stack align="start" gap="2" width="full">
                  <Input
                    maxLength={80}
                    value={editingCredentialName}
                    onChange={(event) =>
                      setEditingCredentialName(event.target.value)
                    }
                    aria-label={t("zk_storage_passkey_name_label")}
                  />
                  <Stack direction="row" gap="2">
                    <Button
                      size="sm"
                      disabled={busy || !editingCredentialName.trim()}
                      loading={busy}
                      onClick={() => void renameCredential(credential)}
                    >
                      {t("zk_storage_save_name")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setEditingCredentialId(null)}
                    >
                      {t("zk_storage_cancel")}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <>
                  <Stack direction="row" align="center" gap="2">
                    <Text>{credential.name}</Text>
                    {activeCredentialId === credential.credentialId && (
                      <Text fontSize="sm" color="fg.muted">
                        {t("zk_storage_active_passkey")}
                      </Text>
                    )}
                  </Stack>
                  {credential.createdAt && (
                    <Text fontSize="sm" color="fg.muted">
                      {t("zk_storage_passkey_created", {
                        date: new Date(
                          credential.createdAt
                        ).toLocaleDateString(),
                      })}
                    </Text>
                  )}
                  {enabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void unlock(credential.credentialId)}
                    >
                      {t("zk_storage_unlock_with", { name: credential.name })}
                    </Button>
                  )}
                  <Stack direction="row" gap="2" mt="2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => {
                        setEditingCredentialName(credential.name);
                        setEditingCredentialId(credential.credentialId);
                      }}
                    >
                      {t("zk_storage_rename_passkey")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      colorPalette="red"
                      disabled={busy || !(credential.canDelete ?? credentials.length > 1)}
                      onClick={() => void deleteCredential(credential)}
                    >
                      {t("zk_storage_delete_passkey")}
                    </Button>
                  </Stack>
                </>
              )}
            </Stack>
          ))}
          {credentials.length === 1 && !credentials[0]?.canDelete && (
            <Field.HelperText>
              {t("zk_storage_last_credential_help")}
            </Field.HelperText>
          )}
          {keyStatus === "unlocked" && (
            credentials.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => openRegistration("additional")}
              >
                {t("zk_storage_add_passkey")}
              </Button>
            )
          )}
        </Stack>
      )}

      <Dialog.Root
        open={vaultLinkMode !== null}
        onOpenChange={(event) => {
          if (!event.open) closeVaultLink();
        }}
        closeOnEscape={!busy}
        closeOnInteractOutside={!busy}
        size="lg"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {t(
                    vaultLinkMode === "source"
                      ? "zk_storage_link_source_title"
                      : "zk_storage_link_target_title"
                  )}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {vaultLinkMode === "destination" ? (
                  <Stack gap="4" align="stretch">
                    <Text>{t("zk_storage_link_target_help")}</Text>
                    <Field.Root>
                      <Field.Label>{t("zk_storage_link_request_code")}</Field.Label>
                      <Input
                        readOnly
                        value={vaultLinkTarget?.requestCode ?? ""}
                        aria-label={t("zk_storage_link_request_code")}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!vaultLinkTarget || busy}
                        onClick={() =>
                          vaultLinkTarget &&
                          void copyVaultLinkCode(vaultLinkTarget.requestCode)
                        }
                      >
                        {t("zk_storage_link_copy_code")}
                      </Button>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t("zk_storage_link_response_code")}</Field.Label>
                      <Input
                        value={vaultLinkResponseCode}
                        onChange={(event) =>
                          setVaultLinkResponseCode(event.target.value)
                        }
                        aria-label={t("zk_storage_link_response_code")}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>{t("zk_storage_passkey_name_label")}</Field.Label>
                      <Input
                        maxLength={80}
                        value={credentialName}
                        onChange={(event) => setCredentialName(event.target.value)}
                        placeholder={t("zk_storage_passkey_name_placeholder")}
                      />
                    </Field.Root>
                  </Stack>
                ) : (
                  <Stack gap="4" align="stretch">
                    <Text>{t("zk_storage_link_source_help")}</Text>
                    <Field.Root>
                      <Field.Label>{t("zk_storage_link_request_code")}</Field.Label>
                      <Input
                        value={vaultLinkRequestCode}
                        onChange={(event) =>
                          updateVaultLinkRequestCode(event.target.value)
                        }
                        aria-label={t("zk_storage_link_request_code")}
                      />
                      {vaultLinkRequestedOrigin && (
                        <Field.HelperText>
                          {t("zk_storage_link_target_origin", {
                            origin: vaultLinkRequestedOrigin,
                          })}
                        </Field.HelperText>
                      )}
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>
                        {t("zk_storage_confirm_with_passkey_label")}
                      </Field.Label>
                      <RadioGroup
                        value={vaultLinkSourceCredentialId}
                        onValueChange={(event) =>
                          setVaultLinkSourceCredentialId(event.value)
                        }
                      >
                        <Stack gap="2">
                          {credentials.length > 0
                            ? credentials.map((credential) => (
                                <Radio
                                  key={credential.credentialId}
                                  value={credential.credentialId}
                                >
                                  {credential.name}
                                </Radio>
                              ))
                            : activeCredentialId ? (
                                <Radio value={activeCredentialId}>
                                  {t("zk_storage_passkey_on_this_site")}
                                </Radio>
                              ) : (
                                <Radio value={DISCOVERABLE_PASSKEY}>
                                  {t("zk_storage_choose_passkey")}
                                </Radio>
                              )}
                        </Stack>
                      </RadioGroup>
                    </Field.Root>
                    {vaultLinkOutputCode && (
                      <Field.Root>
                        <Field.Label>
                          {t("zk_storage_link_response_code")}
                        </Field.Label>
                        <Input readOnly value={vaultLinkOutputCode} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyVaultLinkCode(vaultLinkOutputCode)}
                        >
                          {t("zk_storage_link_copy_code")}
                        </Button>
                      </Field.Root>
                    )}
                  </Stack>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={closeVaultLink}
                >
                  {t("zk_storage_cancel")}
                </Button>
                {vaultLinkMode === "destination" ? (
                  <Button
                    disabled={
                      busy ||
                      !vaultLinkTarget ||
                      !credentialName.trim() ||
                      !vaultLinkResponseCode.trim()
                    }
                    loading={busy}
                    onClick={() => void finishVaultLink()}
                  >
                    {busy
                      ? t("zk_storage_registering_passkey")
                      : t("zk_storage_register_passkey")}
                  </Button>
                ) : (
                  <Button
                    disabled={
                      busy ||
                      !vaultLinkRequestCode.trim() ||
                      !vaultLinkRequestedOrigin ||
                      !vaultLinkSourceCredentialId
                    }
                    loading={busy}
                    onClick={() => void createVaultLink()}
                  >
                    {t("zk_storage_link_prepare_response")}
                  </Button>
                )}
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        open={registrationMode !== null}
        onOpenChange={(event) => {
          if (!event.open) closeRegistration();
        }}
        closeOnEscape={!busy}
        closeOnInteractOutside={!busy}
        size="md"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>
                  {registrationMode === "additional"
                    ? t("zk_storage_add_passkey_title")
                    : t("zk_storage_register_passkey_title")}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Field.Root>
                  <Field.Label>{t("zk_storage_passkey_name_label")}</Field.Label>
                  <Input
                    autoFocus
                    maxLength={80}
                    value={credentialName}
                    onChange={(event) => setCredentialName(event.target.value)}
                    placeholder={t("zk_storage_passkey_name_placeholder")}
                  />
                  <Field.HelperText>
                    {t(
                      registrationMode === "additional"
                        ? "zk_storage_add_passkey_confirmation_help"
                        : "zk_storage_passkey_name_help"
                    )}
                  </Field.HelperText>
                </Field.Root>
                {registrationMode === "additional" && (
                  <Field.Root mt="4">
                    <Field.Label>
                      {t("zk_storage_confirm_with_passkey_label")}
                    </Field.Label>
                    <RadioGroup
                      value={authorizationCredentialId}
                      onValueChange={(event) =>
                        setAuthorizationCredentialId(event.value)
                      }
                    >
                      <Stack gap="2">
                        {credentials.map((credential) => (
                          <Radio
                            key={credential.credentialId}
                            value={credential.credentialId}
                          >
                            {credential.name}
                          </Radio>
                        ))}
                      </Stack>
                    </RadioGroup>
                  </Field.Root>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={closeRegistration}
                >
                  {t("zk_storage_cancel")}
                </Button>
                <Button
                  disabled={
                    busy ||
                    !credentialName.trim() ||
                    (registrationMode === "additional" &&
                      !authorizationCredentialId)
                  }
                  loading={busy}
                  onClick={() => void registerCredential()}
                >
                  {busy
                    ? t("zk_storage_registering_passkey")
                    : t("zk_storage_register_passkey")}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Field.Root>
  );
}
