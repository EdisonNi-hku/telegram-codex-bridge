# Feishu Official Capability Audit

## Verdict

Feishu is a serious current Codex Console pack with official Feishu/Lark API support for the core READ/WRITE-DOCS smoke path: long-connection event ingress, text/card message send, card callbacks with toast response, message-resource download for user images/files, and image/file upload plus send. The current implementation maps those official capabilities through Feishu long-connection/OpenAPI compatibility adapters and shared Codex Bridge Core service paths.

No live Feishu tenant smoke was run in this audit. Treat code/API-matched rows as implementation-confirmed, not production-observed. The main risks are setup-dependent: bot ability, published permissions/scopes, long-connection event subscription, `card.action.trigger` callback subscription, Feishu message/card size limits, and the remaining Telegram-shaped compatibility shell.

## Official documentation retrieval

Feishu Developer Docs MCP was available and returned official Feishu Open Platform documentation. Source URLs below are MCP-returned official `go.feishu.cn` short links unless otherwise noted.

Key official sources used:

- Event overview: https://go.feishu.cn/s/5_sDxkQ3802
- Long connection/WebSocket event receiving: https://go.feishu.cn/s/626tU7DxM0s
- Receive events: https://go.feishu.cn/s/626tU7DxI0s
- Message overview/API list: https://go.feishu.cn/s/65wgBAU2801
- Receive message event (`im.message.receive_v1`): https://go.feishu.cn/s/61BYfeQR80s
- Get message resource file: https://go.feishu.cn/s/61BYfgpwQ01
- Reply/send message constraints: https://go.feishu.cn/s/61BYfeQRw0s
- Interactive card bot tutorial/callback sample: https://go.feishu.cn/s/6t-7Zt6lg04
- Handle card callbacks: https://go.feishu.cn/s/6wrmRAExU04
- Card JSON 2.0 structure: https://go.feishu.cn/s/6qEkCDfEk03
- Card entity full update: https://go.feishu.cn/s/6qEkCDfEU03
- Card entity settings patch: https://go.feishu.cn/s/6qEkCDfEE03

## Official API facts relevant to smoke tests

- Event subscription supports two modes: long connection via Feishu SDK WebSocket and webhook. Long connection is recommended for enterprise self-built apps, requires outbound public network access, and does not require separate event decryption/signature handling in the handler path.
- Long connection constraints: enterprise self-built apps only, handler must complete within 3 seconds, max 50 connections per app, cluster mode is not broadcast and randomly delivers to one connected client.
- Event push is at-least-once; docs recommend idempotency. For receive-message events, docs specifically warn duplicate pushes may happen and recommend `message_id` dedupe rather than relying on `event_id`.
- `im.message.receive_v1` exposes `message_type` and serialized JSON `content`; docs point content shape to receive-message content docs and list text/post/image/file as supported message resources through the message APIs.
- `GET /open-apis/im/v1/messages/:message_id/resources/:file_key` downloads user-sent message resources including images and files. It requires `type=image|file`, the bot must be in the conversation, the resource must match the message, and only resources up to 100 MB are supported.
- Sending messages uses `POST /open-apis/im/v1/messages`; official overview lists text, post/rich text, image, file, and interactive card support. Image/file sends require prior upload to obtain image/file keys.
- Uploading images uses `POST /open-apis/im/v1/images`; uploading files uses `POST /open-apis/im/v1/files`; the overview lists `im:resource` / upload-resource permission for these upload APIs.
- Message/card constraints relevant to long output: text request body max 150 KB; rich text and card request bodies max 30 KB; cards using templates count template size too; Feishu may reject oversized content with error 230025. Message resources download max is 100 MB.
- Interactive cards can be sent as `msg_type=interactive`; current-app card messages can be updated with `PATCH /open-apis/im/v1/messages/:message_id`; delayed card update uses `POST /open-apis/interactive/v1/card/update` after callback response.
- Card callback docs recommend subscribing to `card.action.trigger`; callback service must respond within 3 seconds with HTTP 200. Response can be empty, toast-only, or include a replacement card. Callback interaction validity is 30 days; card update validity is 14 days; delayed-update token is valid 30 minutes and supports at most two updates.
- Card JSON 2.0 supports markdown elements, streaming-mode settings, and shared-card `update_multi=true`; JSON 2.0 cards support up to 200 elements/components, and some CardKit update APIs enforce 30 KB card content and strictly increasing sequence numbers.

## Smoke-test matrix

