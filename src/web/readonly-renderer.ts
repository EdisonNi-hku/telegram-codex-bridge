import type {
  WebReadonlyArtifactDescriptorRow,
  WebReadonlyConversationArtifactCatalogViewModel,
  WebReadonlyConversationResultViewModel,
  WebReadonlyConversationRow,
  WebReadonlyHomeViewModel,
  WebReadonlyPendingInteractionViewRow,
  WebReadonlyPendingInteractionsViewModel,
  WebReadonlyReadinessGuardrailViewModel,
  WebReadonlyRuntimeContextViewModel,
  WebReadonlyRuntimeTurnRow,
  WebReadonlyWorkspaceConversationListViewModel,
  WebReadonlyWorkspaceListViewModel,
  WebReadonlyWorkspaceRow
} from "../service/web-readonly-view-model.js";

interface SafeHtmlCell {
  __safeHtml: string;
}

type NavKey = "home" | "workspaces" | "pending" | "runtime" | "readiness" | "none";

export function renderHomePage(vm: WebReadonlyHomeViewModel): string {
  const pendingCount = vm.runtime.activeTurns.filter((row) => isAttentionState(row.status) || Boolean(row.blockedReason)).length;
  return page("Home", "home", [
    hero("Owner preview", "Read-only prototype for understanding current workspace, conversation/task, runtime, pending, and readiness state."),
    `<section class="console-section" aria-labelledby="home-orientation"><h2 id="home-orientation">Current state</h2><div class="console-card-grid">${[
      metricCard("Runtime", vm.runtime.state, runtimeCopy(vm.runtime.state, vm.runtime.activeTurns.length)),
      metricCard("Pending attention", String(pendingCount), pendingCount === 0 ? "No blocked task is visible in this read-only preview." : "One or more conversation/tasks may need owner attention."),
      metricCard("Operator", vm.operator.binding, vm.operator.binding === "available" ? "Private owner binding is available for this preview." : "Owner binding is unavailable; visible data may be incomplete."),
      metricCard("Readiness", vm.readiness.state, readinessCopy(vm.readiness.state, vm.readiness.missingGates.length))
    ].join("")}</div></section>`,
    cardListSection(
      "home-workspaces",
      "Workspaces",
      vm.workspaces,
      (row) => workspaceCard(row),
      "Workspace data is unavailable in this read-only preview."
    ),
    cardListSection(
      "home-recent-conversations",
      "Recent conversations",
      vm.recentConversations,
      (row) => conversationCard(row),
      "No recent conversation/task data is available yet."
    ),
    cardListSection(
      "home-active-turns",
      "Active turns",
      vm.runtime.activeTurns,
      (row) => runtimeTurnCard(row),
      "No active task is known."
    ),
    warnings(vm.warnings)
  ]);
}

export function renderWorkspaceListPage(vm: WebReadonlyWorkspaceListViewModel): string {
  return page("Workspaces", "workspaces", [
    hero("Workspaces", "Browse safe workspace context. Opening a workspace only reads conversation/task state."),
    summaryPanel("Workspace status", [field("State", vm.state), field("Posture", "Read-only owner preview")]),
    cardListSection(
      "workspace-list",
      "Workspace list",
      vm.workspaces,
      (row) => workspaceCard(row),
      "Workspace data is unavailable or no workspaces are visible."
    ),
    warnings(vm.warnings)
  ]);
}

export function renderWorkspaceConversationListPage(vm: WebReadonlyWorkspaceConversationListViewModel): string {
  return page("Workspace conversations", "workspaces", [
    hero("Workspace conversations", "Open a conversation/task detail page through an opaque Console handle."),
    summaryPanel("Conversation list status", [field("State", vm.state), field("Empty state", vm.emptyState ?? "—")]),
    cardListSection(
      "workspace-conversations",
      "Conversations/tasks",
      vm.conversations,
      (row) => conversationCard(row),
      vm.emptyState === "no_conversations" ? "No conversation/task rows are visible for this workspace." : "Conversation/task data is unavailable."
    ),
    warnings(vm.warnings)
  ]);
}

