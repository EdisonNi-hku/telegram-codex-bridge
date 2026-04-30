import type {
  ConsoleProductAppModel,
  ConsoleProductApprovalCard,
  ConsoleProductDiffCard,
  ConsoleProductProject,
  ConsoleProductRunCard,
  ConsoleProductTimelineItem
} from "./console-product-model.js";
import { createConsoleProductMock } from "./console-product-mock.js";

export function renderConsoleProductHomePage(
  model: ConsoleProductAppModel | undefined = createConsoleProductMock(),
  css = CONSOLE_PRODUCT_CSS
): string {
  model ??= createConsoleProductMock();
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(model.title)} · Product Prototype</title>`,
    `<style>\n${css}\n</style>`,
    "</head>",
    "<body class=\"console-product-body\">",
    renderShell(model),
    "</body>",
    "</html>"
  ].join("\n");
}

function renderShell(model: ConsoleProductAppModel): string {
  return `<main class="console-mobile-shell" aria-label="Codex Console fake-data product prototype">
  <header class="console-topbar" aria-label="Current console context">
    <label class="console-icon-button" for="console-drawer-toggle" role="button" aria-label="Open project drawer">☰</label>
    <section class="console-context">
      <p class="console-kicker">${escapeHtml(model.currentProject)} · ${escapeHtml(model.currentSession)}</p>
      <h1>${escapeHtml(model.title)}</h1>
    </section>
    <label class="console-select-pill console-model-selector">Model <select aria-label="Model">${renderOptions(model.modelOptions, model.currentModel)}</select></label>
    <label class="console-select-pill console-mode-selector">Mode <select aria-label="Mode">${renderOptions(model.modeOptions, model.currentMode)}</select></label>
    <span class="console-status-pill console-status-${escapeHtml(model.status)}"><span class="console-status-dot"></span>${escapeHtml(statusLabel(model.status))}</span>
  </header>
  <input class="console-drawer-toggle" id="console-drawer-toggle" type="checkbox" aria-label="Toggle project drawer">
  <section class="console-app-frame">
    <label class="console-drawer-scrim" for="console-drawer-toggle" aria-label="Close project drawer"></label>
    ${renderProjectDrawer(model.projects)}
    <section class="console-workspace" aria-label="Chat timeline and task cards">
      ${renderCommandBar(model.commands)}
      <section class="console-chat-timeline" aria-label="Chat timeline">
        ${model.timeline.map(renderTimelineItem).join("")}
        ${renderRunCard(model.runCard)}
        ${renderDiffCard(model.diffCard)}
        ${renderApprovalCard(model.approvalCard)}
      </section>
      ${renderComposer(model)}
    </section>
  </section>
