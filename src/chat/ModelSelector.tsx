import {
  Button,
  Menu,
  Separator,
  Slider,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import type { OpenAIOptions, ReasoningEffort } from "./context/types";
import {
  getModelOptions,
  getNewerModelIds,
  groupModelOptions,
  supportsReasoningEffort,
} from "./utils/options";
import type { ModelOption } from "./utils/options";

interface ModelSelectorProps {
  openai: OpenAIOptions;
  effort: ReasoningEffort;
  onModelChange: (_model: string) => void;
  onEffortChange: (_effort: ReasoningEffort) => void;
}

const reasoningEfforts: ReasoningEffort[] = ["low", "medium", "high"];

export function ModelSelector({
  openai,
  effort,
  onModelChange,
  onEffortChange,
}: ModelSelectorProps) {
  const { t } = useTranslation();
  const options = getModelOptions(openai);
  const groups = groupModelOptions(options);
  const newerModelAvailable = getNewerModelIds(options, openai.model).size > 0;
  const effortIndex = reasoningEfforts.indexOf(effort);
  const effortMarks = reasoningEfforts.map((option, value) => ({
    value,
    label: t("reasoning_effort_" + option),
  }));

  const renderModel = (item: ModelOption) => (
    <Menu.RadioItem key={item.value} value={item.value}>
      {item.label}
      <Menu.ItemIndicator />
    </Menu.RadioItem>
  );

  const renderReasoningSlider = () => {
    if (!supportsReasoningEffort(openai.model)) {
      return null;
    }

    return (
      <>
        <Separator />
        <Stack px="4" py="3" gap="2">
          <Slider.Root
            colorPalette="blue"
            size="sm"
            min={0}
            max={reasoningEfforts.length - 1}
            step={1}
            value={[effortIndex >= 0 ? effortIndex : 1]}
            onValueChange={(event) => {
              const nextEffort = reasoningEfforts[event.value[0]];
              onEffortChange(nextEffort);
            }}
          >
            <Slider.Label>
              {t("reasoning_effort_current", {
                effort: t("reasoning_effort_" + effort),
              })}
            </Slider.Label>
            <Slider.Control>
              <Slider.Track>
                <Slider.Range />
              </Slider.Track>
              <Slider.Thumbs />
              <Slider.Marks marks={effortMarks} />
            </Slider.Control>
          </Slider.Root>
        </Stack>
      </>
    );
  };

  return (
    <Menu.Root positioning={{ placement: "top-start" }}>
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          maxW="50vw"
          borderColor={newerModelAvailable ? "orange.500" : undefined}
          boxShadow={
            newerModelAvailable
              ? "0 0 0 1px var(--chakra-colors-orange-500)"
              : undefined
          }
          title={newerModelAvailable ? t("newer_model_available") : undefined}
          aria-label={t("model_options") + ": " + openai.model}
          data-newer-model-available={newerModelAvailable || undefined}
          data-testid="ModelSelectorTrigger"
        >
          <Text
            maxW="28vw"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            {openai.model}
          </Text>
          <LuChevronDown />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="18rem">
          {groups.length <= 1 ? (
            <Menu.RadioItemGroup
              value={openai.model}
              onValueChange={(event) => {
                onModelChange(event.value);
              }}
            >
              <Menu.ItemGroupLabel>{t("model_options")}</Menu.ItemGroupLabel>
              {options.map(renderModel)}
            </Menu.RadioItemGroup>
          ) : (
            groups.map(([group, items]) => (
              <Menu.RadioItemGroup
                key={group}
                value={openai.model}
                onValueChange={(event) => {
                  onModelChange(event.value);
                }}
              >
                <Menu.ItemGroupLabel>{group}</Menu.ItemGroupLabel>
                {items.map(renderModel)}
              </Menu.RadioItemGroup>
            ))
          )}
          {renderReasoningSlider()}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
