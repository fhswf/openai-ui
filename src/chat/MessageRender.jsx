import React, { memo, forwardRef, useEffect, useRef, useState } from 'react'
import { Skeleton } from '@chakra-ui/react'
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


export const MessageRender = memo((props) => {
  const { options } = useGlobal()
  const style = options.general.theme === 'dark' ? oneDark : oneLight

  return (
    <MarkdownHooks
    
      children={props.children}
      remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ node, inline, className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className || '')
          return !inline && match ? (
            <SyntaxHighlighter
              {...rest}
              children={children}
              style={style}
              language={match[1]}
              PreTag="div"
            />
          ) : (
            <code {...props}>
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
  <div ref={ref} className='z-ui-markdown'>
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