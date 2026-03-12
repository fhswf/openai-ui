import {
  Badge,
  Box,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Fieldset,
  HStack,
  Icon,
  Input,
  Link,
  Portal,
  RadioGroup,
  Stack,
  Text,
} from "@chakra-ui/react";
import { McpAuthConfig, McpAuthMode } from "@/chat/context/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { LuLock, LuShieldCheck } from "react-icons/lu";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getFallbackMcpUserScopes,
  normalizeMcpAuthConfig,
} from "./hooks/useMcpAuth";

export interface McpAuthFieldsProps {
  config: McpAuthConfig;
  onChange: React.Dispatch<McpAuthConfig>;
  user?: Record<string, unknown> | null;
}

type NormalizedMcpAuthConfig = ReturnType<typeof normalizeMcpAuthConfig>;
type UserDataConfig = Extract<McpAuthConfig, { mode: "user-data" }>["userData"];

type ScopeItemProps = {
  scope: Extract<
    McpAuthConfig,
    { mode: "user-data" }
  >["userData"]["scopes"][number];
  user?: Record<string, unknown> | null;
};

function formatPreviewValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function ScopeItem({ scope, user }: ScopeItemProps) {
  const { t } = useTranslation();
  const description = t(`mcp_scope_${scope.scope}`, { defaultValue: "" });
  const previewValue = formatPreviewValue(
    user && Object.hasOwn(user, scope.scope) ? user[scope.scope] : undefined
  );

  return (
    <Box
      data-testid={`mcp-auth-scope-${scope.scope}`}
      p={2}
      borderRadius="sm"
      borderWidth="1px"
      borderColor="gray.200"
      bg="gray.50"
    >
      <Stack gap={0}>
        {description && (
          <Text fontSize="sm" color="gray.600">
            {description}
          </Text>
        )}
        {previewValue && (
          <Text fontSize="xs" color="gray.800">
            {previewValue}
          </Text>
        )}
      </Stack>
    </Box>
  );
}

type AuthModeOptionProps = {
  disabled: boolean;
  label: string;
  testId: string;
  value: McpAuthMode;
  children?: React.ReactNode;
};

function AuthModeOption({
  disabled,
  label,
  testId,
  value,
  children,
}: AuthModeOptionProps) {
  return (
    <RadioGroup.Item value={value} data-testid={testId} disabled={disabled}>
      <HStack
        gap={2}
        flexWrap="wrap"
        opacity={disabled ? 0.5 : 1}
        cursor={disabled ? "not-allowed" : "pointer"}
      >
        <RadioGroup.ItemHiddenInput />
        <RadioGroup.ItemControl />
        <RadioGroup.ItemText fontSize="sm">{label}</RadioGroup.ItemText>
        {children}
      </HStack>
    </RadioGroup.Item>
  );
}

type StaticTokenFieldProps = {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  value: string;
};

function StaticTokenField({ onChange, value }: StaticTokenFieldProps) {
  const { t } = useTranslation();

  return (
    <Box pl={6}>
      <Input
        data-testid="mcp-auth-static-token-input"
        value={value}
        onChange={onChange}
        placeholder={t("enter_token")}
        size="sm"
      />
    </Box>
  );
}

type UserDataSectionProps = {
  consentGranted: boolean;
  displayedScopes: UserDataConfig["scopes"];
  onConsentChange: (checked: boolean) => void;
  onOpenPrivacyNotice: () => void;
  user?: Record<string, unknown> | null;
};

function UserDataSection({
  consentGranted,
  displayedScopes,
  onConsentChange,
  onOpenPrivacyNotice,
  user,
}: UserDataSectionProps) {
  const { t } = useTranslation();

  return (
    <Box pl={6} data-testid="mcp-auth-fields-container">
      <Stack gap={2}>
        <HStack
          fontSize="xs"
          color="orange.600"
          bg="orange.50"
          p={2}
          borderRadius="md"
          gap={1}
        >
          <Icon as={LuShieldCheck} flexShrink={0} />
          <Text>
            {t("only_authorized_servers_can_decrypt")}{" "}
            <Link
              color="blue.600"
              onClick={onOpenPrivacyNotice}
              cursor="pointer"
              textDecoration="underline"
            >
              {t("learn_more")}
            </Link>
          </Text>
        </HStack>

        {displayedScopes.length > 0 ? (
          <Stack gap={1}>
            {displayedScopes.map((scope) => (
              <ScopeItem key={scope.scope} scope={scope} user={user} />
            ))}
          </Stack>
        ) : (
          <Text fontSize="xs" color="gray.500">
            {t("mcp_no_user_data_scopes")}
          </Text>
        )}

        <Checkbox.Root
          checked={consentGranted}
          onCheckedChange={(event) => {
            onConsentChange(event.checked === true);
          }}
          size="sm"
        >
          <HStack gap={2}>
            <Checkbox.HiddenInput />
            <Checkbox.Control data-testid="mcp-auth-consent-control" />
            <Checkbox.Label
              data-testid="mcp-auth-consent"
              fontSize="sm"
              cursor="pointer"
            >
              {t("mcp_user_data_consent")}
            </Checkbox.Label>
          </HStack>
        </Checkbox.Root>
      </Stack>
    </Box>
  );
}

