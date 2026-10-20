import React, { useState } from "react";
import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "../../components/ui/tooltip";
import { LuClipboardCheck } from "react-icons/lu";
import { LuClipboardCopy } from "react-icons/lu";
import { useTranslation } from "react-i18next";

export function CopyIcon(props) {
  const { text, value } = props;
  const [icon, setIcon] = useState<React.ReactNode>(<LuClipboardCopy />);
  const { t } = useTranslation();
  const label = text ?? t("copy");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setIcon(<LuClipboardCheck />);
      setTimeout(() => {
        setIcon(<LuClipboardCopy />);
      }, 1500);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  }

  return (
    <Tooltip content={label}>
      <IconButton
        aria-label={label}
        minWidth="24px"
        size="sm"
        variant="ghost"
        onClick={handleCopy}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
