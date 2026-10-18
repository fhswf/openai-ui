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

type Translate = (key: string) => string;

function showShareLoadError(t: Translate) {
  toaster.create({
    title: t("error_occurred"),
    description: t("share_target_load_error"),
    duration: 6000,
    type: "error",
  });
}

function consumeShareParams() {
  const currentUrl = new URL(window.location.href);
  const shareId = currentUrl.searchParams.get("share");
  const shareFailed = currentUrl.searchParams.has("shareError");
  if (!shareId && !shareFailed) return null;

  currentUrl.searchParams.delete("share");
  currentUrl.searchParams.delete("shareError");
  window.history.replaceState(
    window.history.state,
    "",
    `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
  );
  return { shareId, shareFailed };
}

async function loadSharedContent(
  t: Translate,
  setShared: React.Dispatch<
    React.SetStateAction<SharedTargetContent | null>
  >
) {
  const params = consumeShareParams();
  if (!params) return;
  if (params.shareFailed) showShareLoadError(t);
  if (!params.shareId) return;

  try {
    const content = await consumeSharedContent(params.shareId);
    if (!content) {
      showShareLoadError(t);
      return;
    }
    setShared(content);
  } catch (error) {
    console.error("Could not load shared content:", error);
    showShareLoadError(t);
  }
}

function useSharedContent(t: Translate) {
  const [shared, setShared] = useState<SharedTargetContent | null>(null);
  useEffect(() => {
    void loadSharedContent(t, setShared);
  }, [t]);
  return { shared, setShared };
}

function useSelectedGpt(customGpts: CustomGpt[]) {
  const [selectedGptId, setSelectedGptId] = useState("");
  useEffect(() => {
    if (!customGpts.some((item) => item.id === selectedGptId)) {
      setSelectedGptId(customGpts[0]?.id ?? "");
    }
  }, [customGpts, selectedGptId]);
  return {
    selectedGptId,
    setSelectedGptId,
    selectedGpt: customGpts.find((item) => item.id === selectedGptId),
  };
}

function formatSharedContent(shared: SharedTargetContent, t: Translate) {
  return [
    shared.title ? `${t("share_title_label")}: ${shared.title}` : "",
    shared.url ? `${t("share_url_label")}: ${shared.url}` : "",
    shared.text ? `${t("share_text_label")}: ${shared.text}` : "",
    shared.files.length
      ? `${t("share_files_label")}: ${shared.files
          .map((file) => file.name)
          .join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function SharedContentPreview({ shared }: { shared: SharedTargetContent }) {
  const { t } = useTranslation();
  return (
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
  );
}

type CustomGptSelectionProps = {
  customGpts: CustomGpt[];
  selectedGptId: string;
  selectedGpt?: CustomGpt;
  onSelect: (id: string) => void;
  onCreate: () => void;
};

function NoCustomGptOption({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <Stack align="flex-start" gap="3">
      <Text>{t("share_no_custom_gpt")}</Text>
      <Button variant="outline" onClick={onCreate}>
        {t("share_create_custom_gpt")}
      </Button>
    </Stack>
  );
}

type GptSelectFieldProps = {
  items: { value: string; label: string }[];
  selectedGptId: string;
  selectedGpt?: CustomGpt;
  onSelect: (id: string) => void;
};

function GptSelectField({
  items,
  selectedGptId,
  selectedGpt,
  onSelect,
}: GptSelectFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("share_select_custom_gpt")}</Field.Label>
      <Select.Root
        collection={createListCollection({ items })}
        value={selectedGptId ? [selectedGptId] : []}
        onValueChange={(event) => onSelect(event.value[0] ?? "")}
      >
        <Select.Trigger>
          <Select.ValueText
            placeholder={t("share_select_custom_gpt_placeholder")}
          />
        </Select.Trigger>
        <Select.Content>
          {items.map((item) => (
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
  );
}

function CustomGptSelection({
  customGpts,
  selectedGptId,
  selectedGpt,
  onSelect,
  onCreate,
}: CustomGptSelectionProps) {
  const { t } = useTranslation();
  if (!customGpts.length) return <NoCustomGptOption onCreate={onCreate} />;

  const items = customGpts.map((item) => ({
    value: item.id,
    label: item.name || t("custom_gpt_default_name"),
  }));
  return (
    <GptSelectField
      items={items}
      selectedGptId={selectedGptId}
      selectedGpt={selectedGpt}
      onSelect={onSelect}
    />
  );
}

type SubmitSummaryArgs = {
  shared: SharedTargetContent | null;
  selectedGpt?: CustomGpt;
  canSummarize: boolean;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  startCustomGptSummary: (
    customGpt: CustomGpt,
    content: SharedTargetContent
  ) => Promise<void>;
  dismiss: () => void;
  t: Translate;
};

async function submitSummary({
  shared,
  selectedGpt,
  canSummarize,
  submitting,
  setSubmitting,
  startCustomGptSummary,
  dismiss,
  t,
}: SubmitSummaryArgs) {
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
}

type ShareTargetDialogProps = {
  open: boolean;
  canDismiss: boolean;
  shared: SharedTargetContent | null;
  customGpts: CustomGpt[];
  selectedGptId: string;
  selectedGpt?: CustomGpt;
  canSummarize: boolean;
  submitting: boolean;
  onSelectGpt: (id: string) => void;
  onCreateGpt: () => void;
  onDismiss: () => void;
  onGenerateSummary: () => void;
};

function ShareDialogBody(props: ShareTargetDialogProps) {
  const { t } = useTranslation();
  return (
    <DialogBody>
      <Stack gap="4">
        <Text>{t("share_target_description")}</Text>
        {props.shared && <SharedContentPreview shared={props.shared} />}
        <CustomGptSelection
          customGpts={props.customGpts}
          selectedGptId={props.selectedGptId}
          selectedGpt={props.selectedGpt}
          onSelect={props.onSelectGpt}
          onCreate={props.onCreateGpt}
        />
      </Stack>
    </DialogBody>
  );
}

function ShareDialogFooter(props: ShareTargetDialogProps) {
  const { t } = useTranslation();
  return (
    <DialogFooter>
      <Button variant="outline" onClick={props.onDismiss}>
        {t("share_cancel")}
      </Button>
      {props.customGpts.length > 0 && (
        <Button
          colorPalette="blue"
          onClick={props.onGenerateSummary}
          disabled={!props.canSummarize || props.submitting}
          loading={props.submitting}
        >
          {t("share_summary_button")}
        </Button>
      )}
    </DialogFooter>
  );
}

function ShareTargetDialog(props: ShareTargetDialogProps) {
  const { t } = useTranslation();
  return (
    <DialogRoot
      open={props.open}
      onOpenChange={(event) => {
        if (!event.open && props.canDismiss) props.onDismiss();
      }}
      size="lg"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("share_target_title")}</DialogTitle>
          <DialogCloseTrigger />
        </DialogHeader>
        <ShareDialogBody {...props} />
        <ShareDialogFooter {...props} />
      </DialogContent>
    </DialogRoot>
  );
}

export function ShareTargetHandler() {
  const { is, options, setIs, startCustomGptSummary } = useGlobal();
  const { t } = useTranslation();
  const customGpts: CustomGpt[] = Array.isArray(options.general.customGpts)
    ? options.general.customGpts
    : [];
  const { shared, setShared } = useSharedContent(t);
  const { selectedGptId, setSelectedGptId, selectedGpt } =
    useSelectedGpt(customGpts);
  const [submitting, setSubmitting] = useState(false);
  const dismiss = () => {
    setShared(null);
    setSubmitting(false);
  };
  const canSummarize = Boolean(selectedGpt?.systemPrompt.trim());
  const generateSummary = () =>
    void submitSummary({
      shared,
      selectedGpt,
      canSummarize,
      submitting,
      setSubmitting,
      startCustomGptSummary,
      dismiss,
      t,
    });

  return (
    <ShareTargetDialog
      open={Boolean(shared) && !is.config}
      canDismiss={!is.config}
      shared={shared}
      customGpts={customGpts}
      selectedGptId={selectedGptId}
      selectedGpt={selectedGpt}
      canSummarize={canSummarize}
      submitting={submitting}
      onSelectGpt={setSelectedGptId}
      onCreateGpt={() => setIs({ config: true })}
      onDismiss={dismiss}
      onGenerateSummary={generateSummary}
    />
  );
}