type PrivacyNoticeDialogProps = {
  onClose: () => void;
  open: boolean;
};

function PrivacyNoticeDialog({ onClose, open }: PrivacyNoticeDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => {
        if (!event.open) {
          onClose();
        }
      }}
      size="md"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("privacy_notice")}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body className="z-ui-markdown">
              <Markdown remarkPlugins={[remarkGfm]}>
                {t("mcp_privacy_notice_body")}
              </Markdown>
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="blue" onClick={onClose}>
                {t("understood")}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function getUserDataConfig(config: NormalizedMcpAuthConfig): UserDataConfig {
  if (config.mode === "user-data") {
    return config.userData;
  }

  return { scopes: [], consentGranted: false };
}

function buildAuthConfigForMode(
  mode: McpAuthMode,
  config: NormalizedMcpAuthConfig,
  userData: UserDataConfig
): McpAuthConfig {
  switch (mode) {
    case "static":
      return {
        mode: "static",
        staticToken: config.mode === "static" ? config.staticToken : "",
      };
    case "user-data":
      return {
        mode: "user-data",
        userData,
      };
    default:
      return { mode: "none" };
  }
}

export const McpAuthFields: React.FC<McpAuthFieldsProps> = ({
  config,
  onChange,
  user,
}) => {
  const normalizedConfig = normalizeMcpAuthConfig(config);
  const { t } = useTranslation();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const userData = getUserDataConfig(normalizedConfig);
  const displayedScopes =
    userData.scopes.length > 0
      ? userData.scopes
      : getFallbackMcpUserScopes(user);
  const serverAuthOptionsDisabled =
    normalizedConfig.mode === "user-data" && userData.scopes.length > 0;
  const userDataOptionDisabled = false;

  const handleModeChange = (details: { value: string }) => {
    const mode = details.value as McpAuthMode;
    onChange(buildAuthConfigForMode(mode, normalizedConfig, userData));
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      mode: "static",
      staticToken: e.target.value,
    });
  };

  const handleConsentChange = (checked: boolean) => {
    onChange({
      mode: "user-data",
      userData: {
        ...userData,
        scopes: displayedScopes,
        consentGranted: checked,
      },
    });
  };

  return (
    <>
      <Fieldset.Root size="sm">
        <Fieldset.Legend fontSize="sm" fontWeight="semibold">
          {t("authorization")}
        </Fieldset.Legend>

        <Fieldset.Content mt={2}>
          <RadioGroup.Root
            value={normalizedConfig.mode}
            onValueChange={handleModeChange}
            data-testid="mcp-auth-mode-group"
            size="sm"
          >
            <Stack gap={2}>
              <AuthModeOption
                value="none"
                testId="mcp-auth-mode-none"
                disabled={serverAuthOptionsDisabled}
                label={t("none")}
              />

              <AuthModeOption
                value="static"
                testId="mcp-auth-mode-static"
                disabled={serverAuthOptionsDisabled}
                label={t("static_token")}
              />

              {normalizedConfig.mode === "static" && (
                <StaticTokenField
                  value={normalizedConfig.staticToken || ""}
                  onChange={handleTokenChange}
                />
              )}

              <AuthModeOption
                value="user-data"
                testId="mcp-auth-mode-user-data"
                disabled={userDataOptionDisabled}
                label={t("user_data")}
              >
                <Badge colorPalette="green" size="sm" variant="subtle">
                  <Icon as={LuLock} boxSize={3} />
                  {t("encrypted")}
                </Badge>
              </AuthModeOption>

              {normalizedConfig.mode === "user-data" && (
                <UserDataSection
                  consentGranted={userData.consentGranted}
                  displayedScopes={displayedScopes}
                  onConsentChange={handleConsentChange}
                  onOpenPrivacyNotice={() => setPrivacyOpen(true)}
                  user={user}
                />
              )}
            </Stack>
          </RadioGroup.Root>
        </Fieldset.Content>
      </Fieldset.Root>

      <PrivacyNoticeDialog
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />
    </>
  );
};