</main>`;
}

function renderProjectDrawer(projects: ConsoleProductProject[]): string {
  return `<aside class="console-project-drawer" aria-label="Projects and sessions">
    <section class="console-drawer-heading">
      <h2>Projects</h2>
      <label class="console-drawer-close" for="console-drawer-toggle" role="button" aria-label="Close project drawer">×</label>
    </section>
    <label class="console-search"><span>⌕</span><input aria-label="Search projects or sessions" placeholder="Search projects or sessions"></label>
    <section class="console-project-list">
      ${projects.map(renderProject).join("")}
    </section>
    <button class="console-archive-link" type="button">View archived projects <span>›</span></button>
  </aside>`;
}

function renderProject(project: ConsoleProductProject): string {
  const expanded = project.expanded ? "true" : "false";
  return `<article class="console-project-group" data-expanded="${expanded}">
    <section class="console-project-row">
      <section class="console-project-title-block">
        <span class="console-disclosure">${project.expanded ? "⌄" : "›"}</span>
        <span class="console-folder" aria-hidden="true">▣</span>
        <span class="console-project-copy"><strong>${escapeHtml(project.name)}</strong><small>⌘ ${escapeHtml(project.branch)} · ${escapeHtml(project.hint)}</small></span>
      </section>
      <section class="console-project-actions" aria-label="${escapeHtml(project.name)} actions">
        <button class="console-project-action-archive" type="button" aria-label="Archive ${escapeHtml(project.name)}">Archive</button>
        <button class="console-project-action-new-session" type="button" aria-label="Create new session in ${escapeHtml(project.name)}">+ New</button>
      </section>
    </section>
    <section class="console-session-list" aria-label="${escapeHtml(project.name)} sessions">
      ${project.sessions.map((session) => `<article class="console-session-child${session.active ? " is-active" : ""}"><span class="console-session-icon">☵</span><span><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.age)}</small></span><button type="button" aria-label="Session actions">•••</button></article>`).join("")}
    </section>
  </article>`;
}

function renderCommandBar(commands: string[]): string {
  return `<nav class="console-command-bar" aria-label="Command selection">
    ${commands.map((command) => `<button type="button">${escapeHtml(command)}</button>`).join("")}
    <button type="button" aria-label="Command settings">☷</button>
  </nav>`;
}

function renderTimelineItem(item: ConsoleProductTimelineItem): string {
  return `<article class="console-chat-bubble console-chat-bubble-${escapeHtml(item.role)}">
    <p>${escapeHtml(item.body)}</p>
    <time>${escapeHtml(item.time)}</time>
  </article>`;
}

function renderRunCard(card: ConsoleProductRunCard): string {
  const progress = Math.max(0, Math.min(100, card.progressPercent));
  return `<article class="console-run-card" aria-label="Running task card">
    <section class="console-card-header">
      <h2>${escapeHtml(card.title)}</h2>
      <span>${escapeHtml(card.status)}</span>
    </section>
    <section class="console-progress-row" aria-label="${escapeHtml(card.progressLabel)}">
      <span class="console-progress"><span class="console-progress-fill console-progress-fill-${progressClass(progress)}"></span></span>
      <strong>${escapeHtml(card.progressLabel)}</strong>
    </section>
    <ol class="console-step-list">
      ${card.steps.map((step) => `<li class="is-${escapeHtml(step.state)}"><span></span>${escapeHtml(step.label)}</li>`).join("")}
    </ol>
    <button class="console-card-secondary" type="button">${escapeHtml(card.cancelLabel)}</button>
  </article>`;
}

function progressClass(progress: number): string {
  return String(Math.round(progress / 5) * 5);
}

function renderDiffCard(card: ConsoleProductDiffCard): string {
  return `<article class="console-diff-card" aria-label="Diff card">
    <section class="console-card-header">
      <h2>${escapeHtml(card.filename)}</h2>
      <span class="console-diff-stat">+${card.added} −${card.removed}</span>
    </section>
    <pre class="console-diff-lines">${card.lines.map((line) => `${escapeHtml(line.number)}  ${escapeHtml(line.text)}`).join("\n")}</pre>
    <section class="console-card-actions">
      ${card.actions.map((action) => `<button type="button">${escapeHtml(action)}</button>`).join("")}
    </section>
  </article>`;
}

function renderApprovalCard(card: ConsoleProductApprovalCard): string {
  return `<article class="console-approval-card" aria-label="Approval card">
    <section class="console-card-header console-card-header-warning">
      <h2>⚠ ${escapeHtml(card.title)}</h2>
    </section>
    <section class="console-approval-items">
      ${card.items.map((item) => `<article><span>⚙</span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small><button type="button">Review</button></article>`).join("")}
    </section>
    <section class="console-card-actions">
      ${card.actions.filter((action) => action !== "Review").map((action) => `<button type="button">${escapeHtml(action)}</button>`).join("")}
    </section>
  </article>`;
}

function renderComposer(model: ConsoleProductAppModel): string {
  const controls = new Set(model.composer.controls);
  return `<section class="console-composer" aria-label="Message composer">
    <section class="console-composer-input" role="textbox" aria-label="${escapeHtml(model.composer.placeholder)}" aria-readonly="true">${escapeHtml(model.composer.placeholder)}</section>
    <section class="console-composer-tools" aria-label="Composer tools">
      <button type="button" aria-label="Attach">${controls.has("Attach") ? "⌘" : "+"}</button>
      <button type="button" aria-label="Command">${controls.has("Command") ? "/" : "⌕"}</button>
      <button type="button" aria-label="Mic">${controls.has("Mic") ? "🎙" : "Mic"}</button>
      <button type="button" aria-label="Send">${controls.has("Send") ? "➤" : "Send"}</button>
    </section>
  </section>`;
}

function renderOptions(options: string[], selected: string): string {
  return options.map((option) => `<option${option === selected ? " selected" : ""}>${escapeHtml(option)}</option>`).join("");
}

function statusLabel(status: ConsoleProductAppModel["status"]): string {
  return status === "running" ? "Running" : "Online";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const CONSOLE_PRODUCT_CSS = `
