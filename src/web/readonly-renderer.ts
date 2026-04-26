import type {
  WebReadonlyArtifactDescriptorRow,
  WebReadonlyConversationArtifactCatalogViewModel,
  WebReadonlyConversationResultViewModel,
  WebReadonlyHomeViewModel,
  WebReadonlyPendingInteractionViewRow,
  WebReadonlyPendingInteractionsViewModel,
  WebReadonlyReadinessGuardrailViewModel,
  WebReadonlyRuntimeContextViewModel,
  WebReadonlyWorkspaceConversationListViewModel,
  WebReadonlyWorkspaceListViewModel
} from "../service/web-readonly-view-model.js";

interface SafeHtmlCell {
  __safeHtml: string;
}

export function renderHomePage(vm: WebReadonlyHomeViewModel): string {
  return page("Codex Console Web prototype", [
    section("Prototype", [
      pair("Mode", "Read-only local prototype"),
      pair("State", vm.state),
      pair("Operator binding", vm.operator.binding),
      pair("Runtime", vm.runtime.state),
      pair("Readiness", vm.readiness.state)
    ]),
    table(
      "Workspaces",
      ["Workspace", "Conversations", "Pinned", "Last activity"],
      vm.workspaces.map((row) => [
        workspaceLink(row.workspaceId, row.label),
        String(row.conversationCount),
        yesNo(row.pinned),
        row.lastActivityAt ?? "—"
      ])
    ),
    table(
      "Recent conversations",
      ["Conversation", "Status", "Last activity", "Final answer"],
      vm.recentConversations.map((row) => [
        conversationLink(row.conversationHandle, row.title),
        row.status,
        row.lastActivityAt,
        yesNo(row.finalAnswerAvailable)
      ])
    ),
    table(
      "Active turns",
      ["Status", "Summary", "Blocked"],
      vm.runtime.activeTurns.map((row) => [row.status, row.summary ?? "—", row.blockedReason ?? "—"])
    ),
    warnings(vm.warnings)
  ]);
}

export function renderWorkspaceListPage(vm: WebReadonlyWorkspaceListViewModel): string {
  return page("Workspaces", [
    section("Read-only prototype", [pair("State", vm.state)]),
    table(
      "Workspaces",
      ["Workspace", "Availability", "Conversations", "Pinned", "Last activity", "Source"],
      vm.workspaces.map((row) => [
        workspaceLink(row.workspaceId, row.label),
        row.availability,
        String(row.conversationCount),
        yesNo(row.pinned),
        row.lastActivityAt ?? "—",
        row.source
      ])
    ),
    warnings(vm.warnings)
  ]);
}

export function renderWorkspaceConversationListPage(vm: WebReadonlyWorkspaceConversationListViewModel): string {
  return page("Workspace conversations", [
    section("Read-only prototype", [pair("State", vm.state), pair("Empty state", vm.emptyState ?? "—")]),
    table(
      "Conversations",
      ["Conversation", "Status", "Archived", "Created", "Last activity", "Final answer"],
      vm.conversations.map((row) => [
        conversationLink(row.conversationHandle, row.title),
        row.status,
        yesNo(row.archived),
        row.createdAt,
        row.lastActivityAt,
        yesNo(row.finalAnswerAvailable)
      ])
    ),
    warnings(vm.warnings)
  ]);
}

export function renderConversationResultPage(vm: WebReadonlyConversationResultViewModel): string {
  const conversationRows = vm.conversation
    ? [
      pair("Conversation", vm.conversation.title),
      pair("Workspace", vm.conversation.workspaceLabel),
      pair("Status", vm.conversation.status),
      pair("Archived", yesNo(vm.conversation.archived)),
      pair("Created", vm.conversation.createdAt),
      pair("Last activity", vm.conversation.lastActivityAt)
    ]
    : [pair("Conversation", "Unavailable")];

  return page("Conversation result", [
    section("Read-only prototype", [pair("State", vm.state), ...conversationRows]),
    table(
      "Final answers",
      ["Kind", "Delivery", "Created", "Summary", "Body"],
      vm.answers.map((answer) => [
        answer.kind,
        answer.deliveryState,
        answer.createdAt,
        answer.summary,
        answer.body.state === "available" ? answer.body.text : answer.body.reason
      ])
    ),
    table(
      "Runtime",
      ["Status", "Summary", "Blocked"],
      vm.runtime.activeTurns.map((row) => [row.status, row.summary ?? "—", row.blockedReason ?? "—"])
    ),
    table(
      "Pending interactions",
      ["Status", "Kind", "Blocking reason", "Summary", "Created", "Availability"],
      vm.pendingInteractions.pendingInteractions.map((row) => pendingInteractionRow(row))
    ),
    list("Readiness missing gates", vm.readiness.missingGates),
    warnings(vm.warnings)
  ]);
}

