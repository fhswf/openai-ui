import React, { useEffect } from 'react'
import { Radio, RadioGroup } from '../components/ui/radio'
import { Switch } from '../components/ui/switch'

import { useGlobal } from './context'
import { themeOptions, languageOptions, sendCommandOptions, modeOptions, modelOptions, sizeOptions } from './utils/options'
import { Button, Card, Field, Heading, Input, Stack, createListCollection } from "@chakra-ui/react";

import {
  RadioCardItem,
  RadioCardLabel,
  RadioCardRoot,
} from "../components/ui/radio-card"
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../components/ui/select"
import { Slider } from "../components/ui/slider"

import styles from './style/config.module.less'
import { classnames } from '../components/utils'
import { useOptions } from './hooks'
import { t, use } from 'i18next'
import { initState } from './context/initState'
import { getAssistants } from './service/openai_assistant'
import { OptionActionType } from './context/types'
import { Trans } from 'react-i18next'



export function ChatOptions() {
  const { options } = useGlobal()
  const { account, openai, general } = options
  // const { avatar, name } = account
  // const { max_tokens, apiKey, temperature, baseUrl, organizationId, top_p, model } = openai
  const { setAccount, setGeneral, setAPIMode, setModel, setAssistant } = useOptions()
  const [assistants, setAssistants] = React.useState([]);
  const { setState, setIs, is } = useGlobal()


  useEffect(() => {
    if (openai.mode === 'assistant') {
      getAssistants()
        .then((assistants) => {
          console.log(assistants);
          let options = assistants.data
            //.filter((item) => item.metadata["public"] === "True")
            .map((item) => {
              return { label: item.name || "", value: item.id }
            });
          console.log("options: %o", options);
          setAssistants(options);
          if (openai.assistant === "") {
            setAssistant(options[0].value);
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          if (error.message === "Unauthorized") {
            return window.location.href = import.meta.env.VITE_LOGIN_URL;
          }
        })
    }
  }, [openai.mode]);


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
        <Stack spacing='4'>
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

            <SelectRoot collection={createListCollection({ items: languageOptions })} maxWidth="30em" onValueChange={val => setGeneral({ language: val.value })} data-testid="SetLanguageSelect">
              <SelectLabel>{t("language")}</SelectLabel>
              <SelectTrigger>
                <SelectValueText placeholder={general.language} />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((movie) => (
                  <SelectItem item={movie} key={movie.value}>
                    {movie.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
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

            <RadioCardRoot defaultValue={openai.mode} onValueChange={(ev) => setAPIMode(ev.value)} data-testid="ChangeAIModeSelect">
              <RadioCardLabel>{t("api_mode")}</RadioCardLabel>
              <Stack direction={{ base: "column", md: "row" }} gap="10" align="stretch">
                {modeOptions.map((item) => (
                  <RadioCardItem
                    label={item.label}
                    description={item.description}
                    key={item.value}
                    value={item.value}
                    maxWidth="48em"
                  />
                ))}
              </Stack>
            </RadioCardRoot>
            <Field.HelperText>{t("api_mode_help")}</Field.HelperText>
          </Field.Root>

          {
            openai.mode === 'assistant' ?

              (
                <Field.Root mt="4">
                  <SelectRoot collection={createListCollection({ items: assistants })} maxWidth="30em" onValueChange={val => setAssistant(val.value[0])}
                    data-testid="ChangeAIModelSelect">
                    <SelectLabel>{t("assistant")}</SelectLabel>
                    <SelectTrigger>
                      <SelectValueText placeholder={getAssistantLabel(openai.assistant)} />
                    </SelectTrigger>
                    <SelectContent>
                      {assistants.map((assistant) => (
                        <SelectItem item={assistant} key={assistant.value}>
                          {assistant.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                  <Field.HelperText>{t("assistent_help")}</Field.HelperText>
                </Field.Root>
              )

              :
              (
                <Field.Root mt="4">
                  <SelectRoot collection={createListCollection({ items: modelOptions })} maxWidth="30em" onValueChange={val => setModel({ model: val.value[0] })}
                    data-testid="ChangeAIModelSelect">
                    <SelectLabel>{t("openai_model_help")}</SelectLabel>
                    <SelectTrigger>
                      <SelectValueText placeholder={openai.model} />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((model) => (
                        <SelectItem item={model} key={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectRoot>
                  <Field.HelperText>{t("openai_model_help")}</Field.HelperText>
                </Field.Root>
              )
          }

          <Field.Root mt="4">
            <Slider colorPalette="blue" size="md" width="60ex" marks={tokenMarks} label={t("max_tokens")} min={0} max={8192} step={256} value={[openai.max_tokens]} onValueChange={ev => setModel({ max_tokens: ev.value[0] })} data-testid="MaxTokensInput" />
            <Field.HelperText>{t("max_tokens_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Slider colorPalette="blue" size="md" width="60ex" marks={tempMarks} label={t("temperature")} min={0} max={2} step={0.01} value={[openai.temperature]} onValueChange={ev => setModel({ temperature: ev.value[0] })} data-testid="SetTemperatureInput" />
            <Field.HelperText>{t("temperature_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Slider colorPalette="blue" size="md" width="60ex" marks={topPMarks} label={t("top_p")} min={0} max={1} step={0.01} value={[openai.top_p]} onValueChange={ev => setModel({ top_p: ev.value[0] })} data-testid="SetTopPInput" />
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
