import React from "react";
import type { Tool } from "openai/resources/responses/responses.mjs";
import { Menu, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronRight } from "react-icons/lu";
import type { ToolChangeRequest, McpToolMap } from "./utils/mcpServices";

interface ToolOptionsGroupProps {
  onToolChange: React.Dispatch<ToolChangeRequest>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

export function ToolOptionsGroup({
  onToolChange,
  tools,
  toolsEnabled,
}: ToolOptionsGroupProps) {
  const { t } = useTranslation();

  return (
    <Menu.ItemGroup>
      <Menu.ItemGroupLabel>{t("tool_options")}</Menu.ItemGroupLabel>
      {Array.from(tools.entries()).map(([key, value]) => (
        <Menu.CheckboxItem
          key={key}
          value={value.type === "mcp" ? key : value.type}
          checked={toolsEnabled.has(key)}
          onCheckedChange={(event) => {
            onToolChange({ key, tool: value, checkedChange: event });
          }}
        >
          <Menu.ItemIndicator />
          {key}
        </Menu.CheckboxItem>
      ))}
    </Menu.ItemGroup>
  );
}

interface McpServicesMenuProps {
  mcpTools: McpToolMap;
  onEditMcp: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  toolsEnabled: Set<string>;
}

export function McpServicesMenu({
  mcpTools,
  onEditMcp,
  onToolChange,
  toolsEnabled,
}: McpServicesMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
      <Menu.TriggerItem data-testid="mcp-services-menu-trigger">
        {t("MCP Services")} <LuChevronRight />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {Array.from(mcpTools.entries()).map(([key, tool]) => (
              <Menu.CheckboxItem
                key={key}
                value={key}
                checked={toolsEnabled.has(key)}
                onCheckedChange={(event) => {
                  onToolChange({ key, tool, checkedChange: event });
                }}
              >
                <Menu.ItemIndicator />
                {key}
              </Menu.CheckboxItem>
            ))}
            <Menu.Item
              value="edit_mcp_services"
              onClick={onEditMcp}
              data-testid="mcp-add-remove-services"
            >
              {t("Add/Remove MCP Services")}
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
