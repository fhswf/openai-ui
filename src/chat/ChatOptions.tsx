import React, { useEffect } from 'react'
import { Input, Title, Avatar, Select } from '../components'
import { Radio, RadioGroup } from '../components/ui/radio'
import { Switch } from '../components/ui/switch'
import { useGlobal } from './context'
import { themeOptions, languageOptions, sendCommandOptions, modeOptions, modelOptions, sizeOptions } from './utils/options'
import { Button, Card, CardBody, Flex, Field, Heading, IconButton, Stack, StackSeparator } from "@chakra-ui/react";
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "../components/ui/select"

import styles from './style/config.module.less'
import { classnames } from '../components/utils'
import { useOptions } from './hooks'
import { t, use } from 'i18next'
import { initState } from './context/initState'
import { getAssistants } from './service/assistant'
import { OptionActionType } from './context/types'
import { Trans } from 'react-i18next'



export function ChatOptions() {
  const ModelOptions = [
    { label: "gpt-4o-mini", value: "gpt-4o-mini" },
    { label: "gpt-4-turbo", value: "gpt-4-turbo" },
    { label: "gpt-4", value: "gpt-4" },
    { label: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
  ];
  const { options } = useGlobal()
  const { account, openai, general } = options
  // const { avatar, name } = account
  // const { max_tokens, apiKey, temperature, baseUrl, organizationId, top_p, model } = openai
  const { setAccount, setGeneral, setAPIMode, setModel, setAssistant } = useOptions()
  const [modelOptions, setModelOptions] = React.useState(ModelOptions);
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

  return (
    <Card.Root w="100%">
      <Card.Header data-testid="SettingsHeader">
        <Card.Title>{t("chat_settings")}</Card.Title>
      </Card.Header >
      <Card.Body overflowY={"auto"}>
        <Stack spacing='4'>
          <Heading size="md">{t("general")}</Heading>

          <Field.Root mt="4">
            <Field.Label>{t("theme_style")}</Field.Label>
            <RadioGroup data-testid="OptionDarkModeSelect" value={general.theme}
              onValueChange={(val) => setGeneral({ theme: val.value })}>
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
            <RadioGroup value={general.theme} onChange={(val) => setGeneral({ sendCommand: val })}>
              <Stack direction="row">
                {sendCommandOptions.map((item) => (
                  <Radio key={item.value} value={item.value}>{item.label}</Radio>
                ))}
              </Stack>
            </RadioGroup>
            <Field.HelperText>{t("send_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("language")}</Field.Label>
            <Select value={general.language} onChange={val => setGeneral({ language: val })} options={languageOptions} placeholder="language" dataTestId="SetLanguageSelect" />
            <Field.HelperText>{t("language_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("fontsize")}</Field.Label>
            <Select value={general.size} onChange={val => setGeneral({ size: val })} options={sizeOptions} placeholder="OpenAI ApiKey" dataTestId="ChangeFontSizeSelect" />
            <Field.HelperText>{t("fontsize_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">

            <Switch id="gravatar" checked={general.gravatar} onChange={(value) => {
              console.log("onChange: ", value.target.checked);
              setGeneral({ ...options.general, gravatar: value.target.checked });
            }}>{t("gravatar")}</Switch>

            <Field.HelperText><Trans t={t}>help_gravatar</Trans></Field.HelperText>
          </Field.Root>


          <Heading size="md">{t("Global OpenAI Config")}</Heading>


          <Field.Root mt="4">
            <Field.Label>{t("api_mode")}</Field.Label>
            <Select options={modeOptions} value={openai.mode} onChange={val => setAPIMode(val)} />
            <Field.HelperText>{t("api_mode_help")}</Field.HelperText>
          </Field.Root>
          {
            openai.mode === 'assistant' ?

              (
                <Field.Root mt="4">
                  <Field.Label>{t("assistant")}</Field.Label>
                  <Select options={assistants} value={openai.assistant} onChange={val => setAssistant(val)} placeholder="Choose assistant" />
                  <Field.HelperText>{t("assistent_help")}</Field.HelperText>
                </Field.Root>
              )

              :
              (
                <Field.Root mt="4">
                  <Field.Label>{t("openai_model_help")}</Field.Label>
                  <Select dataTestId="ChangeAIModelSelect" options={modelOptions} value={openai.model} onChange={val => setModel({ model: val })} placeholder="Choose model" />
                  <Field.HelperText>{t("openai_model_help")}</Field.HelperText>
                </Field.Root>
              )
          }

          <Field.Root mt="4">
            <Field.Label>{t("max_tokens")}</Field.Label>
            <Input type="number" value={openai.max_tokens} placeholder="Max Tokens" onChange={val => setModel({ max_tokens: +val })} data-testid="MaxTokensInput" />
            <Field.HelperText>{t("max_tokens_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("temperature")}</Field.Label>
            <Input type="number" value={openai.temperature} placeholder="OpenAI Temperature" onChange={val => setModel({ temperature: +val })} data-testid="SetTemperatureInput" />
            <Field.HelperText>{t("temperature_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("top_p")}</Field.Label>
            <Input type="number" value={openai.top_p} placeholder="Custom top_p." onChange={val => setModel({ top_p: +val })} data-testid="SetTopPInput" />
            <Field.HelperText>{t("top_p_help")}</Field.HelperText>
          </Field.Root>

          <Heading size="md" desc={t("custom_endpoint_desc")}>{t("Custom API Endpoint")}</Heading>

          <Field.Root mt="4">
            <Field.Label>{t("api_base_url")}</Field.Label>
            <Input value={openai.baseUrl} placeholder="Api Base Url" onChange={val => setModel({ baseUrl: val })} data-testid="ApiBaseURLInput" />
            <Field.HelperText>{t("api_base_url_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("api_key")}</Field.Label>
            <Input value={openai.apiKey} autoComplete="new-password" onChange={val => setModel({ apiKey: val })} placeholder="ApiKey" type="password" data-testid="APIKeyInput" />
            <Field.HelperText>{t("api_key_help")}</Field.HelperText>
          </Field.Root>

          <Field.Root mt="4">
            <Field.Label>{t("organization_id")}</Field.Label>
            <Input value={openai.organizationId} placeholder="OpenAI Organization ID" onChange={val => setModel({ organizationId: val })} data-testid="APIOrganisationIDInput" />
            <Field.HelperText>{t("organization_id_help")}</Field.HelperText>
          </Field.Root>

        </Stack>
      </Card.Body>

      <Card.Footer>
        <Button variant="outline" onClick={() => setState(initState)} data-testid="SettingsRefreshBtn">Reset</Button>
        <Button type="primary" onClick={() => setIs({ config: !is.config })} data-testid="SettingsCloseBtn">Close</Button>
      </Card.Footer>
    </Card.Root >
  )
}
