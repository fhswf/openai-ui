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
import { MessageInput } from './MessageInput';
import { use } from 'chai';


function ErrorFallback({ error, resetErrorBoundary }) {
  console.log("error: %o %s", error.stack, typeof error.stack)
  const t = (key) => key
  //const { t } = useTranslation();
  const resetSettings = () => {
    console.log("resetSettings")
    localStorage.setItem("SESSIONS", "");
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





  const allowedEmails = [
    'neus.burkhard@fh-swf.de',
    'kuepluece.hatice@fh-swf.de',
    'wienke.annalisa@fh-swf.de',
    'andermahr.sabine@fh-swf.de',
    'kleineberg.matthaeus@fh-swf.de',
    'meffert.inga@fh-swf.de',
    'goedde.kirsten@fh-swf.de',
    'hillebrand.melanie@fh-swf.de',
    'kern.sebastian@fh-swf.de',
    'lueck.veith@fh-swf.de',
    'menk.eva@fh-swf.de',
    'reinecke.sandra@fh-swf.de',
    'kurowski.bernd@fh-swf.de',
    'schoebel.denis@fh-swf.de',
    'schluck.dirk@fh-swf.de'
  ];

  /**
   * Check if the user is allowed to access the chat
   * @returns {boolean} true if the user is allowed to access the chat 
   */
  function checkUser() {
    if (!user) return false
    if (
      // User is a faculty member of fh-swf.de
      user?.affiliations['fh-swf.de']?.indexOf('faculty') > -1 ||
      // User is a student at fb-in.fh-swf.de
      user?.affiliations['fb-in.fh-swf.de']?.indexOf('student') > -1 ||
      // User is a staff member of fb-in.fh-swf.de
      user?.affiliations['fb-in.fh-swf.de']?.indexOf('staff') > -1 ||
      // User is an employee of the department 8
      allowedEmails.includes(user?.email)
    )
      return true
    return false
  }

  const userText = `
  ## Kein Zugriff

Diese Anwendung befindet sich im Pilotbetrieb.
Der Zugriff ist aktuell nur für folgende Personen möglich:

- Mitglieder des Fachbereichs Informatik & Naturwissenschaften,
- Professor*innen der Fachhochschule Südwestfalen,
- Beschäftigte des Dezernats 8
`

  if (!checkUser()) {
    return (
      <div className={classnames(styles.chat, chatStyle)}>
        <div className={styles.chat_inner}>
          <ChatSideBar />
          <div>
            <Markdown
              remarkPlugins={[remarkGfm, remarkMath, smartypants]}
              rehypePlugins={[rehypeKatex]}
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
  )
}
