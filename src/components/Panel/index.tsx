import React from 'react'
import { classnames } from '../utils'
import { Icon } from '../Icon'
import { Title } from '../Title'
import styles from './panel.module.less'

import PropTypes from 'prop-types'
import { name } from 'file-loader'
export function Item(props) {
  const { type, title, desc, children, extra, icon, className } = props

  return (
    <div className={classnames(styles.item, type && styles[type], className)}>
      <div className={styles.headers}>
        <div className={styles.container}>
          {icon && <Icon className={styles.icon} type={icon} />}
          <div className={styles.line}>
            <div className={styles.item_title}>{title}</div>
            <div className={styles.inner}>
              {children}
            </div>
            <div className={styles.item_desc}>{desc}</div>
          </div>
        </div>
        {extra}
      </div>

    </div>
  )
}


export function Header(props) {
  const { children, className } = props
  return (
    <div className={classnames(styles.header, className)}>
      {children}
    </div>
  )
}


export function Panel(props) {
  const { children, title, desc, className, dataTestId } = props
  return (
    <div className={classnames(styles.panel, className)} data-testid={dataTestId}>
      {title && <Title type="h2" className={styles.title}>{title}</Title>}
      {desc && <div className={styles.panel_desc}>{desc}</div>}
      <div className={styles.children}>{children}</div>
    </div>
  )
}

Item.defaultProps = {
  type: 'vertical'
}

Panel.propTypes = {
  title: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.element
  ]),
  type: PropTypes.string,
}

Panel.Item = Item