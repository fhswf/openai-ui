import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuX } from "react-icons/lu";
import { getFeatureGuide } from "./guideRegistry";
import { useFeatureTour } from "./FeatureTourContext";

interface Position {
  left: number;
  top: number;
}

function findTarget(name: string) {
  // Some responsive controls have separate desktop and mobile copies.
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
    ).find(isVisible) ?? null
  );
}

function isVisible(element: HTMLElement | null) {
  return Boolean(
    element &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden"
  );
}

function waitForTarget(name: string, timeoutMs = 1800) {
  const startedAt = Date.now();
  return new Promise<HTMLElement | null>((resolve) => {
    const check = () => {
      const element = findTarget(name);
      if (isVisible(element)) {
        resolve(element);
      } else if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
      } else {
        window.setTimeout(check, 50);
      }
    };
    check();
  });
}

export function FeatureTourOverlay() {
  const { t } = useTranslation();
  const {
    activeGuide,
    activeStepIndex,
    cancelTour,
    nextStep,
    previousStep,
    prepareStep,
  } = useFeatureTour();
  const cardRef = useRef<HTMLDivElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<Position>({ left: 12, top: 12 });
  const [targetAvailable, setTargetAvailable] = useState(true);

  const step = activeGuide?.steps[activeStepIndex];

  useEffect(() => {
    if (!activeGuide) return;
    window.requestAnimationFrame(() => nextButtonRef.current?.focus());
  }, [activeGuide?.id, activeStepIndex]);

  useEffect(() => {
    if (!activeGuide || !step) return;

    let cancelled = false;
    let target: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | undefined;
    let previousOutline = "";
    let previousOutlineOffset = "";
    let previousDescribedBy: string | null = null;
    let onPositionChange: (() => void) | undefined;

    const cleanupTarget = () => {
      if (!target) return;
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOutlineOffset;
      if (previousDescribedBy === null) {
        target.removeAttribute("aria-describedby");
      } else {
        target.setAttribute("aria-describedby", previousDescribedBy);
      }
      if (onPositionChange) {
        window.removeEventListener("resize", onPositionChange);
        window.removeEventListener("scroll", onPositionChange, true);
      }
      resizeObserver?.disconnect();
      target = null;
    };

    const positionCard = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const cardRect = cardRef.current?.getBoundingClientRect();
      const cardWidth = cardRect?.width || Math.min(352, window.innerWidth - 24);
      const cardHeight = cardRect?.height || 260;
      const left = Math.max(
        12,
        Math.min(
          window.innerWidth - cardWidth - 12,
          rect.left + rect.width / 2 - cardWidth / 2
        )
      );
      const belowTop = rect.bottom + 12;
      const aboveTop = rect.top - cardHeight - 12;
      const top =
        belowTop + cardHeight <= window.innerHeight - 12
          ? belowTop
          : aboveTop >= 12
            ? aboveTop
            : Math.max(12, Math.min(belowTop, window.innerHeight - cardHeight - 12));
      setPosition({ left, top });
    };

    const showStep = async () => {
      await prepareStep(step);
      const found = await waitForTarget(step.target);
      if (cancelled) return;

      if (!found) {
        setTargetAvailable(false);
        setPosition({
          left: Math.max(
            12,
            (window.innerWidth - Math.min(352, window.innerWidth - 24)) / 2
          ),
          top: Math.max(12, (window.innerHeight - 260) / 2),
        });
        return;
      }

      target = found;
      setTargetAvailable(true);
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "nearest",
        inline: "nearest",
      });
      previousOutline = target.style.outline;
      previousOutlineOffset = target.style.outlineOffset;
      previousDescribedBy = target.getAttribute("aria-describedby");
      target.style.outline = "3px solid #3182ce";
      target.style.outlineOffset = "3px";
      target.setAttribute(
        "aria-describedby",
        [previousDescribedBy, "feature-tour-step-description"]
          .filter(Boolean)
          .join(" ")
      );

      onPositionChange = () => positionCard(target!);
      window.addEventListener("resize", onPositionChange);
      window.addEventListener("scroll", onPositionChange, true);
      resizeObserver = new ResizeObserver(onPositionChange);
      resizeObserver.observe(target);
      window.requestAnimationFrame(() => {
        if (!cancelled && target) positionCard(target);
      });
    };

    void showStep();
    return () => {
      cancelled = true;
      cleanupTarget();
    };
  }, [activeGuide, activeStepIndex, prepareStep, step]);

  useEffect(() => {
    if (!activeGuide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelTour();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGuide, cancelTour]);

  if (!activeGuide || !step) return null;

  const isLastStep = activeStepIndex === activeGuide.steps.length - 1;
  const guide = getFeatureGuide(activeGuide.id);

  return (
    <Portal>
      <Box
        ref={cardRef}
        role="region"
        aria-live="polite"
        aria-labelledby="feature-tour-step-title"
        id="feature-tour-step-description"
        position="fixed"
        left={`${position.left}px`}
        top={`${position.top}px`}
        zIndex={1800}
        width="min(22rem, calc(100vw - 1.5rem))"
        maxH="calc(100dvh - 1.5rem)"
        overflowY="auto"
        borderWidth="1px"
        borderColor="blue.500"
        borderRadius="lg"
        boxShadow="xl"
        bg="bg.panel"
        color="fg"
        padding="4"
      >
        <Stack gap="3">
          <HStack justifyContent="space-between" alignItems="start">
            <Text fontSize="xs" color="fg.muted">
              {t("tour_step_count", {
                current: activeStepIndex + 1,
                total: activeGuide.steps.length,
              })}
            </Text>
            <IconButton
              size="xs"
              variant="ghost"
              aria-label={t("tour_exit")}
              title={t("tour_exit")}
              onClick={cancelTour}
            >
              <LuX />
            </IconButton>
          </HStack>
          <Box>
            <Text fontSize="xs" color="fg.muted" marginBlockEnd="1">
              {guide ? t(guide.titleKey) : ""}
            </Text>
            <Text id="feature-tour-step-title" fontWeight="bold" fontSize="lg">
              {t(step.titleKey)}
            </Text>
          </Box>
          <Text>{t(step.bodyKey)}</Text>
          {!targetAvailable && (
            <Text fontSize="sm" color="fg.muted">
              {t("tour_target_unavailable")}
            </Text>
          )}
          <HStack justifyContent="space-between">
            <Button
              size="sm"
              variant="ghost"
              onClick={previousStep}
              disabled={activeStepIndex === 0}
            >
              {t("tour_previous")}
            </Button>
            <Button
              ref={nextButtonRef}
              id="feature-tour-next-button"
              size="sm"
              colorPalette="blue"
              onClick={nextStep}
            >
              {isLastStep ? t("tour_finish") : t("tour_next")}
            </Button>
          </HStack>
        </Stack>
      </Box>
    </Portal>
  );
}
