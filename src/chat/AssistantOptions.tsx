import React from "react";
import { useEffect, useState } from "react";
import { modifyAssistant, retrieveAssistant, retrieveFile, createFile, deleteFile, assistantsModels, Model } from "./service/assistant";
import { Box, Button, ButtonGroup, Card, CardBody, CardFooter, CardHeader, Flex, Heading, IconButton, Input, Select, SimpleGrid, Spacer, Stack, StackDivider } from '@chakra-ui/react'
import { Panel, Icon, Textarea, Title } from "../components";
import OpenAI from "openai";
import { useGlobal } from "./context";
import styles from './style/config.module.less'
import { classnames } from '../components/utils'
import { t } from "i18next";
import { FormControl, FormHelperText, FormLabel, Switch } from "@chakra-ui/react";
import { useToast } from '@chakra-ui/react'
import { OptionActionType } from "./context/types";
import { DeleteIcon } from "@chakra-ui/icons";


export interface AssistantProps {
    assistant: string;
}

type ToolType = 'code_interpreter' | 'file_search' //| 'function';

function ConfigHeader() {
    const { setState, setIs, is } = useGlobal()
    function cancel() {

        setIs({ config: !is.config })
        setState({ currentEditor: null })
    }

    return (
        <CardHeader>
            <Flex direction={'row'}>
                <Heading size="lg">Assistant Settings</Heading>
                <Spacer />
                <IconButton variant="ghost" aria-label="Close" size="sm"
                    onClick={cancel} icon={<i className="ico ico-close" />} />
            </Flex>
        </CardHeader>
    )
}




/**
 * Display and edit information about the assistant.
 */