export function renderConversationResultPage(vm: WebReadonlyConversationResultViewModel): string {
  const conversation = vm.conversation;
  const title = conversation?.title ?? "Conversation unavailable";
  const statusRows = conversation
    ? [
      field("Workspace", conversation.workspaceLabel),
      field("State", conversation.status),
      field("Archived", yesNo(conversation.archived)),
      field("Created", conversation.createdAt),
      field("Last activity", conversation.lastActivityAt)
    ]
    : [field("State", "Unavailable"), field("Note", "Conversation/task data is unavailable from the safe read model.")];

  return page("Conversation/task detail", "none", [
    hero("Conversation/task detail", "Read-only owner preview. Result, pending state, runtime, readiness, and warnings are separated for safe review."),
    `<section class="console-panel console-detail-heading" aria-labelledby="detail-heading"><h2 id="detail-heading">${escapeHtml(title)}</h2><div class="console-fields">${statusRows.join("")}</div></section>`,
    statusPanel(conversation?.status ?? vm.state),
    resultPanel(vm.answers),
    pendingPanel(vm.pendingInteractions.state, vm.pendingInteractions.pendingInteractions),
    runtimePanel(vm.runtime.state, vm.runtime.activeTurns),
    readinessPanel(vm.readiness.state, vm.readiness.missingGates),
    warnings(vm.warnings)
  ]);
}

export function renderConversationArtifactCatalogPage(vm: WebReadonlyConversationArtifactCatalogViewModel): string {
  return page("Conversation artifacts", "none", [
    hero("Artifact descriptors", "Descriptor-only artifact availability. This preview does not expose file content."),
    summaryPanel("Artifact status", [field("State", vm.state), field("Empty state", vm.emptyState ?? "—")]),
    cardListSection(
      "artifact-descriptors",
      "Artifact descriptors",
      vm.artifacts,
      (artifact) => artifactCard(artifact),
      "No artifact descriptors are available."
    ),
    vm.selectedArtifact ? summaryPanel("Selected descriptor", [field("Label", vm.selectedArtifact.label), field("Availability", vm.selectedArtifact.availability)]) : "",
    warnings(vm.warnings)
  ]);
}

export function renderRuntimePage(vm: WebReadonlyRuntimeContextViewModel): string {
  return page("Runtime", "runtime", [
    hero("Runtime", "Read-only runtime state. Use it to understand whether Codex is idle, running, blocked, degraded, or unavailable."),
    summaryPanel("Runtime status", [field("State", vm.state), field("Active turns", String(vm.activeTurns.length))]),
    runtimePanel(vm.state, vm.activeTurns),
    warnings(vm.warnings)
  ]);
}

export function renderPendingInteractionsPage(vm: WebReadonlyPendingInteractionsViewModel): string {
  return page("Pending", "pending", [
    hero("Pending", "Read-only view of approvals, questions, and other owner attention states. Responses are not enabled in this preview."),
    summaryPanel("Pending status", [field("State", vm.state), field("Visible items", String(vm.pendingInteractions.length))]),
    pendingPanel(vm.state, vm.pendingInteractions),
    warnings(vm.warnings)
  ]);
}

export function renderReadinessPage(vm: WebReadonlyReadinessGuardrailViewModel): string {
  return page("Readiness", "readiness", [
    hero("Readiness", "Guardrail state for this private Console preview. Readiness is not a public support claim."),
    summaryPanel("Readiness status", [field("State", vm.state), field("Checked at", vm.checkedAt ?? "—"), field("Active pack", vm.activePack ?? "—")]),
    cardListSection(
      "readiness-capabilities",
      "Capabilities",
      vm.capabilities,
      (row) => `<article class="console-card"><h3>${escapeHtml(row.label)}</h3><div class="console-fields">${[
        field("Declared", row.declared),
        field("Configured", row.configured),
        field("Observed", row.observed),
        field("UX exposed", row.uxExposed)
      ].join("")}</div></article>`,
      "No capability rows are available."
    ),
    listPanel("Missing gates", vm.missingGates, "No missing gates are visible."),
    warnings(vm.warnings)
  ]);
}

export function renderGenericNotFoundPage(): string {
  return page("Not found", "none", [summaryPanel("Not found", ["The requested page is not available."])]);
}

export function renderGenericErrorPage(): string {
  return page("Temporarily unavailable", "none", [summaryPanel("Temporarily unavailable", ["The read-only Console preview could not render this page."])]);
}

