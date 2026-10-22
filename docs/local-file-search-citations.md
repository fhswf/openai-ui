# Local document search citations

## Design

The local vector-store search API returns a filename and the matching text
chunk, but it does not return a public URL or a stable chunk identifier. A
filename-only citation therefore cannot identify which passage supported an
answer. Each result is instead addressed by its local search tool-call ID and
its one-based position in that call's relevance-sorted results.

The Markdown destination format is:

```text
#file-search/<encoded-tool-call-id>/<result-number>
```

For example, a citation can look like:

```markdown
[course-notes.pdf](#file-search/fs_local_call_abc123/2)
```

The destination is a chat-local permalink. In the chat UI, clicking it opens a
dialog with the exact text chunk returned for that result. Markdown source
files render as Markdown in the dialog; other source types render as plain
text. OpenAI citation wrapper markers around Markdown links are removed while
rendering. The renderer also recognizes structured OpenAI citation markers of
the form `\uE200cite\uE202turn0url1\uE202L8-L13\uE201`. Resolved web and
document citations are shown as clickable source labels inside `⟨...⟩`
brackets; line locators appear beside the label. A marker whose source is
unavailable remains visible as a bracketed source ID. The model receives this
complete Markdown link in each result's `markdown_citation` field and is
instructed to copy it for each excerpt used.
The tool-usage display keeps its short preview, while `source_text` retains the
complete passage for citation links after the chat is saved and reopened.

## Data flow

1. Local search sorts all results by score and selects at most eight.
2. It creates a citation destination from the local tool-call ID and the
   selected result's one-based position.
3. The function output gives the model the destination as `markdown_citation`
   alongside the filename and full text.
4. The chat renderer recognizes `#file-search/.../...`, resolves the matching
   `file_search_call` in that assistant message's `toolsUsed`, and displays
   `source_text`.

The citation result is scoped to one tool call. If a chat history contains a
citation but no longer contains its matching search result, the UI reports
that the excerpt is unavailable. Older entries that only have the former
short preview can still open that preview.

## Scope

These are not links to a path on the user's computer or to a vector-store API
endpoint. The service does not expose original file locations, page numbers,
or chunk offsets. The link identifies the precise text chunk returned by that
search call, which is the evidence supplied to the model. It only resolves in
the chat UI where that search call is retained.
