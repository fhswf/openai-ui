import React from "react";
import { Button, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { toaster } from "../../components/ui/toaster";
import { useTranslation } from "react-i18next";

interface McpToastProps {
    request: any;
    onApprove: () => void;
    onDeny: () => void;
}

export const McpToast: React.FC<McpToastProps> = ({ request, onApprove, onDeny }) => {
    const { t } = useTranslation();

    return (
        <Stack gap={3} width="100%">
            <VStack alignItems="flex-start" gap={1}>
                {request.message && (
                    <Text fontSize="sm">{request.message}</Text>
                )}
                <Text fontSize="xs" color="gray.500">
                    {t("tool")}: {request.name}
                </Text>
            </VStack>
            <HStack justifyContent="flex-end" width="100%">
                <Button
                    size="xs"
                    colorPalette="red"
                    variant="outline"
                    onClick={() => {
                        onDeny();
                        toaster.dismiss();
                    }}
                >
                    {t("Deny")}
                </Button>
                <Button
                    size="xs"
                    colorPalette="green"
                    variant="solid"
                    onClick={() => {
                        onApprove();
                        toaster.dismiss();
                    }}
                >
                    {t("Approve")}
                </Button>
            </HStack>
        </Stack>
    );
};

export function showMcpApprovalToast(request: any, onApprove: () => void, onDeny: () => void) {
    toaster.create({
        title: "MCP Approval Request",
        description: <McpToast request={request} onApprove={onApprove} onDeny={onDeny} />,
        duration: 999999, // Keep open until action
        type: "info",
    });
}
