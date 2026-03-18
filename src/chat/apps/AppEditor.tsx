import React, { useState, useEffect } from "react";
import {
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  Switch,
} from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogActionTrigger,
} from "../components/ui/dialog";
import { Field } from "../components/ui/field";
import { useApps } from "./context";
import { v7 as uuidv7 } from "uuid";
import { useTranslation } from "react-i18next";
import { App } from "../context/types";

interface AppEditorProps {
  app?: App | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AppEditor({ app, isOpen, onClose }: AppEditorProps) {
  const { t } = useTranslation();
  const { saveApp } = useApps();
  const [formData, setFormData] = useState<Partial<App>>({
    title: "",
    desc: "",
    content: "",
    botStarts: false,
    role: "system",
    category: 1, // Default to Chatbots
  });

  useEffect(() => {
    if (app) {
      setFormData(app);
    } else {
      setFormData({
        title: "",
        desc: "",
        content: "",
        botStarts: false,
        role: "system",
        category: 1,
      });
    }
  }, [app, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalApp: App = {
      ...formData,
      id: app?.id || uuidv7(),
    } as App;
    saveApp(finalApp);
    onClose();
  };

  return (
    <DialogRoot open={isOpen} onOpenChange={(details) => !details.open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{app ? t("Edit Template") : t("Add Template")}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <VStack gap={4} align="stretch">
              <Field label={t("Title")} required>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t("e.g., Python Tutor")}
                  required
                />
              </Field>
              <Field label={t("Description")}>
                <Input
                  value={formData.desc}
                  onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                  placeholder={t("Short description of the chatbot")}
                />
              </Field>
              <Field label={t("System Prompt / Welcome Message")} required>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder={t("Instructions for the AI or the first message it sends")}
                  rows={5}
                  required
                />
              </Field>
              <HStack justify="space-between">
                <Field label={t("Bot Starts First")} mb={0}>
                  <Switch
                    checked={formData.botStarts}
                    onCheckedChange={(details) => setFormData({ ...formData, botStarts: details.checked })}
                  />
                </Field>
                <Field label={t("Role")} mb={0}>
                   <select 
                    style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                    value={formData.role} 
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                   >
                     <option value="system">System</option>
                     <option value="assistant">Assistant</option>
                     <option value="user">User</option>
                   </select>
                </Field>
              </HStack>
            </VStack>
          </DialogBody>
          <DialogFooter>
            <DialogActionTrigger asChild>
              <Button variant="outline" onClick={onClose}>{t("Cancel")}</Button>
            </DialogActionTrigger>
            <Button type="submit" colorPalette="blue">{t("Save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  );
}
