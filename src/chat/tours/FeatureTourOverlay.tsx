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
import type { FeatureGuide, FeatureTourStep } from "./guideRegistry";
import { getFeatureGuide } from "./guideRegistry";
import { useFeatureTour } from "./FeatureTourContext";

interface Position {
  left: number;
  top: number;
}

type ElementRef<T extends HTMLElement> = { current: T | null };

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

function positionTourCard(
  element: HTMLElement,
  cardRef: ElementRef<HTMLDivElement>,
  setPosition: (position: Position) => void
) {
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
}

function centerTourCard(setPosition: (position: Position) => void) {
  const width = Math.min(352, window.innerWidth - 24);
  setPosition({
    left: Math.max(12, (window.innerWidth - width) / 2),
    top: Math.max(12, (window.innerHeight - 260) / 2),
  });
}

function highlightTourTarget(
  element: HTMLElement,
  onPositionChange: () => void
) {
  const previousOutline = element.style.outline;
  const previousOutlineOffset = element.style.outlineOffset;
  const previousDescribedBy = element.getAttribute("aria-describedby");
  const resizeObserver = new ResizeObserver(onPositionChange);

  element.style.outline = "3px solid #3182ce";
  element.style.outlineOffset = "3px";
  element.setAttribute(
    "aria-describedby",
    [previousDescribedBy, "feature-tour-step-description"]
      .filter(Boolean)
      .join(" ")
  );
  window.addEventListener("resize", onPositionChange);
  window.addEventListener("scroll", onPositionChange, true);
  resizeObserver.observe(element);

  return () => {
    element.style.outline = previousOutline;
    element.style.outlineOffset = previousOutlineOffset;
    if (previousDescribedBy === null) {
      element.removeAttribute("aria-describedby");
    } else {
      element.setAttribute("aria-describedby", previousDescribedBy);
    }
    window.removeEventListener("resize", onPositionChange);
    window.removeEventListener("scroll", onPositionChange, true);
    resizeObserver.disconnect();
  };
}

function positionVisibleTourTarget(
  target: HTMLElement,
  cardRef: ElementRef<HTMLDivElement>,
  setPosition: (position: Position) => void,
  isCancelled: () => boolean
) {
  target.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "nearest",
    inline: "nearest",
  });
  const updatePosition = () => positionTourCard(target, cardRef, setPosition);
  const cleanup = highlightTourTarget(target, updatePosition);
  window.requestAnimationFrame(() => {
    if (!isCancelled()) updatePosition();
  });
  return cleanup;
}

function useTourTargetPosition(
  activeGuide: FeatureGuide | undefined,
  activeStepIndex: number,
  step: FeatureTourStep | undefined,
  prepareStep: (step: FeatureTourStep) => Promise<void>,
  cardRef: ElementRef<HTMLDivElement>,
  setPosition: (position: Position) => void,
  setTargetAvailable: (available: boolean) => void
) {
  useEffect(() => {
    if (!activeGuide || !step) return;

    let cancelled = false;
    let cleanupHighlight = () => {};
    const showStep = async () => {
      await prepareStep(step);
      const target = await waitForTarget(step.target);
      if (cancelled) return;

      if (!target) {
        setTargetAvailable(false);
        centerTourCard(setPosition);
        return;
      }

      setTargetAvailable(true);
      cleanupHighlight = positionVisibleTourTarget(
        target,
        cardRef,
        setPosition,
        () => cancelled
      );
    };

    void showStep();
    return () => {
      cancelled = true;
      cleanupHighlight();
    };
  }, [
    activeGuide,
    activeStepIndex,
    cardRef,
    prepareStep,
    setPosition,
    setTargetAvailable,
    step,
  ]);
}

