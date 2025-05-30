import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, HStack, IconButton, Menu, Popover, Portal } from "@chakra-ui/react";
import { IoLogoGithub } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { useGlobal } from "./context";

export function GitHubMenu() {
    const { t } = useTranslation();
    const { release } = useGlobal();
    const issueUrl = import.meta.env.VITE_ISSUE_URL || 'https://github.com/fhswf/openai-ui/issues/new?template=Blank+issue';

    const [menuOpen, setMenuOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    return (
        <Menu.Root
            closeOnSelect={false}
            onSelect={(e) => {
                console.log('Selected: %o', e)
                if (e.value === 'release_notes') {
                    setPopoverOpen(!popoverOpen);
                }
            }}>
            <Menu.Trigger asChild>
                <IconButton variant="ghost" title={t("open_issue")}>
                    <IoLogoGithub aria-label={t("open_issue")} />
                </IconButton>
            </Menu.Trigger>
            <Menu.Positioner>
                <Menu.Content>
                    <Menu.Item value="release_notes">{t("release_notes")}</Menu.Item>
                    <Popover.Root open={popoverOpen} onOpenChange={(e) => setPopoverOpen(e.open)} portalled={false}>
                        <Popover.Trigger></Popover.Trigger>
                        <Portal>
                            <Popover.Positioner>
                                <Popover.Content>
                                    <Popover.CloseTrigger />
                                    <Popover.Arrow>
                                        <Popover.ArrowTip />
                                    </Popover.Arrow>
                                    <Popover.Body >
                                        <Popover.Title>Release Notes</Popover.Title>
                                        <div className="z-ui-markdown">
                                            <Markdown
                                                remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
                                                rehypePlugins={[rehypeKatex, rehypeRaw]}>
                                                {release?.body}
                                            </Markdown>
                                        </div>
                                    </Popover.Body>
                                    <Popover.Footer>
                                        <Popover.CloseTrigger asChild>
                                            <HStack justifyContent={"center"}>
                                                <Button type="primary" variant={"ghost"}>Close</Button>
                                            </HStack>
                                        </Popover.CloseTrigger>
                                    </Popover.Footer>
                                </Popover.Content>
                            </Popover.Positioner>
                        </Portal>
                    </Popover.Root>

                    <Menu.Item value={t("open_issue")}>
                        <a href={issueUrl} target="_blank" title={t("open_issue")}>{t("open_issue")}</a>
                    </Menu.Item>
                </Menu.Content>
            </Menu.Positioner>
        </Menu.Root>
    )
}