| Capability | Official API/doc evidence | Current implementation path | Smoke test | Expected result | Gap/Risk | Verdict |
|---|---|---|---|---|---|---|
| Text input | `im.message.receive_v1` receive-message event exposes `message_type`, serialized `content`, sender, chat, and message IDs. Long connection can subscribe via WebSocket SDK. Sources: receive message, long connection. | `src/feishu/poller.ts` registers `im.message.receive_v1`, parses `text` content, translates to Telegram-like update; `src/service.ts` records Feishu text ingress and routes normal text. | Send a plain text task to the Feishu bot in a p2p chat after setup. | Bridge records text ingress, authorizes sender, and starts/routes a normal Codex turn. | Requires bot ability, receive-message event subscription, p2p message permission, published app version, and no competing long-connection client consuming events. | Confirmed (API + code); needs live smoke for tenant setup. |
| Card/status/welcome rendering | Official messages support `msg_type=interactive`; Feishu card docs support JSON 2.0 markdown/card content. Sources: message overview, card JSON 2.0. | `src/feishu/api.ts` sends interactive messages when HTML/markup is present; `src/feishu/card-renderer.ts` builds JSON 2.0 cards; `src/feishu/ui.ts` builds welcome/status content; `src/service.ts` sends Feishu welcome/setup/status surfaces. | Enter bot p2p chat or trigger setup/status menu. | Feishu receives a card with welcome/status text and actions. | Card body size limit is 30 KB; card JSON/rendering must stay valid; setup readiness must permit interactive send. | Confirmed (API + code); needs live smoke for exact client rendering. |
| Card callback/action trigger | Official card callback handling documents `card.action.trigger`, 3-second response, toast/card response, and long-connection callback subscription. Source: handle card callbacks; card bot tutorial. | `src/feishu/card-renderer.ts` emits callback behaviors with `callback_data`; `src/feishu/poller.ts` registers `card.action.trigger`, extracts callback data, returns toast, and enqueues callback query; `src/packs/feishu/setup.ts` tracks observed card callback readiness. | Click a Feishu card button such as Status/Inspect/Interrupt. | Feishu client shows toast; bridge receives callback and routes the associated action. | Requires callback subscription, long connection callback mode or valid callback endpoint, app publish, and callback handler under 3 seconds. Duplicate/old callbacks need stale handling in shared router. | Confirmed (API + code); needs live smoke. |
| File receive | Official message-resource download supports files from a message using `GET /im/v1/messages/:message_id/resources/:file_key?type=file`, up to 100 MB. Receive-message event carries message ID and content/resource keys. Sources: receive message, get message resource file. | `src/feishu/poller.ts` parses `message_type=file` and emits bridge media with `resourceType=file`; `src/service/media-ingress.ts` calls `downloadMessageResource`; `src/feishu/api.ts` wraps `client.im.v1.messageResource.get`. | Send a small file to the bot with optional caption/text. | Bridge downloads the file to cache and passes an inbound media event to rich input handling. | Requires message-resource permission (`im:message`/readonly/history), bot in conversation, resource <=100 MB, and unsupported restricted/external cases may fail. | Confirmed (API + code); needs live smoke for permission set. |
| Image receive | Official message-resource download supports images from messages using `type=image`, up to 100 MB. Receive-message content includes image resource key by message type. Sources: receive message, get message resource file. | `src/feishu/poller.ts` parses `message_type=image` and post images into bridge media; `src/service/media-ingress.ts` resolves Feishu resources; `src/feishu/api.ts` downloads message resources. | Send an image to the bot. | Bridge downloads the image to cache and passes it as image input. | Same resource-download risks as files; current code does not claim voice/audio support. | Confirmed (API + code); needs live smoke. |
| File send | Official message API supports sending `file` messages after `POST /im/v1/files` upload; upload requires resource upload permission and message send requires bot/message permission. Sources: message overview, reply/send constraints. | `src/feishu/api.ts` uploads via `client.im.v1.file.create`, sends `msg_type=file`; `src/packs/feishu/index.ts` declares `send_feishu_file` dynamic tool and probes file upload scopes; `src/packs/feishu/egress-adapter.ts` exposes `sendDocument`. | Use the `send_feishu_file` dynamic tool or trigger a file fallback path. | Feishu receives a file message; optional caption is sent as a separate supplementary message. | Requires `im:resource` upload scope, message send scope, bot ability, file type mapping accepted by Feishu, and live tenant upload probe success. | Confirmed (API + code); needs live smoke. |
| Image send | Official message API supports sending `image` messages after image upload; upload supports common image formats and requires resource upload permission. Sources: message overview, upload image API listing. | `src/feishu/api.ts` uploads via `client.im.v1.image.create` with `image_type=message`, sends `msg_type=image`; `src/packs/feishu/index.ts` declares `send_feishu_image` and probes image upload scopes; `src/packs/feishu/egress-adapter.ts` exposes `sendPhoto`. | Use the `send_feishu_image` dynamic tool with a PNG/JPEG. | Feishu receives an image message; optional caption is sent separately. | Requires `im:resource` scope and send scope; remote image URLs are not supported by current pack. | Confirmed (API + code); needs live smoke. |
| Long output / long final answer | Official constraints: text body max 150 KB; rich text/card max 30 KB; card JSON 2.0 up to 200 elements; message-resource max 100 MB. Sources: reply/send constraints, card JSON 2.0, CardKit update docs. | Pack declares long-form pagination; Feishu API sends text or interactive cards; card renderer uses markdown sections. Matrix already marks final answers as adapted, not native parity. | Produce a final answer larger than one card/message and verify pagination/splitting/file fallback behavior. | User should receive complete answer without silent truncation, through pages/split messages or fallback artifact/file. | Biggest current risk: Feishu card 30 KB cap and 200-component cap can reject dense runtime/final cards; no live evidence in this audit that every long-final path stays below limits. | Likely but needs live smoke. |
| Runtime status card / inspect detail | Official interactive cards support buttons/callbacks and updates; message patch can update app-sent card messages. Sources: message overview, handle card callbacks, card update docs. | `src/feishu/ui.ts` builds status/inspect/interrupt buttons; `src/feishu/card-renderer.ts` renders them; `src/feishu/api.ts` patches card messages or falls back to send/delete; `src/service.ts` sends setup/status surfaces. | Start a turn, open status, click Inspect, and observe runtime card updates. | Status card renders and actions route; card edits update or fallback to replacement message. | Runtime surface is adapted through Telegram-compatible IDs and message refs; patch failures can create replacement messages; live Feishu UX density needs checking. | Likely but needs live smoke. |
| Session switching/project picker | Official card callbacks provide enough primitive support for button-driven pickers. Source: handle card callbacks. | `src/feishu/card-renderer.ts` maps Telegram-style inline keyboards into Feishu buttons/overflow; `src/feishu/poller.ts` translates callbacks; `src/feishu/ui.ts` exposes sessions/status/new buttons. | Open Sessions/Project picker and select a session/project from Feishu cards. | Shared service receives callback data and switches context as in the adapted control surface. | Product flow is still Telegram-shaped; Feishu can carry callbacks, but exact picker ergonomics and overflow behavior need live smoke. | Likely but needs live smoke. |
| Bot menu/native command discovery | Official card-interaction tutorial uses `application.bot.menu_v6` with menu `event_key`; message overview also notes bot ability. Source: card interaction bot tutorial. | `src/feishu/poller.ts` registers `application.bot.menu_v6`; `src/feishu/ui.ts` maps native menu keys for `new`, `status`, `sessions`, `help`; `src/service.ts` routes those commands. `src/feishu/api.ts#setMyCommands` is intentionally no-op. | Configure Feishu bot menu entries with the expected event keys and click each entry. | Menu click routes to New, Status, Sessions, or Help. | Requires manual/admin Feishu bot menu configuration and publish; no automatic command sync equivalent to Telegram. Native discovery is smaller than Telegram. | Confirmed but limited; needs live smoke for menu config. |

