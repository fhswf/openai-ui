import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  createListCollection,
  Field,
  Select,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "../components/ui/dialog";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import { consumeSharedContent } from "./service/shareTarget";
import type { CustomGpt, SharedTargetContent } from "./context/types";

function formatSharedContent(
  shared: SharedTargetContent,
  t: (key: string) => string
) {
  const items = [
    shared.title ? `${t("share_title_label")}: ${shared.title}` : "",
    shared.url ? `${t("share_url_label")}: ${shared.url}` : "",
    shared.text ? `${t("share_text_label")}: ${shared.text}` : "",
    shared.files.length
      ? `${t("share_files_label")}: ${shared.files
          .map((file) => file.name)
          .join(", ")}`
      : "",
  ].filter(Boolean);
  return items.join("\n\n");
}

export function ShareTargetHandler() {
  const { is, options, setIs, startCustomGptSummary } = useGlobal();
  const { t } = useTranslation();
  const [shared, setShared] = useState<SharedTargetContent | null>(null);
  const [selectedGptId, setSelectedGptId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const customGpts: CustomGpt[] = Array.isArray(options.general.customGpts)
    ? options.general.customGpts
    : [];
  const selectedGpt = customGpts.find((item) => item.id === selectedGptId);
  const canSummarize = Boolean(
    selectedGpt && selectedGpt.systemPrompt.trim()
  );

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const shareId = currentUrl.searchParams.get("share");
    const shareFailed = currentUrl.searchParams.has("shareError");
    if (!shareId && !shareFailed) return;

    currentUrl.searchParams.delete("share");
    currentUrl.searchParams.delete("shareError");
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );

    if (shareFailed) {
      toaster.create({
        title: t("error_occurred"),
        description: t("share_target_load_error"),
        duration: 6000,
        type: "error",
      });
    }
    if (shareId) {
      consumeSharedContent(shareId)
        .then((content) => {
          if (!content) {
            toaster.create({
              title: t("error_occurred"),
              description: t("share_target_load_error"),
              duration: 6000,
              type: "error",
            });
            return;
          }
          setShared(content);
        })
        .catch((error) => {
          console.error("Could not load shared content:", error);
          toaster.create({
            title: t("error_occurred"),
            description: t("share_target_load_error"),
            duration: 6000,
            type: "error",
          });
        });
    }
  }, [t]);

  useEffect(() => {
    if (!customGpts.some((item) => item.id === selectedGptId)) {
      setSelectedGptId(customGpts[0]?.id ?? "");
    }
  }, [customGpts, selectedGptId]);

  const dismiss = () => {
    setShared(null);
    setSubmitting(false);
  };

  const generateSummary = async () => {
    if (!shared || !selectedGpt || !canSummarize || submitting) return;
    setSubmitting(true);
    try {
      await startCustomGptSummary(selectedGpt, shared);
      dismiss();
    } catch (error) {
      console.error("Could not start the shared content summary:", error);
      toaster.create({
        title: t("error_occurred"),
        description: error instanceof Error ? error.message : String(error),
        duration: 6000,
        type: "error",
      });
      setSubmitting(false);
    }
  };

  const gptItems = customGpts.map((item) => ({
    value: item.id,
    label: item.name || t("custom_gpt_default_name"),
  }));
  const optionsCollection = createListCollection({ items: gptItems });
  const open = Boolean(shared) && !is.config;

  return (
    <DialogRoot
      open={open}
      onOpenChange={(event) => {
        if (!event.open && !is.config) dismiss();
      }}
      size="lg"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("share_target_title")}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <DialogBody>
          <Stack gap="4">
            <Text>{t("share_target_description")}</Text>
            {shared && (
              <Box
                borderWidth="1px"
                borderRadius="md"
                padding="3"
                maxH="12rem"
                overflowY="auto"
              >
                <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
                  {formatSharedContent(shared, t)}
                </Text>
              </Box>
            )}

            {customGpts.length > 0 ? (
              <Field.Root>
                <Field.Label>{t("share_select_custom_gpt")}</Field.Label>
                <Select.Root
                  collection={optionsCollection}
                  value={selectedGptId ? [selectedGptId] : []}
                  onValueChange={(event) =>
                    setSelectedGptId(event.value[0] ?? "")
                  }
                >
                  <Select.Trigger>
                    <Select.ValueText
                      placeholder={t("share_select_custom_gpt_placeholder")}
                    />
                  </Select.Trigger>
                  <Select.Content>
                    {gptItems.map((item) => (
                      <Select.Item item={item} key={item.value}>
                        {item.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {selectedGpt && !selectedGpt.systemPrompt.trim() && (
                  <Field.HelperText>
                    {t("share_custom_gpt_requires_prompt")}
                  </Field.HelperText>
                )}
              </Field.Root>
            ) : (
              <Stack align="flex-start" gap="3">
                <Text>{t("share_no_custom_gpt")}</Text>
                <Button
                  variant="outline"
                  onClick={() => setIs({ config: true })}
                >
                  {t("share_create_custom_gpt")}
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            {t("share_cancel")}
          </Button>
          {customGpts.length > 0 && (
            <Button
              colorPalette="blue"
              onClick={() => void generateSummary()}
              disabled={!canSummarize || submitting}
              loading={submitting}
            >
              {t("share_summary_button")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