export function escapeHtml(value: unknown): string {
  return scrubText(String(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, active: NavKey, sections: string[]): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(title)} · Codex Console</title>`,
    "</head>",
    "<body class=\"console-shell\">",
    "<header class=\"console-shell__header\">",
    "<div class=\"console-brand\"><p class=\"console-eyebrow\">Owner preview · read-only prototype</p><h1>Codex Console</h1><p class=\"console-posture\">Private, denied-by-default Console preview. Runtime data is read-only and action lanes are not enabled.</p></div>",
    "<nav class=\"console-shell__nav\" aria-label=\"Console navigation\">",
    navLink("/", "Home", active === "home"),
    navLink("/workspaces", "Workspaces", active === "workspaces"),
    navLink("/interactions", "Pending", active === "pending"),
    navLink("/runtime", "Runtime", active === "runtime"),
    navLink("/readiness", "Readiness", active === "readiness"),
    "</nav>",
    "</header>",
    "<main class=\"console-shell__main\">",
    ...sections.filter(Boolean),
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function navLink(href: string, label: string, active: boolean): string {
  const current = active ? " aria-current=\"page\"" : "";
  return `<a class="console-nav-link" href="${href}"${current}>${escapeHtml(label)}</a>`;
}

function hero(label: string, body: string): string {
  return `<section class="console-hero" aria-labelledby="page-heading"><p class="console-eyebrow">${escapeHtml(label)}</p><h2 id="page-heading">${escapeHtml(label)}</h2><p>${escapeHtml(body)}</p></section>`;
}

function metricCard(label: string, value: string, body: string): string {
  return `<article class="console-card"><p class="console-eyebrow">${escapeHtml(label)}</p><p class="console-metric">${escapeHtml(value)}</p><p>${escapeHtml(body)}</p></article>`;
}

function summaryPanel(title: string, rows: string[]): string {
  return `<section class="console-panel" aria-labelledby="${slug(title)}"><h2 id="${slug(title)}">${escapeHtml(title)}</h2><div class="console-fields">${rows.map((row) => `<p>${row}</p>`).join("")}</div></section>`;
}

function cardListSection<T>(id: string, title: string, rows: T[], render: (row: T) => string, emptyCopy: string): string {
  const body = rows.length > 0
    ? `<div class="console-card-list">${rows.map((row) => render(row)).join("")}</div>`
    : `<p class="console-empty">${escapeHtml(emptyCopy)}</p>`;
  return `<section class="console-section" aria-labelledby="${id}"><h2 id="${id}">${escapeHtml(title)}</h2>${body}</section>`;
}

function statusPanel(status: string): string {
  return `<section class="console-panel" aria-labelledby="status-heading"><h2 id="status-heading">Status</h2><p><span class="console-badge">${escapeHtml(statusLabel(status))}</span> ${escapeHtml(statusCopy(status))}</p></section>`;
}

function resultPanel(answers: WebReadonlyConversationResultViewModel["answers"]): string {
  if (answers.length === 0) {
    return `<section class="console-panel console-result" aria-labelledby="result-heading"><h2 id="result-heading">Final answer/result</h2><p class="console-empty">Final answer body unavailable: this run has no sanitized Web-readable answer source yet.</p></section>`;
  }

  const cards = answers.map((answer) => {
    const body = answer.body.state === "available"
      ? `<pre class="console-result-body">${escapeHtml(answer.body.text)}</pre>`
      : `<p class="console-empty">${escapeHtml(finalAnswerUnavailableCopy(answer.body.reason))}</p>`;
    return `<article class="console-card console-result-card"><h3>${escapeHtml(answer.kind)}</h3><div class="console-fields">${[
      field("Delivery", answer.deliveryState),
      field("Created", answer.createdAt),
      field("Summary", answer.summary)
    ].join("")}</div>${body}</article>`;
  }).join("");

  return `<section class="console-panel console-result" aria-labelledby="result-heading"><h2 id="result-heading">Final answer/result</h2><div class="console-card-list">${cards}</div></section>`;
}

function finalAnswerUnavailableCopy(reason: string): string {
  if (reason === "unsafe_final_answer_body") {
    return "Final answer body unavailable: supplied answer text was rejected by the Web safety filter.";
  }
  return "Result metadata is available, but the answer text was not captured in a Web-safe format.";
}

function runtimePanel(state: string, rows: WebReadonlyRuntimeTurnRow[]): string {
  return cardListSection(
    "runtime-heading",
    "Runtime",
    rows,
    (row) => runtimeTurnCard(row),
    runtimeCopy(state, rows.length)
  );
}

function pendingPanel(state: string, rows: WebReadonlyPendingInteractionViewRow[]): string {
  return cardListSection(
    "pending-heading",
    "Pending interactions",
    rows,
    (row) => pendingInteractionCard(row),
    pendingCopy(state)
  );
}

function readinessPanel(state: string, missingGates: string[]): string {
  return `<section class="console-panel" aria-labelledby="readiness-heading"><h2 id="readiness-heading">Readiness</h2><p><span class="console-badge">${escapeHtml(state)}</span> ${escapeHtml(readinessCopy(state, missingGates.length))}</p>${listItems(missingGates, "No missing gates are visible.")}</section>`;
}

function listPanel(title: string, items: string[], emptyCopy: string): string {
  return `<section class="console-panel" aria-labelledby="${slug(title)}"><h2 id="${slug(title)}">${escapeHtml(title)}</h2>${listItems(items, emptyCopy)}</section>`;
}

function listItems(items: string[], emptyCopy: string): string {
  if (items.length === 0) {
    return `<p class="console-empty">${escapeHtml(emptyCopy)}</p>`;
  }
  return `<ul class="console-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function workspaceCard(row: WebReadonlyWorkspaceRow): string {
  return `<article class="console-card"><h3>${cellHtml(workspaceLink(row.workspaceId, row.label))}</h3><div class="console-fields">${[
    field("Availability", row.availability),
    field("Conversations", String(row.conversationCount)),
    field("Pinned", yesNo(row.pinned)),
    field("Last activity", row.lastActivityAt ?? "—")
  ].join("")}</div></article>`;
}

