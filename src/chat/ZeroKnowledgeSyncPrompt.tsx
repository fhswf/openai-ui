import { useEffect, useState } from "react";
import { Button, Dialog, Portal, Stack, Text } from "@chakra-ui/react";
import { t } from "i18next";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import {
  chatVault,
  type VaultCredential,
  type VaultUserKey,
} from "./service/chatVault";
import {
  enableZeroKnowledgeStorage,
  getZeroKnowledgeStorageErrorKey,
} from "./utils/zeroKnowledgeStorage";

export function ZeroKnowledgeSyncPrompt() {
  const { user, options } = useGlobal();
  const { setGeneral } = useOptions();
  const enabled = options.general.zkStorage ?? false;
  const identityValue = user?.sub ?? user?.id ?? user?.email ?? null;
  const identity = identityValue == null ? null : String(identityValue);
  const [availableFor, setAvailableFor] = useState<string | null>(null);
  const [userKey, setUserKey] = useState<VaultUserKey | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!identity || enabled) {
      setAvailableFor(null);
      return;
    }

    let cancelled = false;
    setAvailableFor(null);
    setUserKey(null);
    chatVault
      .getMyKey()
      .then((key) => {
        if (!cancelled) {
          setUserKey(key);
          setAvailableFor(identity);
        }
      })
      .catch((error) => {
        // A 404 means this account has not enabled encrypted storage. Other
        // errors should not interrupt normal sign-in or chat use.
        if (error?.status !== 404) {
          console.warn("Could not check for encrypted chat storage:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [identity, enabled]);

  const open = Boolean(
    identity &&
      availableFor === identity &&
      dismissedFor !== identity &&
      !enabled
  );

  const dismiss = () => {
    if (identity) setDismissedFor(identity);
  };

  const credentials: VaultCredential[] = userKey
    ? userKey.credentials?.length
      ? userKey.credentials
      : [
          {
            credentialId: userKey.credentialId,
            name: userKey.credentialName || t("zk_storage_default_passkey_name"),
            createdAt: "",
          },
        ]
    : [];

  const unlock = async (credentialId: string) => {
    setBusy(true);
    try {
      await enableZeroKnowledgeStorage(user, { credentialId });
      setGeneral({ zkStorage: true });
      setAvailableFor(null);
      dismiss();
      toaster.create({
        title: t("zk_storage_enabled"),
        description: t("zk_storage_enabled_help"),
        duration: 6000,
        type: "success",
      });
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

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => {
        if (!event.open && !busy) dismiss();
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
              <Dialog.Title>{t("zk_storage_sync_prompt_title")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap="3" align="stretch">
                <Text>{t("zk_storage_sync_prompt_description")}</Text>
                <Text fontWeight="semibold">
                  {t("zk_storage_choose_passkey")}
                </Text>
                {credentials.map((credential) => (
                  <Button
                    key={credential.credentialId}
                    variant="outline"
                    disabled={busy}
                    loading={busy}
                    onClick={() => void unlock(credential.credentialId)}
                  >
                    {t("zk_storage_unlock_with", { name: credential.name })}
                  </Button>
                ))}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={busy} onClick={dismiss}>
                {t("zk_storage_sync_prompt_later")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
