import React from "react";
import type { Tool } from "openai/resources/responses/responses.mjs";
import { Menu, Portal } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronRight, LuSettings } from "react-icons/lu";
import type { ToolChangeRequest, McpToolMap } from "./utils/mcpServices";

interface ToolOptionsGroupProps {
  onToolChange: React.Dispatch<ToolChangeRequest>;
  onConfigureImageGeneration: VoidFunction;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

export function ToolOptionsGroup({
  onToolChange,
  onConfigureImageGeneration,
  tools,
  toolsEnabled,
}: ToolOptionsGroupProps) {
  const { t } = useTranslation();

  return (
    <Menu.ItemGroup
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      gap={0}
    >
      <Menu.ItemGroupLabel gridColumn="1 / -1">
        {t("tool_options")}
      </Menu.ItemGroupLabel>
      {Array.from(tools.entries())
        // Document collections are listed in their own submenu.
        .filter(([, value]) => value.type !== "file_search")
        .map(([key, value]) => {
          const checkboxItem = (
            <Menu.CheckboxItem
              value={value.type === "mcp" ? key : value.type}
              checked={toolsEnabled.has(key)}
              onCheckedChange={(event) => {
                onToolChange({ key, tool: value, checkedChange: event });
              }}
              gridColumn={
                key === "Image Generation" && value.type === "image_generation"
                  ? "1"
                  : "1 / -1"
              }
            >
              <Menu.ItemIndicator />
              {key}
            </Menu.CheckboxItem>
          );

          if (key === "Image Generation" && value.type === "image_generation") {
            return (
              <React.Fragment key={key}>
                {checkboxItem}
                <Menu.Item
                  value="image_generation_settings"
                  onClick={onConfigureImageGeneration}
                  aria-label={t("image_generation_settings_menu")}
                  title={t("image_generation_settings_menu")}
                  data-testid="image-generation-settings-btn"
                  justifyContent="center"
                  minWidth="9"
                  paddingX="2"
                  width="auto"
                  gridColumn="2"
                >
                  <LuSettings aria-hidden="true" />
                </Menu.Item>
              </React.Fragment>
            );
          }

          return <React.Fragment key={key}>{checkboxItem}</React.Fragment>;
        })}
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
      <Menu.TriggerItem
        data-testid="mcp-services-menu-trigger"
        data-tour="mcp-services-menu-trigger"
      >
        {t("MCP Services")} <LuChevronRight />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            _open={{ animation: "none" }}
            _closed={{ animation: "none" }}
          >
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
              data-tour="mcp-add-remove-services"
            >
              {t("Add/Remove MCP Services")}
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
