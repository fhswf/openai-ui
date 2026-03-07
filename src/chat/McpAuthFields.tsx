import {
  Box,
  Checkbox,
  Fieldset,
  HStack,
  Icon,
  Input,
  Link,
  RadioGroup,
  Stack,
  Text,
  Badge,
  Dialog,
  Portal,
  CloseButton,
  Button,
  Code,
} from "@chakra-ui/react";
import { McpAuthConfig, McpAuthMode } from "@/chat/context/types";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n/config";
import { LuLock, LuShieldCheck } from "react-icons/lu";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getScopeDescription,
  isConsentRequired,
  supportsUserDataAuth,
} from "./utils/mcp";

const PRIVACY_NOTICE = `
### Datenübertragung an MCP-Server

Wenn Sie der Übertragung von Benutzerdaten zustimmen, werden die ausgewählten Daten 
**verschlüsselt** an autorisierte MCP-Server der FH Südwestfalen übertragen.

**Wichtig:**
- Die Daten werden **Ende-zu-Ende verschlüsselt** – nur autorisierte MCP-Server können sie entschlüsseln
- OpenAI  oder unbefugte Dritte können diese Daten **nicht** lesen
- Die Übertragung ist **freiwillig** und kann jederzeit widerrufen werden
- Ohne Ihre Einwilligung werden **keine** personenbezogenen Daten übertragen

Die vollständigen Datenschutzhinweise finden Sie im Info-Menü (?) der Anwendung.
`;

export interface McpAuthFieldsProps {
  config: McpAuthConfig;
  onChange: React.Dispatch<McpAuthConfig>;
  userFields: string[];
  user?: Record<string, unknown>;
  disabled?: boolean;
}