function TourStepHeader({
  activeStepIndex,
  totalSteps,
  cancelTour,
}: {
  activeStepIndex: number;
  totalSteps: number;
  cancelTour: VoidFunction;
}) {
  const { t } = useTranslation();
  return (
    <HStack justifyContent="space-between" alignItems="start">
      <Text fontSize="xs" color="fg.muted">
        {t("tour_step_count", {
          current: activeStepIndex + 1,
          total: totalSteps,
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
  );
}

function TourStepDescription({
  guide,
  step,
  targetAvailable,
}: {
  guide: FeatureGuide | undefined;
  step: FeatureTourStep;
  targetAvailable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
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
    </>
  );
}

function TourStepNavigation({
  activeStepIndex,
  isLastStep,
  nextButtonRef,
  nextStep,
  previousStep,
}: {
  activeStepIndex: number;
  isLastStep: boolean;
  nextButtonRef: ElementRef<HTMLButtonElement>;
  nextStep: VoidFunction;
  previousStep: VoidFunction;
}) {
  const { t } = useTranslation();
  return (
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
  );
}

interface TourStepCardProps {
  activeGuide: FeatureGuide;
  activeStepIndex: number;
  cardRef: ElementRef<HTMLDivElement>;
  cancelTour: VoidFunction;
  guide: FeatureGuide | undefined;
  isLastStep: boolean;
  nextButtonRef: ElementRef<HTMLButtonElement>;
  nextStep: VoidFunction;
  position: Position;
  previousStep: VoidFunction;
  step: FeatureTourStep;
  targetAvailable: boolean;
}

function TourStepCard(props: TourStepCardProps) {
  return (
    <Portal>
      <Box
        ref={props.cardRef}
        role="region"
        aria-live="polite"
        aria-labelledby="feature-tour-step-title"
        id="feature-tour-step-description"
        position="fixed"
        left={`${props.position.left}px`}
        top={`${props.position.top}px`}
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
          <TourStepHeader
            activeStepIndex={props.activeStepIndex}
            totalSteps={props.activeGuide.steps.length}
            cancelTour={props.cancelTour}
          />
          <TourStepDescription
            guide={props.guide}
            step={props.step}
            targetAvailable={props.targetAvailable}
          />
          <TourStepNavigation
            activeStepIndex={props.activeStepIndex}
            isLastStep={props.isLastStep}
            nextButtonRef={props.nextButtonRef}
            nextStep={props.nextStep}
            previousStep={props.previousStep}
          />
        </Stack>
      </Box>
    </Portal>
  );
}

function useFocusTourNextButton(
  activeGuide: FeatureGuide | undefined,
  activeStepIndex: number,
  nextButtonRef: ElementRef<HTMLButtonElement>
) {
  useEffect(() => {
    if (!activeGuide) return;
    window.requestAnimationFrame(() => nextButtonRef.current?.focus());
  }, [activeGuide?.id, activeStepIndex, nextButtonRef]);
}

function useEscapeToCancel(
  activeGuide: FeatureGuide | undefined,
  cancelTour: VoidFunction
) {
  useEffect(() => {
    if (!activeGuide) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelTour();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeGuide, cancelTour]);
}

export function FeatureTourOverlay() {
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

  useFocusTourNextButton(activeGuide, activeStepIndex, nextButtonRef);
  useEscapeToCancel(activeGuide, cancelTour);
  useTourTargetPosition(
    activeGuide,
    activeStepIndex,
    step,
    prepareStep,
    cardRef,
    setPosition,
    setTargetAvailable
  );

  if (!activeGuide || !step) return null;

  return (
    <TourStepCard
      activeGuide={activeGuide}
      activeStepIndex={activeStepIndex}
      cardRef={cardRef}
      cancelTour={cancelTour}
      guide={getFeatureGuide(activeGuide.id)}
      isLastStep={activeStepIndex === activeGuide.steps.length - 1}
      nextButtonRef={nextButtonRef}
      nextStep={nextStep}
      position={position}
      previousStep={previousStep}
      step={step}
      targetAvailable={targetAvailable}
    />
  );
}
