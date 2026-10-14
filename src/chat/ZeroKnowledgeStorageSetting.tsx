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
import { Switch } from "../components/ui/switch";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import {
  chatVault,
  type VaultCredential,
  type VaultUserKey,
} from "./service/chatVault";
import { clearPrivateKey, loadPrivateKey } from "./utils/zeroKnowledgeKeystore";
import {
  enableZeroKnowledgeStorage,
  getZeroKnowledgeStorageErrorKey,
  isPrivateKeyForUser,
  registerAdditionalPasskey,
} from "./utils/zeroKnowledgeStorage";

type KeyStatus = "idle" | "checking" | "unlocked" | "locked";
type RegistrationMode = "initial" | "additional" | null;

function getCredentials(key: VaultUserKey | null): VaultCredential[] {
  if (!key) return [];
  if (key.credentials?.length) return key.credentials;
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
  const userIdentity = user?.sub ?? user?.id ?? user?.email ?? null;
  const [busy, setBusy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [vaultKey, setVaultKey] = useState<VaultUserKey | null>(null);
  const [loadingAccountKey, setLoadingAccountKey] = useState(false);
  const [registrationMode, setRegistrationMode] =
    useState<RegistrationMode>(null);
  const [credentialName, setCredentialName] = useState("");

  const credentials = useMemo(() => getCredentials(vaultKey), [vaultKey]);

  useEffect(() => {
    if (!userIdentity) {
      setVaultKey(null);
      setKeyStatus("idle");
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
        if (!cancelled) {
          setVaultKey(key);
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
    setRegistrationMode(mode);
  };

  const closeRegistration = () => {
    if (!busy) setRegistrationMode(null);
  };

  const registerCredential = async () => {
    const addingToExistingKey = registrationMode === "additional";
    setBusy(true);
    try {
      if (addingToExistingKey) {
        const updatedKey = await registerAdditionalPasskey(user, credentialName);
        setVaultKey(updatedKey);
      } else {
        const result = await enableZeroKnowledgeStorage(user, {
          credentialName,
        });
        setVaultKey(result.userKey);
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

  const disable = async () => {
    const confirmed = window.confirm(t("zk_storage_disable_confirm"));
    if (!confirmed) return;

    setBusy(true);
    try {
      await chatVault.deleteMyKey();
      await clearPrivateKey();
      setGeneral({ zkStorage: false });
      setVaultKey(null);
      setKeyStatus("idle");
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
              setGeneral({ zkStorage: true });
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
        <Field.HelperText>{t("zk_storage_unlocked")}</Field.HelperText>
      )}
      {enabled && keyStatus === "locked" && (
        <Stack align="start" gap="2">
          <Field.HelperText>{t("zk_storage_locked_help")}</Field.HelperText>
          {credentials.map((credential) => (
            <Button
              key={credential.credentialId}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void unlock(credential.credentialId)}
            >
              {t("zk_storage_unlock_with", { name: credential.name })}
            </Button>
          ))}
        </Stack>
      )}
      {vaultKey && (
        <Stack mt="3" align="start" gap="2" width="full">
          <Text fontWeight="semibold">{t("zk_storage_your_passkeys")}</Text>
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
              <Text>{credential.name}</Text>
              {credential.createdAt && (
                <Text fontSize="sm" color="fg.muted">
                  {t("zk_storage_passkey_created", {
                    date: new Date(credential.createdAt).toLocaleDateString(),
                  })}
                </Text>
              )}
            </Stack>
          ))}
          {keyStatus === "unlocked" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => openRegistration("additional")}
            >
              {t("zk_storage_add_passkey")}
            </Button>
          )}
        </Stack>
      )}

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
                    {t("zk_storage_passkey_name_help")}
                  </Field.HelperText>
                </Field.Root>
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
                  disabled={busy || !credentialName.trim()}
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