function conversationCard(row: WebReadonlyConversationRow): string {
  return `<article class="console-card"><h3>${cellHtml(conversationLink(row.conversationHandle, row.title))}</h3><p><span class="console-badge">${escapeHtml(statusLabel(row.status))}</span> ${escapeHtml(conversationCopy(row.status, row.finalAnswerAvailable))}</p><div class="console-fields">${[
    field("Last activity", row.lastActivityAt),
    field("Final result", row.finalAnswerAvailable ? "available" : "unavailable"),
    field("Archived", yesNo(row.archived))
  ].join("")}</div></article>`;
}

function runtimeTurnCard(row: WebReadonlyRuntimeTurnRow): string {
  return `<article class="console-card"><h3>${escapeHtml(statusLabel(row.status))}</h3><p>${escapeHtml(row.summary ?? statusCopy(row.status))}</p><div class="console-fields">${[
    field("Blocked", row.blockedReason ?? "—")
  ].join("")}</div></article>`;
}

function pendingInteractionCard(row: WebReadonlyPendingInteractionViewRow): string {
  const summary = row.summary.state === "available" ? row.summary.text : "Summary is unavailable from the safe read model.";
  return `<article class="console-card"><h3>${escapeHtml(pendingLabel(row.kind, row.status))}</h3><p>${escapeHtml(summary)}</p><div class="console-fields">${[
    field("Status", row.status),
    field("Kind", row.kind),
    field("Reason", row.blockingReason),
    field("Created", row.createdAt ?? "—"),
    field("Availability", row.availability)
  ].join("")}</div><p class="console-muted">Read-only preview: responses are not enabled here.</p></article>`;
}

function artifactCard(artifact: WebReadonlyArtifactDescriptorRow): string {
  return `<article class="console-card"><h3>${escapeHtml(artifact.label)}</h3><div class="console-fields">${[
    field("Kind", artifact.kind),
    field("Type", artifact.type ?? artifact.mediaType ?? "—"),
    field("Size", artifact.sizeBytes === null ? "—" : String(artifact.sizeBytes)),
    field("Availability", artifact.availability),
    field("Created", artifact.createdAt ?? "—")
  ].join("")}</div></article>`;
}

function field(label: string, value: unknown): string {
  return `<span class="console-field"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`;
}

function cellHtml(value: unknown | SafeHtmlCell): string {
  if (isSafeHtmlCell(value)) {
    return value.__safeHtml;
  }
  return escapeHtml(value);
}

function isSafeHtmlCell(value: unknown): value is SafeHtmlCell {
  return typeof value === "object" && value !== null && typeof (value as SafeHtmlCell).__safeHtml === "string";
}

function conversationLink(handle: string, label: string): SafeHtmlCell {
  if (!/^cv_[a-f0-9]{16}$/.test(handle)) {
    return { __safeHtml: escapeHtml(label) };
  }
  return { __safeHtml: `<a href="/conversations/${handle}">${escapeHtml(label)}</a>` };
}

