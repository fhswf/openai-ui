import React from 'react'
import { ChatMessage } from './ChatMessage'
import { ChatSideBar } from './ChatSideBar'
import { ChatOptions } from './ChatOptions'
import { Apps } from './apps/index'
import { ChatList } from './ChatList'
import { classnames } from '../components/utils'
import { useGlobal } from './context'
import { Search } from '../components/Search'
import styles from './style/chat.module.less'
import { ScrollView } from './component'
import './style.less'
import { Config } from './Config'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import smartypants from 'remark-smartypants'
import rehypeKatex from 'rehype-katex'
import { all } from 'cypress/types/bluebird'

export default function Chat() {
  const { is, user } = useGlobal()
  const chatStyle = is?.fullScreen ? styles.full : styles.normal
  const onSearch = (e) => {
    console.log(e)
  }
  console.log("user", user?.affiliations, user?.affiliations['fh-swf.de'].indexOf('faculty'))

  const allowedEmails = [
    'neus.burkhard@fh - swf.de',
    'kuepluece.hatice@fh-swf.de',
    'wienke.annalisa@fh-swf.de',
    'andermahr.sabine@fh-swf.de',
    'kleineberg.matthaeus@fh-swf.de',
    'meffert.inga@fh-swf.de',
    'goedde.kirsten@fh-swf.de',
    'hillebrand.melanie@fh-swf.de',
    'kern.sebastian@fh-swf.de',
    'lueck.veith@fh-swf.de',
    'menk.eva@fh-swf.de'
  ];

  /**
   * Check if the user is allowed to access the chat
   * @returns {boolean} true if the user is allowed to access the chat 
   */
  function checkUser() {
    if (
      // User is a faculty member of fh-swf.de
      user?.affiliations['fh-swf.de'].indexOf('faculty') > -1 ||
      // User is a student at fb-in.fh-swf.de
      user?.affiliations['fb-in.fh-swf.de'].indexOf('student') > -1 ||
      // User is a staff member of fb-in.fh-swf.de
      user?.affiliations['fb-in.fh-swf.de'].indexOf('staff') > -1 ||
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

- Studierende des Fachbereichs Informatik & Naturwissenschaften,
- Professor*innen der Fachhochschule Südwestfalen,
- Beschäftigte des Dezernats 8
`

  if (!checkUser()) {
    return (
      <div className={classnames(styles.chat, chatStyle)}>
        <div className={styles.chat_inner}>
          <ChatSideBar />
          <Markdown
            className="z-ui-markdown"
            remarkPlugins={[remarkGfm, remarkMath, smartypants]}
            rehypePlugins={[rehypeKatex]}
          >
            {userText}
          </Markdown>
        </div>
      </div>)
  }
  return (
    <div className={classnames(styles.chat, chatStyle)}>
      <div className={styles.chat_inner}>
        <ChatSideBar />
        {
          is?.config ?
            <Config />
            :
            <React.Fragment>
              {
                is?.sidebar && <div className={styles.sider} data-testid="ConversationSideBar">
                  <div className={styles.search}>
                    <Search onSearch={onSearch} dataTestId="ConversationSearchBar" />
                  </div>
                  <ScrollView>
                    {is?.apps ? <Apps /> : <ChatList />}
                  </ScrollView>
                </div>
              }
              <ChatMessage />
            </React.Fragment>
        }
      </div>
    </div>
  )
}
