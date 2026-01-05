import React from "react";
import {
    Accordion,
    Badge,
    Box,
    Dialog,
    Heading,
    Stack,
    Text,
    VStack,
    Portal,
    CloseButton,
} from "@chakra-ui/react";
import { Tool } from "../context/types";
import { useTranslation } from "react-i18next";
import { LazyRenderer } from "../MessageRender";

type ToolUsagePopupProps = {
    isOpen: boolean;
    onClose: () => void;
    toolsUsed: Tool[];
};

export function ToolUsagePopup({ isOpen, onClose, toolsUsed }: ToolUsagePopupProps) {
    const { t } = useTranslation();

    if (!toolsUsed || toolsUsed.length === 0) {
        return null;
    }

    const groupedTools = Array.from(
        Map.groupBy<string, Tool>(toolsUsed, (tool) => tool.type)
    );

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl" scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content data-testid="tool-usage-popup-content">
                        <Dialog.Header>
                            <Dialog.Title>{t("Tool Usage Details")}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.CloseTrigger asChild>
                            <CloseButton size="sm" onClick={onClose} />
                        </Dialog.CloseTrigger>
                        <Dialog.Body>
                            <Stack gap={4}>
                                {groupedTools.map(([key, tools]) => (
                                    <Stack key={key} gap={2}>
                                        <Heading size="md" textTransform="capitalize">
                                            {t(key + "_title") || key} <Badge colorPalette="green">{tools.length}</Badge>
                                        </Heading>
                                        <Accordion.Root multiple>
                                            {tools.map((tool, index) => {
                                                const info = getToolInfo(tool, key, index, t);
                                                if (!info.items || info.items === t("No additional information available.")) {
                                                    return (
                                                        <Box key={index} p={2} borderWidth="1px" borderRadius="md" data-testid={`tool-item-${key}-${index}`}>
                                                            <Text fontWeight="medium">{info.title}</Text>
                                                            <Text color="gray.500" fontSize="sm">{t("No additional information available.")}</Text>
                                                        </Box>
                                                    );
                                                }
                                                return (
                                                    <Accordion.Item key={index} value={index.toString()} data-testid={`tool-item-${key}-${index}`}>
                                                        <Accordion.ItemTrigger data-testid={`tool-trigger-${key}-${index}`}>
                                                            <Text fontWeight="medium">{info.title}</Text>
                                                            <Accordion.ItemIndicator />
                                                        </Accordion.ItemTrigger>
                                                        <Accordion.ItemContent>
                                                            <Accordion.ItemBody>
                                                                {info.items}
                                                            </Accordion.ItemBody>
                                                        </Accordion.ItemContent>
                                                    </Accordion.Item>
                                                );
                                            })}
                                        </Accordion.Root>
                                    </Stack>
                                ))}
                            </Stack>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}

