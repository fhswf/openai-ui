import React from "react";
import {
    Alert,
    Button,
    Center,
    Heading,
    HStack,
    Text,
} from "@chakra-ui/react";
import { t } from "i18next";
import { logger, SeverityNumber } from "./utils/instrumentation";
import {
    ATTR_ERROR_TYPE,
    ATTR_EXCEPTION_MESSAGE,
    ATTR_EXCEPTION_STACKTRACE,
} from "@opentelemetry/semantic-conventions";

export interface ErrorFallbackProps {
    error: Error;
    resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: Readonly<ErrorFallbackProps>) {
    console.log("error: %o %s", error.stack, typeof error.stack);

    const stackTrace = React.useMemo(() => {
        return error.stack ? error.stack.split("\n").map((line, index) => ({
            id: `trace-${index}`,
            content: line,
        })) : [];
    }, [error.stack]);

    logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        body: { message: error.message, stack: error.stack?.toString() },
        attributes: {
            [ATTR_ERROR_TYPE]: "exception",
            [ATTR_EXCEPTION_MESSAGE]: error.message,
            [ATTR_EXCEPTION_STACKTRACE]: error.stack?.toString(),
        },
    });

    const resetSettings = () => {
        console.log("resetSettings");
        localStorage.setItem("SESSIONS", "");
        globalThis.location.reload();
    };

    return (
        <Center height="100%" margin="10ex">
            <Alert.Root variant="surface" status="error">
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title as="h2" fontSize="lg">
                        {t("An error occurred") + ": " + error.name}
                    </Alert.Title>
                    <Alert.Description>
                        {error.message}

                        <Heading paddingBlockStart="1ex" as="h3" fontSize="md">
                            Stacktrace:
                        </Heading>
                        {stackTrace.map((line) => (
                            <Text key={line.id}>{line.content}</Text>
                        ))}
                    </Alert.Description>
                    <HStack justify="end" spacing="2">
                        <Button variant="subtle" onClick={resetSettings}>
                            {t("Reset settings")}
                        </Button>
                        <Button variant="solid" onClick={resetErrorBoundary}>
                            {t("Try again")}
                        </Button>
                    </HStack>
                </Alert.Content>
            </Alert.Root>
        </Center>
    );
}

export default ErrorFallback;
