import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { SkeletonText } from "@chakra-ui/react";
import { LuClipboardCheck, LuClipboardCopy } from "react-icons/lu";
import MarkdownHooks from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneLight,
  oneDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { useGlobal } from "./context";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "./style/markdown.less";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";

export const MessageRender = (props) => {
  const { options } = useGlobal();
  const style = options.general.theme === "dark" ? oneDark : oneLight;

  const textRef = useRef(null);

  function CopyIcon(props) {


    const [IconComponent, setIconComponent] = useState<any>(LuClipboardCopy);
    const { t } = useTranslation();

    const handleCopy = async (e) => {
      try {
        console.log("handleCopy: %o", textRef.current.innerText);

        const text = textRef.current.innerText;
        await navigator.clipboard.writeText(text);
        setIconComponent(LuClipboardCheck);
        setTimeout(() => {
          setIconComponent(LuClipboardCopy);
        }, 1500);
      } catch (err) {
        console.error("Failed to copy: ", err);
      }
    };

    return (
      <button className="copy" onClick={handleCopy} type="button" aria-label={t("copy_code") || "Copy code"}>
        <IconComponent />
      </button>
    );
  }

  const rendered = useMemo(
    () => (
      <MarkdownHooks

        remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...rest }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <>
                <div className="code-header">
                  <CopyIcon />
                </div>
                <SyntaxHighlighter
                  ref={textRef}
                  {...rest}
                  style={style}
                  language={match[1]}
                  PreTag="div"
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </>
            ) : (
              <code {...props}>{children}</code>
            );
          },
        }}
      >
        {props.children}
      </MarkdownHooks>
    ),
    [props.children]
  );

  return rendered;
};

type RendererProps = {
  children: React.ReactNode;
};

const Renderer = forwardRef<HTMLDivElement, RendererProps>(
  ({ children, ...props }, ref) => (
    <div ref={ref} className="z-ui-markdown">
      <MessageRender {...props}>{children}</MessageRender>
    </div>
  )
);

type LazyRendererProps = {
  children: any;
  isVisible?: boolean;
};

export const LazyRenderer = (props: LazyRendererProps) => {
  const [isVisible, setIsVisible] = useState(props.isVisible || false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(entry.isIntersecting);
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

  return isVisible ? (
    <Renderer ref={ref}>{props.children}</Renderer>
  ) : (
    <SkeletonText ref={ref} flex="1" noOfLines={10} gap={4} variant="pulse" />
  );
};
