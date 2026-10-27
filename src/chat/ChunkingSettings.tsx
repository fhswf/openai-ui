import React, { useId, useState } from "react";
import {
  Box,
  Button,
  Field,
  Grid,
  HStack,
  Input,
  RadioGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuInfo } from "react-icons/lu";
import {
  CHUNKING_PRESETS,
  ChunkingChoice,
  ChunkingPresetId,
  MAX_CHUNK_TOKENS,
  MIN_CHUNK_TOKENS,
  validateChunkTokens,
} from "./utils/chunking";

const PRESET_IDS = Object.keys(CHUNKING_PRESETS) as ChunkingPresetId[];
const LIMITS = { min: MIN_CHUNK_TOKENS, max: MAX_CHUNK_TOKENS };
// Illustrative number of sections a document is split into per preset.
const PREVIEW_SECTIONS: Record<ChunkingPresetId, number> = {
  precise: 9,
  balanced: 5,
  context: 3,
};

/** Name of a choice in the user's language, e.g. "Precise" or "Custom size (1234)". */
export function chunkingChoiceName(t: TFunction, choice: ChunkingChoice) {
  return choice.kind === "preset"
    ? t(`vector_store_chunking_${choice.preset}`)
    : t("vector_store_chunking_custom", { size: choice.maxTokens });
}

interface ChunkingSettingsProps {
  onChange: (choice: ChunkingChoice) => void;
  value: ChunkingChoice;
}

/**
 * Lets users choose how new files are split into sections. The surrounding
 * container (e.g. a popover) provides background, border and padding.
 */
export function ChunkingSettings({ onChange, value }: ChunkingSettingsProps) {
  const { t } = useTranslation();
  return (
    <Stack gap={4}>
      <Stack gap="0.5">
        <Text fontSize="sm" fontWeight="medium">
          {t("vector_store_chunking_granularity")}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {t("vector_store_chunking_granularity_help")}
        </Text>
      </Stack>
      <PresetSlider value={value} onChange={onChange} />
      <ChoiceDetails value={value} />
      <HStack alignItems="flex-start" gap="1.5" color="fg.muted">
        <Box as="span" marginTop="2px" flexShrink={0} aria-hidden="true">
          <LuInfo size={13} />
        </Box>
        <Text fontSize="xs">{t("vector_store_chunking_new_files_only")}</Text>
      </HStack>
      <CustomSizeSection value={value} onChange={onChange} />
    </Stack>
  );
}

/*
 * The presets are radio buttons (arrow keys, screen readers), drawn as three
 * stops on a track whose blue part grows up to the selected stop.
 */
function PresetSlider({ onChange, value }: ChunkingSettingsProps) {
  const { t } = useTranslation();
  const selected =
    value.kind === "preset" ? PRESET_IDS.indexOf(value.preset) : -1;
  const fill = selected < 0 ? 0 : (selected / (PRESET_IDS.length - 1)) * 100;
  return (
    <RadioGroup.Root
      aria-label={t("vector_store_chunking_title")}
      // No preset is selected while a custom size is active.
      value={value.kind === "preset" ? value.preset : null}
      onValueChange={(details) => {
        if (details.value) {
          onChange({
            kind: "preset",
            preset: details.value as ChunkingPresetId,
          });
        }
      }}
      position="relative"
      width="full"
      maxWidth="260px"
      marginInline="auto"
    >
      <SliderTrack fill={fill} />
      <Grid
        position="relative"
        templateColumns={`repeat(${PRESET_IDS.length}, minmax(0, 1fr))`}
      >
        {PRESET_IDS.map((id, index) => (
          <PresetStop
            key={id}
            id={id}
            reached={index <= selected}
            selected={index === selected}
          />
        ))}
      </Grid>
    </RadioGroup.Root>
  );
}

/** Runs from the centre of the first stop to the centre of the last. */
function SliderTrack({ fill }: { fill: number }) {
  return (
    <Box
      position="absolute"
      top="7px"
      insetInline={`${50 / PRESET_IDS.length}%`}
      height="4px"
      borderRadius="full"
      backgroundColor="border"
      aria-hidden="true"
    >
      <Box
        height="full"
        width={`${fill}%`}
        borderRadius="full"
        backgroundImage="linear-gradient(to right, {colors.blue.400}, {colors.blue.600})"
        transition="width 0.25s ease-out"
      />
    </Box>
  );
}

interface PresetStopProps {
  id: ChunkingPresetId;
  reached: boolean;
  selected: boolean;
}

// Keyboard focus is shown as a ring around the dot only.
const FOCUS_RING_ON_DOT = {
  "&[data-focus-visible] [data-dot]": {
    outline: "2px solid",
    outlineColor: "blue.solid",
    outlineOffset: "3px",
  },
};

function PresetStop({ id, reached, selected }: PresetStopProps) {
  const { t } = useTranslation();
  return (
    <RadioGroup.Item
      value={id}
      flexDirection="column"
      alignItems="center"
      gap="6px"
      cursor="pointer"
      css={FOCUS_RING_ON_DOT}
      data-testid={`chunking-preset-${id}`}
    >
      <RadioGroup.ItemHiddenInput />
      <PresetDot reached={reached} selected={selected} />
      <RadioGroup.ItemText
        fontSize="xs"
        lineHeight="short"
        textAlign="center"
        fontWeight={selected ? "medium" : "normal"}
        color={selected ? "fg" : "fg.muted"}
      >
        {t(`vector_store_chunking_${id}`)}
      </RadioGroup.ItemText>
    </RadioGroup.Item>
  );
}

