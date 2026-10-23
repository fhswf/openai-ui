# Zero-knowledge group chats

Status: the backend API is implemented in `openai-proxy`. Frontend group
management, event encryption and merge, offline outbox, and live UI integration
remain to be implemented.

## Recommendation

Use the existing encrypted vault as the durable source of truth and use a
WebSocket connection to deliver new encrypted events to online group members.
Reconnects resume from a durable cursor. This removes regular polling while
preserving offline delivery and recovery.

WebSockets are client-to-server, full-duplex connections; they are not peer-to-peer.
WebRTC data channels provide direct peer-to-peer transport between connected
browsers, but still need signaling and ICE connectivity, and do not provide an
offline mailbox. WebTransport is another client-to-server API, not peer-to-peer.
These APIs solve different transport problems:

- [WebSockets Standard](https://html.spec.whatwg.org/multipage/web-sockets.html)
  defines bidirectional communication with server-side processes.
- [WebRTC](https://www.w3.org/TR/webrtc/) defines browser peer-to-peer
  connections and data channels.
- [WebTransport](https://www.w3.org/TR/webtransport/) defines streams and
  datagrams between a browser and a server.

For this app, WebSockets plus persisted encrypted events are the best fit.
True peer-to-peer transport would add connection setup, NAT traversal, relay,
and group fan-out complexity, while still requiring the vault for offline
delivery and history.

## What the current infrastructure provides

- Each chat has a random AES-GCM `K_chat`; the client can wrap it separately
  for each user's public key. The server stores opaque ciphertext and one key
  envelope per recipient. See [zero-knowledge chat design](zero-knowledge-chat.md).
- A user with an envelope can list and download the shared chat. The UI can
  share a chat with one user at a time.
- The backend currently allows only the owner to overwrite a chat or upload
  and delete attachments. The UI restores chats at bootstrap and syncs local
  changes; it has no live remote-update channel.

There is a contract mismatch to resolve: the frontend design document says an
envelope holder may read or change a chat, while the current proxy `PUT`
handler restricts overwrites to the owner. Group writes need an explicit
authorization model in the proxy and matching frontend documentation.

## Group and membership model

### Saved groups

Users create a named roster by selecting people with registered zk keys. A
roster stores stable `userId`s and key fingerprints; display names and the
group name are encrypted. Discovery can use the existing verified-email lookup
where available, or the recipient's manually shared public key. The invitation
flow should show the key fingerprint for verification before sharing.

Treat a saved group as the creator's reusable roster, not as a server-side
group key. Store the creator's group catalog in an encrypted account resource
such as `GET/PUT /api/zk/group-catalog`, so it can be restored on another
device. Creating a group chat snapshots that roster into the chat. Editing the
saved roster must not silently change access to existing chats; changing a
chat's members is an explicit action.

### Group chats

- The creator is the owner and manages membership. Members can post messages.
- Starting a group chat creates a chat ID and random key material, then creates
  a recipient envelope for each member using the existing multi-recipient
  crypto. The server's per-chat recipient records are the access-control list.
- By default, inviting a member grants the chat history. If the product later
  needs “messages from now on” invitations, make that an explicit history
  policy.
- Group names and chat contents remain encrypted. The server necessarily sees
  account IDs, chat IDs, membership, event sizes, and timing so it can authorize
  and route updates.

### Membership changes and key epochs

Use the existing random `K_chat` as the first epoch key, then generate a fresh
random key for each later membership epoch. Each event is encrypted with its
epoch key, and each active member has an envelope for that key. On membership
change, the client advances the epoch and wraps the new key for the remaining
members. A newly invited member receives envelopes for prior epochs only when
the invitation grants history. A removed member receives no envelope for the
new epoch, so they cannot decrypt future events.

Revocation cannot erase messages or keys a removed member already downloaded.
If an active member deliberately exports an old key, the server cannot prevent
them from sharing it. The UI should explain these limits when changing
membership.

## Encrypted event synchronization

Replace whole-transcript writes for collaborative chats with an append-only
event log. A complete transcript snapshot plus a single `baseRev` is vulnerable
to one participant overwriting another's concurrent update.

An event envelope should contain only routing and idempotency fields outside
the ciphertext, for example:

```json
{
  "eventId": "client-generated-uuid",
  "epoch": 3,
  "ciphertext": "...",
  "iv": "..."
}
```

The encrypted event body contains its type and content: message, assistant
response, edit, deletion/tombstone, title change, or attachment reference. Bind
the chat ID, event ID, and epoch as AES-GCM additional authenticated data. The
server adds the authenticated `actorId`, assigns a monotonically increasing
sequence cursor, and stores only ciphertext plus routing metadata. Duplicate
`eventId`s must return the original result rather than creating duplicate
messages.

Recommended endpoints:

- `GET/PUT /api/zk/group-catalog`: read or replace the caller's encrypted
  saved-roster catalog, with an owner envelope and optimistic revision.
- `POST /api/zk/chats/{id}/group`: turn an owner-created chat into a group chat
  by registering its active members and epoch 1 envelopes.
- `GET /api/zk/chats/{id}/group`: read active member IDs and the caller's
  envelopes for granted key epochs.
- `PUT /api/zk/chats/{id}/group/membership`: replace the active member list,
  advance the epoch, and supply a fresh envelope for each active member. A new
  member receives prior-epoch envelopes only when granting history.
- `POST /api/zk/chats/{id}/events`: append one encrypted event. Require current
  membership and the active epoch.
- `GET /api/zk/chats/{id}/events?after={cursor}`: fetch authorized events
  after a cursor, including their sequence and epoch.
- WebSocket at `/api/zk/ws` authenticates the session, authorizes subscriptions,
  and accepts encrypted event submissions through the same idempotent append
  operation as HTTPS, then broadcasts committed events to subscribed members.

Persist an event before broadcasting it. A WebSocket notification is a signal
to fetch or receive the committed event; it is never the only copy. On
reconnect, clients send their last durable cursor and catch up from the event
store over HTTPS or the socket. Keep a local IndexedDB outbox for events created
offline, and retry idempotently when reconnected. Use HTTPS APIs for initial
history and attachment transfer.

For browser authentication, use the existing secure session cookie on the
WebSocket handshake when deployment allows it. If a short-lived socket ticket
is required, obtain it over the authenticated HTTPS API rather than putting a
long-lived bearer token in the WebSocket URL. Validate the request origin,
authorize every subscription and write, enforce message-size limits, and close
or reauthorize connections when membership changes.

The authenticated `actorId` identifies which account submitted an event to the
proxy. It does not prove to another member that the event was authored by that
person if a group member can encrypt arbitrary content. If strong authorship
proof is required, add a separate per-user signing key bound to the user's
identity and sign event envelopes; the existing ECDH key is for key agreement,
not signatures.

## Implementation phases

1. **Set product semantics.** Confirm owner/member permissions, history access
   for new members, removal behavior, and whether message signatures are needed.
2. **Build group creation.** Add a group manager and recipient picker in the
   frontend. Persist a user's saved rosters as encrypted account data. Reuse
   public-key discovery and add key-fingerprint confirmation.
3. **Extend the proxy vault.** Add group membership and epoch records, an
   idempotent encrypted event store, cursor-based reads, and WebSocket
   authentication/subscription/broadcast. Implement both MongoDB and in-memory
   stores. Enforce owner-only membership changes and member-only event writes.
   *(Implemented in the backend.)*
4. **Add client event crypto and sync.** Extend `zeroKnowledgeCrypto.ts` for
   event encryption with authenticated context. Add a WebSocket client with
   reconnect/backoff and cursor catch-up. Persist outgoing events and cursors
   locally; merge events by ID and sequence.
5. **Integrate chat behavior.** Render messages from the merged event stream,
   handle concurrent posts and assistant replies, and make attachments
   available to authorized members. Keep attachment bytes encrypted client-side.
6. **Add membership lifecycle.** Implement invite, remove, epoch rotation, and
   the chosen history policy. Keep existing one-to-one shares working; provide
   an explicit conversion path if existing shared chats should become
   collaborative group chats.

## Main files and repositories

- Frontend crypto and vault sync: `src/chat/utils/zeroKnowledgeCrypto.ts`,
  `src/chat/service/chatVault.ts`, `src/chat/service/zeroKnowledgeSync.ts`, and
  `src/chat/context/index.tsx`.
- Existing share UI: `src/chat/ChatShareDialog.tsx` and
  `src/chat/ChatShareDialogView.tsx`.
- Backend API and storage: `openai-proxy/src/zk/router.ts`,
  `openai-proxy/src/zk/mongoStore.ts`, and `openai-proxy/src/zk/memoryStore.ts`.
