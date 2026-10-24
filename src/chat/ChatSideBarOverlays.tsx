import React from "react";
import {
  Button,
  IconButton,
  Link,
  Portal,
  Spacer,
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
import { classnames } from "../components/utils";
import { PrimarySidebarOptions } from "./ChatSideBarOptions";
import type { PrimarySidebarOptionsProps } from "./ChatSideBarOptions";
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
import { useColorModeValue } from "../components/ui/color-mode";
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
import "./style/markdown.less";
import "katex/dist/katex.min.css";

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
  const aboutLinkColor = useColorModeValue("blue.700", "blue.200");

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
                color={aboutLinkColor}
                href={`https://github.com/fhswf/openai-ui/releases/tag/openai-ui-v${metadata.release}`}
              >
                {metadata.release}
              </Link>{" "}
              (
              <Link
                target="blank"
                color={aboutLinkColor}
                href={`https://github.com/fhswf/openai-ui/commit/${metadata.build_sha}`}
              >
                commit {String(metadata.build_sha).substring(0, 7)}
              </Link>
              )
            </Text>
          ) : null}
          <Markdown
            components={{
              a: ({ node: _node, ...props }) => (
                <Link color={aboutLinkColor} {...props} />
              ),
            }}
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

interface DesktopSidebarProps {
  actions: React.ReactNode;
  about: React.ReactNode;
}

export function DesktopSidebar({ actions, about }: DesktopSidebarProps) {
  return (
    <VStack
      role="toolbar"
      className={classnames(styles.sider, "flex-c-sb flex-column")}
      data-testid="LeftSideBar"
    >
      {actions}
      <Spacer />
      <div className={classnames(styles.tool, "flex-c-sb flex-column")}>
        {about}
      </div>
    </VStack>
  );
}

type SidebarActionProps = Omit<PrimarySidebarOptionsProps, "expanded">;

interface DesktopChatSideBarProps extends SidebarActionProps {
  acceptedTerms: boolean;
  aboutOpen: boolean;
  metadata: ReleaseMetadata;
  onAboutOpenChange: (open: boolean) => void;
  onAcceptTerms: VoidFunction;
  termsText: string;
}

function DesktopChatSideBar({
  acceptedTerms,
  aboutOpen,
  fullScreen,
  metadata,
  onAboutOpenChange,
  onAcceptTerms,
  onToggleConfig,
  onToggleFullScreen,
  onToggleTheme,
  termsText,
  theme,
}: DesktopChatSideBarProps) {
  return (
    <DesktopSidebar
      actions={
        <PrimarySidebarOptions
          expanded={false}
          theme={theme}
          fullScreen={fullScreen}
          onToggleTheme={onToggleTheme}
          onToggleConfig={onToggleConfig}
          onToggleFullScreen={onToggleFullScreen}
        />
      }
      about={
        <SidebarAboutDialog
          open={aboutOpen}
          acceptedTerms={acceptedTerms}
          metadata={metadata}
          termsText={termsText}
          onOpenChange={onAboutOpenChange}
          onAcceptTerms={onAcceptTerms}
        />
      }
    />
  );
}

interface MobileChatSideBarProps extends SidebarActionProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onOpenAbout: VoidFunction;
}

function MobileChatSideBar({
  fullScreen,
  mobileOpen,
  onMobileOpenChange,
  onOpenAbout,
  onToggleConfig,
  onToggleFullScreen,
  onToggleTheme,
  theme,
}: MobileChatSideBarProps) {
  return (
    <MobileSidebarDrawer
      mobileOpen={mobileOpen}
      onMobileOpenChange={onMobileOpenChange}
      onOpenAbout={onOpenAbout}
      actions={
        <PrimarySidebarOptions
          expanded
          theme={theme}
          fullScreen={fullScreen}
          onToggleTheme={onToggleTheme}
          onToggleConfig={onToggleConfig}
          onToggleFullScreen={onToggleFullScreen}
        />
      }
    />
  );
}

interface ChatSideBarViewProps extends SidebarActionProps {
  acceptedTerms: boolean;
  aboutOpen: boolean;
  metadata: ReleaseMetadata;
  mobileOpen: boolean;
  onAboutOpenChange: (open: boolean) => void;
  onAcceptTerms: VoidFunction;
  onMobileOpenChange: (open: boolean) => void;
  onOpenAbout: VoidFunction;
  termsText: string;
}

export function ChatSideBarView(props: ChatSideBarViewProps) {
  return (
    <>
      <DesktopChatSideBar {...props} />
      <MobileChatSideBar {...props} />
    </>
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
