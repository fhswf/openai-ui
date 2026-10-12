import { useEffect, useState } from "react";
import { Button, Field } from "@chakra-ui/react";
import { t } from "i18next";
import { Switch } from "../components/ui/switch";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import { chatVault } from "./service/chatVault";
import { clearPrivateKey, loadPrivateKey } from "./utils/zeroKnowledgeKeystore";
import {
  enableZeroKnowledgeStorage,
  isPrivateKeyForUser,
} from "./utils/zeroKnowledgeStorage";

type KeyStatus = "idle" | "checking" | "unlocked" | "locked";

export function ZeroKnowledgeStorageSetting() {
  const { options, user } = useGlobal();
  const { setGeneral } = useOptions();
  const enabled = options.general.zkStorage ?? false;
  const userIdentity = user?.sub ?? user?.id ?? user?.email ?? null;
  const [busy, setBusy] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");

  useEffect(() => {
    if (!enabled) {
      setKeyStatus("idle");
      return;
    }

    let cancelled = false;
    setKeyStatus("checking");
    Promise.all([loadPrivateKey(), chatVault.getMyKey()])
      .then(async ([privateKey, userKey]) => {
        const unlocked =
          privateKey && (await isPrivateKeyForUser(privateKey, userKey));
        if (!cancelled) setKeyStatus(unlocked ? "unlocked" : "locked");
      })
      .catch((error) => {
        console.error("Could not inspect the local chat key:", error);
        if (!cancelled) setKeyStatus("locked");
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, userIdentity]);

  const enable = async () => {
    setBusy(true);
    try {
      await enableZeroKnowledgeStorage(user);
      setGeneral({ zkStorage: true });
      setKeyStatus("unlocked");
      if (enabled) {
        window.dispatchEvent(new Event("zk-storage-key-available"));
      }
      toaster.create({
        title: t("zk_storage_enabled"),
        description: t("zk_storage_enabled_help"),
        duration: 6000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not enable encrypted chat storage:", error);
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
      await chatVault.deleteMyKey();
      await clearPrivateKey();
      setGeneral({ zkStorage: false });
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
        disabled={busy}
        onChange={(event) => {
          if (event.target.checked) {
            void enable();
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
        <>
          <Field.HelperText>{t("zk_storage_locked_help")}</Field.HelperText>
          <Button
            alignSelf="start"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void enable()}
          >
            {busy ? t("zk_storage_unlocking") : t("zk_storage_unlock")}
          </Button>
        </>
      )}
    </Field.Root>
  );
}
