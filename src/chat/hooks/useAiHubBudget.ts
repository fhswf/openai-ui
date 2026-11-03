import { useState } from "react";
import { AiHubBudget, fetchAiHubBudget } from "../service/aiHub";

export function useAiHubBudget() {
  const [budget, setBudget] = useState<AiHubBudget | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  async function load() {
    setIsLoading(true);
    setHasError(false);

    try {
      setBudget(await fetchAiHubBudget());
    } catch (error) {
      console.warn("Unable to load AI-Hub budget:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  return { budget, hasError, isLoading, load };
}
