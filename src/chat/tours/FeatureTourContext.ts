import { createContext, useContext } from "react";
import type { FeatureGuide, FeatureTourStep } from "./guideRegistry";
import type { FeatureTourProgress } from "./progressStore";

export interface FeatureTourContextValue {
  activeGuide: FeatureGuide | undefined;
  activeStepIndex: number;
  menuOpen: boolean;
  progress: FeatureTourProgress;
  unseenGuides: FeatureGuide[];
  openMenu: () => void;
  setMenuOpen: (open: boolean) => void;
  startGuide: (id: string) => void;
  cancelTour: () => void;
  previousStep: () => void;
  nextStep: () => void;
  prepareStep: (step: FeatureTourStep) => Promise<void>;
}

// Keep the context outside the provider module so Fast Refresh cannot replace
// it while React preserves an already-mounted provider instance.
export const FeatureTourContext = createContext<FeatureTourContextValue | null>(
  null,
);

export function useFeatureTour() {
  const context = useContext(FeatureTourContext);
  if (!context) {
    throw new Error("useFeatureTour must be used inside FeatureTourProvider");
  }
  return context;
}
