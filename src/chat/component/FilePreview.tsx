import React from "react";
import { Tag } from "@chakra-ui/react";
import {
  MdOutlineInsertDriveFile,
  MdOutlinePictureAsPdf,
  MdOutlineTableChart,
} from "react-icons/md";
import { isPdfFile, isSpreadsheetFile } from "../utils/attachments";
import styles from "../style/message.module.less";

export interface FilePreviewProps {
  readonly name?: string;
}

export function FilePreview({ name }: FilePreviewProps) {
  const Icon = isPdfFile({ name })
    ? MdOutlinePictureAsPdf
    : isSpreadsheetFile({ name })
      ? MdOutlineTableChart
      : MdOutlineInsertDriveFile;

  return (
    <Tag.Root className={styles.file} data-testid={`file-preview-${name}`}>
      <Tag.StartElement>
        <Icon />
      </Tag.StartElement>
      <Tag.Label>{name}</Tag.Label>
    </Tag.Root>
  );
}
