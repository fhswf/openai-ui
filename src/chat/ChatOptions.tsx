import React, { useEffect } from 'react'
import { Button, Panel, Input, Title, Avatar, Select } from '../components'
import { useGlobal } from './context'
import { themeOptions, languageOptions, sendCommandOptions, modeOptions, modelOptions, sizeOptions } from './utils/options'
import { Tooltip } from '../components'
import { Card, CardBody, Flex, FormControl, FormHelperText, FormLabel, Heading, Icon, Radio, RadioGroup, Stack, StackDivider, Switch } from "@chakra-ui/react";
import styles from './style/config.module.less'
import { classnames } from '../components/utils'
import { useOptions } from './hooks'
import { t, use } from 'i18next'
import { initState } from './context/initState'
import { getAssistants } from './service/assistant'
import { OptionActionType } from './context/types'
import { Trans } from 'react-i18next'

export function ConfigHeader() {
  const { setState, setIs, is } = useGlobal()
  return (
    <div className={classnames(styles.header, 'flex-c-sb')} data-testid="SettingsHeader">
      <Heading size="lg">{t("chat_settings")}</Heading>
      <div className="flex-c">
        <Button type="icon" onClick={() => setState(initState)} icon="refresh" dataTestId="SettingsRefreshBtn" />
        <Button type="icon" onClick={() => setIs({ config: !is.config })} icon="close" dataTestId="SettingsCloseBtn" />
      </div>
    </div >
  )
}

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
    <Card w="100%">
      <ConfigHeader />
      <CardBody overflowY={"auto"}>
        <Stack divider={<StackDivider />} spacing='4'>
          <Heading size="md">{t("general")}</Heading>

          <FormControl mt="4">
            <FormLabel>{t("theme_style")}</FormLabel>
            <RadioGroup value={general.theme} onChange={(val) => setGeneral({ theme: val })}>
              <Stack direction="row">
                {themeOptions.map((item) => (
                  <Radio key={item.value} value={item.value}>{item.label}</Radio>
                ))}
              </Stack>
            </RadioGroup>
            <FormHelperText>{t("theme_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("send")}</FormLabel>
            <RadioGroup value={general.theme} onChange={(val) => setGeneral({ sendCommand: val })}>
              <Stack direction="row">
                {sendCommandOptions.map((item) => (
                  <Radio key={item.value} value={item.value}>{item.label}</Radio>
                ))}
              </Stack>
            </RadioGroup>
            <FormHelperText>{t("send_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("language")}</FormLabel>
            <Select value={general.language} onChange={val => setGeneral({ language: val })} options={languageOptions} placeholder="language" dataTestId="SetLanguageSelect" />
            <FormHelperText>{t("language_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("fontsize")}</FormLabel>
            <Select value={general.size} onChange={val => setGeneral({ size: val })} options={sizeOptions} placeholder="OpenAI ApiKey" dataTestId="ChangeFontSizeSelect" />
            <FormHelperText>{t("fontsize_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <Flex>
              <FormLabel htmlFor='gravatar' mb='0'>
                {t("gravatar")}
              </FormLabel>
              <Switch id="gravatar" isChecked={general.gravatar} onChange={(value) => {
                console.log("onChange: ", value.target.checked);
                setGeneral({ ...options.general, gravatar: value.target.checked });
              }} />
            </Flex>
            <FormHelperText><Trans t={t}>help_gravatar</Trans></FormHelperText>
          </FormControl>


          <Heading size="md">{t("Global OpenAI Config")}</Heading>


          <FormControl mt="4">
            <FormLabel>{t("api_mode")}</FormLabel>
            <Select options={modeOptions} value={openai.mode} onChange={val => setAPIMode(val)} />
            <FormHelperText>{t("api_mode_help")}</FormHelperText>
          </FormControl>
          {
            openai.mode === 'assistant' ?

              (
                <FormControl mt="4">
                  <FormLabel>{t("assistant")}</FormLabel>
                  <Select options={assistants} value={openai.assistant} onChange={val => setAssistant(val)} placeholder="Choose assistant" />
                  <FormHelperText>{t("assistent_help")}</FormHelperText>
                </FormControl>
              )

              :
              (
                <FormControl mt="4">
                  <FormLabel>{t("openai_model_help")}</FormLabel>
                  <Select dataTestId="ChangeAIModelSelect" options={modelOptions} value={openai.model} onChange={val => setModel({ model: val })} placeholder="Choose model" />
                  <FormHelperText>{t("openai_model_help")}</FormHelperText>
                </FormControl>
              )
          }

          <FormControl mt="4">
            <FormLabel>{t("max_tokens")}</FormLabel>
            <Input type="number" value={openai.max_tokens} placeholder="Max Tokens" onChange={val => setModel({ max_tokens: +val })} data-testid="MaxTokensInput" />
            <FormHelperText>{t("max_tokens_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("temperature")}</FormLabel>
            <Input type="number" value={openai.temperature} placeholder="OpenAI Temperature" onChange={val => setModel({ temperature: +val })} data-testid="SetTemperatureInput" />
            <FormHelperText>{t("temperature_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("top_p")}</FormLabel>
            <Input type="number" value={openai.top_p} placeholder="Custom top_p." onChange={val => setModel({ top_p: +val })} data-testid="SetTopPInput" />
            <FormHelperText>{t("top_p_help")}</FormHelperText>
          </FormControl>

          <Heading size="md" desc={t("custom_endpoint_desc")}>{t("Custom API Endpoint")}</Heading>

          <FormControl mt="4">
            <FormLabel>{t("api_base_url")}</FormLabel>
            <Input value={openai.baseUrl} placeholder="Api Base Url" onChange={val => setModel({ baseUrl: val })} data-testid="ApiBaseURLInput" />
            <FormHelperText>{t("api_base_url_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("api_key")}</FormLabel>
            <Input value={openai.apiKey} autoComplete="new-password" onChange={val => setModel({ apiKey: val })} placeholder="ApiKey" type="password" data-testid="APIKeyInput" />
            <FormHelperText>{t("api_key_help")}</FormHelperText>
          </FormControl>

          <FormControl mt="4">
            <FormLabel>{t("organization_id")}</FormLabel>
            <Input value={openai.organizationId} placeholder="OpenAI Organization ID" onChange={val => setModel({ organizationId: val })} data-testid="APIOrganisationIDInput" />
            <FormHelperText>{t("organization_id_help")}</FormHelperText>
          </FormControl>

        </Stack>
      </CardBody>
    </Card >
  )
}
