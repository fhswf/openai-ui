import React, { useEffect } from 'react'
import { Radio, RadioGroup } from '../components/ui/radio'
import { Switch } from '../components/ui/switch'

import { useGlobal } from './context'
import { themeOptions, languageOptions, sendCommandOptions, modeOptions, modelOptions, sizeOptions } from './utils/options'
import { Button, Card, Field, FileUploadFileAcceptDetails, HStack, Heading, Input, Stack, createListCollection } from "@chakra-ui/react";

import { Select } from "@chakra-ui/react"
import { FileUpload } from "@chakra-ui/react"
import { Slider } from "@chakra-ui/react"


import { useOptions } from './hooks'
import { t, use } from 'i18next'
import { initState } from './context/initState'
import { GlobalState, OptionActionType } from './context/types'
import { Trans } from 'react-i18next'
import { exportSettings, importSettings } from './utils/settings'
import { HiUpload } from "react-icons/hi"
import { toaster } from "../components/ui/toaster";


export function ChatOptions() {
  const { options } = useGlobal()
  const { account, openai, general } = options
  // const { avatar, name } = account
  // const { max_tokens, apiKey, temperature, baseUrl, organizationId, top_p, model } = openai
  const { setAccount, setGeneral, setModel } = useOptions()
  const [assistants, setAssistants] = React.useState([]);
  const { setState, setIs, is } = useGlobal()

  const tempMarks = [...Array(11).keys()].map((i) => ({ value: 0.2 * i, label: (0.2 * i).toFixed(1) }));
  const topPMarks = [...Array(11).keys()].map((i) => ({ value: 0.1 * i, label: (0.1 * i).toFixed(1) }));
  const tokenMarks = [...Array(4).keys()].map((i) => ({ value: 1024 * 2 ** i, label: (1024 * 2 ** i).toString() }));

  function getAssistantLabel(id) {
    let assistant = assistants.find((item) => item.value === id);
    return assistant ? assistant.label : "";
  }

  return (
    <Card.Root w="100%">
      <Card.Header paddingBlockEnd={2} data-testid="SettingsHeader">
        <Card.Title>{t("chat_settings")}</Card.Title>
      </Card.Header >
      <Card.Body overflowY={"auto"}>
        <Stack gap="4">
          <Heading size="md">{t("import_export")}</Heading>
          {t("import_export_description")}

          <Stack direction={{ base: "column", md: "row" }}>
            <Field.Root>
              <Field.Label>{t("export_settings")}</Field.Label>
              <Button variant="outline" colorPalette="blue" onClick={exportSettings}>{t("export")}</Button>
              <Field.HelperText>{t("export_settings_help")}</Field.HelperText>
            </Field.Root>

            <Field.Root>
              <Field.Label>{t("import_settings")}</Field.Label>


              <FileUpload.Root accept={["application/json"]}
                onFileAccept={(details: FileUploadFileAcceptDetails) => {
                  if (details.files.length > 0) {
                    const file = details.files[0];
                    importSettings(file)
                      .then((settings: GlobalState) => {
                        setIs({ config: false });
                        setState({ ...initState, ...settings });
                        toaster.create({
                          title: t("import_settings_success"),
                          description: t("import_settings_success_desc"),
                          duration: 5000,
                          type: "success",
                        })
                      })
                      .catch((error) => {
                        console.error('Error importing settings:', error);
                        toaster.create({
                          title: t("import_settings_error"),
                          description: error.message || t("import_settings_error_desc"),
                          duration: 5000,
                          type: "error",
                        })
                      })
                  }
                }}>
                <FileUpload.HiddenInput />
                <FileUpload.Trigger asChild>
                  <Button variant="outline" size="sm">
                    <HiUpload /> {t("import")}
                  </Button>
                </FileUpload.Trigger>
                <FileUpload.ItemGroup>
                  <FileUpload.Context>
                    {({ acceptedFiles }) =>
                      acceptedFiles.map((file) => (
                        <FileUpload.Item key={file.name} file={file}>
                          <FileUpload.ItemPreview />
                          <FileUpload.ItemName />
                          <FileUpload.ItemSizeText />
                          <FileUpload.ItemDeleteTrigger />
                        </FileUpload.Item>
                      ))
                    }
                  </FileUpload.Context>
                </FileUpload.ItemGroup>
              </FileUpload.Root>

              <Field.HelperText>{t("import_settings_help")}</Field.HelperText>
            </Field.Root>
          </Stack>


          <Heading size="md">{t("general")}</Heading>

          <Field.Root mt="4">
            <Field.Label>{t("theme_style")}</Field.Label>
            <RadioGroup data-testid="OptionDarkModeSelect" value={general.theme}
              onValueChange={(ev) => setGeneral({ theme: ev.value })}>
              <Stack direction="row">
                {themeOptions.map((item) => (
                  <Radio key={item.value} value={item.value}>{item.label}</Radio>
                ))}
              </Stack>
            </RadioGroup>
            <Field.HelperText>{t("theme_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("send")}</Field.Label>
            <RadioGroup value={general.sendCommand} onValueChange={(ev) => setGeneral({ sendCommand: ev.value })}>
              <Stack direction="row">
                {sendCommandOptions.map((item) => (
                  <Radio key={item.value} value={item.value}>{item.label}</Radio>
                ))}
              </Stack>
            </RadioGroup>
            <Field.HelperText>{t("send_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">

            <Select.Root collection={createListCollection({ items: languageOptions })} maxWidth="30em" onValueChange={val => setGeneral({ language: val.value })} data-testid="SetLanguageSelect">
              <Select.Label>{t("language")}</Select.Label>
              <Select.Trigger>
                <Select.ValueText placeholder={general.language} />
              </Select.Trigger>
              <Select.Content>
                {languageOptions.map((movie) => (
                  <Select.Item item={movie} key={movie.value}>
                    {movie.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Field.HelperText>{t("language_help")}</Field.HelperText>
          </Field.Root>

          {/*<Field.Root mt="4">
            <SelectRoot collection={createListCollection({ items: sizeOptions })} maxWidth="30em" onValueChange={val => setGeneral({ size: val.value })} data-testid="ChangeFontSizeSelect">
              <SelectLabel>{t("fontsize")}</SelectLabel>
              <SelectTrigger>
                <SelectValueText placeholder={general.size} />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((movie) => (
                  <SelectItem item={movie} key={movie.value}>
                    {movie.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>

            <Field.HelperText>{t("fontsize_help")}</Field.HelperText>
          </Field.Root> */ }

          <Field.Root mt="4">

            <Switch id="gravatar" checked={general.gravatar} onChange={(value) => {
              console.log("onChange: ", value.target.checked);
              setGeneral({ ...options.general, gravatar: value.target.checked });
            }}>{t("gravatar")}</Switch>

            <Field.HelperText><Trans t={t}>help_gravatar</Trans></Field.HelperText>
          </Field.Root>


          <Heading size="md" paddingBlockStart="2em">{t("Global OpenAI Config")}</Heading>

          <Field.Root mt="4">
            <Select.Root collection={createListCollection({ items: modelOptions })} maxWidth="30em" onValueChange={val => setModel({ model: val.value[0] })}
              data-testid="ChangeAIModelSelect">
              <Select.Label>{t("openai_model_help")}</Select.Label>
              <Select.Trigger>
                <Select.ValueText placeholder={openai.model} />
              </Select.Trigger>
              <Select.Content>
                {modelOptions.map((model) => (
                  <Select.Item item={model} key={model.value}>
                    {model.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <Field.HelperText>{t("openai_model_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Slider.Root colorPalette="blue"
              size="md" width="60ex" min={0} max={8192} step={256} value={[openai.max_tokens]}
              onValueChange={ev => setModel({ max_tokens: ev.value[0] })} data-testid="MaxTokensInput">
              <Slider.Label>{t("max_tokens")}</Slider.Label>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
                <Slider.Marks marks={tokenMarks} />
              </Slider.Control>
              <Slider.Label>
                <Slider.ValueText>{openai.max_tokens}</Slider.ValueText>
              </Slider.Label>
            </Slider.Root>
            <Field.HelperText>{t("max_tokens_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Slider.Root colorPalette="blue" size="md" width="60ex" min={0} max={2} step={0.01} value={[openai.temperature]} onValueChange={ev => setModel({ temperature: ev.value[0] })} data-testid="SetTemperatureInput">
              <Slider.Label>{t("temperature")}</Slider.Label>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
                <Slider.Marks marks={tempMarks} />
              </Slider.Control>
              <Slider.Label>
                <Slider.ValueText>{openai.temperature}</Slider.ValueText>
              </Slider.Label>
            </Slider.Root>
            <Field.HelperText>{t("temperature_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Slider.Root colorPalette="blue" size="md" width="60ex" min={0} max={1} step={0.01} value={[openai.top_p]} onValueChange={ev => setModel({ top_p: ev.value[0] })} data-testid="SetTopPInput">
              <Slider.Label>{t("top_p")}</Slider.Label>
              <Slider.Control>
                <Slider.Track>
                  <Slider.Range />
                </Slider.Track>
                <Slider.Thumbs />
                <Slider.Marks marks={topPMarks} />
              </Slider.Control>
              <Slider.Label>
                <Slider.ValueText>{openai.top_p}</Slider.ValueText>
              </Slider.Label>
            </Slider.Root>
            <Field.HelperText>{t("top_p_help")}</Field.HelperText>
          </Field.Root>

          <Heading size="md" desc={t("custom_endpoint_desc")} paddingBlockStart="2em">{t("Custom API Endpoint")}</Heading>

          <Field.Root mt="4">
            <Field.Label>{t("api_base_url")}</Field.Label>
            <Input width="60ex" value={openai.baseUrl} placeholder="Api Base Url" onChange={ev => setModel({ baseUrl: ev.target.value })} data-testid="ApiBaseURLInput" />
            <Field.HelperText>{t("api_base_url_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("api_key")}</Field.Label>
            <Input width="60ex" value={openai.apiKey} onChange={ev => setModel({ apiKey: ev.target.value })} type="password" data-testid="APIKeyInput" />
            <Field.HelperText>{t("api_key_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("organization_id")}</Field.Label>
            <Input width="60ex" value={openai.organizationId} placeholder="OpenAI Organization ID" onChange={ev => setModel({ organizationId: ev.target.value })} data-testid="APIOrganisationIDInput" />
            <Field.HelperText>{t("organization_id_help")}</Field.HelperText>
          </Field.Root>

        </Stack>
      </Card.Body>

      <Card.Footer paddingBlockStart={2}>
        <Button variant="outline" colorPalette="red" onClick={() => setState(initState)} data-testid="SettingsRefreshBtn">{t("Reset")}</Button>
        <Button type="primary" onClick={() => setIs({ config: !is.config })} data-testid="SettingsCloseBtn">{t("Close")}</Button>
      </Card.Footer>
    </Card.Root >
  )
}
