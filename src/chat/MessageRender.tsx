import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  Box,
  CloseButton,
  Dialog,
  Portal,
  Skeleton,
  SkeletonText,
  Text,
} from "@chakra-ui/react";
import { LuClipboardCheck } from "react-icons/lu";
import { LuClipboardCopy } from "react-icons/lu";
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
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "./style/markdown.less";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";
import { findFileSearchCitation } from "./utils/fileSearch";

export const MessageRender = (props) => {
  const { options } = useGlobal();
  const { t } = useTranslation();
  const style = options.general.theme === "dark" ? oneDark : oneLight;
  const [citationDialog, setCitationDialog] = useState(null);

  const textRef = useRef(null);

  function CopyIcon() {
    const [Icon, setIcon] = useState(() => LuClipboardCopy);

    const handleCopy = async (e) => {
      try {
        console.log("handleCopy: %o", textRef.current.innerText);

        const text = textRef.current.innerText;
        await navigator.clipboard.writeText(text);
        setIcon(() => LuClipboardCheck);
        setTimeout(() => {
          setIcon(() => LuClipboardCopy);
        }, 1500);
      } catch (err) {
        console.error("Failed to copy: ", err);
      }
    };

    return (
      <span className="copy" onClick={handleCopy}>
        <Icon />
      </span>
    );
  }

  const rendered = useMemo(
    () => (
      <>
        <MarkdownHooks
          children={props.children}
          remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
          rehypePlugins={[
            rehypeRaw,
            [
              rehypeSanitize,
              {
                ...defaultSchema,
                attributes: {
                  ...defaultSchema.attributes,
                  code: [
                    ...(defaultSchema.attributes?.code || []),
                    ["className", /^language-./, "math-inline", "math-display"],
                  ],
                },
              },
            ],
            rehypeKatex,
          ]}
          components={{
            a({ href, children, ...rest }) {
              const localCitation = href?.startsWith("#file-search/");
              return (
                <a
                  href={href}
                  {...rest}
                  onClick={(event) => {
                    if (!localCitation) return;
                    event.preventDefault();
                    const source = findFileSearchCitation(
                      href,
                      props.toolsUsed || []
                    );
                    setCitationDialog(
                      source
                        ? { source }
                        : { unavailable: true }
                    );
                  }}
                >
                  {children}
                </a>
              );
            },
            code({ node, className, children, ...rest }) {
              const match = /language-(\w+)/.exec(className || "");
              return match ? (
                <>
                  <div className="code-header">
                    <CopyIcon />
                  </div>
                  <SyntaxHighlighter
                    ref={textRef}
                    {...rest}
                    children={children}
                    style={style}
                    language={match[1]}
                    PreTag="div"
                  />
                </>
              ) : (
                <code {...rest}>{children}</code>
              );
            },
          }}
        />
        <Dialog.Root
          open={Boolean(citationDialog)}
          onOpenChange={(event) => !event.open && setCitationDialog(null)}
          size="xl"
          scrollBehavior="inside"
        >
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content data-testid="file-search-citation-dialog">
                <Dialog.Header>
                  <Dialog.Title>
                    {citationDialog?.source?.filename || t("file_search_source_title")}
                  </Dialog.Title>
                </Dialog.Header>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" onClick={() => setCitationDialog(null)} />
                </Dialog.CloseTrigger>
                <Dialog.Body>
                  {citationDialog?.source ? (
                    <Box whiteSpace="pre-wrap" userSelect="text">
                      <Text fontSize="sm" color="fg.muted" mb={3}>
                        {t("file_search_source_title")}
                      </Text>
                      {citationDialog.source.text}
                    </Box>
                  ) : (
                    <Text>{t("file_search_source_unavailable")}</Text>
                  )}
                </Dialog.Body>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
      </>
    ),
    [props.children, props.toolsUsed, style, citationDialog, t]
  );

  return rendered;
};

type RendererProps = {
  children: React.ReactNode;
  toolsUsed?: unknown[];
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
  toolsUsed?: unknown[];
};

export const LazyRenderer = (props: LazyRendererProps) => {
  const [isVisible, setIsVisible] = useState(Boolean(props.isVisible));
  const ref = useRef(null);

  useEffect(() => {
    if (props.isVisible) {
      setIsVisible(true);
    }
  }, [props.isVisible]);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    if (typeof IntersectionObserver !== "function") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        //console.log('isIntersecting: %o %o', entry, ref.current);
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
  }, [isVisible]);

  return isVisible ? (
    <Renderer ref={ref} toolsUsed={props.toolsUsed}>
      {props.children}
    </Renderer>
  ) : (
    <SkeletonText ref={ref} flex="1" noOfLines={10} gap={4} variant="pulse" />
  );
};
