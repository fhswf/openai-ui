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
import {
  fileSearchCitationHref,
  findFileSearchCitation,
} from "./utils/fileSearch";

function CitationAnchor({
  href,
  children,
  toolsUsed,
  onOpenCitation,
  ...rest
}) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        if (!href?.startsWith("#file-search/")) return;
        event.preventDefault();
        const source = findFileSearchCitation(href, toolsUsed || []);
        onOpenCitation(source ? { source } : { unavailable: true });
      }}
    >
      {children}
    </a>
  );
}

function stripCitationLinkMarkers(markdown) {
  return typeof markdown === "string"
    ? markdown.replace(
        /\uE200(\[[^\n]*?\]\((?:<[^>\n]+>|(?:\\.|[^()\s])*(?:\([^()\s]*\)(?:\\.|[^()\s])*)*)(?:\s+["'][^"'\n]*["'])?\))\uE201/g,
        "$1"
      )
    : markdown;
}

function citationSourceMap(toolsUsed = []) {
  const urls = [];
  const files = [];

  for (const value of toolsUsed) {
    const tool = value as any;
    if (tool?.type === "web_search_call") {
      const searchSources = Array.isArray(tool.action?.sources)
        ? tool.action.sources
        : [];
      for (const source of searchSources) {
        try {
          const url = new URL(source.url);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
          urls.push({
            href: url.href,
            label: url.hostname.replace(/^www\./, ""),
          });
        } catch {
          // Ignore malformed source URLs.
        }
      }
    }

    if (tool?.type === "file_search_call" && Array.isArray(tool.results)) {
      tool.results.forEach((result, index) => {
        if (!tool.id) return;
        files.push({
          href: fileSearchCitationHref(tool.id, index + 1),
          label: result.filename || result.file_id || `Source ${index + 1}`,
        });
      });
    }
  }

  return { urls, files };
}

function createCitationMarkerPlugin(toolsUsed) {
  const sources = citationSourceMap(toolsUsed);
  const citationPattern =
    /\uE200cite\uE202(turn\d+(?:url|file|block)\d+)(?:\uE202(L\d+(?:-L\d+)?))?\uE201/g;

  function renderCitation(sourceId, locator) {
    const match = /^turn\d+(url|file|block)(\d+)$/.exec(sourceId);
    const source = match
      ? (match[1] === "url" ? sources.urls : sources.files)[
          Number(match[2]) - 1
        ]
      : undefined;
    const label = source?.label || sourceId;
    const linkLabel = locator ? `${label} · ${locator}` : label;

    if (!source) {
      return [{ type: "text", value: `⟨${linkLabel}⟩` }];
    }

    return [
      { type: "text", value: "⟨" },
      {
        type: "link",
        url: source.href,
        children: [{ type: "text", value: linkLabel }],
      },
      { type: "text", value: "⟩" },
    ];
  }

  function transformText(value) {
    const nodes = [];
    let cursor = 0;
    let match;
    citationPattern.lastIndex = 0;

    while ((match = citationPattern.exec(value))) {
      if (match.index > cursor) {
        nodes.push({ type: "text", value: value.slice(cursor, match.index) });
      }
      nodes.push(...renderCitation(match[1], match[2]));
      cursor = citationPattern.lastIndex;
    }

    if (cursor === 0) return undefined;
    if (cursor < value.length) {
      nodes.push({ type: "text", value: value.slice(cursor) });
    }
    return nodes;
  }

  return function remarkCitationMarkers() {
    return function transformCitationMarkers(tree) {
      function visit(node) {
        if (
          !Array.isArray(node.children) ||
          ["link", "inlineCode", "code", "html"].includes(node.type)
        ) {
          return;
        }

        node.children = node.children.flatMap((child) => {
          if (child.type === "text" && typeof child.value === "string") {
            return transformText(child.value) || [child];
          }
          visit(child);
          return [child];
        });
      }

      visit(tree);
    };
  };
}

function isMarkdownSource(filename = "") {
  return /\.(md|markdown|mdown|mkd|mdx)$/i.test(filename);
}

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
          children={stripCitationLinkMarkers(props.children)}
          remarkPlugins={[
            remarkMath,
            remarkGfm,
            remarkBreaks,
            createCitationMarkerPlugin(props.toolsUsed),
          ]}
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
            a: (anchorProps) => (
              <CitationAnchor
                {...anchorProps}
                toolsUsed={props.toolsUsed}
                onOpenCitation={setCitationDialog}
              />
            ),
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
                    isMarkdownSource(citationDialog.source.filename) ? (
                      <Box className="z-ui-markdown" userSelect="text">
                        <MessageRender>
                          {citationDialog.source.text}
                        </MessageRender>
                      </Box>
                    ) : (
                      <Box whiteSpace="pre-wrap" userSelect="text">
                        <Text fontSize="sm" color="fg.muted" mb={3}>
                          {t("file_search_source_title")}
                        </Text>
                        {citationDialog.source.text}
                      </Box>
                    )
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
