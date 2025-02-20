import { PopoverRoot, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, PopoverTitle } from '../components/ui/popover';
import { Avatar, HStack, Stack, Text, IconButton, Button } from '@chakra-ui/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineClear } from 'react-icons/ai';
import { IoSettingsOutline, IoReloadOutline, IoLogoGithub } from 'react-icons/io5';
import { LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { MdOutlineSimCardDownload } from 'react-icons/md';
import { useGlobal } from './context';
import { useMessage } from './hooks';



export function MessageHeader() {
    const { is, setIs, clearThread, reloadThread, downloadThread, showSettings, options, user } = useGlobal();
    const { message } = useMessage();
    const messages = message?.messages;
    const columnIcon = is.toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />;

    const { t } = useTranslation();
    const issueUrl = import.meta.env.VITE_ISSUE_URL || 'https://github.com/fhswf/openai-ui/issues/new?template=Blank+issue';

    const logout = () => {
        console.log('Logout');
        window.location.href = import.meta.env.VITE_LOGOUT_URL || '/';
    };


    return (
        <HStack as="header"
            spacing={2} padding={2} borderBottomWidth="1px"
            justifyContent="space-between"
            data-testid="ChatHeader">

            <IconButton
                hideFrom="md"
                variant="ghost"
                title={t("toggle_toolbar")}
                onClick={() => setIs({ toolbar: !is.toolbar })}>{columnIcon}</IconButton>
            <Stack flexGrow={1} gap="1px" paddingInlineStart={2}>
                <Text data-testid="HeaderTitle" textStyle="lg">{message?.title}</Text>
                <Text textStyle="xs">{t('count_messages', { count: messages?.filter(item => item.role !== "system").length })}</Text>
            </Stack>


            {options.openai.mode == "assistant" ? <IconButton variant="ghost" title={t("chat_settings")} onClick={showSettings}><IoSettingsOutline /></IconButton> : null}
            {false && <IconButton variant="ghost" title={t("reload_thread")} onClick={reloadThread}><IoReloadOutline /></IconButton>}
            <IconButton variant="ghost" title={t("clear_thread")} onClick={clearThread} data-testid="ClearChatBtn"><AiOutlineClear /></IconButton>
            <IconButton variant="ghost" title={t("download_thread")} onClick={downloadThread}><MdOutlineSimCardDownload /></IconButton>
            <a href={issueUrl} target="_blank" title={t("open_issue")}><IconButton variant="ghost" aria-label={t("open_issue")}><IoLogoGithub /></IconButton></a>
            <PopoverRoot>
                <PopoverTrigger data-testid="UserInformationBtn">
                    <Avatar.Root size="sm">
                        <Avatar.Fallback name={user?.name} />
                        <Avatar.Image src={user?.avatar} />
                    </Avatar.Root>
                </PopoverTrigger>
                <PopoverContent data-testid="UserInformation">
                    <PopoverArrow />
                    <PopoverBody>
                        <PopoverTitle fontWeight="bold" paddingBlockEnd={"15px"}>{t('User information')}</PopoverTitle>
                        <Stack spacing={2}>
                            <Text>{user?.name}</Text>
                            <Text>{user?.email}</Text>
                            <Button type="primary" onClick={logout}>Logout</Button>
                        </Stack>
                    </PopoverBody>
                </PopoverContent>
            </PopoverRoot>

        </HStack>
    );
}
