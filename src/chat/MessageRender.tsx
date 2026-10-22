import React, {
  forwardRef,
  useEffect,
  useRef,
  useState,
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
    <>
      {"⟨"}
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
      {"⟩"}
    </>
  );
}

const CITATION_START = "\uE200";
const CITATION_DELIMITER = "\uE202";
const CITATION_STOP = "\uE201";
const MARKDOWN_LINK_PATTERN = String.raw`\[[^\n]*?\]\((?:<[^>\n]+>|(?:\\.|[^()\s])*(?:\([^()\s]*\)(?:\\.|[^()\s])*)*)(?:\s+["'][^"'\n]*["'])?\)`;

function formatCitationLinkMarkers(markdown) {
  if (typeof markdown !== "string") return markdown;

  const wrappedLinksPattern = new RegExp(
    `${CITATION_START}(${MARKDOWN_LINK_PATTERN}(?:${CITATION_DELIMITER}${MARKDOWN_LINK_PATTERN})*)${CITATION_STOP}`,
    "g"
  );
  const wrapped = markdown.replace(wrappedLinksPattern, (_match, links) =>
    links.split(CITATION_DELIMITER).join(" ")
  );
  return wrapped;
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

    if (!source) return [{ type: "text", value: `⟨${linkLabel}⟩` }];

    return [{
      type: "link",
      url: source.href,
      children: [{ type: "text", value: linkLabel }],
    }];
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

        const originalChildren = node.children;
        const children = [];
        originalChildren.forEach((child) => {
          if (child.type === "text" && typeof child.value === "string") {
            children.push(...(transformText(child.value) || [child]));
            return;
          }

          visit(child);
          children.push(child);
        });
        node.children = children;
      }

      visit(tree);
    };
  };
}

function isMarkdownSource(filename = "") {
  return /\.(md|markdown|mdown|mkd|mdx)$/i.test(filename);
}

function CopyIcon({ textRef }) {
  const [Icon, setIcon] = useState(() => LuClipboardCopy);

  const handleCopy = async () => {
    try {
      const text = textRef.current.innerText;
      await navigator.clipboard.writeText(text);
      setIcon(() => LuClipboardCheck);
      setTimeout(() => setIcon(() => LuClipboardCopy), 1500);
    } catch (error) {
      console.error("Failed to copy: ", error);
    }
  };

  return (
    <span className="copy" onClick={handleCopy}>
      <Icon />
    </span>
  );
}

function MarkdownCode({ node: _node, className, children, style, textRef, ...rest }) {
  const match = /language-(\w+)/.exec(className || "");
  if (!match) return <code {...rest}>{children}</code>;

  return (
    <>
      <div className="code-header">
        <CopyIcon textRef={textRef} />
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
  );
}

function MarkdownContent({ children, toolsUsed, onOpenCitation, style, textRef }) {
  return (
    <MarkdownHooks
      children={formatCitationLinkMarkers(children)}
      remarkPlugins={[
        remarkMath,
        remarkGfm,
        remarkBreaks,
        createCitationMarkerPlugin(toolsUsed),
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
            toolsUsed={toolsUsed}
            onOpenCitation={onOpenCitation}
          />
        ),
        code: (codeProps) => (
          <MarkdownCode {...codeProps} style={style} textRef={textRef} />
        ),
      }}
    />
  );
}

function CitationDialogBody({ citation }) {
  const { t } = useTranslation();
  const source = citation?.source;
  if (!source) return <Text>{t("file_search_source_unavailable")}</Text>;

  if (isMarkdownSource(source.filename)) {
    return (
      <Box className="z-ui-markdown" userSelect="text">
        <MessageRender>{source.text}</MessageRender>
      </Box>
    );
  }

  return (
    <Box whiteSpace="pre-wrap" userSelect="text">
      <Text fontSize="sm" color="fg.muted" mb={3}>
        {t("file_search_source_title")}
      </Text>
      {source.text}
    </Box>
  );
}

function CitationDialog({ citation, onClose }) {
  const { t } = useTranslation();
  return (
    <Dialog.Root
      open={Boolean(citation)}
      onOpenChange={(event) => !event.open && onClose()}
      size="xl"
      scrollBehavior="inside"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content data-testid="file-search-citation-dialog">
            <Dialog.Header>
              <Dialog.Title>
                {citation?.source?.filename || t("file_search_source_title")}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" onClick={onClose} />
            </Dialog.CloseTrigger>
            <Dialog.Body>
              <CitationDialogBody citation={citation} />
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export const MessageRender = (props) => {
  const { options } = useGlobal();
  const [citation, setCitation] = useState(null);
  const textRef = useRef(null);
  const style = options.general.theme === "dark" ? oneDark : oneLight;

  return (
    <>
      <MarkdownContent
        {...props}
        onOpenCitation={setCitation}
        style={style}
        textRef={textRef}
      />
      <CitationDialog citation={citation} onClose={() => setCitation(null)} />
    </>
  );
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
