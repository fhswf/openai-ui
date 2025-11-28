import React from "react";
import {
    Dialog,
    IconButton,
    CloseButton,
    Portal,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { AiOutlineBarChart } from "react-icons/ai";
import { ErrorBoundary } from "react-error-boundary";
import DashboardChart from "./DashboardChart";
import styles from "./style/menu.module.less";

const ErrorFallback = () => {
    const { t } = useTranslation();
    return <div>{t("error")}</div>;
};

export function UsageInformationDialog() {
    const { t } = useTranslation();

    return (
        <Dialog.Root lazyMount size="cover">
            <Dialog.Trigger data-testid="UsageInformationBtn" asChild>
                <IconButton variant="ghost" title={t("usage_information")}>
                    <AiOutlineBarChart aria-label={t("usage_information")} />
                </IconButton>
            </Dialog.Trigger>
            <Portal>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content data-testid="UsageInformation">
                        <Dialog.Header>
                            <Dialog.Title fontWeight="bold" paddingBlockEnd={"15px"}>
                                {t("usage_information")}
                            </Dialog.Title>
                            <Dialog.CloseTrigger asChild>
                                <CloseButton size="sm" />
                            </Dialog.CloseTrigger>
                        </Dialog.Header>
                        <Dialog.Body className={styles.dashboard}>
                            <ErrorBoundary FallbackComponent={ErrorFallback}>
                                <DashboardChart />
                            </ErrorBoundary>
                        </Dialog.Body>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
}
