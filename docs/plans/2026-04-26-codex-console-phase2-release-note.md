# Codex Console Phase 2 Release Note

Status: ready for PR
Branch: `feat/codex-console-phase2`
Base: `master`

## Summary

This change continues the Codex Console platform-abstraction landing after the initial naming and capability-matrix work.

It keeps all compatibility identifiers unchanged:

- repository/package name remains `telegram-codex-bridge`
- CLI remains `ctb`
- existing service/config/state path names remain unchanged
- Telegram remains the stable first/default pack
- Feishu remains a serious current pack with explicit setup/readiness caveats

## Commits

1. `79bcb1d docs: clarify Codex Console install paths`
   - Splits README install guidance into Telegram default path and Feishu pack path.
   - Adds Feishu direct install examples using `--pack feishu` and `--pack-option`.
   - Updates operations docs and product scope wording so Feishu is current but not treated as identical to Telegram UX.

2. `a024753 docs: audit Feishu capability against official APIs`
   - Adds an official Feishu developer-doc-backed capability audit.
   - Covers long connection/events, text receive, cards, card callbacks, image/file upload and download, long-output risks, status cards, session/project flows, and bot-menu limits.
   - Separates confirmed API+code support from items needing live tenant smoke.

3. `0667c6f refactor: clarify Feishu pack transport metadata`
   - Updates Feishu pack metadata from compatibility-shaped labels to actual current behavior:
     - ingress: `long_connection`
     - egress: `open_api`
   - Adds tests for the metadata and updates docs caveats.
   - Keeps broader compatibility-adapter caveats intact.

4. `29e1593 docs: sketch Web App control surface`
   - Adds a future Web/App control surface sketch.
   - Defines Core reuse targets, Pack/Presentation responsibilities, readiness gates, migration lessons, open decisions, and sequencing.
   - Explicitly does not claim current Web/App support.

## User-visible impact

- Codex Console docs are less Telegram-only while preserving Telegram as the default path.
- Feishu setup and capability boundaries are easier to discover.
- Feishu official API evidence is captured for future smoke testing.
- The most obvious Feishu pack metadata mismatch is fixed and tested.
- Web/App planning now has a concrete document that avoids forcing Web/App into a fake chat-pack shape.

## Known remaining gaps

- No live Feishu tenant smoke was performed in this change set.
- Feishu pin/unpin remains non-native.
- Feishu bot-menu discovery remains externally configured and smaller than Telegram command sync.
- Feishu voice/audio and remote image URL support remain unsupported by current pack capabilities.
- Web/App remains future design only.

## Verification

Run from the branch worktree:

```bash
git diff --check
node --import tsx --test src/packs/feishu/index.test.ts src/packs/registry.test.ts
npm run check
npm test
```

Expected result: all pass.
