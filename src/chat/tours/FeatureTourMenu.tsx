import {
  Badge,
  Box,
  Button,
  Dialog,
  Heading,
  HStack,
  IconButton,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuBookOpen, LuX } from "react-icons/lu";
import { Tooltip } from "../../components/ui/tooltip";
import { featureGuides } from "./guideRegistry";
import { useFeatureTour } from "./FeatureTourContext";

function FeatureTourGuideCard({
  guide,
  isNew,
}: {
  guide: (typeof featureGuides)[number];
  isNew: boolean;
}) {
  const { t } = useTranslation();
  const { startGuide } = useFeatureTour();

  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="md" padding="3">
      <HStack justifyContent="space-between" alignItems="start">
        <Heading size="sm">{t(guide.titleKey)}</Heading>
        {isNew ? (
          <Badge colorPalette="blue">{t("tour_new")}</Badge>
        ) : (
          <Text fontSize="xs" color="fg.muted">
            {t("tour_seen")}
          </Text>
        )}
      </HStack>
      <Text color="fg.muted" fontSize="sm" marginBlock="2">
        {t(guide.descriptionKey)}
      </Text>
      <Button size="sm" variant="outline" onClick={() => startGuide(guide.id)}>
        {t("tour_start")}
      </Button>
    </Box>
  );
}

function FeatureTourMenuBody() {
  const { t } = useTranslation();
  const { unseenGuides } = useFeatureTour();

  return (
    <Dialog.Body overflowY="auto">
      <Stack gap="4">
        <Text color="fg.muted">{t("tour_menu_description")}</Text>
        {unseenGuides.length > 0 && (
          <Box
            borderWidth="1px"
            borderColor="blue.300"
            borderRadius="md"
            padding="3"
            bg="blue.subtle"
          >
            <Heading size="sm" marginBlockEnd="1">
              {t("tour_new_section", { number: unseenGuides.length })}
            </Heading>
            <Text fontSize="sm">{t("tour_new_section_description")}</Text>
          </Box>
        )}
        <Stack gap="3">
          {featureGuides.map((guide) => (
            <FeatureTourGuideCard
              key={guide.id}
              guide={guide}
              isNew={unseenGuides.some((item) => item.id === guide.id)}
            />
          ))}
        </Stack>
        <Text fontSize="xs" color="fg.muted">
          {t("tour_progress_local")}
        </Text>
      </Stack>
    </Dialog.Body>
  );
}

interface FeatureTourButtonProps {
  expanded?: boolean;
  onBeforeOpen?: VoidFunction;
}

export function FeatureTourButton({
  expanded = false,
  onBeforeOpen,
}: FeatureTourButtonProps) {
  const { t } = useTranslation();
  const { openMenu, unseenGuides } = useFeatureTour();
  const count = unseenGuides.length;

  const handleOpen = () => {
    onBeforeOpen?.();
    openMenu();
  };

  if (expanded) {
    return (
      <Button
        width="100%"
        justifyContent="flex-start"
        variant="ghost"
        onClick={handleOpen}
        aria-label={t("tour_menu_title")}
        data-testid="MobileFeatureTourBtn"
      >
        <LuBookOpen />
        <span>{t("tour_menu_title")}</span>
        {count > 0 && <Badge colorPalette="blue">{count}</Badge>}
      </Button>
    );
  }

  return (
    <Tooltip content={t("tour_menu_title")}>
      <Box position="relative" display="inline-flex">
        <IconButton
          variant="ghost"
          aria-label={t("tour_menu_title")}
          title={t("tour_menu_title")}
          onClick={handleOpen}
          data-testid="FeatureTourBtn"
        >
          <LuBookOpen />
        </IconButton>
        {count > 0 && (
          <Badge
            colorPalette="blue"
            position="absolute"
            top="0"
            insetEnd="0"
            minWidth="1.2em"
            textAlign="center"
            pointerEvents="none"
            aria-label={t("tour_unseen_count", { number: count })}
          >
            {count}
          </Badge>
        )}
      </Box>
    </Tooltip>
  );
}

export function FeatureTourMenu() {
  const { t } = useTranslation();
  const { menuOpen, setMenuOpen } = useFeatureTour();

  return (
    <Dialog.Root
      open={menuOpen}
      onOpenChange={(event) => setMenuOpen(event.open)}
      size="lg"
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxH="calc(100dvh - 2rem)"
          display="flex"
          flexDirection="column"
        >
          <Dialog.Header>
            <Dialog.Title>{t("tour_menu_title")}</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <IconButton
                variant="ghost"
                aria-label={t("close")}
                position="absolute"
                top="2"
                insetEnd="2"
              >
                <LuX />
              </IconButton>
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <FeatureTourMenuBody />
          <Dialog.Footer>
            <Button variant="ghost" onClick={() => setMenuOpen(false)}>
              {t("close")}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
