import React, { useEffect } from 'react'
import { ErrorBoundary } from "react-error-boundary";
import { Alert, Button, Center, Grid, GridItem, Heading, HStack, Text } from "@chakra-ui/react"
import { Toaster, toaster } from "../components/ui/toaster"
import { ChatMessage } from './ChatMessage'
import { MessageHeader } from './MessageHeader';
import { ChatSideBar } from './ChatSideBar'

import { Apps } from './apps/index'
import { ChatList } from './ChatList'
import { classnames } from '../components/utils'
import { useGlobal } from './context'

import styles from './style/chat.module.less'
import { ScrollView } from './component'
import './style.less'

import { Config } from './Config'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import smartypants from 'remark-smartypants'
import rehypeKatex from 'rehype-katex'
import { func } from 'prop-types';
import { useTranslation } from 'react-i18next';
import { t } from 'i18next';
import { MessageInput } from './MessageInput';
import { use } from 'chai';
import {
  ATTR_ERROR_TYPE,
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE
} from '@opentelemetry/semantic-conventions';
import { logger, SeverityNumber } from './utils/instrumentation'

function ErrorFallback({ error, resetErrorBoundary }) {

  console.log("error: %o %s", error.stack, typeof error.stack)

  logger.emit({
    severityNumber: SeverityNumber.ERROR,
    severityText: "ERROR",
    body: { message: error.message, stack: error.stack.toString() },
    attributes: { [ATTR_ERROR_TYPE]: 'exception', [ATTR_EXCEPTION_MESSAGE]: error.message, [ATTR_EXCEPTION_STACKTRACE]: error.stack.toString() },
  });

  //const t = (key) => key
  // const { t } = useTranslation();

  const resetSettings = () => {
    console.log("resetSettings")
    localStorage.setItem("SESSIONS", "");
    window.location.reload();
  }

  return (
    <Center height="100%" margin="10ex">
      <Alert.Root variant="surface" status="error" >
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title as="h2" fontSize="lg">{t("An error occurred") + ": " + error.name}</Alert.Title>
          <Alert.Description>
            {error.message}

            <Heading paddingBlockStart="1ex" as="h3" fontSize="md">Stacktrace:</Heading>
            {error.stack.split("\n").map((line, index) => <Text key={index}>{line}</Text>)}
          </Alert.Description>
          <HStack justify="end" spacing="2">
            <Button variant="subtle" onClick={resetSettings}>{t("Reset settings")}</Button>
            <Button variant="solid" onClick={resetErrorBoundary}>{t("Try again")}</Button>
          </HStack>
        </Alert.Content>
      </Alert.Root>
    </Center >
  )
}

export default function Chat() {
  const { is, user } = useGlobal()
  const { t } = useTranslation();
  const chatStyle = is?.fullScreen ? styles.full : styles.normal

  window.onerror = function (message, source, lineno, colno, error) {
    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: { message: typeof message === 'string' ? message : message?.toString(), source, lineno, colno, stack: error.stack.toString() },
      attributes: { [ATTR_ERROR_TYPE]: 'exception', [ATTR_EXCEPTION_MESSAGE]: error.message.toString(), [ATTR_EXCEPTION_STACKTRACE]: error.stack.toString() },
    });
    console.log("window.onerror: %o %o", error, error.stack)
    toaster.create({ type: "error", title: "An Error Occurred", description: (`${message}, ${source}, ${lineno}, ${colno}`) })
    return true;
  }




  /**
   * Check if the user is allowed to access the chat
   * @returns {boolean} true if the user is allowed to access the chat 
   */
  function checkUser() {
    if (!(user?.affiliations && user.affiliations['fh-swf.de']))
      return false
    else
      return true
  }

  const userText = `
  # Kein Zugriff

Der Zugriff auf den Chat ist nur für Mitglieder der FH SWF möglich. Wenn du ein Mitglied bist, melde dich bitte mit Deiner Hochschulkennung an.
`

  if (!checkUser()) {
    return (
      <div className={classnames(styles.chat, chatStyle)}>
        <MessageHeader />
        <div className={styles.chat_inner}>

          <div>
            <Markdown
              remarkPlugins={[remarkGfm, smartypants]}
            >
              {userText}
            </Markdown>
            <div>
              <p>Ihre Benutzerdaten lauten:</p>

              <pre>
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>)
  }

  return (
    <ErrorBoundary fallbackRender={ErrorFallback}>
      <Grid
        gridTemplateAreas={`"header header" "side main" "side input"`}
        gridTemplateColumns={"max-content 1fr"}
        gridTemplateRows={"max-content 1fr max-content"}
        className={classnames(styles.chat, chatStyle)}
      >
        <Toaster />

        <GridItem gridArea={"header"}>
          <MessageHeader />
        </GridItem>

        <GridItem gridArea={"side"} as="aside" className={is?.toolbar ? styles.showToolbar : styles.hideToolbar}>
          <ChatSideBar />
        </GridItem>

        {
          is?.config ?
            <Config />
            :
            <GridItem as="main" gridArea={"main"} overflow="auto">
              <ErrorBoundary fallbackRender={ErrorFallback}>
                <div className={styles.chat_content}>

                  {

                    is?.sidebar && <div className={styles.sider} data-testid="ConversationSideBar">
                      <ScrollView>
                        {is?.apps ? <Apps /> : <ChatList />}
                      </ScrollView>
                    </div>
                  }
                  <ChatMessage />
                </div>
              </ErrorBoundary>
            </GridItem>

        }

        <GridItem gridArea={"input"}>
          <MessageInput />
        </GridItem>
      </Grid>
    </ErrorBoundary>
  )
}
