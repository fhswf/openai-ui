import React, { useState } from "react";
import {
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Heading,
  HStack,
  Link,
  List,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Trans, useTranslation } from "react-i18next";
import { MdGavel } from "react-icons/md";
import { aiHubTermsUrl } from "./service/aiHub";

function ExternalLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      color="blue.600"
      textDecoration="underline"
    >
      {children}
    </Link>
  );
}

function AiHubTermsContent() {
  const { t } = useTranslation();

  return (
    <Stack gap={4} fontSize="sm">
      <Heading size="xl">{t("ai_hub_terms_title")}</Heading>
      <Text>
        <Trans
          t={t}
          i18nKey="ai_hub_terms_intro"
          components={{ bold: <strong /> }}
        />
      </Text>
      <Text>{t("ai_hub_terms_pdf_intro")}</Text>
      <ExternalLink href={aiHubTermsUrl}>{t("ai_hub_terms_pdf")}</ExternalLink>
      <Text>
        <Trans
          t={t}
          i18nKey="ai_hub_terms_sensitive_data"
          components={{ bold: <strong /> }}
        />
      </Text>
      <Heading size="md" marginTop={4}>
        {t("ai_hub_terms_more_info")}
      </Heading>
      <List.Root paddingInlineStart={5}>
        <List.Item>
          <ExternalLink href="https://openai.com/de-DE/policies/terms-of-use/">
            {t("ai_hub_terms_openai_terms")}
          </ExternalLink>
        </List.Item>
        <List.Item>
          <ExternalLink href="https://openai.com/de-DE/enterprise-privacy/">
            {t("ai_hub_terms_openai_privacy")}
          </ExternalLink>
        </List.Item>
      </List.Root>
    </Stack>
  );
}

interface AiHubTermsFooterProps {
  accepted: boolean;
  onAccept: () => void;
  onAcceptedChange: (accepted: boolean) => void;
}

function AiHubTermsFooter({
  accepted,
  onAccept,
  onAcceptedChange,
}: AiHubTermsFooterProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Footer borderTopWidth="1px" justifyContent="space-between" gap={4}>
      <Checkbox.Root
        checked={accepted}
        onCheckedChange={(event) => onAcceptedChange(event.checked === true)}
        data-testid="AiHubTermsCheckbox"
      >
        <Checkbox.HiddenInput />
        <Checkbox.Control />
        <Checkbox.Label>{t("ai_hub_terms_confirm")}</Checkbox.Label>
      </Checkbox.Root>
      <Button
        variant="subtle"
        flexShrink={0}
        disabled={!accepted}
        onClick={onAccept}
        data-testid="AiHubTermsAcceptBtn"
      >
        {t("ai_hub_terms_accept")}
      </Button>
    </Dialog.Footer>
  );
}

export interface AiHubTermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

export function AiHubTermsDialog({
  open,
  onOpenChange,
  onAccept,
}: AiHubTermsDialogProps) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog.Root
      lazyMount
      size="lg"
      open={open}
      onOpenChange={(event) => {
        setAccepted(false);
        onOpenChange(event.open);
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content data-testid="AiHubTermsDialog">
            <Dialog.Header borderBottomWidth="1px">
              <HStack gap={2}>
                <MdGavel size={22} color="var(--chakra-colors-blue-600)" />
                <Dialog.Title>{t("ai_hub_terms_title")}</Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body paddingBlock={6}>
              <AiHubTermsContent />
            </Dialog.Body>
            <AiHubTermsFooter
              accepted={accepted}
              onAcceptedChange={setAccepted}
              onAccept={() => {
                setAccepted(false);
                onAccept();
              }}
            />
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
