import React from "react";
import { Alert, Link } from "@chakra-ui/react";
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