export function renderConversationArtifactCatalogPage(vm: WebReadonlyConversationArtifactCatalogViewModel): string {
  return page("Conversation artifacts", [
    section("Read-only prototype", [pair("State", vm.state), pair("Empty state", vm.emptyState ?? "—")]),
    table(
      "Artifact descriptors",
      ["Label", "Kind", "Type", "Size", "Availability", "Created"],
      vm.artifacts.map((artifact) => artifactRow(artifact))
    ),
    vm.selectedArtifact ? section("Selected descriptor", [pair("Label", vm.selectedArtifact.label), pair("Availability", vm.selectedArtifact.availability)]) : "",
    warnings(vm.warnings)
  ]);
}

export function renderRuntimePage(vm: WebReadonlyRuntimeContextViewModel): string {
  return page("Runtime", [
    section("Read-only prototype", [pair("State", vm.state)]),
    table(
      "Active turns",
      ["Status", "Summary", "Blocked"],
      vm.activeTurns.map((row) => [row.status, row.summary ?? "—", row.blockedReason ?? "—"])
    ),
    warnings(vm.warnings)
  ]);
}

export function renderPendingInteractionsPage(vm: WebReadonlyPendingInteractionsViewModel): string {
  return page("Pending interactions", [
    section("Read-only prototype", [pair("State", vm.state)]),
    table(
      "Pending interactions",
      ["Status", "Kind", "Blocking reason", "Summary", "Created", "Availability"],
      vm.pendingInteractions.map((row) => pendingInteractionRow(row))
    ),
    warnings(vm.warnings)
  ]);
}

export function renderReadinessPage(vm: WebReadonlyReadinessGuardrailViewModel): string {
  return page("Readiness", [
    section("Read-only prototype", [pair("State", vm.state), pair("Checked at", vm.checkedAt ?? "—"), pair("Active pack", vm.activePack ?? "—")]),
    table(
      "Capabilities",
      ["Capability", "Declared", "Configured", "Observed", "UX exposed"],
      vm.capabilities.map((row) => [row.label, row.declared, row.configured, row.observed, row.uxExposed])
    ),
    list("Missing gates", vm.missingGates),
    warnings(vm.warnings)
  ]);
}

export function renderGenericNotFoundPage(): string {
  return page("Not found", [section("Not found", ["The requested page is not available."])]);
}

export function renderGenericErrorPage(): string {
  return page("Temporarily unavailable", [section("Temporarily unavailable", ["The read-only prototype could not render this page."])]);
}

export function escapeHtml(value: unknown): string {
  return scrubText(String(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(title: string, sections: string[]): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    "<body>",
    `<h1>${escapeHtml(title)}</h1>`,
    "<p>Local prototype · read-only · not a shipped or supported Web surface.</p>",
    ...sections.filter(Boolean),
    "</body>",
    "</html>"
  ].join("\n");
}

function section(title: string, rows: string[]): string {
  return [`<section><h2>${escapeHtml(title)}</h2>`, ...rows.map((row) => `<p>${row}</p>`), "</section>"].join("\n");
}

function pair(label: string, value: unknown): string {
  return `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}`;
}

function table(title: string, headings: string[], rows: Array<Array<unknown | SafeHtmlCell>>): string {
  const body = rows.length > 0
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("\n")
    : `<tr><td colspan="${headings.length}">${escapeHtml("No rows")}</td></tr>`;
  return [
    `<section><h2>${escapeHtml(title)}</h2>`,
    "<table>",
    `<thead><tr>${headings.map((heading) => `<th>${escapeHtml(heading)}</th>`).join("")}</tr></thead>`,
    `<tbody>${body}</tbody>`,
    "</table></section>"
  ].join("\n");
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

function list(title: string, items: string[]): string {
  const body = items.length > 0
    ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")
    : `<li>${escapeHtml("None")}</li>`;
  return `<section><h2>${escapeHtml(title)}</h2><ul>${body}</ul></section>`;
}

function warnings(items: string[]): string {
  return list("Warnings", items);
}

function artifactRow(artifact: WebReadonlyArtifactDescriptorRow): string[] {
  return [
    artifact.label,
    artifact.kind,
    artifact.type ?? artifact.mediaType ?? "—",
    artifact.sizeBytes === null ? "—" : String(artifact.sizeBytes),
    artifact.availability,
    artifact.createdAt ?? "—"
  ];
}

function pendingInteractionRow(row: WebReadonlyPendingInteractionViewRow): string[] {
  return [
    row.status,
    row.kind,
    row.blockingReason,
    row.summary.state === "available" ? row.summary.text : row.summary.reason,
    row.createdAt ?? "—",
    row.availability
  ];
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function scrubText(value: string): string {
  return value
    .replace(/\b(submit|approve|interrupt|upload|switch|resume)\b/gi, "[redacted]")
    .replace(/\b(callback(?:_data)?|messageId|deliveryMessageId|telegramChatId|feishuChatId|chatId|threadId|token)\s*[:=]\s*[^\s<>"']+/gi, "[redacted]")
    .replace(/\b[A-Z][A-Z0-9_]{2,}=\S+/g, "[redacted-env]")
    .replace(/(?:^|\s)(\/(?:home|tmp|var|etc|root|Users|usr)\/[^\s<>"']*)/g, (match, path: string) => match.replace(path, "[redacted-path]"));
}
