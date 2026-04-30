import test from "node:test";
import assert from "node:assert/strict";

import { createConsoleProductMock } from "./console-product-mock.js";
import { renderConsoleProductHomePage } from "./console-product-renderer.js";

test("product renderer emits required fake-data mobile console shell", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  for (const marker of [
    "console-mobile-shell",
    "console-project-drawer",
    "console-project-row",
    "console-project-action-archive",
    "console-project-action-new-session",
    "console-session-child",
    "console-chat-timeline",
    "console-command-bar",
    "console-model-selector",
    "console-mode-selector",
    "console-run-card",
    "console-diff-card",
    "console-approval-card",
    "console-composer"
  ]) {
    assert.match(html, new RegExp(escapeRegExp(marker)), `missing marker ${marker}: ${html}`);
  }
});

test("product renderer shows required projects, sessions, controls, and cards", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  for (const copy of [
    "acme/web",
    "acme/api",
    "acme/infra",
    "Refactor auth middleware",
    "Fix CI flaky test",
    "Add UI prototype",
    "GPT-5.5 xhigh",
    "Auto",
    "Ask",
    "/code",
    "/review",
    "/test",
    "/deploy",
    "/explain",
    "Online",
    "Running",
    "Message Codex or type /",
    "src/web/App.tsx",
    "Approval required",
    "Run tests",
    "Modify config",
    "Review diff",
    "Open files",
    "Approve",
    "Approve all",
    "Cancel"
  ]) {
    assert.match(html, new RegExp(escapeRegExp(copy)), `missing required content ${copy}: ${html}`);
  }

  assert.match(html, /class="console-project-row"[\s\S]*?acme\/web[\s\S]*?class="console-project-action-archive"[\s\S]*?Archive[\s\S]*?class="console-project-action-new-session"[\s\S]*?\+ New/);
  assert.match(html, /class="console-project-row"[\s\S]*?acme\/api[\s\S]*?class="console-project-action-archive"[\s\S]*?Archive[\s\S]*?class="console-project-action-new-session"[\s\S]*?\+ New/);
  assert.match(html, /class="console-project-row"[\s\S]*?acme\/infra[\s\S]*?class="console-project-action-archive"[\s\S]*?Archive[\s\S]*?class="console-project-action-new-session"[\s\S]*?\+ New/);
  assert.match(html, /class="console-project-action-archive"[^>]*aria-label="Archive acme\/web"[^>]*>Archive<\/button>/);
  assert.match(html, /class="console-project-action-new-session"[^>]*aria-label="Create new session in acme\/web"[^>]*>\+ New<\/button>/);
  assert.match(html, /[-+]\s+(const|if)/, `missing diff-like lines: ${html}`);
});

test("product renderer does not render old bottom tab navigation labels", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  assert.doesNotMatch(html, /bottom[^<]{0,40}tab/i);
  for (const label of ["Chat", "Files", "Status"]) {
    assert.doesNotMatch(html, new RegExp(`>${label}<`), `rendered bottom-tab-like label ${label}: ${html}`);
  }
  assert.doesNotMatch(html, /class="[^"]*bottom[^"]*"/i);
  assert.doesNotMatch(html, /class="[^"]*tab[^"]*"/i);
});

test("product renderer CSS makes the project drawer a mobile overlay", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-app-frame \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-project-drawer \{[\s\S]*?position: fixed;[\s\S]*?left: 14px;[\s\S]*?width: min\(340px, calc\(100vw - 28px\)\);[\s\S]*?max-width: calc\(100vw - 28px\);[\s\S]*?transform: translateX\(calc\(-100% - 28px\)\);/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?#console-drawer-toggle:checked ~ \.console-app-frame \.console-project-drawer \{[\s\S]*?transform: translateX\(0\);/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-drawer-scrim \{[\s\S]*?position: fixed;[\s\S]*?inset: 0;/);
});

test("product renderer CSS keeps mobile drawer project actions readable and tappable", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  assert.match(html, /\.console-project-title-block \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;/);
  assert.match(html, /\.console-project-copy \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;/);
  assert.match(html, /\.console-project-actions button \{[\s\S]*?white-space: nowrap;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-project-row \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-project-actions \{[\s\S]*?justify-content: flex-end;/);
});

test("product renderer CSS keeps the mobile composer in flow below scrollable content", () => {
  const html = renderConsoleProductHomePage(createConsoleProductMock());

  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-mobile-shell \{[\s\S]*?height: 100dvh;[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);[\s\S]*?overflow: hidden;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-workspace \{[\s\S]*?display: grid;[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\) auto;[\s\S]*?overflow: hidden;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-chat-timeline \{[\s\S]*?min-height: 0;[\s\S]*?overflow-y: auto;/);
  assert.match(html, /@media \(max-width: 720px\)[\s\S]*?\.console-composer \{[\s\S]*?position: static;[\s\S]*?border-radius: 22px;/);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
