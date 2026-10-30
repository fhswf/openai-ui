import React from "react";
import { Button, Flex, Heading, Stack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuKeyRound, LuLock } from "react-icons/lu";
import { useGlobal } from "./context";
import { useAiHubActivation } from "./hooks/useAiHubActivation";
import { AiHubTermsDialog } from "./AiHubTermsDialog";
import { AiHubLoginStatus } from "./AiHubLoginHint";

function LockBadge() {
  return (
    <Flex
      colorPalette="green"
      bg="colorPalette.subtle"
      color="colorPalette.fg"
      borderRadius="full"
      boxSize={14}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
    >
      <LuLock size={28} aria-hidden="true" />
    </Flex>
  );
}

function AiHubRequiredText() {
  const { t } = useTranslation();

  return (
    <Stack gap={1} flex="1">
      <Heading size="md">{t("vector_store_ai_hub_required_title")}</Heading>
      <Text fontSize="sm" color="fg.muted">
        {t("vector_store_ai_hub_required_desc")}
      </Text>
    </Stack>
  );
}

/**
 * Shown instead of the document collections when the vector store service
 * rejects the current API key. The button runs the same AI-Hub activation as
 * the profile popover; the list reloads once the new key is set.
 */
export function AiHubRequiredCard() {
  const { t } = useTranslation();
  const { options, setOptions, user } = useGlobal();
  const aiHub = useAiHubActivation({
    openai: options.openai,
    setOptions,
    user,
  });

  return (
    <Stack
      gap={4}
      padding={6}
      borderWidth="1px"
      borderRadius="lg"
      bg="bg.subtle"
      data-testid="vector-store-ai-hub-required"
    >
      <AiHubTermsDialog {...aiHub.termsDialogProps} />
      <Flex direction={{ base: "column", md: "row" }} gap={6} align="center">
        <LockBadge />
        <AiHubRequiredText />
        <Button
          colorPalette="green"
          onClick={aiHub.start}
          loading={aiHub.isActivating || aiHub.isWaitingForHubLogin}
          loadingText={
            aiHub.isWaitingForHubLogin
              ? t("ai_hub_login_waiting_button")
              : undefined
          }
          data-testid="vector-store-ai-hub-login-btn"
        >
          <LuKeyRound /> {t("vector_store_ai_hub_required_button")}
        </Button>
      </Flex>
      <AiHubLoginStatus
        cancelHubLogin={aiHub.cancelHubLogin}
        isWaitingForHubLogin={aiHub.isWaitingForHubLogin}
        needsHubLogin={aiHub.needsHubLogin}
        openLoginPopup={aiHub.openLoginPopup}
      />
    </Stack>
  );
}