export const AssistantOptions = (props: AssistantProps) => {
    const { setState, setIs, setOptions, doLogin, is, options } = useGlobal();
    const assistant_id = props.assistant;
    const [assistant, setAssistant] = useState<OpenAI.Beta.Assistants.Assistant | null>(null);
    const [description, setDescription] = useState<string>("");
    const [name, setName] = useState<string>("");
    const [model, setModel] = useState<string>("");
    const [instructions, setInstructions] = useState<string>("");
    const [metadata, setMetadata] = useState<any>({});
    const [tools, setTools] = useState<ToolType[]>([]);
    const [file_ids, setFileIds] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [models, setModels] = useState<Model[]>([]);

    console.log("Assistant ID:", assistant_id);
    const toast = useToast();

    function File(props: { assistant_id: string, file_id: string }) {
        const { assistant_id, file_id } = props;
        const [file, setFile] = useState<OpenAI.Files.FileObject | null>(null);
        const [loading, setLoading] = useState<boolean>(true);
        const name = loading ? "Loading... " + file_id : file.filename;
        return (
            <Flex alignItems="center">
                <div>{name}</div>
                <Spacer />
                <IconButton my={2} aria-label={t("help_delete_file")} colorScheme="red" icon={<DeleteIcon />}
                />
            </Flex>
        )

    }

    useEffect(() => {
        assistantsModels()
            .then((_models) => {
                setModels(_models);
            })
            .catch((error) => {
                toast({
                    title: 'Could not load assistant models.',
                    description: error.message,
                    status: 'error',
                    duration: 9000,
                    isClosable: true,
                })
                if (error.status === 401) {
                    doLogin();
                }
            });
    });

    useEffect(() => {
        console.log("Retrieving Assistant:", assistant_id);
        retrieveAssistant(assistant_id)
            .then((assistant) => {
                let tools: ToolType[] = [];
                assistant.tools.forEach(element => {
                    if (element.type === 'file_search') {
                        tools.push('file_search');
                    }
                    if (element.type === 'code_interpreter') {
                        tools.push('code_interpreter');
                    }
                });
                setAssistant(assistant);
                setDescription(assistant.description);
                setName(assistant.name);
                setModel(assistant.model);
                setInstructions(assistant.instructions);
                setMetadata(assistant.metadata);
                setTools(tools);
                //setFileIds(assistant.file_ids);
                setLoading(false);
            })
            .catch((error) => {
                toast({
                    title: 'An error occured.',
                    description: error.message,
                    status: 'error',
                    duration: 9000,
                    isClosable: true,
                })
                if (error.status === 401) {
                    doLogin();
                }
                setIs({ config: !is.config })
                setState({ currentEditor: null })
                setLoading(false);
            });
    }, [assistant_id]);

    const cancel = () => {
        setIs({ config: !is.config })
        setState({ currentEditor: null })
    }

    const save = async () => {
        if (assistant) {
            const newAssistant = {
                description,
                name,
                model,
                instructions,
                metadata,
                tools: tools.map((tool) => ({ type: tool })),
                file_ids,
            }
            try {
                const updatedAssistant = await modifyAssistant(assistant.id, newAssistant);
                let tools: ToolType[] = [];
                updatedAssistant.tools.forEach(element => {
                    if (element.type === 'file_search') {
                        tools.push('file_search');
                    }
                    if (element.type === 'code_interpreter') {
                        tools.push('code_interpreter');
                    }
                });
                setAssistant(updatedAssistant);
                setDescription(updatedAssistant.description);
                setName(updatedAssistant.name);
                setModel(updatedAssistant.model);
                setInstructions(updatedAssistant.instructions);
                setMetadata(updatedAssistant.metadata);
                setTools(tools);
                //setFileIds(updatedAssistant.file_ids);
                setIs({ config: !is.config })
                setState({ currentEditor: null })
            } catch (error) {
                if (error.status === 401) {
                    doLogin();
                }
                setError(error.message);
            }
        }
    }

    if (loading) {
        return (<div>Loading...</div>);
    }

    if (error) {
        return (<div>Error: {error.toString()}</div>);
    }

    const updateTool = (tool: ToolType, value: boolean) => {
        console.log("Update tool:", tool, value);
        if (value) {
            setTools([...tools, tool]);
        } else {
            setTools(tools.filter((t) => t !== tool));
        }
    }

    const dragEnter = (ev: React.DragEvent<HTMLDivElement>) => {
        ev.preventDefault();
        //console.log("Drag Enter:", ev.dataTransfer.types);
        if (ev.dataTransfer.types.includes("Files")) {
            ev.dataTransfer.dropEffect = "copy";
        }
        else {
            ev.dataTransfer.dropEffect = "none";
            ev.dataTransfer.effectAllowed = "none";
        }
    }

    const dropFile = (ev: React.DragEvent<HTMLDivElement>) => {
        ev.preventDefault();
        console.log("Drop:", ev.dataTransfer.files);
        for (const file of ev.dataTransfer.files) {
            console.log("adding File:", file);
            createFile(file)
                .then((assistantFile) => {
                    console.log("Assistant File:", assistantFile);
                    return null;//createAssistantFile(assistant_id, assistantFile.id);
                })
                .then((assistantFile) => {
                    console.log("Assistant File:", assistantFile);
                    setFileIds([...file_ids, assistantFile.id]);
                })
                .catch((error) => {
                    console.error("Error:", error);
                    toast({
                        title: 'An error occured.',
                        description: error.message,
                        status: 'error',
                        duration: 9000,
                        isClosable: true,
                    })
                    if (error.status === 401) {
                        doLogin();
                    }
                });
        }
    }

    return (
        <Card w="100%" maxW="70em">
            <ConfigHeader />
            <CardBody overflowY={"auto"}>
                <Stack divider={<StackDivider />} spacing='4'>
                    <Box>
                        <Heading size="md">{t("general")}</Heading>
                        <FormControl mt="4">
                            <FormLabel>{t("name")}</FormLabel>
                            <Input id="name" type="string" value={name} onChange={(ev) => setName(ev.target.value)} w="100%" />
                            <FormHelperText>{t("help_name")}</FormHelperText>
                        </FormControl>

                        <FormControl mt="4">
                            <FormLabel>{t("description")}</FormLabel>
                            <Input type="string" value={description} width="100%" onChange={(ev) => setDescription(ev.target.value)} />
                            <FormHelperText>{t("help_description")}</FormHelperText>
                        </FormControl>


                        <FormControl mt="4">
                            <FormLabel>{t("description")}</FormLabel>
                            <Input type="string" value={description} width="100%" onChange={(ev) => setDescription(ev.target.value)} />
                            <FormHelperText>{t("help_description")}</FormHelperText>
                        </FormControl>


                        <FormControl mt="4">
                            <FormLabel>{t("instructions")}</FormLabel>
                            <Textarea type="string" rows="5" cols="70" value={instructions} onChange={setInstructions} />
                            <FormHelperText>{t("help_instructions")}</FormHelperText>
                        </FormControl>

                        <FormControl mt="4">
                            <FormLabel>{t("model")}</FormLabel>
                            <Select onChange={(ev) => setModel(ev.target.value)}>
                                {
                                    models
                                        .toSorted((a, b) => -a.id.localeCompare(b.id))
                                        .map((_model) => {
                                            return <option key={_model.id} value={_model.id} selected={_model.id === model}>{_model.id}</option>
                                        })
                                }
                            </Select>
                        </FormControl>

                        <FormControl mt="4">
                            <Flex>
                                <FormLabel htmlFor='code_editor' mb='0'>
                                    {t("code_editor")}
                                </FormLabel>
                                <Switch id="code_editor" isChecked={metadata.code_editor === "true"} onChange={(value) => {
                                    console.log("onChange: ", value.target.checked);
                                    setMetadata({ ...metadata, code_editor: value.target.checked.toString() });
                                    setOptions({ type: OptionActionType.GENERAL, data: { ...options.general, codeEditor: value.target.checked } })
                                }} />
                            </Flex>
                            <FormHelperText>{t("help_code_editor")}</FormHelperText>
                        </FormControl>
                    </Box>
                    <Box>
                        <Heading size="md">{t("tools")}</Heading>
                        <SimpleGrid columns={2} spacing="2" mt="4">
                            <FormLabel mb='0'>
                                {t("tool_retrieval")}
                            </FormLabel>
                            <Switch isChecked={tools.includes('file_search')} onChange={(ev) => updateTool('file_search', ev.target.checked)} />
                            <FormLabel mb='0'>
                                {t("tool_code_interpreter")}
                            </FormLabel>
                            <Switch isChecked={tools.includes('code_interpreter')} onChange={(ev) => updateTool('code_interpreter', ev.target.checked)} />
                        </SimpleGrid>
                    </Box>
                    {false ? //TODO: files are per tool in v2
                        (<Box>
                            <Heading size="md">{t("files")}</Heading>
                            <FormControl mt="4" onDrop={dropFile} onDragEnter={dragEnter} onDragOver={dragEnter} className={styles.drop_zone}>
                                {
                                    file_ids.map((file_id) => {
                                        return (<File assistant_id={assistant_id} file_id={file_id} key={file_id} />)
                                    })
                                }
                            </FormControl>
                        </Box>) : null
                    }
                </Stack>
            </CardBody >
            <CardFooter mt="4" display="flex">
                <ButtonGroup variant='outline' spacing='6'>
                    <Button variant="solid" onClick={cancel}>{t("cancel")}</Button>
                    <Button colorScheme='blue' variant="solid" onClick={save}>{t("save")}</Button>
                </ButtonGroup>
            </CardFooter>

        </Card >
    )
}