import React from "react";
import { Button, Stack, Text } from "@chakra-ui/react";

const OPEN_MCP_SETTINGS_EVENT = "open-mcp-settings";

export function openMcpSettings(key?: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_MCP_SETTINGS_EVENT, {
      detail: key ? { key } : undefined,
    })
  );
}

export function getOpenMcpSettingsEventName() {
  return OPEN_MCP_SETTINGS_EVENT;
}

export function McpSettingsAction(props: {
  message: string;
  buttonLabel: string;
  serviceKey?: string;
}) {
  const { message, buttonLabel, serviceKey } = props;

  return (
    <Stack gap={2} alignItems="flex-start">
      <Text>{message}</Text>
      <Button
        size="xs"
        variant="outline"
        onClick={() => openMcpSettings(serviceKey)}
      >
        {buttonLabel}
      </Button>
    </Stack>
  );
}
