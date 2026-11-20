# Chat Interface UX Action Plan

## Goal

Improve the K!mpuls chat interface hierarchy, message rhythm, status feedback, composer balance, and control accessibility while retaining the current chat features and responsive behavior.

## Work Plan

1. **Constrain the conversation column.** Limit the message list and composer to a readable width of about 48rem. Let message cards fit their content, align assistant and user turns within the same centered column, and preserve responsive media sizing.
2. **Clarify message hierarchy and activity.** Keep the timestamp and compact tool-count disclosure in the message header, without a visible “Response activity” label. Place response duration beside input and output token counts in the message footer. Retain keyboard-accessible detailed tool information, and add an optional header switch for tool-interaction and provided reasoning-summary bubbles below the response text. Show active progress and cancellation beside the current assistant turn.
3. **Organize the composer.** Place model and editor settings in a distinct settings row. Keep upload, voice, clear, and send actions together, with send as the primary action and clear as an accessible icon-only secondary action.
4. **Strengthen navigation and contrast.** Distinguish the desktop sidebar's primary and utility groups, visually group header actions, and ensure controls have clear hover and keyboard-focus states in both themes.

## Acceptance Criteria

- Desktop messages remain within a centered column no wider than about 768px; user messages do not occupy large empty cards.
- The timestamp and compact tool-count disclosure remain in the message header without a visible “Response activity” label; response duration appears beside token counts in the footer.
- Assistant messages can optionally show important tool interactions and provided reasoning summaries as bubbles; hidden reasoning is never exposed.
- Tool details remain discoverable and keyboard operable; active response status and cancel action appear with the conversation.
- The composer has one visually primary send action, and all secondary controls retain accessible names and usable hit areas on mobile.
- Icon controls meet at least 3:1 non-text contrast, normal text meets 4.5:1 contrast, and focus is visible in light and dark themes.
- Header and sidebar actions remain reachable at narrow viewport widths.

## Implementation Touchpoints

- Message rendering and activity disclosure: `src/chat/ChatMessage.tsx`, `src/chat/component/ToolUsagePopup.tsx`, and `src/chat/tours/FeatureTourProvider.tsx`.
- Message and composer layout: `src/chat/style.less`, `src/chat/style/message.module.less`, and `src/chat/MessageInput.tsx`.
- Sidebar and header control grouping: `src/chat/ChatSideBarOverlays.tsx`, `src/chat/ChatSideBarOptions.tsx`, and `src/chat/style/sider.module.less` / `src/chat/style/chat.module.less`.
- English and German labels: `src/i18n/config.ts`.
