import React from "react";
import { Tag } from "@chakra-ui/react";
import { MdOutlinePictureAsPdf } from "react-icons/md";
import styles from "../style/message.module.less";

export interface FilePreviewProps {
  readonly name?: string;
}

export function FilePreview({ name }: FilePreviewProps) {
  return (
    <Tag.Root className={styles.file} data-testid={`file-preview-${name}`}>
      <Tag.StartElement>
        <MdOutlinePictureAsPdf />
      </Tag.StartElement>
      <Tag.Label>{name}</Tag.Label>
    </Tag.Root>
  );
}
