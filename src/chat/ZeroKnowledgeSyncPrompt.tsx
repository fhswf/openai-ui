import { useEffect, useState } from "react";
import { Button, Dialog, Portal, Text } from "@chakra-ui/react";
import { t } from "i18next";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import { chatVault } from "./service/chatVault";
import { enableZeroKnowledgeStorage } from "./utils/zeroKnowledgeStorage";

export function ZeroKnowledgeSyncPrompt() {
  const { user, options } = useGlobal();
  const { setGeneral } = useOptions();
  const enabled = options.general.zkStorage ?? false;
  const identityValue = user?.sub ?? user?.id ?? user?.email ?? null;
  const identity = identityValue == null ? null : String(identityValue);
  const [availableFor, setAvailableFor] = useState<string | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!identity || enabled) {
      setAvailableFor(null);
      return;
    }

    let cancelled = false;
    setAvailableFor(null);
    chatVault
      .getMyKey()
      .then(() => {
        if (!cancelled) setAvailableFor(identity);
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

  const unlock = async () => {
    setBusy(true);
    try {
      await enableZeroKnowledgeStorage(user);
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
              <Text>{t("zk_storage_sync_prompt_description")}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" disabled={busy} onClick={dismiss}>
                {t("zk_storage_sync_prompt_later")}
              </Button>
              <Button
                disabled={busy}
                loading={busy}
                onClick={() => void unlock()}
              >
                {busy
                  ? t("zk_storage_unlocking")
                  : t("zk_storage_sync_prompt_action")}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
