import React from "react";
import { Alert, Button, HStack, Link, Spinner } from "@chakra-ui/react";
import { Trans, useTranslation } from "react-i18next";
import { aiHubBaseUrl } from "./service/aiHub";

export function AiHubLoginHint() {
  const { t } = useTranslation();

  return (
    <Alert.Root
      status="info"
      variant="subtle"
      size="sm"
      data-testid="AiHubLoginHint"
    >
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description fontSize="sm">
          <Trans
            t={t}
            i18nKey="ai_hub_login_hint"
            components={{
              link: (
                <Link
                  href={aiHubBaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  textDecoration="underline"
                />
              ),
            }}
          />
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}

interface AiHubLoginWaitingHintProps {
  onCancel: () => void;
  onOpenPopup: () => void;
}

export function AiHubLoginWaitingHint({
  onCancel,
  onOpenPopup,
}: AiHubLoginWaitingHintProps) {
  const { t } = useTranslation();

  return (
    <Alert.Root
      status="info"
      variant="subtle"
      size="sm"
      data-testid="AiHubLoginWaitingHint"
    >
      <Alert.Indicator>
        <Spinner size="sm" />
      </Alert.Indicator>
      <Alert.Content gap={2}>
        <Alert.Description fontSize="sm">
          {t("ai_hub_login_waiting")}
        </Alert.Description>
        <HStack gap={2}>
          <Button size="xs" variant="outline" onClick={onOpenPopup}>
            {t("ai_hub_login_open_popup")}
          </Button>
          <Button size="xs" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </HStack>
      </Alert.Content>
    </Alert.Root>
  );
}

interface AiHubLoginStatusProps {
  cancelHubLogin: () => void;
  isWaitingForHubLogin: boolean;
  needsHubLogin: boolean;
  openLoginPopup: () => void;
}

/** Shows the waiting hint while the login popup is open, or the login link. */
export function AiHubLoginStatus({
  cancelHubLogin,
  isWaitingForHubLogin,
  needsHubLogin,
  openLoginPopup,
}: AiHubLoginStatusProps) {
  if (isWaitingForHubLogin) {
    return (
      <AiHubLoginWaitingHint
        onCancel={cancelHubLogin}
        onOpenPopup={openLoginPopup}
      />
    );
  }

  return needsHubLogin ? <AiHubLoginHint /> : null;
}
