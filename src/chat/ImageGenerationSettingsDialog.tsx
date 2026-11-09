import {
  Button,
  CloseButton,
  Dialog,
  Field,
  HStack,
  Portal,
  RadioGroup,
  Stack,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface ImageGenerationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partialImages: number;
  onPartialImagesChange: (value: number) => void;
}

const PARTIAL_IMAGE_COUNTS = [0, 1, 2, 3];

export function ImageGenerationSettingsDialog({
  open,
  onOpenChange,
  partialImages,
  onPartialImagesChange,
}: ImageGenerationSettingsDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      data-testid="image-generation-settings-dialog"
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      lazyMount
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("image_generation_settings")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={4}>
                <Field.Root>
                  <Field.Label>
                    {t("image_generation_partial_images")}
                  </Field.Label>
                  <Field.HelperText>
                    {t("image_generation_partial_images_help")}
                  </Field.HelperText>
                  <RadioGroup.Root
                    aria-label={t("image_generation_partial_images")}
                    value={String(partialImages)}
                    onValueChange={(event) => {
                      if (event.value !== "") {
                        onPartialImagesChange(Number(event.value));
                      }
                    }}
                  >
                    <HStack gap={4} flexWrap="wrap">
                      {PARTIAL_IMAGE_COUNTS.map((count) => (
                        <RadioGroup.Item key={count} value={String(count)}>
                          <RadioGroup.ItemHiddenInput />
                          <RadioGroup.ItemIndicator />
                          <RadioGroup.ItemText>
                            {count === 0
                              ? t("image_generation_partial_images_off")
                              : t("image_generation_partial_images_count", {
                                  count,
                                })}
                          </RadioGroup.ItemText>
                        </RadioGroup.Item>
                      ))}
                    </HStack>
                  </RadioGroup.Root>
                </Field.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => onOpenChange(false)}>
                {t("done")}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
