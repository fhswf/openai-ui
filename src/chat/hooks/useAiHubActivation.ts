import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { toaster } from "../../components/ui/toaster";
import { defaultOpenAIBaseUrl, defaultOpenAIModel } from "../context/initState";
import {
  GlobalActions,
  OpenAIOptions,
  OptionActionType,
} from "../context/types";
import {
  AiHubError,
  aiHubApiBaseUrl,
  aiHubBaseUrl,
  fetchAiHubModels,
  generateUniqueAiHubKey,
} from "../service/aiHub";

type AiHubUser = { email?: string } | null | undefined;

function isAiHubBaseUrl(openai: OpenAIOptions) {
  const normalize = (url: string) => url.replace(/\/$/, "");
  return normalize(openai.baseUrl) === normalize(aiHubApiBaseUrl);
}

function getExistingAiHubKey(openai: OpenAIOptions) {
  return openai.aiHubApiKey || (isAiHubBaseUrl(openai) ? openai.apiKey : "");
}

function getAiHubKeyAlias(user: AiHubUser) {
  return user?.email ? `KImpuls-${user.email.trim().toLowerCase()}` : "";
}

function getAiHubErrorDescription(error: unknown, t: TFunction) {
  if (!(error instanceof AiHubError)) {
    return t("ai_hub_budget_error_desc");
  }

  switch (error.code) {
    case "key_generation_failed":
      if (error.status === 401) {
        return t("ai_hub_session_invalid_desc", { url: aiHubBaseUrl });
      }
      return t("ai_hub_key_generation_failed_desc", { status: error.status });
    case "key_generation_missing_key":
      return t("ai_hub_key_generation_missing_key_desc");
    case "model_list_failed":
      return t("ai_hub_model_list_failed_desc", { status: error.status });
    default:
      return t("ai_hub_budget_error_desc");
  }
}

function buildRestoredOptions(openai: OpenAIOptions): Partial<OpenAIOptions> {
  const aiHubModels = openai.aiHubModels ?? [];
  const restoredModel =
    openai.aiHubPreviousModel ||
    (aiHubModels.includes(openai.model) ? defaultOpenAIModel : openai.model);

  return {
    apiKey: openai.aiHubPreviousApiKey || "unused",
    baseUrl: openai.aiHubPreviousBaseUrl || defaultOpenAIBaseUrl,
    aiHubEnabled: false,
    aiHubApiKey: getExistingAiHubKey(openai),
    aiHubModels: [],
    model: restoredModel,
  };
}

async function resolveAiHubKey(
  openai: OpenAIOptions,
  keyAlias: string,
  acceptedTerms: boolean
) {
  if (!keyAlias) {
    throw new Error("AI-Hub key alias requires a user email address.");
  }

  const existingKey = getExistingAiHubKey(openai);
  if (existingKey) {
    return {
      key: existingKey,
      key_alias: keyAlias,
      key_name: openai.aiHubKeyName,
    };
  }

  return generateUniqueAiHubKey(keyAlias, { acceptedTerms });
}

async function loadActivatedOptions(
  openai: OpenAIOptions,
  keyAlias: string,
  acceptedTerms: boolean
): Promise<Partial<OpenAIOptions>> {
  const key = await resolveAiHubKey(openai, keyAlias, acceptedTerms);
  const models = await fetchAiHubModels(key.key);
  const selectedModel = models.includes(openai.model)
    ? openai.model
    : models[0] ?? openai.model;

  return {
    apiKey: key.key,
    baseUrl: aiHubApiBaseUrl,
    aiHubEnabled: true,
    aiHubApiKey: key.key,
    aiHubKeyAlias: key.key_alias || keyAlias,
    aiHubKeyName: key.key_name,
    aiHubModels: models,
    aiHubPreviousApiKey: openai.apiKey,
    aiHubPreviousBaseUrl: openai.baseUrl,
    aiHubPreviousModel: openai.model,
    model: selectedModel,
  };
}

interface UseAiHubActivationProps {
  onActivated?: () => void;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  user: AiHubUser;
}

/**
 * Schaltet das AI-Hub-Budget ein und aus. Fuer einen neuen Key muss der
 * Nutzer zuerst die Nutzungsbedingungen bestaetigen; dafuer liefert der Hook
 * die Props fuer den `AiHubTermsDialog`.
 */
export function useAiHubActivation({
  onActivated,
  openai,
  setOptions,
  user,
}: UseAiHubActivationProps) {
  const { t } = useTranslation();
  const [isActivating, setIsActivating] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
  const isUsingAiHubBudget =
    Boolean(openai.aiHubEnabled) || isAiHubBaseUrl(openai);

  async function activate(acceptedTerms: boolean) {
    setIsActivating(true);
    try {
      const data = await loadActivatedOptions(
        openai,
        getAiHubKeyAlias(user),
        acceptedTerms
      );
      setOptions({ type: OptionActionType.OPENAI, data });
      toaster.create({
        title: t("ai_hub_budget_enabled"),
        description: t("ai_hub_budget_enabled_desc", {
          count: data.aiHubModels?.length ?? 0,
        }),
        duration: 5000,
        type: "success",
      });
      onActivated?.();
    } catch (error) {
      console.error("Unable to activate AI-Hub budget:", error);
      toaster.create({
        title: t("ai_hub_budget_error"),
        description: getAiHubErrorDescription(error, t),
        duration: 5000,
        type: "error",
      });
    } finally {
      setIsActivating(false);
    }
  }

  function start() {
    if (getExistingAiHubKey(openai)) {
      void activate(false);
    } else {
      setTermsDialogOpen(true);
    }
  }

  function stop() {
    setOptions({
      type: OptionActionType.OPENAI,
      data: buildRestoredOptions(openai),
    });
    toaster.create({
      title: t("ai_hub_budget_disabled"),
      description: t("ai_hub_budget_disabled_desc"),
      duration: 5000,
      type: "success",
    });
  }

  const termsDialogProps = {
    open: termsDialogOpen,
    onOpenChange: setTermsDialogOpen,
    onAccept: () => {
      setTermsDialogOpen(false);
      void activate(true);
    },
  };

  return { isActivating, isUsingAiHubBudget, start, stop, termsDialogProps };
}
