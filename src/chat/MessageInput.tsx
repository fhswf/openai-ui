import React, { BaseSyntheticEvent, SyntheticEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptions, useSendKey } from "./hooks";
import { useGlobal } from "./context";
import { Button, HStack, IconButton, Kbd, Progress, Skeleton, Stack, StepsStatus, Text, Textarea } from "@chakra-ui/react";
import { Switch } from "../components/ui/switch"
import styles from './style/message.module.less'
import CodeEditor from '@uiw/react-textarea-code-editor';
import { MdOutlineCancel } from "react-icons/md";
import { use } from "chai";
import { CiMicrophoneOff, CiMicrophoneOn } from "react-icons/ci";
import { toaster } from "../components/ui/toaster";
import classNames from 'classnames';


export function LazyImage(props: { name?: string, url?: string }) {
    const { name, url } = props;
    const [loaded, setLoaded] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        navigator.storage.getDirectory()
            .then(async (opfs) => {
                if (name) {
                    const fileHandle = await opfs.getFileHandle(name);
                    if (fileHandle) {
                        const file = await fileHandle.getFile()
                        const imageUrl = URL.createObjectURL(file);
                        setImageUrl(imageUrl);
                        setLoaded(true);
                    }
                }
            })
    }, [name, url]);

    if (!url) {
        if (imageUrl) {
            return (
                <img
                    src={imageUrl}
                    alt={name || "Image"}
                    className={classNames(styles.image, { [styles.loaded]: loaded })}
                    loading="lazy"
                    onLoad={() => setLoaded(true)}
                />
            );
        }
        return <Skeleton className={styles.image} />;
    }
    console.log("LazyImage: url: %s", url);
    return (
        <img
            src={url}
            alt={name || "Image"}
            className={classNames(styles.image, { [styles.loaded]: loaded })}
            loading="lazy"
        />
    );
}

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
                const isImage = event.dataTransfer.types.includes("Files") && Array.from(event.dataTransfer.items).some(item => item.type.startsWith("image/"));
                if (isLink || isImage) {
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

                const isLink = event.dataTransfer.types.includes("text/uri-list");
                const isImage = event.dataTransfer.types.includes("Files") && Array.from(event.dataTransfer.items).some(item => item.type.startsWith("image/"));

                if (!isLink && !isImage) {
                    console.warn('Drop event does not contain a link or image');
                    return;
                }
                else if (isLink) {
                    console.log('Drop event contains a link');
                    const url = event.dataTransfer.getData("text/uri-list");

                    if (!typeingMessage.images) {
                        typeingMessage.images = [];
                    }
                    // check if the url is an image
                    const proxy = import.meta.env.VITE_PROXY_URL || "https://poxy.gawron.cloud/api";
                    let fetchUrl = `${proxy}?url=${encodeURIComponent(url)}`;
                    fetch(fetchUrl, { method: 'GET' })
                        .then((response) => {
                            if (response.headers.get('content-type')?.startsWith('image')) {
                                typeingMessage.images.push({ url });
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
                } else {
                    // Handle image drop

                    // Upload file and store in OPFS
                    const files = Array.from(event.dataTransfer.files);
                    console.log('Dropped files: %o', files);
                    if (files.length === 0) {
                        console.warn('No files dropped');
                        return;
                    }
                    if (!typeingMessage.images) {
                        typeingMessage.images = [];
                    }
                    files.forEach(file => {
                        if (file.type.startsWith("image/")) {
                            console.log('Processing dropped image file: %o', file);
                            const reader = new FileReader();
                            reader.onload = async (e) => {
                                const opfs = await navigator.storage.getDirectory();
                                const fileHandle = await opfs.getFileHandle(file.name, { create: true });
                                const writable = await fileHandle.createWritable();
                                await writable.write(e.target?.result);
                                await writable.close();
                                console.log('File written to OPFS: %o', fileHandle);


                                typeingMessage.images.push({ name: file.name, size: file.size, lastModified: file.lastModified, type: file.type });
                                setState({ typeingMessage });
                            }
                            reader.onerror = (error) => {
                                console.error('Error reading file: %o', error);
                                toaster.create({
                                    title: t("error_occurred"),
                                    description: error.message,
                                    duration: 5000,
                                    type: "error",
                                });
                            }
                            reader.readAsArrayBuffer(file);
                        }
                    });
                }
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
                            typeingMessage?.images?.map((image, index) => {
                                return (
                                    <LazyImage key={index} name={image.name} url={image.url} />
                                )
                            })
                        }
                    </HStack>
                }
                <HStack justify={"flex-end"} paddingInlineStart={2} paddingInlineEnd={2}>
                    <Switch size="sm" colorScheme="blue" className={styles.editorToggle} marginInlineEnd="auto" checked={options.general.codeEditor}
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
