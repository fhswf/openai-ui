import React from "react";
import {
  Button,
  IconButton,
  Link,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import remarkMath from "remark-math";
import smartypants from "remark-smartypants";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { IoInformationCircleOutline } from "react-icons/io5";
import { Tooltip } from "../components/ui/tooltip";
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerRoot,
  DrawerTitle,
} from "../components/ui/drawer";
import styles from "./style/sider.module.less";

interface ReleaseMetadata {
  release?: string;
  build_sha?: string;
}

interface SidebarAboutDialogProps {
  acceptedTerms: boolean;
  metadata: ReleaseMetadata;
  onAcceptTerms: VoidFunction;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  termsText: string;
}

export function SidebarAboutDialog({
  acceptedTerms,
  metadata,
  onAcceptTerms,
  onOpenChange,
  open,
  termsText,
}: SidebarAboutDialogProps) {
  const { t } = useTranslation();

  return (
    <DialogRoot
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      size="lg"
    >
      <DialogTrigger asChild>
        <IconButton
          aria-label={t("about")}
          variant="ghost"
          data-testid="aboutBtn"
        >
          <Tooltip content={t("about")}>
            <IoInformationCircleOutline />
          </Tooltip>
        </IconButton>
      </DialogTrigger>
      <DialogContent data-testid="InformationWindow">
        <DialogHeader>
          <DialogTitle>{t("About")}</DialogTitle>
          {acceptedTerms ? <DialogCloseTrigger /> : null}
        </DialogHeader>
        <DialogBody className="z-ui-markdown">
          {metadata.release ? (
            <Text>
              Version:{" "}
              <Link
                target="blank"
                href={`https://github.com/fhswf/openai-ui/releases/tag/openai-ui-v${metadata.release}`}
              >
                {metadata.release}
              </Link>{" "}
              (
              <Link
                target="blank"
                href={`https://github.com/fhswf/openai-ui/commit/${metadata.build_sha}`}
              >
                commit {String(metadata.build_sha).substring(0, 7)}
              </Link>
              )
            </Text>
          ) : null}
          <Markdown
            remarkPlugins={[remarkGfm, remarkMath, smartypants]}
            rehypePlugins={[rehypeKatex]}
          >
            {termsText}
          </Markdown>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            onClick={onAcceptTerms}
            data-testid="accept-terms-btn"
          >
            {t("Accept Terms")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

interface MobileSidebarDrawerProps {
  actions: React.ReactNode;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onOpenAbout: VoidFunction;
}

export function MobileSidebarDrawer({
  actions,
  mobileOpen,
  onMobileOpenChange,
  onOpenAbout,
}: MobileSidebarDrawerProps) {
  const { t } = useTranslation();

  return (
    <DrawerRoot
      open={mobileOpen}
      onOpenChange={(event) => onMobileOpenChange(event.open)}
      placement="start"
      size="xs"
    >
      <Portal>
        <DrawerBackdrop />
      </Portal>
      <DrawerContent
        id="mobile-chat-navigation"
        className={styles["mobile-drawer"]}
      >
        <DrawerHeader>
          <DrawerTitle>{t("chatbot_title")}</DrawerTitle>
          <DrawerCloseTrigger aria-label={t("close")} />
        </DrawerHeader>
        <DrawerBody>
          <VStack align="stretch" gap="2" className={styles["drawer-controls"]}>
            {actions}
            <Button
              width="100%"
              justifyContent="flex-start"
              variant="ghost"
              onClick={onOpenAbout}
              data-testid="MobileAboutBtn"
            >
              <IoInformationCircleOutline /> <span>{t("about")}</span>
            </Button>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}
