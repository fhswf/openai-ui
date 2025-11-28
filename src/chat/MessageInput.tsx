import React, {
  BaseSyntheticEvent,
  SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useOptions, useSendKey } from "./hooks";
import { useGlobal } from "./context";
import {
  Button,
  Box,
  HStack,
  IconButton,
  Kbd,
  Progress,
  Stack,
  StepsStatus,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { Switch } from "../components/ui/switch";
import styles from "./style/message.module.less";
import CodeEditor from "@uiw/react-textarea-code-editor";
import { MdOutlineCancel, MdOutlineFileUpload } from "react-icons/md";
import { CiMicrophoneOff, CiMicrophoneOn } from "react-icons/ci";
import { toaster } from "../components/ui/toaster";
import classNames from "classnames";
import { OPFSImage } from "./component";



function useDebounce(cb, delay) {
  const timeoutId = useRef(null);

  return function (...args) {
    if (timeoutId.current) {
      // This check is not strictly necessary
      clearTimeout(timeoutId.current);
    }
    timeoutId.current = setTimeout(() => cb(...args), delay);
  };
}

export function MessageInput() {
  const {
    setIs,
    sendMessage,
    setMessage,
    setState,
    eventProcessor,
    is,
    options,
    typeingMessage,
    clearTypeing,
  } = useGlobal();
  const { setGeneral } = useOptions();
  const { t } = useTranslation();
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [recognition, setRecognition] = useState(null);
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [inputMessage, setInputMessage] = useState(
    typeingMessage?.content || ""
  );
  useSendKey(sendMessage, options.general.sendCommand);

  useEffect(() => {
    console.log("MessageBar: eventProcessor: %o", eventProcessor);
  }, [eventProcessor]);

  useEffect(() => {
    const SpeechRecognition =
      globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    const _recognition = SpeechRecognition ? new SpeechRecognition() : null;
    if (!_recognition) {
      console.warn("SpeechRecognition is not supported in this browser.");
      return;
    }
    setRecognition(_recognition);

    _recognition.onspeechend = () => {
      console.log("MessageBar: recognition speech end");
      setRecognitionActive(false);
    };
    _recognition.onaudioend = () => {
      console.log("MessageBar: recognition audio end");
      setRecognitionActive(false);
    };
    _recognition.onerror = (event) => {
      console.error("MessageBar: recognition error: %o", event);
      setRecognitionActive(false);
    };
  }, []);

  const stopResponse = () => {
    eventProcessor?.stop();
  };

  const voiceClasses = classNames(styles.voice, {
    [styles.active]: recognitionActive,
  });

  const handleLinkDrop = (url: string) => {
    if (!typeingMessage.images) {
      typeingMessage.images = [];
    }
    // check if the url is an image
    const proxy =
      import.meta.env.VITE_PROXY_URL || "https://poxy.gawron.cloud/api";
    const fetchUrl = `${proxy}?url=${encodeURIComponent(url)}`;
    fetch(fetchUrl, { method: "GET" })
      .then((response) => {
        if (response.headers.get("content-type")?.startsWith("image")) {
          typeingMessage.images.push({ url });
          setState({ typeingMessage });
        } else {
          toaster.create({
            title: t("not_image"),
            description: t("not_image_description"),
            duration: 5000,
            type: "warning",
          });
        }
      })
      .catch((error) => {
        console.error("Error: %o", error);
        toaster.create({
          title: t("error_occurred"),
          description: "error.message",
          duration: 5000,
          type: "error",
        });
      });
  };

  const handleFileDrop = (files: File[]) => {
    if (files.length === 0) {
      console.warn("No files dropped");
      return;
    }
    const newMessage = typeingMessage ? { ...typeingMessage } : {};
    if (!newMessage.images) {
      newMessage.images = [];
    }
    files.forEach(async (file) => {
      if (file.type.startsWith("image/")) {
        try {
          const opfs = await navigator.storage.getDirectory();
          const fileHandle = await opfs.getFileHandle(file.name, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          const buffer = await file.arrayBuffer();
          await writable.write(buffer);
          await writable.close();
        } catch (error) {
          console.error("Error writing file to OPFS: %o", error);
          toaster.create({
            title: t("error_occurred"),
            description: error instanceof Error ? error.message : String(error),
            duration: 5000,
            type: "error",
          });
        }
        newMessage.images.push({
          name: file.name,
          url: `opfs://${file.name}`,
          size: file.size,
          lastModified: file.lastModified,
          type: file.type,
        });
        setState({ typeingMessage: newMessage });
      }
    });
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      handleFileDrop(Array.from(event.target.files));
    }
    // Reset the input value so the same file can be selected again
    event.target.value = "";
  };

  const handleDeleteImage = (index: number) => {
    if (typeingMessage.images) {
      typeingMessage.images.splice(index, 1);
      setState({ typeingMessage: { ...typeingMessage } });
    }
  };

  const handleDrop = (
    event: React.DragEvent<HTMLElement>,
    isLink: boolean,
    isImage: boolean
  ) => {
    event.preventDefault();
    dropRef.current?.classList.remove(styles.dragover);

    if (!isLink && !isImage) {
      console.warn("Drop event does not contain a link or image");
      return;
    }

    if (isLink) {
      const url = event.dataTransfer.getData("text/uri-list");
      handleLinkDrop(url);
    } else {
      // Handle image drop

      // Upload file and store in OPFS
      const files = Array.from(event.dataTransfer.files);
      handleFileDrop(files);
    }
  };

  const dragHandler = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    const isLink = event.dataTransfer.types.includes("text/uri-list");
    const isImage =
      event.dataTransfer.types.includes("Files") &&
      Array.from(event.dataTransfer.items).some((item) =>
        item.type.startsWith("image/")
      );

    switch (event.type) {
      case "dragenter":
        if (isLink || isImage) {
          event.preventDefault();
          dropRef.current?.classList.add(styles.dragover);
        }
        break;

      case "dragover":
        if (isLink || isImage) {
          event.preventDefault();
        }
        break;

      case "dragleave":
        dropRef.current?.classList.remove(styles.dragover);
        break;

      case "drop":
        handleDrop(event, isLink, isImage);
        break;
    }
  };

  return (
    <div className={styles.bar} data-testid="MessageInputBar">
      <div
        className={styles.dropzone}
        ref={dropRef}
        data-name="dropzone"
        style={{ pointerEvents: "none" }}
      >
        <input
          type="file"
          multiple
          accept="image/*"
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            opacity: 0,
            pointerEvents: "auto",
          }}
          ref={fileInputRef}
          onChange={handleFileInputChange}
          onDragOver={dragHandler}
          onDragEnter={dragHandler}
          onDragLeave={dragHandler}
          onDrop={dragHandler}
          data-testid="file-input"
        />
      </div>
      <Stack
        className={styles.bar_inner}
        width="100%"
        borderColor={is.inputing ? "blue.500" : "gray.200"}
        borderWidth={1}
        borderStyle="solid"
        borderRadius="md"
        padding={1}
        onDragOver={dragHandler}
        onDragEnter={dragHandler}
      >
        {is.thinking && (
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
        )}
        {options.general.codeEditor ? (
          <CodeEditor
            language="Python"
            minHeight="6lh"
            onFocus={() => setIs({ inputing: true })}
            onBlur={() => setIs({ inputing: false })}
            value={typeingMessage?.content || ""}
            placeholder={t("Please enter Python code.")}
            onChange={(ev) => setMessage(ev.target.value)}
            style={{
              backgroundColor: "var(--chakra-colors-bg)",
              fontFamily:
                "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
              fontSize: "12pt",
            }}
          />
        ) : (
          <Textarea
            data-testid="ChatTextArea"
            value={typeingMessage?.content || ""}
            onFocus={() => setIs({ inputing: true })}
            onBlur={() => setIs({ inputing: false })}
            variant="outline"
            autoresize
            borderWidth={0}
            outlineWidth={0}
            placeholder={t("Enter something....")}
            className={styles.textarea}
            onDragOver={dragHandler}
            onDragEnter={dragHandler}
            onChange={(ev: BaseSyntheticEvent) => {
              typeingMessage.content = ev.target.value;
              setInputMessage(ev.target.value);
            }}
          />
        )}
        {
          <HStack
            justify={"flex-end"}
            paddingInlineStart={2}
            paddingInlineEnd={2}
          >
            {typeingMessage?.images?.map((image, index) => {
              return (
                <Box key={index} position="relative">
                  <OPFSImage src={image.url} alt={image.name} />
                  <IconButton
                    aria-label="Delete image"
                    size="xs"
                    position="absolute"
                    top={0}
                    right={0}
                    colorPalette="red"
                    variant="solid"
                    onClick={() => handleDeleteImage(index)}
                    style={{ transform: "translate(50%, -50%)" }}
                    rounded="full"
                  >
                    <MdOutlineCancel />
                  </IconButton>
                </Box>
              );
            })}
          </HStack>
        }
        <HStack
          justify={"flex-end"}
          paddingInlineStart={2}
          paddingInlineEnd={2}
        >
          <Switch
            size="sm"
            colorScheme="blue"
            className={styles.editorToggle}
            marginInlineEnd="auto"
            checked={options.general.codeEditor}
            onCheckedChange={(ev) => setGeneral({ codeEditor: ev.checked })}
          >
            {t("Code Editor")}
          </Switch>
          <IconButton
            variant="outline"
            aria-label={t("upload_file") || "Upload file"}
            onClick={() => fileInputRef.current?.click()}
            data-testid="UploadFileBtn"
          >
            <MdOutlineFileUpload />
          </IconButton>
          <Button
            variant="outline"
            onClick={() => {
              typeingMessage.content = "";
              clearTypeing();
            }}
            data-testid="ClearMessageBtn"
          >
            {t("clear")}
          </Button>
          {recognition ? (
            <IconButton
              variant="outline"
              className={voiceClasses}
              onClick={() => {
                if (recognitionActive) {
                  recognition.stop();
                  setRecognitionActive(false);
                } else {
                  recognition.start();
                  recognition.onresult = (event) => {
                    if (event.results.length > 0) {
                      const result = event.results[0][0];
                      typeingMessage.content =
                        (typeingMessage.content || "") + result.transcript;
                      setMessage(typeingMessage.content);
                    }
                  };
                  setRecognitionActive(true);
                }
              }}
              data-testid="VoiceMessageBtn"
            >
              {recognitionActive ? <CiMicrophoneOff /> : <CiMicrophoneOn />}
            </IconButton>
          ) : null}
          <Button
            colorPalette={is.thinking ? "gray" : "blue"}
            type="submit"
            disabled={is.thinking || !typeingMessage?.content}
            onClick={() => {
              typeingMessage.content = inputMessage;
              typeingMessage.role = "user";
              setMessage(typeingMessage.content);
              sendMessage();
            }}
            data-testid="SendMessageBtn"
          >
            {t("send")}
            {options.general.codeEditor || (
              <Kbd size="sm">{t(options.general.sendCommand)}</Kbd>
            )}
          </Button>
        </HStack>
      </Stack>
    </div>
  );
}
