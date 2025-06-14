import React, { useRef, useState, useEffect } from 'react'
import { classnames } from '../../components/utils'
import { useGlobal } from '../context'
import styles from './style.module.less'

export const ScrollView = (props) => {
  const { children, className, ...rest } = props
  const scrollRef = useRef(null)
  const { is, chat } = useGlobal()
  const [height, setHeight] = useState(0);
  const handleScroll = () => {
    scrollRef?.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBottom = () => {
    const currentHeight = scrollRef?.current?.scrollHeight
    //console.log('scrollToBottom: %o %o', currentHeight, height);
    if (true || currentHeight - height > 60) {
      //scrollRef.current.scrollTop = scrollRef.current.scrollHeight;

      scrollRef.current.scrollIntoView(0, currentHeight); // scroll to bottom
      setHeight(currentHeight)
    }
  };
  useEffect(() => {
    scrollToBottom()
  }, [is.thinking, chat]);

  useEffect(() => {
    window.requestAnimationFrame(handleScroll);
    setHeight(scrollRef?.current?.scrollHeight);
  }, [scrollRef.current]);

  return <div ref={scrollRef} className={classnames(styles.scroll, className)} {...rest}> {children}</div >
}
