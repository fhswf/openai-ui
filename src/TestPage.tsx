import React, { useState } from "react";
import { Box, Button, HStack, VStack, Text, Input, Image } from "@chakra-ui/react";
import { Avatar, AvatarGroup } from "./components/ui/avatar";
import { Checkbox } from "./components/ui/checkbox";
import { CloseButton } from "./components/ui/close-button";
import {
    DialogRoot,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogTitle,
    DialogActionTrigger,
    DialogCloseTrigger,
} from "./components/ui/dialog";
import {
    DrawerRoot,
    DrawerTrigger,
    DrawerContent,
    DrawerHeader,
    DrawerBody,
    DrawerFooter,
    DrawerTitle,
    DrawerActionTrigger,
    DrawerCloseTrigger,
} from "./components/ui/drawer";
import { Field } from "./components/ui/field";
import { InputGroup } from "./components/ui/input-group";
import {
    MenuRoot,
    MenuTrigger,
    MenuContent,
    MenuItem,
    MenuItemGroup,
    MenuCheckboxItem,
    MenuRadioItemGroup,
    MenuRadioItem,
    MenuTriggerItem,
    MenuSeparator,
    MenuContextTrigger,
} from "./components/ui/menu";
import { NumberInputRoot, NumberInputField, NumberInputLabel } from "./components/ui/number-input";
import {
    PopoverRoot,
    PopoverTrigger,
    PopoverContent,
    PopoverArrow,
    PopoverCloseTrigger,
    PopoverTitle,
    PopoverBody,
} from "./components/ui/popover"; // importing from jsx file actually imports from the module resolved by build system? tsconfig says allowJs: true? 
// Actually I read popover.jsx but there is also popover.tsx in the list? 
// list_dir showed popover.jsx and popover.tsx due to me seeing both in the file list earlier?
// Wait, list_dir of src/components/ui showed:
// popover.jsx
// popover.tsx
// I should rely on the TS one if available or check which one is used.
// Let's assume .tsx for imports usually. But I read .jsx content.
// The file list showed BOTH. That's weird. 
// Let's look at list_dir output again (Step 30).
// {"name":"popover.jsx","sizeBytes":"1434"}
// {"name":"popover.tsx","sizeBytes":"1684"}
// They both exist. I should probably test both or just the one that is actually used. 
// I'll import from "./components/ui/popover" and let resolution handle it, 
// usually .tsx takes precedence in TS projects if configured.

import { Error as ErrorComponent } from "./chat/component/Error";
import { ChatHistory } from "./chat/ChatHistory";
import { useGlobal } from "./chat/context";

// Mock/Test Data
const TEST_ERROR = {
    code: "TEST_ERR_001",
    message: "This is a test error message",
    type: "simulated_error",
    param: "test_param",
};

