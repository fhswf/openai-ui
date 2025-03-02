import React, { memo, forwardRef, useEffect, useRef, useState } from 'react'
import { Skeleton } from '@chakra-ui/react'
import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "../components/ui/tooltip"
import { LuClipboardCheck } from "react-icons/lu";
import { LuClipboardCopy } from "react-icons/lu";
import MarkdownHooks from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useGlobal } from './context'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeKatex from 'rehype-katex'
import './style/markdown.less'
import 'katex/dist/katex.min.css'
import { useTranslation } from 'react-i18next';

export const MessageRender = memo((props) => {
  const { options } = useGlobal()
  const style = options.general.theme === 'dark' ? oneDark : oneLight


  function CopyIcon(props) {
    const { text = "copy", value, className } = props
    const [icon, setIcon] = useState(LuClipboardCopy);
    const { t } = useTranslation();

    async function handleCopy(e) {
      try {
        console.log('handleCopy: %o', e.target.parentNode.parentNode.parentNode.innerText);
        const text = e.target.parentNode.parentNode.parentNode.nextSibling.innerText;
        await navigator.clipboard.writeText(text);
        setIcon(LuClipboardCheck);
        setTimeout(() => {
          setIcon(LuClipboardCopy);
        }, 1500);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }

    return (
      <span className="copy" minWidth="24px" size="sm" variant="ghost" onClick={handleCopy} >
        {icon}
      </span>
    )
  }


  return (
    <MarkdownHooks
      className="z-ui-markdown"
      children={props.children}
      remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <>
              <div className="code-header">
                <CopyIcon />
              </div>
              <SyntaxHighlighter
                {...rest}
                children={children}
                style={style}
                language={match[1]}
                PreTag="div"
              />
            </>

          ) : (
            <code {...props} className={`code-line`}>
              {children}
            </code>
          )
        }
      }}
    />
  )
})

const Renderer = forwardRef((props, ref) =>
(
  <div ref={ref}>
    <MessageRender {...props} />
  </div>
)
)

export const LazyRenderer = (props) => {
  const [isVisible, setIsVisible] = useState(props?.isVisible || false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        console.log('isIntersecting: %o %o', entry, ref.current);
        setIsVisible(true);
        observer.disconnect();
      }
    });

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return isVisible ?
    <Renderer {...props} ref={ref} />
    :
    <Skeleton ref={ref} flex="1" height="10lh" variant="pulse" />;
}