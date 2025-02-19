import React from 'react'
import { Button, Card, Heading } from '@chakra-ui/react'
import { AppsProvider, useApps } from './context'
import { useGlobal } from '../context'
import { classnames } from '../../components/utils'
import styles from './apps.module.less'
import { useTranslation } from 'react-i18next'


export function AppItem(props) {
  const { t } = useTranslation();
  const { setCurrent, apps, dispatch } = useApps()
  const { setApp, newChat, currentApp } = useGlobal()

  const { category } = props;
  const app = apps.filter(item => item.category === category)[0]
  console.log("AppItem: %o %o", currentApp, props)
  return (
    <Card.Root variant={currentApp?.id === props?.id ? "elevated" : "subtle"}>
      <Card.Header>
        <Card.Title>{props.title}</Card.Title>
      </Card.Header>
      <Card.Body>
        <Card.Description hyphens="auto">{props.desc}</Card.Description>
      </Card.Body>
      <Card.Footer flexDirection={"column"} alignItems={"flex-end"}>
        <Button
          type="primary"
          onClick={() => { setApp(app); newChat(app) }}>{t("Start Chat")}</Button>
      </Card.Footer>
    </Card.Root>
  )
}

export function Empty() {
  return (
    <div className={classnames(styles.empty, 'flex-column')}>
      <div className={classnames(styles.icon, 'ico-prompts')} />
      <div className={styles.empty_text}>None-apps</div>
    </div>
  )
}

export function Category(props) {
  const { setState, apps, current, category } = useApps()
  const list = apps.filter(item => item.category === category[props.index].id)
  return (
    <div>
      <Heading paddingInlineStart={2} paddingBlockStart={4} paddingBlockEnd={2} as="h2" >
        <span className={classnames(styles.icon, `ico-${props.icon}`)}></span>
        {props?.title}
      </Heading>
      <div>
        {list.map((item, index) => <AppItem {...item} key={index} />)}
      </div>
    </div >
  )
}

export function AppContainer() {
  const { category, dispatch } = useApps()
  return (
    <div className={styles.apps} data-testid="AppsList">
      {
        category.map((item, index) => <Category index={index} {...item} key={item.id} />)
      }
    </div>
  )
}

export function Apps() {
  return (
    <AppsProvider>
      <AppContainer />
    </AppsProvider>
  )
}