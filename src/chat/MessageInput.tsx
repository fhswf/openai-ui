import React, { BaseSyntheticEvent, SyntheticEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOptions, useSendKey } from "./hooks";
import { useGlobal } from "./context";
import { Button, HStack, Kbd, Progress, Stack, StepsStatus, Text, Textarea } from "@chakra-ui/react";
import { Switch } from "../components/ui/switch"
import styles from './style/message.module.less'
import CodeEditor from '@uiw/react-textarea-code-editor';
import { MdOutlineCancel } from "react-icons/md";
import { use } from "chai";

export function MessageInput() {
    const { setIs, sendMessage, setMessage, setState, eventProcessor, is, options, typeingMessage, clearTypeing } = useGlobal();
    const { setGeneral } = useOptions()
    const { t } = useTranslation();
    const inputRef = React.createRef<HTMLDivElement>();
    useSendKey(sendMessage, options.general.sendCommand);


    useEffect(() => {
        console.log("MessageBar: eventProcessor: %o", eventProcessor)
    }, [eventProcessor])

    const stopResponse = () => {
        eventProcessor?.stop()
    }

    return (
        <div className={styles.bar}
            data-name="dropzone"
            onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
                event.stopPropagation();
                const isLink = event.dataTransfer.types.includes("text/uri-list");
                if (isLink) {
                    event.preventDefault();
                }
            }}
            onDragEnter={(event: React.DragEvent<HTMLDivElement>) => {
                event.stopPropagation();
                console.log('Drag enter: %o', event);

                let target = event.target as HTMLElement;
                const isLink = event.dataTransfer.types.includes("text/uri-list");
                if (isLink) {
                    event.preventDefault();
                    let target = event.target as HTMLElement;
                    inputRef.current.classList.add(styles.dragover);
                }
            }}
            onDragLeave={(event: React.DragEvent<HTMLDivElement>) => {
                event.stopPropagation();

                let target = event.target as HTMLElement;
                console.log('Drag leave: %o %o', event, target.dataset.name);
                if (target.dataset.name === "dropzone") {
                    target.classList.remove(styles.dragover);
                    console.log('Remove dragover');
                }
            }}
            onDrop={(event: React.DragEvent<HTMLDivElement>) => {
                console.log('Drop: %o', event);
                event.stopPropagation();
                event.preventDefault();
                inputRef.current.classList.remove(styles.dragover);
                const url = event.dataTransfer.getData("text/uri-list");

                console.log('Drop URL: %o', url);
                if (!typeingMessage.images) {
                    typeingMessage.images = [];
                }
                // check if the url is an image
                /* Does not work in the browser due to CORS
                fetch(url, { method: 'HEAD' })
                    .then((response) => {
                        console.log('Response: %o', response.headers.get('content-type'));
                        if (response.headers.get('content-type')?.startsWith('image')) {
                            typeingMessage.images.push(url);
                            setState({ typeingMessage });
                        }
                    })
                    .catch((error) => {
                        console.error('Error: %o', error);
                    });
                */
                typeingMessage.images.push(url);
                setState({ typeingMessage });

            }}
            ref={inputRef}
        >

            <Stack className={styles.bar_inner}
                width="100%"
                borderColor={is.inputing ? 'blue.500' : 'gray.200'}
                borderWidth={1}
                borderStyle='solid'
                borderRadius="md"
                padding={1}
                onDragLeave={(event: React.DragEvent<HTMLDivElement>) => {
                    event.stopPropagation();
                    console.log('Drag leave: %o', event);
                }}
            >
                {
                    is.thinking &&
                    <HStack justify={"flex-end"}>
                        <Progress.Root size="xs" width="20em" value={null}>
                            <Progress.Label>
                                {is.tool ? t(is.tool) : t("thinking")}
                            </Progress.Label>
                            <Progress.Track>
                                <Progress.Range />
                            </Progress.Track>
                        </Progress.Root>
                        <Button variant="ghost" title={t("cancel")} onClick={stopResponse}>
                            {t("cancel")} <MdOutlineCancel />
                        </Button>
                    </HStack>
                }
                {
                    options.general.codeEditor ?
                        <CodeEditor language='Python' minHeight="6lh"
                            onFocus={() => setIs({ inputing: true })} onBlur={() => setIs({ inputing: false })}
                            value={typeingMessage?.content || ''}
                            placeholder={t("Please enter Python code.")}
                            onChange={(ev) => setMessage(ev.target.value)}
                            style={{
                                backgroundColor: "var(--chakra-colors-bg)",
                                fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                                fontSize: '12pt',
                            }}
                        /> :
                        <Textarea data-testid="ChatTextArea" value={typeingMessage?.content || ''}
                            onFocus={() => setIs({ inputing: true })} onBlur={() => setIs({ inputing: false })}
                            variant="outline" autoresize
                            borderWidth={0} outlineWidth={0}
                            placeholder={t("Enter something....")}
                            className={styles.textarea}
                            onInput={(ev: BaseSyntheticEvent) => setMessage(ev.target.value)} />
                }
                {
                    <HStack justify={"flex-end"} paddingInlineStart={2} paddingInlineEnd={2}>
                        {
                            typeingMessage?.images?.map((image, index) => (
                                <img key={index} src={image} alt={image} />
                            ))
                        }
                    </HStack>
                }
                <HStack justify={"flex-end"} paddingInlineStart={2} paddingInlineEnd={2}>
                    <Switch size="sm" colorScheme="blue" marginInlineEnd="auto" checked={options.general.codeEditor}
                        onCheckedChange={(ev) => setGeneral({ codeEditor: ev.checked })}>
                        {t("Code Editor")}
                    </Switch>
                    <Button variant="outline" onClick={clearTypeing} data-testid="ClearMessageBtn">{t("clear")}</Button>
                    <Button
                        colorPalette={is.thinking ? "gray" : "blue"}
                        type="submit"
                        disabled={is.thinking || !typeingMessage?.content}
                        onClick={sendMessage}
                        data-testid="SendMessageBtn">{t("send")}
                        {
                            options.general.codeEditor ||
                            <Kbd size="sm">{t(options.general.sendCommand)}</Kbd>
                        }
                    </Button>
                </HStack>
            </Stack>
        </div>
    )
}