function workspaceLink(workspaceId: string, label: string): SafeHtmlCell {
  if (!/^wk_[A-Za-z0-9_-]{1,80}$/.test(workspaceId)) {
    return { __safeHtml: escapeHtml(label) };
  }
  return { __safeHtml: `<a href="/workspaces/${workspaceId}/conversations">${escapeHtml(label)}</a>` };
}

function warnings(items: string[]): string {
  return listPanel("Warnings", items, "No warnings are visible.");
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function isAttentionState(status: string): boolean {
  return /pending|blocked|question|approval|needs/i.test(status);
}

function statusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("running")) return "Running";
  if (normalized.includes("queued")) return "Queued";
  if (normalized.includes("question")) return "Needs answer";
  if (normalized.includes("approval")) return "Approval needed";
  if (normalized.includes("pending")) return "Needs attention";
  if (normalized.includes("blocked")) return "Blocked";
  if (normalized.includes("complete") || normalized.includes("done")) return "Done";
  if (normalized.includes("fail")) return "Failed";
  if (normalized.includes("degraded")) return "Degraded";
  if (normalized.includes("unavailable")) return "Unavailable";
  if (normalized.includes("recover")) return "Recovered";
  if (normalized.includes("idle")) return "Idle";
  return status;
}

function statusCopy(status: string): string {
  const label = statusLabel(status);
  switch (label) {
    case "Running":
      return "Codex is working; result will appear here when complete.";
    case "Queued":
      return "A task is waiting to start.";
    case "Needs answer":
      return "Codex asked a question; the answer lane is read-only until enabled.";
    case "Approval needed":
      return "Codex requested an approval; the approval lane is read-only until enabled.";
    case "Needs attention":
      return "Owner attention may be needed, but responses are not enabled in this preview.";
    case "Blocked":
      return "Progress is stopped until required owner interaction is resolved.";
    case "Done":
      return "Completion metadata or a final result is available.";
    case "Failed":
      return "The task ended without a usable final result in this preview.";
    case "Degraded":
      return "State is partial, stale, or missing a safe source.";
    case "Unavailable":
      return "The required reader/source is not connected or authorized.";
    case "Recovered":
      return "Runtime restarted or state was restored with caveats.";
    default:
      return "Read-only state is shown exactly as exposed by the safe view model.";
  }
}

function runtimeCopy(state: string, activeCount: number): string {
  if (activeCount > 0) {
    return `${activeCount} active turn${activeCount === 1 ? "" : "s"} visible in the safe read model.`;
  }
  const label = statusLabel(state);
  if (label === "Degraded" || label === "Unavailable") {
    return "Runtime data is partial or unavailable in this preview.";
  }
  return "No active task is known.";
}

function readinessCopy(state: string, missingCount: number): string {
  if (missingCount > 0) {
    return `${missingCount} readiness gate${missingCount === 1 ? "" : "s"} need attention before broader support claims.`;
  }
  if (/degraded|unavailable/i.test(state)) {
    return "Readiness data is partial or unavailable.";
  }
  return "No missing readiness gates are visible.";
}

function pendingCopy(state: string): string {
  if (/unavailable/i.test(state)) {
    return "Pending interaction data is unavailable in this preview.";
  }
  if (/degraded/i.test(state)) {
    return "Pending interaction data is partial or stale.";
  }
  return "No pending owner interaction is visible.";
}

function conversationCopy(status: string, finalAnswerAvailable: boolean): string {
  if (finalAnswerAvailable) {
    return "Result metadata is available.";
  }
  return statusCopy(status);
}

function pendingLabel(kind: string, status: string): string {
  const loweredKind = kind.toLowerCase();
  if (loweredKind.includes("question")) return "Needs answer";
  if (loweredKind.includes("approval")) return "Approval needed";
  return statusLabel(status);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function scrubText(value: string): string {
  return value
    .replace(/\b(submit|approve|interrupt|upload|switch|resume)\b/gi, "[redacted]")
    .replace(/\b(callback(?:_data)?|messageId|deliveryMessageId|telegramChatId|feishuChatId|chatId|threadId|token)\s*[:=]\s*[^\s<>"']+/gi, "[redacted]")
    .replace(/\b[A-Z][A-Z0-9_]{2,}=\S+/g, "[redacted-env]")
    .replace(/(?:^|\s)(\/(?:home|tmp|var|etc|root|Users|usr)\/[^\s<>"']*)/g, (match, path: string) => match.replace(path, "[redacted-path]"));
}