## Confirmed

These are confirmed by official docs plus current code paths, but not by live tenant smoke in this audit:

- Long-connection event ingress is an official Feishu SDK/WebSocket mode, and the current Feishu poller uses `Lark.WSClient` with `im.message.receive_v1`, p2p chat-entered, bot-menu, and `card.action.trigger` handlers.
- Text input, image/file receive descriptors, and image/file message-resource download have matching official APIs and implementation paths.
- Text/card send, card patch/fallback, image upload/send, and file upload/send have matching official APIs and implementation paths.
- Card callback toast response is supported by official docs and implemented by the Feishu poller.
- Feishu setup health tracks credentials, token validation, authorization binding, text ingress observation, interactive card delivery, callback observation, and upload-scope probes.

## Likely but needs live smoke

These should work given the primitives but require live Feishu client/tenant observation:

- Long final answers and dense runtime cards, because Feishu card/rich text limits are materially lower than arbitrary Codex output.
- Runtime status/inspect detail and project/session picker UX, because the implementation adapts Telegram-style callbacks/buttons into Feishu cards and overflow controls.
- Bot menu/native discovery, because current code handles menu events but Feishu menu entries must be configured in the developer/admin console.
- Callback/update timing under load, because Feishu requires the callback response path to complete within 3 seconds.

## Current gap

- Native pin/unpin is not implemented for Feishu; the compatibility API returns success without calling a native Feishu pin API. Existing matrix wording already warns not to treat this as native.
- Feishu command/menu discovery has no automatic `setMyCommands` equivalent; `src/feishu/api.ts#setMyCommands` is a no-op, so native menu setup remains external.
- Feishu voice/audio input is not supported by the pack capability snapshot.
- Remote image URL input/output is not supported by the current pack.

## Doc/API unknown

- This audit did not retrieve a dedicated official Feishu page for every receive-message content subtype (`text`, `post`, `image`, `file`) beyond the receive-message event and message overview/resource API pages. The available official pages were sufficient to verify the event shape, message resource download, and send/upload APIs used by current code.
- No official live tenant logs, Feishu event logs, or Codex Console runtime logs were reviewed, so observed success remains unknown.

## Matrix/boundary doc impact

No changes were made to the platform capability matrix or platform pack boundary docs in this audit. Their current Feishu caveats already match the evidence found here: Feishu is a current serious pack, it uses long-connection/OpenAPI compatibility adapters, upload/callback readiness is setup-dependent, rich runtime/session UX is adapted, and pin/unpin is not native.