function getToolInfo(tool: Tool, key: string, index: number, t: any) {
    const info: any = { ...tool };
    switch ((tool as any).type) {
        case "mcp_list_tools":
            info.title = "" + (tool as any).server_label;
            info.items = (
                <dl>
                    {/* @ts-ignore */}
                    {tool.tools.map((_t) => (
                        <React.Fragment key={_t.id}>
                            <dt>{_t.name}</dt>{" "}
                            <dd>
                                {_t.description || t("No description available.")}{" "}
                            </dd>
                        </React.Fragment>
                    ))}
                </dl>
            );
            break;
        case "function_call":
        case "mcp_call": {
            let parsedArgs = {};
            try {
                parsedArgs = JSON.parse((tool as any).arguments || "{}");
            } catch (error) {
                console.error("Error parsing tool arguments:", error);
                parsedArgs = {};
            }
            info.title = "" + (tool as any).name;
            info.items = (
                <VStack alignItems="flex-start">
                    <Text>
                        {Object.entries(parsedArgs).map(
                            ([key, value], index) => (
                                <React.Fragment key={index}>
                                    <dt>{key}</dt>
                                    <dd>{value as any}</dd>
                                </React.Fragment>
                            )
                        ) || t("No arguments provided.")}
                    </Text>
                    <LazyRenderer>
                        {(tool as any).output ||
                            t("No additional information available.")}
                    </LazyRenderer>
                </VStack>
            );
            break;
        }
        case "reasoning": {
            let summary = (tool as any).summary || [];
            let title = (tool as any).title;

            if (!title && summary.length > 0) {
                const firstItemText = summary[0].text;
                // Check for bold title at the beginning: **Title** Content
                const match = firstItemText.match(/^\*\*(.*?)\*\*\s*(.*)$/);
                if (match) {
                    title = match[1];
                    // Update the first item text to remove the title part
                    summary = [
                        { ...summary[0], text: match[2] },
                        ...summary.slice(1)
                    ];
                    // If the remaining text is empty, remove the first item
                    if (!summary[0].text.trim()) {
                        summary = summary.slice(1);
                    }
                } else {
                    title = firstItemText;
                    summary = summary.slice(1);
                }
            }

            info.title = title || t("Reasoning Step") + " " + (index + 1);
            info.items = summary.length ? (
                <ul>
                    {summary.map((item: any, index: number) => (
                        <li key={index}>
                            {<LazyRenderer>{item.text}</LazyRenderer>}
                        </li>
                    ))}
                </ul>
            ) : t("No additional information available.");
            break;
        }
        case "web_search_call":
            info.title = "" + (tool as any).action?.query;
            info.items = (
                <VStack alignItems="flex-start">
                    <Text>{t("Search Results:")}</Text>
                    <ul>
                        {(tool as any).action?.sources?.map((result: any, index: number) => (
                            <React.Fragment key={index}>
                                <li>
                                    <a
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {result.url}
                                    </a>{" "}
                                </li>
                            </React.Fragment>
                        ))}
                    </ul>
                </VStack>
            );
            break;
        case "code_interpreter_call":
            info.title = t("Code Interpreter Step") + " " + (index + 1);
            info.items = (
                <VStack alignItems="flex-start">
                    <Text>{t("Code")}:</Text>
                    <LazyRenderer>
                        {"```python\n" + (tool as any).code + "\n```" ||
                            t("No additional information available.")}
                    </LazyRenderer>
                    <Text>{t("Outputs")}:</Text>
                    {(tool as any).outputs?.map((output: any, index: number) => (
                        <LazyRenderer key={index}>
                            {"```json\n" + JSON.stringify(output) + "\n```"}
                        </LazyRenderer>
                    ))}
                </VStack>
            );
            break;
        case "mcp_approval_request":
            info.title = t("mcp_approval_request_title");
            info.items = (
                <VStack alignItems="flex-start">
                    {(tool as any).server_label && (
                        <>
                            <Text fontWeight="bold">{t("Server")}:</Text>
                            <Text>{(tool as any).server_label}</Text>
                        </>
                    )}
                    {(tool as any).name && (
                        <>
                            <Text fontWeight="bold">{t("Tool")}:</Text>
                            <Text>{(tool as any).name}</Text>
                        </>
                    )}
                    {((tool as any).params || (tool as any).arguments) && (
                        <>
                            <Text fontWeight="bold">{t("Parameters")}:</Text>
                            <LazyRenderer>
                                {"```json\n" + JSON.stringify((tool as any).params || (tool as any).arguments, null, 2) + "\n```"}
                            </LazyRenderer>
                        </>
                    )}

                    {(tool as any).message && (
                        <>
                            <Text fontWeight="bold">{t("Message")}:</Text>
                            <Text>{(tool as any).message}</Text>
                        </>
                    )}

                    {(tool as any).approval_decision !== undefined && (
                        <Text fontWeight="bold" color={(tool as any).approval_decision ? "green.500" : "red.500"}>
                            {t("Status")}: {(tool as any).approval_decision ? t("Approved") : t("Denied")}
                        </Text>
                    )}
                </VStack>
            );
            break;
        case "image_generation_call": {
            let prompt = "";
            try {
                const rawArgs = (tool as any).arguments;
                const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || "{}") : rawArgs || {};
                prompt = args.prompt;
            } catch (e) {
                console.debug("Failed to parse image generation arguments", e);
            }
            info.title = (tool as any).title || prompt || t("image_generation_call_title");
            // Avoid duplicate title in items if it's already in the header
            info.items = (tool as any).items || t("No additional information available.");
            break;
        }
        default:
            info.title = (tool as any).title || (tool as any).action?.query || t(key) + " " + (index + 1);
            info.items = (tool as any).items || t("No additional information available.");
            break;
    }
    return info;
}
