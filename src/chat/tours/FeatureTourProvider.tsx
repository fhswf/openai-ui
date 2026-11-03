import React, { useCallback, useEffect, useRef, useState } from "react";
import semver from "semver";
import { useTranslation } from "react-i18next";
import { toaster } from "../../components/ui/toaster";
import { useGlobal } from "../context";
import {
  featureGuides,
  getFeatureGuide,
  type FeatureTourStep,
} from "./guideRegistry";
import { FeatureTourContext } from "./FeatureTourContext";
import {
  hasSeenFeatureGuide,
  readFeatureTourProgress,
  writeFeatureTourProgress,
  type FeatureTourProgress,
} from "./progressStore";

function selectorForTourTarget(name: string) {
  return `[data-tour="${name}"]`;
}

function isElementVisible(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLElement &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function findVisibleTourTarget(name: string) {
  // The responsive header renders desktop and mobile copies of some controls.
  return (
    Array.from(
      document.querySelectorAll<HTMLElement>(selectorForTourTarget(name))
    ).find(isElementVisible) ?? null
  );
}

function isExpanded(element: HTMLElement | null) {
  return (
    element?.getAttribute("aria-expanded") === "true" ||
    element?.getAttribute("data-state") === "open"
  );
}

function waitForVisibleElement(name: string, timeoutMs = 1800) {
  const startedAt = Date.now();
  return new Promise<HTMLElement | null>((resolve) => {
    const check = () => {
      const element = findVisibleTourTarget(name);
      if (element) {
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

type TourPreparationContext = {
  cleanupActions: { current: Array<VoidFunction> };
  openMenuTrigger: (name: string) => Promise<void>;
  globalRef: { current: ReturnType<typeof useGlobal> };
};

async function prepareToolUsageDetails({
  cleanupActions,
}: TourPreparationContext) {
  const badge = await waitForVisibleElement("tool-usage-badge");
  if (!badge) return;

  cleanupActions.current.push(() => {
    findVisibleTourTarget("tool-usage-details-close")?.click();
  });
  badge.click();
}

async function prepareMobileHeaderActions(
  step: FeatureTourStep,
  { openMenuTrigger }: TourPreparationContext
) {
  if (!findVisibleTourTarget(step.target)) {
    await openMenuTrigger("mobile-header-actions-trigger");
  }
}

function prepareSettingsNavigation(
  step: FeatureTourStep,
  { cleanupActions }: TourPreparationContext
) {
  if (findVisibleTourTarget(step.target)) return;

  const trigger = findVisibleTourTarget("mobile-navigation-trigger");
  if (!trigger || isExpanded(trigger)) return;

  trigger.click();
  cleanupActions.current.push(() => {
    const currentTrigger = findVisibleTourTarget("mobile-navigation-trigger");
    if (isExpanded(currentTrigger)) {
      findVisibleTourTarget("mobile-navigation-close")?.click();
    }
  });
}

function prepareHistory(
  step: FeatureTourStep,
  { cleanupActions }: TourPreparationContext
) {
  if (findVisibleTourTarget(step.target)) return;

  findVisibleTourTarget("chat-history-trigger")?.click();
  cleanupActions.current.push(() => {
    findVisibleTourTarget("chat-history-close")?.click();
  });
}

async function prepareMcpServicesDialog(
  step: FeatureTourStep,
  context: TourPreparationContext
) {
  if (findVisibleTourTarget(step.target)) return;

  await context.openMenuTrigger("chat-options-trigger");
  await context.openMenuTrigger("mcp-services-menu-trigger");
  const addRemoveTrigger = await waitForVisibleElement(
    "mcp-add-remove-services"
  );
  if (!addRemoveTrigger) return;

  context.cleanupActions.current.push(() => {
    findVisibleTourTarget("mcp-services-dialog-close")?.click();
  });
  addRemoveTrigger.click();
}

function prepareSettings({
  cleanupActions,
  globalRef,
}: TourPreparationContext) {
  const mobileNavigation = findVisibleTourTarget("mobile-navigation-trigger");
  if (isExpanded(mobileNavigation)) {
    findVisibleTourTarget("mobile-navigation-close")?.click();
  }

  const app = globalRef.current;
  if (app.is?.config) return;

  app.setState({ is: { ...app.is, config: true } });
  cleanupActions.current.push(() => {
    const current = globalRef.current;
    current.setState({ is: { ...current.is, config: false } });
  });
}

type TourPreparationName = NonNullable<FeatureTourStep["prepare"]>;
type TourPreparationAction = (
  step: FeatureTourStep,
  context: TourPreparationContext
) => Promise<void>;

const tourPreparationActions: Record<
  TourPreparationName,
  TourPreparationAction
> = {
  "open-model-selector": (_step, { openMenuTrigger }) =>
    openMenuTrigger("chat-model-selector"),
  "open-tool-usage-details": (_step, context) =>
    prepareToolUsageDetails(context),
  "open-mobile-header-actions": (step, context) =>
    prepareMobileHeaderActions(step, context),
  "open-settings-navigation": async (step, context) =>
    prepareSettingsNavigation(step, context),
  "open-history": async (step, context) => prepareHistory(step, context),
  "open-chat-options": (_step, { openMenuTrigger }) =>
    openMenuTrigger("chat-options-trigger"),
  "open-mcp-services-dialog": (step, context) =>
    prepareMcpServicesDialog(step, context),
  "open-settings": async (_step, context) => prepareSettings(context),
};

async function prepareTourStep(
  step: FeatureTourStep,
  context: TourPreparationContext
) {
  if (!step.prepare) return;
  await tourPreparationActions[step.prepare](step, context);
}

function useFeatureTourController() {
  const { t } = useTranslation();
  const global = useGlobal();
  const globalRef = useRef(global);
  const initialAppVersion = useRef(global.version);
  globalRef.current = global;

  const [progress, setProgress] = useState(readFeatureTourProgress);
  const progressRef = useRef(progress);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const cleanupActions = useRef<Array<VoidFunction>>([]);

  const saveProgress = useCallback((nextProgress: FeatureTourProgress) => {
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    writeFeatureTourProgress(nextProgress);
  }, []);

  const openMenu = useCallback(() => setMenuOpen(true), []);

  const closePreparedSurfaces = useCallback(() => {
    const actions = cleanupActions.current.splice(0).reverse();
    actions.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn("Could not close a feature tour surface:", error);
      }
    });
  }, []);

  const openMenuTrigger = useCallback(async (name: string) => {
    const trigger = await waitForVisibleElement(name);
    if (!trigger || isExpanded(trigger)) return;

    trigger.click();
    cleanupActions.current.push(() => {
      const currentTrigger = findVisibleTourTarget(name);
      if (isExpanded(currentTrigger)) currentTrigger?.click();
    });
  }, []);

  const prepareStep = useCallback(
    (step: FeatureTourStep) =>
      prepareTourStep(step, { cleanupActions, openMenuTrigger, globalRef }),
    [openMenuTrigger]
  );

  const cancelTour = useCallback(() => {
    closePreparedSurfaces();
    setActiveGuideId(null);
    setActiveStepIndex(0);
    window.requestAnimationFrame(() => {
      const candidates = [
        ...document.querySelectorAll('[data-testid="FeatureTourBtn"]'),
        ...document.querySelectorAll(
          selectorForTourTarget("mobile-navigation-trigger")
        ),
      ];
      const focusTarget = candidates.find((candidate) =>
        isElementVisible(candidate)
      ) as HTMLElement | undefined;
      focusTarget?.focus();
    });
  }, [closePreparedSurfaces]);

  const startGuide = useCallback(
    (id: string) => {
      const guide = getFeatureGuide(id);
      if (!guide) return;
      closePreparedSurfaces();
      setMenuOpen(false);
      setActiveStepIndex(0);
      setActiveGuideId(guide.id);
    },
    [closePreparedSurfaces]
  );

  const nextStep = useCallback(() => {
    const guide = getFeatureGuide(activeGuideId);
    if (!guide) return;

    if (activeStepIndex < guide.steps.length - 1) {
      setActiveStepIndex((index) => index + 1);
      return;
    }

    const nextProgress = {
      ...progressRef.current,
      seen: {
        ...progressRef.current.seen,
        [guide.id]: guide.revision,
      },
    };
    saveProgress(nextProgress);
    cancelTour();
  }, [activeGuideId, activeStepIndex, cancelTour, saveProgress]);

  const previousStep = useCallback(() => {
    setActiveStepIndex((index) => Math.max(0, index - 1));
  }, []);

  useEffect(() => {
    if (!global.options.account.terms) return;

    let cancelled = false;

    fetch("/metadata.json", { cache: "no-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Metadata request failed: ${response.status}`);
        }
        return response.json();
      })
      .then((metadata: { release?: unknown }) => {
        if (cancelled || typeof metadata.release !== "string") return;

        const currentBuild = semver.valid(metadata.release);
        if (!currentBuild) return;

        const stored = progressRef.current;
        const previousBuild = semver.valid(
          stored.lastKnownBuild || initialAppVersion.current || ""
        );
        const newlyAnnouncedGuides =
          previousBuild && semver.gt(currentBuild, previousBuild)
            ? featureGuides.filter((guide) => {
                const announcedBuild = semver.valid(guide.announceIn);
                return Boolean(
                  announcedBuild &&
                    semver.gt(announcedBuild, previousBuild!) &&
                    semver.lte(announcedBuild, currentBuild) &&
                    !hasSeenFeatureGuide(stored, guide.id, guide.revision)
                );
              })
            : [];

        const lastKnownBuild =
          previousBuild && semver.gt(previousBuild, currentBuild)
            ? previousBuild
            : currentBuild;
        if (stored.lastKnownBuild !== lastKnownBuild) {
          saveProgress({ ...stored, lastKnownBuild });
        }

        if (newlyAnnouncedGuides.length > 0) {
          toaster.create({
            title: t("tour_update_title"),
            description: t("tour_update_description", {
              number: newlyAnnouncedGuides.length,
            }),
            duration: 12000,
            type: "info",
            action: { label: t("tour_open"), onClick: openMenu },
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Could not check for new feature tour guides:", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [global.options.account.terms, openMenu, saveProgress, t]);

  const activeGuide = getFeatureGuide(activeGuideId);
  const unseenGuides = featureGuides.filter(
    (guide) => !hasSeenFeatureGuide(progress, guide.id, guide.revision)
  );

  return {
    activeGuide,
    activeStepIndex,
    menuOpen,
    progress,
    unseenGuides,
    openMenu,
    setMenuOpen,
    startGuide,
    cancelTour,
    previousStep,
    nextStep,
    prepareStep,
  };
}

export function FeatureTourProvider({ children }: React.PropsWithChildren) {
  const value = useFeatureTourController();
  return (
    <FeatureTourContext.Provider value={value}>
      {children}
    </FeatureTourContext.Provider>
  );
}