export const McpAuthFields: React.FC<McpAuthFieldsProps> = ({
  config,
  onChange,
  userFields,
  user,
  disabled,
}) => {
  const { t } = useTranslation();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const selectedFields = Array.isArray(config.selectedFields)
    ? config.selectedFields
    : [];

  const hasScopes =
    Array.isArray(config.scopes) && config.scopes.length > 0;

  const handleModeChange = (details: { value: string }) => {
    const mode = details.value as McpAuthMode;
    onChange({
      ...config,
      mode,
      selectedFields: mode === "user-data" ? selectedFields : [],
      staticToken: mode === "static" ? config.staticToken : "",
    });
  };

  const handleFieldToggle = (field: string, checked: boolean) => {
    const fields = checked
      ? [...selectedFields, field]
      : selectedFields.filter((f) => f !== field);
    onChange({ ...config, selectedFields: fields });
  };

  const handleScopeToggle = (scope: string, checked: boolean) => {
    const grantedScopes = Array.isArray(config.grantedScopes)
      ? config.grantedScopes
      : [];
    const updated = checked
      ? [...grantedScopes, scope]
      : grantedScopes.filter((s) => s !== scope);
    onChange({ ...config, grantedScopes: updated });
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, staticToken: e.target.value });
  };

  const getFieldValue = (fieldName: string): unknown => {
    if (!user) return undefined;
    if (
      fieldName === "__proto__" ||
      fieldName === "constructor" ||
      fieldName === "prototype"
    ) {
      return undefined;
    }
    if (!Object.hasOwn(user, fieldName)) return undefined;
    return Object.getOwnPropertyDescriptor(user, fieldName)?.value;
  };

  const formatFieldValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return (
        <Text as="span" color="gray.400" fontStyle="italic">
          -
        </Text>
      );
    }
    if (typeof value === "object") {
      return (
        <Code
          display="block"
          whiteSpace="pre-wrap"
          fontSize="xs"
          p={1}
          bg="gray.100"
          borderRadius="sm"
          maxH="80px"
          overflowY="auto"
        >
          {JSON.stringify(value, null, 2)}
        </Code>
      );
    }
    return (
      <Text as="span" fontSize="xs" color="gray.600" wordBreak="break-all">
        {String(value)}
      </Text>
    );
  };

  const grantedScopes = Array.isArray(config.grantedScopes)
    ? config.grantedScopes
    : [];
  const allScopesGranted =
    hasScopes && config.scopes.every((s) => grantedScopes.includes(s.scope));
  const consentRequired = isConsentRequired(config);
  const userDataDisabled = disabled || !supportsUserDataAuth(config);

  return (
    <>
      <Fieldset.Root size="sm">
        <Fieldset.Legend fontSize="sm" fontWeight="semibold">
          {t("authorization")}
        </Fieldset.Legend>

        <Fieldset.Content mt={2}>
          <RadioGroup.Root
            value={config.mode}
            onValueChange={handleModeChange}
            data-testid="mcp-auth-mode-group"
            size="sm"
          >
            <Stack gap={2}>
              <RadioGroup.Item
                value="none"
                data-testid="mcp-auth-mode-none"
                disabled={consentRequired}
                opacity={consentRequired ? 0.5 : 1}
              >
                <HStack gap={2}>
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemControl />
                  <RadioGroup.ItemText fontSize="sm">
                    {t("none")}
                  </RadioGroup.ItemText>
                </HStack>
              </RadioGroup.Item>

              <RadioGroup.Item
                value="static"
                data-testid="mcp-auth-mode-static"
                disabled={consentRequired}
                opacity={consentRequired ? 0.5 : 1}
              >
                <HStack gap={2}>
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemControl />
                  <RadioGroup.ItemText fontSize="sm">
                    {t("static_token")}
                  </RadioGroup.ItemText>
                </HStack>
              </RadioGroup.Item>

              {config.mode === "static" && (
                <Box pl={6}>
                  <Input
                    data-testid="mcp-auth-static-token-input"
                    value={config.staticToken || ""}
                    onChange={handleTokenChange}
                    placeholder={t("enter_token")}
                    size="sm"
                  />
                </Box>
              )}

              <RadioGroup.Item
                value="user-data"
                data-testid="mcp-auth-mode-user-data"
                disabled={userDataDisabled}
                opacity={userDataDisabled ? 0.5 : 1}
              >
                <HStack gap={2} flexWrap="wrap">
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemControl />
                  <RadioGroup.ItemText fontSize="sm">
                    {t("user_data")}
                  </RadioGroup.ItemText>
                  <Badge colorPalette="green" size="sm" variant="subtle">
                    <Icon as={LuLock} boxSize={3} />
                    {t("encrypted")}
                  </Badge>
                </HStack>
              </RadioGroup.Item>

              {config.mode === "user-data" && (
                <Box pl={6} data-testid="mcp-auth-fields-container">
                  <Stack gap={2}>
                    {hasScopes && (
                      <Text
                        fontSize="xs"
                        color="blue.700"
                        bg="blue.50"
                        p={2}
                        borderRadius="md"
                        data-testid="mcp-scope-consent-container"
                      >
                        {t("consent_info")}
                      </Text>
                    )}

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
                          onClick={() => {
                            setPrivacyOpen(true);
                          }}
                          cursor="pointer"
                          textDecoration="underline"
                        >
                          {t("learn_more")}
                        </Link>
                      </Text>
                    </HStack>

                    <Stack gap={1}>
                      {hasScopes
                        ? config.scopes.map((scope) => {
                            const isGranted = grantedScopes.includes(
                              scope.scope
                            );
                            const value = getFieldValue(scope.scope);
                            return (
                              <Checkbox.Root
                                key={scope.scope}
                                data-testid={`mcp-scope-${scope.scope}`}
                                checked={isGranted}
                                onCheckedChange={(e) => {
                                  handleScopeToggle(
                                    scope.scope,
                                    !!e.checked
                                  );
                                }}
                                size="sm"
                                p={2}
                                borderRadius="sm"
                                borderWidth="1px"
                                borderColor={
                                  isGranted ? "blue.200" : "gray.200"
                                }
                                bg={isGranted ? "blue.50" : "transparent"}
                                _hover={{
                                  bg: isGranted ? "blue.50" : "gray.50",
                                }}
                                cursor="pointer"
                              >
                                <HStack
                                  gap={2}
                                  alignItems="flex-start"
                                  width="100%"
                                >
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control mt={0.5} />
                                  <Box flex={1} minW={0}>
                                    <Checkbox.Label
                                      fontSize="xs"
                                      fontWeight="medium"
                                      display="block"
                                    >
                                      {getScopeDescription(
                                        scope,
                                        i18n.resolvedLanguage
                                      )}
                                    </Checkbox.Label>
                                    <Box mt={0.5}>
                                      {formatFieldValue(value)}
                                    </Box>
                                  </Box>
                                </HStack>
                              </Checkbox.Root>
                            );
                          })
                        : userFields.map((field) => {
                            const isChecked = selectedFields.includes(field);
                            const value = getFieldValue(field);
                            return (
                              <Checkbox.Root
                                key={field}
                                data-testid={`mcp-auth-field-${field}`}
                                checked={isChecked}
                                onCheckedChange={(e) => {
                                  handleFieldToggle(field, !!e.checked);
                                }}
                                size="sm"
                                p={2}
                                borderRadius="sm"
                                borderWidth="1px"
                                borderColor={
                                  isChecked ? "blue.200" : "gray.200"
                                }
                                bg={isChecked ? "blue.50" : "transparent"}
                                _hover={{
                                  bg: isChecked ? "blue.50" : "gray.50",
                                }}
                                cursor="pointer"
                              >
                                <HStack
                                  gap={2}
                                  alignItems="flex-start"
                                  width="100%"
                                >
                                  <Checkbox.HiddenInput />
                                  <Checkbox.Control
                                    data-testid={`mcp-auth-field-${field}-control`}
                                    mt={0.5}
                                  />
                                  <Box flex={1} minW={0}>
                                    <Checkbox.Label
                                      fontSize="xs"
                                      fontWeight="medium"
                                      display="block"
                                    >
                                      {field}
                                    </Checkbox.Label>
                                    <Box mt={0.5}>
                                      {formatFieldValue(value)}
                                    </Box>
                                  </Box>
                                </HStack>
                              </Checkbox.Root>
                            );
                          })}
                    </Stack>

                    {hasScopes && !allScopesGranted && (
                      <Text color="red.500" fontSize="xs">
                        {t("consent_all_required")}
                      </Text>
                    )}

                    {!hasScopes && (
                      <Text fontSize="xs" color="gray.500">
                        {selectedFields.length}/{userFields.length}{" "}
                        {t("selected")}
                      </Text>
                    )}
                  </Stack>
                </Box>
              )}

              {consentRequired && (
                <Text
                  data-testid="mcp-auth-user-data-required"
                  fontSize="xs"
                  color="blue.600"
                >
                  {t("mcp_user_data_required")}
                </Text>
              )}
            </Stack>
          </RadioGroup.Root>
        </Fieldset.Content>
      </Fieldset.Root>

      <Dialog.Root
        open={privacyOpen}
        onOpenChange={(e) => {
          setPrivacyOpen(e.open);
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
                  {PRIVACY_NOTICE}
                </Markdown>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  colorPalette="blue"
                  onClick={() => {
                    setPrivacyOpen(false);
                  }}
                >
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
    </>
  );
};