export default function TestPage() {
    const { setState, chat, currentChat } = useGlobal();
    const [checked, setChecked] = useState(false as boolean | "indeterminate");

    const triggerError = () => {
        if (!chat || !chat[currentChat]) return;
        const newChat = [...chat];
        newChat[currentChat] = {
            ...newChat[currentChat],
            error: TEST_ERROR
        };
        setState({ chat: newChat });
    };

    const clearError = () => {
        if (!chat || !chat[currentChat]) return;
        const newChat = [...chat];
        newChat[currentChat] = {
            ...newChat[currentChat],
            error: null
        };
        setState({ chat: newChat });
    };

    return (
        <Box p={5} id="test-page-container">
            <Text fontSize="2xl" mb={5}>Test Page for Coverage</Text>

            <VStack align="start" gap={8}>

                {/* Avatar Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Avatar</Text>
                    <HStack>
                        <Avatar name="Test User" />
                        <Avatar src="https://bit.ly/dan-abramov" name="Dan Abramov" />
                        <AvatarFallbackTest />
                        <AvatarGroup>
                            <Avatar name="A" />
                            <Avatar name="B" />
                        </AvatarGroup>
                    </HStack>
                </Box>

                {/* Checkbox Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Checkbox</Text>
                    <Checkbox checked={checked} onCheckedChange={(e) => setChecked(e.checked)}>
                        Checkbox Label
                    </Checkbox>
                    <Button onClick={() => setChecked("indeterminate")}>Set Indeterminate</Button>
                </Box>

                {/* CloseButton Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">CloseButton</Text>
                    <CloseButton />
                </Box>

                {/* Dialog Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Dialog</Text>
                    <DialogRoot>
                        <DialogTrigger asChild>
                            <Button variant="outline">Open Dialog</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Dialog Title</DialogTitle>
                                <DialogCloseTrigger />
                            </DialogHeader>
                            <DialogBody>
                                <p>Dialog Body Content</p>
                            </DialogBody>
                            <DialogFooter>
                                <DialogActionTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DialogActionTrigger>
                                <Button>Save</Button>
                            </DialogFooter>
                        </DialogContent>
                    </DialogRoot>
                </Box>

                {/* Drawer Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Drawer</Text>
                    <DrawerRoot>
                        <DrawerTrigger asChild>
                            <Button variant="outline">Open Drawer</Button>
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader>
                                <DrawerTitle>Drawer Title</DrawerTitle>
                                <DrawerCloseTrigger />
                            </DrawerHeader>
                            <DrawerBody>
                                <p>Drawer Body Content</p>
                            </DrawerBody>
                            <DrawerFooter>
                                <DrawerActionTrigger asChild>
                                    <Button variant="outline">Cancel</Button>
                                </DrawerActionTrigger>
                            </DrawerFooter>
                        </DrawerContent>
                    </DrawerRoot>
                </Box>

                {/* Field Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Field</Text>
                    <Field label="Field Label" helperText="Helper text" errorText="Error text">
                        <Input placeholder="Input inside field" />
                    </Field>
                </Box>

                {/* InputGroup Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">InputGroup</Text>
                    <InputGroup startElement={<span>$</span>} endElement={<span>.00</span>}>
                        <Input placeholder="Amount" />
                    </InputGroup>
                </Box>

                {/* Menu Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Menu</Text>
                    <MenuRoot>
                        <MenuTrigger asChild>
                            <Button variant="outline">Open Menu</Button>
                        </MenuTrigger>
                        <MenuContent>
                            <MenuItem value="item-1">Item 1</MenuItem>
                            <MenuItem value="item-2">Item 2</MenuItem>
                            <MenuSeparator />
                            <MenuItemGroup title="Group">
                                <MenuItem value="item-3">Item 3</MenuItem>
                            </MenuItemGroup>
                            <MenuCheckboxItem checked={true} value="checked">Checked Item</MenuCheckboxItem>
                            <MenuRadioItemGroup value="radio-1">
                                <MenuRadioItem value="radio-1">Radio 1</MenuRadioItem>
                                <MenuRadioItem value="radio-2">Radio 2</MenuRadioItem>
                            </MenuRadioItemGroup>
                            <MenuRoot>
                                <MenuTriggerItem value="sub">Submenu</MenuTriggerItem>
                                <MenuContent>
                                    <MenuItem value="sub-1">Sub 1</MenuItem>
                                </MenuContent>
                            </MenuRoot>
                        </MenuContent>
                    </MenuRoot>

                    <MenuRoot>
                        <MenuContextTrigger asChild>
                            <Box w="100px" h="50px" bg="gray.100" border="1px dashed">Right click me</Box>
                        </MenuContextTrigger>
                        <MenuContent>
                            <MenuItem value="context-1">Context Item</MenuItem>
                        </MenuContent>
                    </MenuRoot>
                </Box>

                {/* NumberInput Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">NumberInput</Text>
                    <NumberInputRoot>
                        <NumberInputLabel>Number Input</NumberInputLabel>
                        <NumberInputField />
                    </NumberInputRoot>
                </Box>

                {/* Popover Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Popover</Text>
                    <PopoverRoot>
                        <PopoverTrigger asChild>
                            <Button variant="outline">Open Popover</Button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <PopoverArrow />
                            <PopoverTitle>Popover Title</PopoverTitle>
                            <PopoverBody>Popover Body</PopoverBody>
                            <PopoverCloseTrigger />
                        </PopoverContent>
                    </PopoverRoot>
                </Box>

                {/* Error Component Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Error Component</Text>
                    <HStack>
                        <Button onClick={triggerError} id="trigger-error-btn">Trigger Error</Button>
                        <Button onClick={clearError} id="clear-error-btn">Clear Error</Button>
                    </HStack>
                    <ErrorComponent />
                </Box>

                {/* ChatHistory Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">ChatHistory</Text>
                    {/* ChatHistory relies on useMessage returning messages. We might need to mock or populate messages via global state if possible */}
                    <ChatHistory />
                </Box>

                {/* Apps Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">Apps</Text>
                    <AppsTest />
                </Box>

                {/* AbortController & Config Section */}
                <Box border="1px solid #ccc" p={3} w="full">
                    <Text fontWeight="bold">AbortController & Config</Text>
                    <AbortTest />
                    <ConfigTest />
                </Box>

            </VStack>
        </Box>
    );
}

function AvatarFallbackTest() {
    return <Avatar fallback={<span>FB</span>} />;
}

import { Apps } from "./chat/apps";
import { Provider as UiProvider } from "./components/context";

function AppsTest() {
    return (
        <UiProvider>
            <Apps />
        </UiProvider>
    );
}

import { setAbortController } from "./chat/service/abortController.mjs";
import { Models } from "./chat/context/config.mjs";

function AbortTest() {
    const [status, setStatus] = useState("Idle");
    const handleAbort = () => {
        const { controller, disconnect } = setAbortController(() => setStatus("Aborted"));
        setStatus("Running");
        setTimeout(() => {
            disconnect();
        }, 100);
    };

    return (
        <div>
            <Text>Status: {status}</Text>
            <Button onClick={handleAbort}>Test Abort</Button>
        </div>
    );
}

function ConfigTest() {
    return (
        <div>
            <Text>Models: {Object.keys(Models).length}</Text>
            <Text>Davinci: {Models.gptApiDavinci.value}</Text>
        </div>
    );
}