:root {
  color-scheme: light;
  --console-product-bg: #f5f7fb;
  --console-product-panel: rgba(255, 255, 255, 0.92);
  --console-product-border: #d9e1ef;
  --console-product-border-strong: #b9cdf5;
  --console-product-text: #141922;
  --console-product-muted: #657085;
  --console-product-blue: #2463eb;
  --console-product-blue-soft: #eaf3ff;
  --console-product-warning: #f59e0b;
  --console-product-success: #24a067;
  --console-product-shadow: 0 18px 60px rgba(31, 42, 68, 0.14);
}
* {
  box-sizing: border-box;
}
html {
  background: var(--console-product-bg);
}
body.console-product-body {
  margin: 0;
  color: var(--console-product-text);
  background:
    radial-gradient(circle at 0 0, rgba(36, 99, 235, 0.12), transparent 24rem),
    linear-gradient(180deg, #ffffff 0, var(--console-product-bg) 18rem);
  font: 16px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
button,
select,
input {
  font: inherit;
}
button,
select {
  min-height: 44px;
}
button,
.console-icon-button {
  cursor: default;
}
.console-mobile-shell {
  width: min(1180px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  padding: 18px 24px 28px;
}
.console-drawer-toggle {
  position: fixed;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}
.console-topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  gap: 14px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(217, 225, 239, 0.84);
  background: rgba(248, 250, 253, 0.86);
  backdrop-filter: blur(16px);
}
.console-icon-button,
.console-drawer-close,
.console-command-bar button,
.console-project-actions button,
.console-session-child button,
.console-card-actions button,
.console-card-secondary,
.console-composer button,
.console-archive-link,
.console-approval-items button {
  border: 1px solid var(--console-product-border);
  border-radius: 14px;
  background: #ffffff;
  color: var(--console-product-text);
}
.console-icon-button {
  display: grid;
  place-items: center;
  width: 52px;
  min-height: 52px;
  font-size: 1.55rem;
}
.console-context {
  min-width: 0;
}
.console-context h1,
.console-context p,
.console-drawer-heading h2,
.console-card-header h2,
.console-chat-bubble p {
  margin: 0;
}
.console-context h1 {
  font-size: clamp(1.35rem, 3vw, 2.05rem);
  letter-spacing: -0.04em;
}
.console-kicker {
  color: var(--console-product-muted);
  font-size: 0.82rem;
  font-weight: 760;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.console-select-pill,
.console-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--console-product-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--console-product-muted);
  font-weight: 760;
}
.console-select-pill select {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--console-product-text);
}
.console-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--console-product-success);
}
.console-app-frame {
  position: relative;
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
  padding-top: 20px;
}
.console-drawer-scrim {
  display: none;
}
.console-project-drawer,
.console-run-card,
.console-diff-card,
.console-approval-card,
.console-composer,
.console-chat-bubble {
  border: 1px solid var(--console-product-border);
  background: var(--console-product-panel);
  box-shadow: var(--console-product-shadow);
}
.console-project-drawer {
  position: sticky;
  top: 86px;
  display: grid;
  gap: 12px;
  max-height: calc(100vh - 112px);
  min-height: calc(100vh - 112px);
  overflow: auto;
  padding: 18px;
  border-radius: 28px;
}
.console-drawer-heading,
.console-card-header,
.console-project-row,
.console-project-title-block,
.console-project-actions,
.console-card-actions,
.console-progress-row,
.console-approval-items article,
.console-composer-tools {
  display: flex;
  align-items: center;
}
.console-drawer-heading,
.console-card-header,
.console-project-row {
  justify-content: space-between;
  gap: 12px;
}
.console-drawer-heading h2 {
  font-size: 1.32rem;
}
.console-drawer-close {
  display: grid;
  place-items: center;
  width: 44px;
  min-height: 44px;
  color: var(--console-product-blue);
  font-size: 1.35rem;
}
.console-search {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 12px;
  border: 1px solid var(--console-product-border);
  border-radius: 16px;
  background: #ffffff;
  color: var(--console-product-muted);
}
.console-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--console-product-text);
}
.console-project-list {
  display: grid;
  gap: 12px;
}
.console-project-group {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 18px;
}
.console-project-group[data-expanded="true"] {
  border-color: var(--console-product-border-strong);
  background: rgba(234, 243, 255, 0.62);
}
.console-project-row {
  min-height: 48px;
}
.console-project-title-block {
  flex: 1 1 auto;
  min-width: 0;
  gap: 9px;
}
.console-project-copy {
  flex: 1 1 auto;
  min-width: 0;
}
.console-project-title-block strong,
.console-session-child strong {
  display: block;
  overflow: hidden;
  color: #0f172a;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.console-project-title-block small,
.console-session-child small,
.console-approval-items small {
  display: block;
  color: var(--console-product-muted);
}
.console-disclosure {
  color: var(--console-product-muted);
  font-weight: 800;
}
.console-folder,
.console-session-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 1px solid var(--console-product-border);
  border-radius: 10px;
  background: #f8fbff;
  color: var(--console-product-blue);
}
.console-project-actions {
  flex: 0 0 auto;
  gap: 6px;
}
.console-project-actions button {
  min-height: 32px;
  min-width: 0;
  padding: 0 9px;
  border-radius: 999px;
  border-color: rgba(185, 205, 245, 0.84);
  background: rgba(255, 255, 255, 0.78);
  color: #2e3440;
  font-size: 0.78rem;
  font-weight: 760;
  white-space: nowrap;
}
.console-project-action-new-session {
  color: var(--console-product-blue) !important;
}
.console-session-list {
  display: grid;
  gap: 7px;
  margin-left: 16px;
  padding-left: 12px;
  border-left: 1px solid rgba(185, 205, 245, 0.9);
}
.console-session-child {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 14px;
}
.console-session-child.is-active {
  border-color: var(--console-product-border-strong);
  background: #f3f8ff;
  box-shadow: inset 4px 0 0 var(--console-product-blue);
}
.console-session-child button {
  min-width: 34px;
  min-height: 34px;
  border-color: transparent;
  background: transparent;
  color: var(--console-product-muted);
}
.console-archive-link {
  align-self: end;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  color: #475569;
}
.console-workspace {
  display: grid;
  gap: 13px;
  min-width: 0;
}
.console-command-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 4px;
}
.console-command-bar button {
  flex: 0 0 auto;
  min-height: 38px;
  min-width: 0;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #3f4656;
  font-size: 0.9rem;
}
.console-chat-timeline {
  display: grid;
  gap: 13px;
}
.console-chat-bubble {
  width: min(520px, 86%);
  padding: 14px 16px;
  border-radius: 18px;
}
.console-chat-bubble-user {
  justify-self: end;
  border-color: #b7d4ff;
  background: #eaf3ff;
}
.console-chat-bubble-assistant {
  justify-self: start;
  background: #ffffff;
}
.console-chat-bubble time {
  display: block;
  margin-top: 7px;
  color: var(--console-product-muted);
  font-size: 0.82rem;
}
.console-run-card,
.console-diff-card,
.console-approval-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 18px;
  background: #ffffff;
}
.console-card-header h2 {
  font-size: 1rem;
}
.console-card-header span,
.console-diff-stat {
  border-radius: 999px;
  padding: 5px 9px;
  background: var(--console-product-blue-soft);
  color: var(--console-product-blue);
  font-size: 0.86rem;
  font-weight: 760;
}
.console-progress-row {
  gap: 12px;
}
.console-progress {
  position: relative;
  display: block;
  width: min(240px, 56%);
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}
.console-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--console-product-blue), #60a5fa);
}
.console-progress-fill-40 {
  width: 40%;
}
.console-step-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--console-product-muted);
}
.console-step-list li {
  display: flex;
  align-items: center;
  gap: 9px;
}
.console-step-list li span {
  width: 15px;
  height: 15px;
  border: 1px solid #9ca3af;
  border-radius: 999px;
}
.console-step-list li.is-done span {
  border-color: var(--console-product-success);
  background: var(--console-product-success);
}
.console-step-list li.is-active {
  color: var(--console-product-text);
  font-weight: 760;
}
.console-step-list li.is-active span {
  border-color: var(--console-product-blue);
  background: var(--console-product-blue);
}
.console-card-secondary {
  justify-self: end;
  min-height: 36px;
  padding: 0 12px;
  border-color: transparent;
  background: #f8fafc;
  color: var(--console-product-muted);
}
.console-diff-lines {
  margin: 0 -14px;
  overflow-x: auto;
  padding: 8px 14px;
  border-block: 1px solid #eef2f7;
  background: linear-gradient(#fff7f7 0 40%, #f3fbf5 40% 80%, #ffffff 80%);
  color: #17324d;
  font: 0.88rem/1.7 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.console-card-actions {
  gap: 8px;
}
.console-card-actions button {
  flex: 1 1 0;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.9rem;
}
.console-card-actions button:not(:last-child) {
  border-color: transparent;
  background: #f8fafc;
  color: #475569;
}
.console-card-actions button:last-child,
.console-composer button:last-child {
  border-color: var(--console-product-blue);
  background: var(--console-product-blue);
  color: #ffffff;
}
.console-approval-card {
  border-color: rgba(245, 158, 11, 0.28);
  box-shadow: 0 10px 28px rgba(31, 42, 68, 0.08);
}
.console-card-header-warning h2 {
  color: #7c4a03;
}
.console-approval-items {
  display: grid;
  gap: 8px;
}
.console-approval-items article {
  gap: 9px;
  min-height: 46px;
  padding: 8px;
  border-radius: 14px;
  background: #fffbeb;
}
.console-approval-items strong {
  min-width: 88px;
}
.console-approval-items small {
  flex: 1 1 auto;
}
.console-approval-items button {
  min-height: 34px;
  padding: 0 10px;
  border-color: #f4d29c;
  border-radius: 999px;
  color: #5f3b10;
  font-size: 0.86rem;
}
.console-composer {
  position: sticky;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 5;
  display: grid;
  gap: 9px;
  padding: 10px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}
.console-composer-input {
  width: 100%;
  min-height: 46px;
  padding: 12px 14px;
  border: 1px solid var(--console-product-border);
  border-radius: 18px;
  background: #f8fafc;
  color: #8b94a7;
}
.console-composer-tools {
  justify-content: space-between;
  gap: 8px;
}
.console-composer button {
  display: grid;
  place-items: center;
  min-width: 42px;
  min-height: 38px;
  padding: 0 11px;
  border-radius: 999px;
  font-weight: 760;
}
.console-composer button:last-child {
  min-width: 48px;
}
@media (max-width: 860px) {
  .console-mobile-shell {
    padding: 10px 0 18px;
  }
  .console-topbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: 12px 16px;
  }
  .console-model-selector,
  .console-mode-selector {
    grid-row: 2;
  }
  .console-status-pill {
    grid-column: 3;
  }
  .console-app-frame {
    grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
    gap: 16px;
    padding: 16px 0 0;
  }
  .console-project-drawer {
    top: 118px;
    min-height: calc(100vh - 132px);
    border-radius: 0 24px 24px 0;
    border-left: 0;
  }
  .console-workspace {
    padding-right: 10px;
  }
}
@media (max-width: 720px) {
  .console-mobile-shell {
    width: 100%;
    height: 100vh;
    height: 100dvh;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    padding: 0 0 calc(10px + env(safe-area-inset-bottom));
  }
  .console-topbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    padding: calc(10px + env(safe-area-inset-top)) 12px 10px;
  }
  .console-context h1 {
    font-size: 1.28rem;
  }
  .console-model-selector,
  .console-mode-selector {
    grid-row: 2;
    min-height: 36px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 0.82rem;
  }
  .console-mode-selector {
    grid-column: 2;
    justify-self: start;
  }
  .console-status-pill {
    grid-column: 3;
    grid-row: 1 / span 2;
    min-height: 36px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 0.82rem;
  }
  .console-icon-button {
    width: 44px;
    min-height: 44px;
    border-radius: 16px;
  }
  .console-app-frame {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    align-items: stretch;
    min-height: 0;
    overflow: hidden;
    padding: 10px 10px 0;
  }
  .console-workspace {
    width: 100%;
    display: grid;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    padding: 0;
  }
  .console-drawer-scrim {
    position: fixed;
    inset: 0;
    z-index: 7;
    display: block;
    background: rgba(15, 23, 42, 0.22);
    opacity: 0;
    pointer-events: none;
    transition: opacity 160ms ease;
  }
  .console-project-drawer {
    position: fixed;
    top: 8px;
    right: auto;
    bottom: 8px;
    left: 14px;
    z-index: 8;
    width: min(340px, calc(100vw - 28px));
    max-width: calc(100vw - 28px);
    max-height: calc(100dvh - 16px);
    min-height: auto;
    overflow: auto;
    padding: 14px;
    border-radius: 26px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(20px);
    transform: translateX(calc(-100% - 28px));
    transition: transform 180ms ease;
  }
  #console-drawer-toggle:checked ~ .console-app-frame .console-drawer-scrim {
    opacity: 1;
    pointer-events: auto;
  }
  #console-drawer-toggle:checked ~ .console-app-frame .console-project-drawer {
    transform: translateX(0);
  }
  .console-drawer-heading h2 {
    font-size: 1.18rem;
  }
  .console-search {
    min-height: 44px;
  }
  .console-project-group {
    padding: 7px;
  }
  .console-project-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .console-project-title-block {
    gap: 8px;
  }
  .console-project-title-block small,
  .console-session-child small {
    font-size: 0.78rem;
  }
  .console-project-actions {
    gap: 4px;
    justify-content: flex-end;
  }
  .console-project-actions button {
    min-height: 30px;
    padding: 0 7px;
    font-size: 0.74rem;
  }
  .console-session-list {
    margin-left: 11px;
    padding-left: 10px;
  }
  .console-session-child {
    min-height: 52px;
    padding: 7px 8px;
  }
  .console-folder,
  .console-session-icon {
    width: 30px;
    height: 30px;
  }
  .console-command-bar {
    margin: 0 -10px;
    padding: 0 10px 6px;
  }
  .console-command-bar button {
    min-height: 34px;
    padding: 0 10px;
    font-size: 0.84rem;
  }
  .console-chat-timeline {
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 6px;
    overscroll-behavior: contain;
  }
  .console-chat-bubble {
    width: 92%;
    padding: 12px 14px;
  }
  .console-run-card,
  .console-diff-card,
  .console-approval-card {
    padding: 12px;
  }
  .console-card-header {
    align-items: flex-start;
  }
  .console-progress-row {
    display: grid;
    gap: 8px;
  }
  .console-progress {
    width: 100%;
  }
  .console-step-list {
    font-size: 0.92rem;
  }
  .console-diff-lines {
    margin: 0 -12px;
    padding: 8px 12px;
  }
  .console-card-actions {
    justify-content: flex-end;
    flex-wrap: wrap;
  }
  .console-card-actions button {
    flex: 0 1 auto;
    min-height: 34px;
    padding: 0 11px;
    font-size: 0.84rem;
  }
  .console-approval-items article {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 7px;
  }
  .console-approval-items strong {
    min-width: 0;
  }
  .console-approval-items small {
    grid-column: 2 / -1;
  }
  .console-approval-items button {
    min-height: 32px;
    padding: 0 9px;
  }
  .console-composer {
    position: static;
    margin-top: 2px;
    padding: 9px;
    border-radius: 22px;
  }
  .console-composer-input {
    min-height: 44px;
    padding: 11px 13px;
  }
  .console-composer-tools {
    gap: 6px;
  }
  .console-composer button {
    min-width: 38px;
    min-height: 36px;
    padding: 0 10px;
  }
  .console-composer button:last-child {
    min-width: 46px;
  }
}
`.trim();
