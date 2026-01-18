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
import { t } from "i18next";
import { LuLock, LuShieldCheck } from "react-icons/lu";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Condensed privacy notice for the inline dialog */
const PRIVACY_NOTICE = `
### Datenübertragung an MCP-Server

Wenn Sie der Übertragung von Benutzerdaten zustimmen, werden die ausgewählten Daten 
**verschlüsselt** an autorisierte MCP-Server der FH Südwestfalen übertragen.

**Wichtig:**
- Die Daten werden **Ende-zu-Ende verschlüsselt** – nur autorisierte MCP-Server können sie entschlüsseln
- OpenAI oder andere LLM-Anbieter können diese Daten **nicht** lesen
- Die Übertragung ist **freiwillig** und kann jederzeit widerrufen werden
- Ohne Ihre Einwilligung werden **keine** personenbezogenen Daten übertragen

Die vollständigen Datenschutzhinweise finden Sie im Info-Menü (?) der Anwendung.
`;

export interface McpAuthFieldsProps {
    config: McpAuthConfig;
    onChange: (config: McpAuthConfig) => void;
    userFields: string[];
    user?: Record<string, unknown>;
}

export function McpAuthFields({
                                  config,
                                  onChange,
                                  userFields,
                                  user,
                              }: McpAuthFieldsProps) {
    const [privacyOpen, setPrivacyOpen] = useState(false);

    const handleModeChange = (details: { value: string }) => {
        const mode = details.value as McpAuthMode;
        onChange({
            ...config,
            mode,
            selectedFields: mode === "user-data" ? config.selectedFields : [],
            staticToken: mode === "static" ? config.staticToken : "",
        });
    };

    const handleFieldToggle = (field: string, checked: boolean) => {
        const fields = checked
            ? [...config.selectedFields, field]
            : config.selectedFields.filter((f) => f !== field);
        onChange({ ...config, selectedFields: fields });
    };

    const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...config, staticToken: e.target.value });
    };
    const formatFieldValue = (value: unknown): React.ReactNode => {
        if (value === null || value === undefined) {
            return <Text as="span" color="gray.400" fontStyle="italic">—</Text>;
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

    return (
        <>
            <Fieldset.Root size="sm">
                <Fieldset.Legend fontSize="sm" fontWeight="semibold">
                    {t("Autorisierung")}
                </Fieldset.Legend>

                <Fieldset.Content mt={2}>
                    <RadioGroup.Root
                        value={config.mode}
                        onValueChange={handleModeChange}
                        data-testid="mcp-auth-mode-group"
                        size="sm"
                    >
                        <Stack gap={2}>
                            {/* Option: None */}
                            <RadioGroup.Item value="none" data-testid="mcp-auth-mode-none">
                                <HStack gap={2}>
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemControl />
                                    <RadioGroup.ItemText fontSize="sm">
                                        {t("Keine")}
                                    </RadioGroup.ItemText>
                                </HStack>
                            </RadioGroup.Item>

                            {/* Option: Static Token */}
                            <RadioGroup.Item value="static" data-testid="mcp-auth-mode-static">
                                <HStack gap={2}>
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemControl />
                                    <RadioGroup.ItemText fontSize="sm">
                                        {t("Statisches Token")}
                                    </RadioGroup.ItemText>
                                </HStack>
                            </RadioGroup.Item>

                            {/* Static Token Input */}
                            {config.mode === "static" && (
                                <Box pl={6}>
                                    <Input
                                        data-testid="mcp-auth-static-token-input"
                                        value={config.staticToken || ""}
                                        onChange={handleTokenChange}
                                        placeholder={t("Token eingeben...")}
                                        size="sm"
                                    />
                                </Box>
                            )}

                            {/* Option: Encrypted User Data */}
                            <RadioGroup.Item value="user-data" data-testid="mcp-auth-mode-user-data">
                                <HStack gap={2} flexWrap="wrap">
                                    <RadioGroup.ItemHiddenInput />
                                    <RadioGroup.ItemControl />
                                    <RadioGroup.ItemText fontSize="sm">
                                        {t("Benutzerdaten")}
                                    </RadioGroup.ItemText>
                                    <Badge colorPalette="green" size="sm" variant="subtle">
                                        <Icon as={LuLock} boxSize={3} />
                                        {t("verschlüsselt")}
                                    </Badge>
                                </HStack>
                            </RadioGroup.Item>

                            {/* User Data Fields Selection */}
                            {config.mode === "user-data" && (
                                <Box pl={6} data-testid="mcp-auth-fields-container">
                                    <Stack gap={2}>
                                        {/* Compact Info */}
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
                                                {t("Nur autorisierte FH-Server können entschlüsseln.")}
                                                {" "}
                                                <Link
                                                    color="blue.600"
                                                    onClick={() => setPrivacyOpen(true)}
                                                    cursor="pointer"
                                                    textDecoration="underline"
                                                >
                                                    {t("Mehr erfahren")}
                                                </Link>
                                            </Text>
                                        </HStack>

                                        {/* Field List with Values */}
                                        <Stack gap={1}>
                                            {userFields.map((field) => {
                                                const isChecked = config.selectedFields.includes(field);
                                                const value = user?.[field];
                                                return (
                                                    <Checkbox.Root
                                                        key={field}
                                                        data-testid={`mcp-auth-field-${field}`}
                                                        checked={isChecked}
                                                        onCheckedChange={(e) =>
                                                            handleFieldToggle(field, !!e.checked)
                                                        }
                                                        size="sm"
                                                        p={2}
                                                        borderRadius="sm"
                                                        borderWidth="1px"
                                                        borderColor={isChecked ? "blue.200" : "gray.200"}
                                                        bg={isChecked ? "blue.50" : "transparent"}
                                                        _hover={{ bg: isChecked ? "blue.50" : "gray.50" }}
                                                        cursor="pointer"
                                                    >
                                                        <HStack gap={2} alignItems="flex-start" width="100%">
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

                                        {/* Selection Count */}
                                        <Text fontSize="xs" color="gray.500">
                                            {config.selectedFields.length}/{userFields.length} {t("ausgewählt")}
                                        </Text>
                                    </Stack>
                                </Box>
                            )}
                        </Stack>
                    </RadioGroup.Root>
                </Fieldset.Content>
            </Fieldset.Root>

            {/* Privacy Notice Dialog */}
            <Dialog.Root
                open={privacyOpen}
                onOpenChange={(e) => setPrivacyOpen(e.open)}
                size="md"
            >
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content>
                            <Dialog.Header>
                                <Dialog.Title>{t("Datenschutzhinweise")}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body className="z-ui-markdown">
                                <Markdown remarkPlugins={[remarkGfm]}>
                                    {PRIVACY_NOTICE}
                                </Markdown>
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Button
                                    colorPalette="blue"
                                    onClick={() => setPrivacyOpen(false)}
                                >
                                    {t("Verstanden")}
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
}