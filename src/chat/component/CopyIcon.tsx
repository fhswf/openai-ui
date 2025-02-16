import React, { useState } from 'react'
import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "../../components/ui/tooltip"
import { LuClipboardCheck } from "react-icons/lu";
import { LuClipboardCopy } from "react-icons/lu";
import { useTranslation } from 'react-i18next';
import { t } from 'i18next';

export function CopyIcon(props) {
  const { text, value, className } = props
  const [icon, setIcon] = useState(LuClipboardCopy);
  const { t } = useTranslation();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setIcon(LuClipboardCheck);
      setTimeout(() => {
        setIcon(LuClipboardCopy);
      }, 1500);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  return (
    <Tooltip content={text}>
      <IconButton minWidth="24px" size="sm" variant="plain" onClick={handleCopy} >
        {icon}
      </IconButton>
    </Tooltip>
  )
}

CopyIcon.defaultProps = {
  text: t('copy')
}