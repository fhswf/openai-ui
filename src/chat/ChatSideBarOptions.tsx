import React from "react";
import { Button, IconButton } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip";
import { classnames } from "../components/utils";
import { t } from "i18next";
import {
  IoInformationCircleOutline,
  IoSettingsOutline,
  IoApps,
} from "react-icons/io5";
import { RiChatHistoryLine } from "react-icons/ri";
import { MdOutlineDarkMode, MdOutlineLightMode } from "react-icons/md";
import { TbArrowsMinimize, TbArrowsMaximize } from "react-icons/tb";
import { LuMonitor } from "react-icons/lu";
import styles from "./style/sider.module.less";

const ICONS = {
  help: IoInformationCircleOutline,
  apps: IoApps,
  history: RiChatHistoryLine,
  config: IoSettingsOutline,
  dark: MdOutlineDarkMode,
  light: MdOutlineLightMode,
  auto: LuMonitor,
  "min-screen": TbArrowsMinimize,
  "full-screen": TbArrowsMaximize,
};

interface OptionProps {
  dataTestId?: string;
  expanded?: boolean;
  onClick: VoidFunction;
  tooltip: string;
  type: keyof typeof ICONS;
}

function Option({
  dataTestId,
  expanded = false,
  onClick,
  tooltip,
  type,
}: OptionProps) {
  const Icon = ICONS[type];
  if (!Icon) {
    console.error(`Icon ${type} not found`);
    return null;
  }
  const testId = dataTestId ? { "data-testid": dataTestId } : {};
  const control = expanded ? (
    <Button
      width="100%"
      justifyContent="flex-start"
      variant="ghost"
      onClick={onClick}
      aria-label={tooltip}
      {...testId}
    >
      <Icon />
      <span>{tooltip}</span>
    </Button>
  ) : (
    <IconButton
      aria-label={tooltip}
      variant="ghost"
      onClick={onClick}
      {...testId}
    >
      <Icon />
    </IconButton>
  );

  return <Tooltip content={tooltip}>{control}</Tooltip>;
}

export interface PrimarySidebarOptionsProps {
  expanded: boolean;
  fullScreen: boolean;
  theme: string;
  onToggleConfig: VoidFunction;
  onToggleFullScreen: VoidFunction;
  onToggleTheme: VoidFunction;
}

export function PrimarySidebarOptions({
  expanded,
  fullScreen,
  theme,
  onToggleConfig,
  onToggleFullScreen,
  onToggleTheme,
}: PrimarySidebarOptionsProps) {
  return (
    <div
      className={classnames(styles.tool, "flex-c-sb flex-column", {
        [styles["drawer-options"]]: expanded,
      })}
      data-testid={expanded ? "MobileSidebarActions" : "BottomLeftSideBar"}
    >
      <Option
        type={theme as keyof typeof ICONS}
        onClick={onToggleTheme}
        tooltip={t("Theme")}
        dataTestId="OptionDarkModeSelect"
        expanded={expanded}
      />
      <Option
        dataTestId="OpenConfigBtn"
        type="config"
        onClick={onToggleConfig}
        tooltip={t("Config")}
        expanded={expanded}
      />
      <Option
        type={fullScreen ? "min-screen" : "full-screen"}
        onClick={onToggleFullScreen}
        tooltip={fullScreen ? t("Minimize") : t("Maximize")}
        expanded={expanded}
      />
    </div>
  );
}