function PresetDot({ reached, selected }: Omit<PresetStopProps, "id">) {
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      width="18px"
      height="18px"
      aria-hidden="true"
    >
      <Box
        data-dot=""
        width={selected ? "14px" : "10px"}
        height={selected ? "14px" : "10px"}
        borderRadius="full"
        borderWidth={reached ? 0 : "2px"}
        borderColor="border.emphasized"
        backgroundColor={reached ? "blue.solid" : "bg.panel"}
        boxShadow={
          selected ? "0 0 0 4px var(--chakra-colors-blue-muted)" : undefined
        }
        transition="all 0.2s ease-out"
      />
    </Box>
  );
}

function ChoiceDetails({ value }: { value: ChunkingChoice }) {
  const { t } = useTranslation();
  return (
    <Stack
      gap={2}
      paddingInline={3}
      paddingBlock="2.5"
      borderRadius="lg"
      backgroundColor="bg.muted"
    >
      <Stack gap="0.5">
        <Text fontSize="xs" fontWeight="medium">
          {value.kind === "preset"
            ? t(`vector_store_chunking_${value.preset}`)
            : t("vector_store_chunking_custom_title")}
        </Text>
        <Text fontSize="xs" color="fg.muted">
          {value.kind === "preset"
            ? t(`vector_store_chunking_${value.preset}_help`)
            : t("vector_store_chunking_custom_text", {
                size: value.maxTokens,
              })}
        </Text>
      </Stack>
      {value.kind === "preset" && <SplitPreview preset={value.preset} />}
    </Stack>
  );
}

/** Only an illustration; the text next to it carries the information. */
function SplitPreview({ preset }: { preset: ChunkingPresetId }) {
  const { t } = useTranslation();
  return (
    <Stack gap="1.5" aria-hidden="true">
      <Text fontSize="xs" color="fg.muted">
        {t("vector_store_chunking_preview")}
      </Text>
      <HStack gap="3px">
        {Array.from({ length: PREVIEW_SECTIONS[preset] }, (_, i) => (
          <Box
            key={i}
            flex="1"
            height="14px"
            borderRadius="sm"
            backgroundColor="blue.muted"
          />
        ))}
      </HStack>
    </Stack>
  );
}

function CustomSizeSection({ onChange, value }: ChunkingSettingsProps) {
  const contentId = useId();
  const [open, setOpen] = useState(value.kind === "custom");
  const [text, setText] = useState(
    value.kind === "custom" ? String(value.maxTokens) : ""
  );
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const result = validateChunkTokens(text);
    // Without strictNullChecks, only a comparison narrows the result type.
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setError(null);
    onChange({ kind: "custom", maxTokens: result.value });
  };

  return (
    <Stack gap={2} borderTopWidth="1px" paddingTop={1}>
      <AdvancedToggle
        contentId={contentId}
        open={open}
        onToggle={() => setOpen(!open)}
      />
      {open && (
        <Box id={contentId}>
          <CustomSizeField
            error={error}
            text={text}
            onTextChange={(next) => {
              setText(next);
              setError(null);
            }}
            onApply={apply}
          />
        </Box>
      )}
    </Stack>
  );
}

interface AdvancedToggleProps {
  contentId: string;
  onToggle: VoidFunction;
  open: boolean;
}

function AdvancedToggle({ contentId, onToggle, open }: AdvancedToggleProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="xs"
      justifyContent="space-between"
      paddingInline={0}
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      onClick={onToggle}
      data-testid="chunking-advanced-toggle"
    >
      {t("vector_store_chunking_advanced")}
      <Box
        as="span"
        color="fg.muted"
        transform={open ? "rotate(180deg)" : undefined}
        transition="transform 0.16s"
      >
        <LuChevronDown />
      </Box>
    </Button>
  );
}

interface CustomSizeFieldProps {
  error: string | null;
  onApply: VoidFunction;
  onTextChange: (text: string) => void;
  text: string;
}

function CustomSizeField({
  error,
  onApply,
  onTextChange,
  text,
}: CustomSizeFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root invalid={error !== null}>
      <Field.Label fontSize="xs">
        {t("vector_store_chunking_custom_label")}
      </Field.Label>
      <HStack width="full">
        <CustomSizeInput
          text={text}
          onTextChange={onTextChange}
          onApply={onApply}
        />
        <Text fontSize="xs" color="fg.muted" aria-hidden="true">
          {t("vector_store_chunking_tokens")}
        </Text>
        <Button
          variant="outline"
          size="sm"
          onClick={onApply}
          data-testid="chunking-custom-apply"
        >
          {t("vector_store_chunking_apply")}
        </Button>
      </HStack>
      {/* The default red is too light for small text on white. */}
      <Field.ErrorText color={{ base: "red.700", _dark: "red.300" }}>
        {error && t(`vector_store_chunking_error_${error}`, LIMITS)}
      </Field.ErrorText>
      <Field.HelperText fontSize="xs">
        {t("vector_store_chunking_custom_help", LIMITS)}
      </Field.HelperText>
    </Field.Root>
  );
}

function CustomSizeInput({
  onApply,
  onTextChange,
  text,
}: Omit<CustomSizeFieldProps, "error">) {
  return (
    <Input
      size="sm"
      flex="1"
      minWidth={0}
      inputMode="numeric"
      autoComplete="off"
      placeholder={String(CHUNKING_PRESETS.balanced)}
      value={text}
      onChange={(event) => onTextChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onApply();
        }
      }}
      data-testid="chunking-custom-input"
    />
  );
}
