import React, { useEffect } from 'react'
import { Button, Panel, Input, Title, Avatar, Select } from '../components'
import { useGlobal } from './context'
import { themeOptions, languageOptions, sendCommandOptions, modeOptions, modelOptions, sizeOptions } from './utils/options'
import { Tooltip } from '../components'
import styles from './style/config.module.less'
import { classnames } from '../components/utils'
import { useOptions } from './hooks'
import { t, use } from 'i18next'
import { initState } from './context/initState'
import { getAssistants } from './service/assistant'

export function ConfigHeader() {
  const { setState, setIs, is } = useGlobal()
  return (
    <div className={classnames(styles.header, 'flex-c-sb')} data-testid="SettingsHeader">
      <Title type="h5">Setting</ Title>
      <div className="flex-c">
        <Button type="icon" onClick={() => setState(initState)} icon="refresh" dataTestId="SettingsRefreshBtn" />
        <Button type="icon" onClick={() => setIs({ config: !is.config })} icon="close" dataTestId="SettingsCloseBtn" />
      </div>
    </div >
  )
}

export function ChatOptions() {
  const ModelOptions = [
    { label: "gpt4-turbo", value: "gpt4-turbo" },
    { label: "gpt4", value: "gpt4" },
    { label: "gpt3.5-turbo", value: "gpt3.5-turbo" },
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
            .filter((item) => item.metadata["public"] === "True")
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
    <div className={classnames(styles.config, 'flex-c-sb flex-column')}>
      <ConfigHeader />
      <div className={classnames(styles.inner, 'flex-1')}>

        {/*
        <Panel className={styles.panel} title="Account">
          <Panel.Item title="avatar" desc="If selected,  will switch between different appearances following your system settings" icon="user">
            <Avatar src={account.avatar} />
          </Panel.Item>
          <Panel.Item icon="setting" title="Personalized Name" desc="Personalize your AI pair programmer. You can rename your assistant to anything you responsibly prefer.">
            <Input value={account.name} onChange={(val) => setAccount({ name: val })} placeholder="Personalize your AI pair programmer" />
          </Panel.Item>
        </Panel>
        */}
        <Panel className={styles.panel} title="General">
          {/* <Panel.Item title="Appearance" desc="If selected,  will switch between different appearances following your system settings" icon="config">
            <Switch label={theme} />
          </Panel.Item> */}
          <Panel.Item icon="light" title="Theme Style" desc={t("theme_help")}>
            <Select value={general.theme} onChange={(val) => setGeneral({ theme: val })} options={themeOptions} placeholder="Select interface style" dataTestId="OptionDarkModeSelect" />
          </Panel.Item>
          <Panel.Item icon="files" title="Send messages" desc={t("send_help")}>
            <Select value={general.sendCommand} onChange={(val) => setGeneral({ sendCommand: val })} options={sendCommandOptions} placeholder="Select interface style" dataTestId="SendMessageSelect" />
          </Panel.Item>
          <Panel.Item icon="lang" title="Language" desc={t("language_help")}>
            <Select value={general.language} onChange={val => setGeneral({ language: val })} options={languageOptions} placeholder="language" dataTestId="SetLanguageSelect" />
          </Panel.Item>
          <Panel.Item icon="config" title="FontSize" desc={t("fontsize_help")}>
            <Select value={general.size} onChange={val => setGeneral({ size: val })} options={sizeOptions} placeholder="OpenAI ApiKey" dataTestId="ChangeFontSizeSelect" />
          </Panel.Item>
        </Panel>
        <Panel className={styles.panel} title="Global OpenAI Config">
          <Panel.Item icon="editor" title="API mode" desc={t("api_mode_help")}>
            <Select dataTestId="ChangeAIModelSelect" options={modeOptions} value={openai.mode} onChange={val => setAPIMode(val)} />
          </Panel.Item>
          {
            openai.mode === 'assistant' ?

              (
                <Panel.Item icon="model" title="Assistant" desc={t("openai_model_help")}>
                  <Select options={assistants} value={openai.assistant} onChange={val => setAssistant(val)} placeholder="Choose assistant" />
                </Panel.Item>)

              :
              (<Panel.Item icon="model" title="OpenAI model" desc={t("openai_model_help")}>
                <Select options={modelOptions} value={openai.model} onChange={val => setModel({ model: val })} placeholder="Choose model" />
              </Panel.Item>)
          }

          <Panel.Item icon="files" title="Max Tokens" desc="The maximum number of tokens to generate in the reply. 1 token is roughly 1 word.">
            <Input type="number" value={openai.max_tokens} placeholder="Max Tokens" onChange={val => setModel({ max_tokens: +val })} data-testid="MaxTokensInput" />
          </Panel.Item>
          <Panel.Item icon="paste" title="Temperature" desc={t("temperature_help")}>
            <Input type="number" value={openai.temperature} placeholder="OpenAI Temperature" onChange={val => setModel({ temperature: +val })} data-testid="SetTemperatureInput" />
          </Panel.Item>
          <Panel.Item icon="link" title="Top P" desc={t("top_p_help")}>
            <Input type="number" value={openai.top_p} placeholder="Custom top_p." onChange={val => setModel({ top_p: +val })} data-testid="SetTopPInput" />
          </Panel.Item>
        </Panel>

        <Panel className={styles.panel} title="Custom API endpoint"
          desc={t("custom_endpoint_desc")}>
          <Panel.Item icon="link" title="Api Base Url" desc="Custom base url for OpenAI API.">
            <Input value={openai.baseUrl} placeholder="Api Base Url" onChange={val => setModel({ baseUrl: val })} data-testid="ApiBaseURLInput" />
          </Panel.Item>
          <Panel.Item title="API Key" desc="Custom openai.com API Key" icon="key">
            <Input value={openai.apiKey} autoComplete="new-password" onChange={val => setModel({ apiKey: val })} placeholder="ApiKey" type="password" data-testid="APIKeyInput" />
          </Panel.Item>
          <Panel.Item icon="organization" title="Organization" desc="OpenAI Organization ID. Documentation.">
            <Input value={openai.organizationId} placeholder="OpenAI Organization ID" onChange={val => setModel({ organizationId: val })} data-testid="APIOrganisationIDInput" />
          </Panel.Item>

        </Panel>
      </div>
    </div>
  )
}
