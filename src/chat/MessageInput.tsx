import React, { BaseSyntheticEvent, SyntheticEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptions, useSendKey } from "./hooks";
import { useGlobal } from "./context";
import { Button, HStack, IconButton, Kbd, Progress, Stack, StepsStatus, Text, Textarea } from "@chakra-ui/react";
import { Switch } from "../components/ui/switch"
import styles from './style/message.module.less'
import CodeEditor from '@uiw/react-textarea-code-editor';
import { MdOutlineCancel } from "react-icons/md";
import { use } from "chai";
import { CiMicrophoneOff, CiMicrophoneOn } from "react-icons/ci";
import { toaster } from "../components/ui/toaster";
import classNames from 'classnames';

export function MessageInput() {
    const { setIs, sendMessage, setMessage, setState, eventProcessor, is, options, typeingMessage, clearTypeing } = useGlobal();
    const { setGeneral } = useOptions()
    const { t } = useTranslation();
    const inputRef = React.createRef<HTMLDivElement>();

    const [recognition, setRecognition] = useState(null);
    const [recognitionActive, setRecognitionActive] = useState(false);
    useSendKey(sendMessage, options.general.sendCommand);

    useEffect(() => {
        console.log("MessageBar: eventProcessor: %o", eventProcessor)
    }, [eventProcessor])

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const _recognition = SpeechRecognition ? new SpeechRecognition() : null;
        if (!_recognition) {
            console.warn("SpeechRecognition is not supported in this browser.");
            return;
        }
        console.log("MessageBar: recognition: %o", _recognition);
        setRecognition(_recognition);

        _recognition.onspeechend = () => {
            console.log("MessageBar: recognition speech end");
            setRecognitionActive(false);
        }
        _recognition.onaudioend = () => {
            console.log("MessageBar: recognition audio end");
            setRecognitionActive(false);
        }
        _recognition.onerror = (event) => {
            console.error("MessageBar: recognition error: %o", event);
            setRecognitionActive(false);
        }
    }, []);

    const stopResponse = () => {
        eventProcessor?.stop()
    }

    const voiceClasses = classNames(styles.voice, {
        [styles.active]: recognitionActive,
    });

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
                const proxy = import.meta.env.VITE_PROXY_URL || "https://poxy.gawron.cloud/api";
                let fetchUrl = `${proxy}?url=${encodeURIComponent(url)}`;
                fetch(fetchUrl, { method: 'GET' })
                    .then((response) => {
                        console.log('Response: %o', response.headers.get('content-type'));
                        if (response.headers.get('content-type')?.startsWith('image')) {
                            typeingMessage.images.push(url);
                            setState({ typeingMessage });
                        }
                        else {
                            toaster.create({
                                title: t("not_image"),
                                description: t("not_image_description"),
                                duration: 5000,
                                type: "warning",
                            })
                        }
                    })
                    .catch((error) => {
                        console.error('Error: %o', error);
                        toaster.create({
                            title: t("error_occurred"),
                            description: "error.message",
                            duration: 5000,
                            type: "error",
                        })
                    });

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
                            onChange={(ev: BaseSyntheticEvent) => {
                                typeingMessage.content = ev.target.value;
                                setMessage(typeingMessage.content);
                            }} />
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
                    <Button
                        variant="outline"
                        onClick={() => {
                            typeingMessage.content = "";
                            clearTypeing()
                        }}
                        data-testid="ClearMessageBtn">
                        {t("clear")}
                    </Button>
                    {
                        recognition ?
                            <IconButton variant="outline" className={voiceClasses} onClick={() => {
                                if (recognitionActive) {
                                    recognition.stop();
                                    setRecognitionActive(false);
                                }
                                else {
                                    recognition.start();
                                    recognition.onresult = (event) => {
                                        if (event.results.length > 0) {
                                            console.log("MessageBar: recognition result: %o", event.results[0])
                                            const result = event.results[0][0];
                                            typeingMessage.content = (typeingMessage.content || "") + result.transcript;
                                            setMessage(typeingMessage.content);
                                        }
                                    }
                                    setRecognitionActive(true);
                                }
                            }} data-testid="VoiceMessageBtn">{recognitionActive ? <CiMicrophoneOff /> : <CiMicrophoneOn />}</IconButton>
                            : null
                    }
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
