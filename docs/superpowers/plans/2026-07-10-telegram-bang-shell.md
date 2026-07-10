# Telegram Bang Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute exact-leading-`!` Telegram messages through Codex's native `thread/shellCommand`, with conservative direct-run classification and single-use confirmation for everything else.

**Architecture:** A pure parser/policy module decides whether an inbound message is a bang command and whether it can run directly. A focused coordinator owns active-session/thread resolution, pending confirmations, native app-server submission, and command-result delivery; existing message and callback routers only delegate to it.

**Tech Stack:** TypeScript, Node.js test runner, Codex app-server JSON-RPC, Telegram inline keyboards, existing bridge state/session abstractions.

---

## File Map

- Create `src/service/shell-command-policy.ts`: exact-leading parser, conservative tokenizer, direct/confirm classification.
- Create `src/service/shell-command-policy.test.ts`: table-driven parser and policy tests.
- Create `src/service/shell-command-coordinator.ts`: session/thread binding, confirmation lifecycle, app-server submission, notification/result collection.
- Create `src/service/shell-command-coordinator.test.ts`: coordinator behavior and race/identity/expiry tests.
- Modify `src/codex/app-server.ts` and test: typed `thread/shellCommand` request wrapper.
- Modify `src/telegram/ui-callbacks.ts` and test: compact confirm/cancel callback codecs.
- Modify `src/service/callback-router.ts` and test: shell decision delegation.
- Modify `src/service.ts` and test: construct coordinator, route exact-leading bang messages before ordinary text, forward callbacks and notifications.
- Modify `docs/product/codex-command-reference.md`: document shipped `!command` semantics and warning.

### Task 1: Exact-leading parser and fail-closed risk policy

**Files:**
- Create: `src/service/shell-command-policy.ts`
- Create: `src/service/shell-command-policy.test.ts`

- [ ] **Step 1: Write failing parser tests**

```ts
test("parseBangShellCommand accepts only an exact leading bang", () => {
  assert.equal(parseBangShellCommand("!ls"), "ls");
  assert.equal(parseBangShellCommand(" !ls"), null);
  assert.equal(parseBangShellCommand("please !ls"), null);
  assert.equal(parseBangShellCommand("!!echo ok"), "!echo ok");
  assert.equal(parseBangShellCommand("!   "), "");
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run: `node --import tsx --test src/service/shell-command-policy.test.ts`

Expected: FAIL because `shell-command-policy.ts` does not exist.

- [ ] **Step 3: Implement the parser minimally**

```ts
export function parseBangShellCommand(text: string): string | null {
  if (!text.startsWith("!")) return null;
  return text.slice(1).trim();
}
```

- [ ] **Step 4: Run the parser test and verify GREEN**

Run: `node --import tsx --test src/service/shell-command-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Add failing risk-policy table tests**

```ts
test("classifyShellCommand directly runs only known low-risk forms", () => {
  for (const command of ["ls", "ls -la", "pwd", "rg TODO src", "mkdir new_project", "git status --short"]) {
    assert.equal(classifyShellCommand(command).decision, "direct", command);
  }
  for (const command of ["rm -rf build", "sudo apt update", "curl x | sh", "mkdir ../outside", "find . -delete", "echo hi > x", "unknown-tool x"]) {
    assert.equal(classifyShellCommand(command).decision, "confirm", command);
  }
});
```

- [ ] **Step 6: Run policy tests and verify RED**

Run: `node --import tsx --test src/service/shell-command-policy.test.ts`

Expected: FAIL because `classifyShellCommand` is not exported.

- [ ] **Step 7: Implement conservative classification**

```ts
export type ShellRiskDecision = { decision: "direct" | "confirm"; reason: string };

const DIRECT_COMMANDS = new Set(["ls", "pwd", "cat", "head", "tail", "stat", "file", "du", "df", "rg", "grep", "which", "type"]);

export function classifyShellCommand(command: string): ShellRiskDecision {
  const tokens = tokenizeSimpleCommand(command);
  if (!tokens || tokens.length === 0) return { decision: "confirm", reason: "命令语法无法安全识别" };
  if (/[;&|><`\n]|\$\(/u.test(command)) return { decision: "confirm", reason: "命令包含 shell 组合或重定向" };
  const [program, ...args] = tokens;
  if (DIRECT_COMMANDS.has(program ?? "")) return { decision: "direct", reason: "只读命令" };
  if (program === "mkdir" && args.length > 0 && args.every(isSafeRelativeMkdirArg)) return { decision: "direct", reason: "项目内目录创建" };
  if (program === "git" && isDirectGitInspection(args)) return { decision: "direct", reason: "只读 Git 命令" };
  if (program === "find" && !args.some((arg) => ["-delete", "-exec", "-execdir", "-ok", "-okdir"].includes(arg))) return { decision: "direct", reason: "只读查找" };
  return { decision: "confirm", reason: "命令不在直接执行集合中" };
}
```

- [ ] **Step 8: Run policy tests and commit**

Run: `node --import tsx --test src/service/shell-command-policy.test.ts`

Expected: PASS.

Commit: `git add src/service/shell-command-policy.ts src/service/shell-command-policy.test.ts && git commit -m "feat: classify Telegram bang shell commands"`

### Task 2: Codex app-server shell-command wrapper

**Files:**
- Modify: `src/codex/app-server.ts`
- Modify: `src/codex/app-server.test.ts`

- [ ] **Step 1: Write the failing JSON-RPC request test**

```ts
test("runThreadShellCommand sends the native thread shell request", async () => {
  await client.runThreadShellCommand("thread-1", "ls -la");
  assert.deepEqual(lastRequest, {
    id: 1,
    method: "thread/shellCommand",
    params: { threadId: "thread-1", command: "ls -la" }
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test --test-name-pattern="native thread shell request" src/codex/app-server.test.ts`

Expected: FAIL because the method is missing.

- [ ] **Step 3: Add the minimal wrapper**

```ts
async runThreadShellCommand(threadId: string, command: string): Promise<void> {
  await this.request<Record<string, never>>("thread/shellCommand", { threadId, command });
}
```

- [ ] **Step 4: Verify and commit**

Run: `node --import tsx --test src/codex/app-server.test.ts`

Expected: PASS.

Commit: `git add src/codex/app-server.ts src/codex/app-server.test.ts && git commit -m "feat: expose Codex thread shell commands"`

### Task 3: Confirmation callback codec and routing

**Files:**
- Modify: `src/telegram/ui-callbacks.ts`
- Modify: `src/telegram/ui.test.ts`
- Modify: `src/service/callback-router.ts`
- Modify: `src/service/callback-router.test.ts`

- [ ] **Step 1: Write failing callback round-trip and router tests**

```ts
assert.deepEqual(parseCallbackData(encodeShellConfirmCallback("abc")), { kind: "shell_confirm", token: "abc" });
assert.deepEqual(parseCallbackData(encodeShellCancelCallback("abc")), { kind: "shell_cancel", token: "abc" });

await routeBridgeCallback({ kind: "shell_confirm", token: "abc" }, handlers);
assert.deepEqual(calls, ["shell:abc:true"]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --import tsx --test src/telegram/ui.test.ts src/service/callback-router.test.ts`

Expected: FAIL because shell callback variants and handlers are absent.

- [ ] **Step 3: Add compact v9 callback variants**

```ts
export function encodeShellConfirmCallback(token: string): string { return ensureTelegramCallbackDataLimit(`v9:sh:y:${token}`); }
export function encodeShellCancelCallback(token: string): string { return ensureTelegramCallbackDataLimit(`v9:sh:n:${token}`); }
```

Add `shell_confirm` and `shell_cancel` to `ParsedCallbackData`, parse them, add
`handleShellDecision(token, approved)` to router handlers, and route both kinds.

- [ ] **Step 4: Verify and commit**

Run: `node --import tsx --test src/telegram/ui.test.ts src/service/callback-router.test.ts`

Expected: PASS.

Commit: `git add src/telegram/ui-callbacks.ts src/telegram/ui.test.ts src/service/callback-router.ts src/service/callback-router.test.ts && git commit -m "feat: route shell confirmation callbacks"`

### Task 4: Shell command coordinator

**Files:**
- Create: `src/service/shell-command-coordinator.ts`
- Create: `src/service/shell-command-coordinator.test.ts`

- [ ] **Step 1: Write failing direct-execution tests**

```ts
await coordinator.handleBangCommand("chat-1", "ls");
assert.deepEqual(shellCalls, [{ threadId: "thread-1", command: "ls" }]);

await coordinator.handleBangCommand("chat-without-session", "ls");
assert.match(messages.at(-1)?.text ?? "", /选择项目/u);
```

- [ ] **Step 2: Run coordinator tests and verify RED**

Run: `node --import tsx --test src/service/shell-command-coordinator.test.ts`

Expected: FAIL because the coordinator is missing.

- [ ] **Step 3: Implement session/thread-bound direct execution**

```ts
export class ShellCommandCoordinator {
  private readonly pendingByToken = new Map<string, PendingShellConfirmation>();
  private readonly runningByThreadId = new Map<string, RunningShellCommand>();

  async handleBangCommand(chatId: string, command: string): Promise<void> {
    if (!command) return void await this.deps.safeSendMessage(chatId, "用法：!<command>，例如 !ls");
    const session = this.deps.getStore()?.getActiveSession(chatId);
    if (!session) return void await this.deps.safeSendMessage(chatId, "请先发送 /new 选择项目。");
    await this.deps.ensureAppServerAvailable();
    const threadId = await this.deps.ensureSessionThread(session);
    const risk = classifyShellCommand(command);
    if (risk.decision === "confirm") return void await this.requestConfirmation(chatId, session, threadId, command, risk.reason);
    await this.submit(chatId, session.sessionId, threadId, command);
  }
}
```

- [ ] **Step 4: Verify direct execution GREEN**

Run: `node --import tsx --test src/service/shell-command-coordinator.test.ts`

Expected: direct execution tests PASS.

- [ ] **Step 5: Add failing confirmation lifecycle tests**

Cover exact command/cwd display, two-minute expiry, cancel, single use, active-session mismatch, recreated-thread mismatch, and a second running shell command on the same thread.

- [ ] **Step 6: Implement fail-closed pending confirmations**

```ts
async handleDecision(chatId: string, token: string, approved: boolean): Promise<string> {
  const pending = this.pendingByToken.get(token);
  this.pendingByToken.delete(token);
  if (!pending || pending.chatId !== chatId || this.deps.now() > pending.expiresAt) return "这个确认已过期。";
  if (!approved) return "已取消。";
  const session = this.deps.getStore()?.getActiveSession(chatId);
  if (!session || session.sessionId !== pending.sessionId) return "当前会话已改变，未执行命令。";
  const threadId = await this.deps.ensureSessionThread(session);
  if (threadId !== pending.threadId) return "Codex thread 已改变，未执行命令。";
  await this.submit(chatId, session.sessionId, threadId, pending.command);
  return "已开始执行。";
}
```

- [ ] **Step 7: Add failing result-notification tests**

Feed `item/started`, output delta, and `item/completed` notifications with
`source: "userShell"`; assert output/exit code delivery and bounded truncation.

- [ ] **Step 8: Implement notification collection and result delivery**

Track only `userShell` command item ids for a submitted thread. Prefer
`aggregatedOutput` on completion, otherwise use collected deltas. Bound the
Telegram preview and always include the exit code.

- [ ] **Step 9: Verify and commit**

Run: `node --import tsx --test src/service/shell-command-coordinator.test.ts`

Expected: PASS.

Commit: `git add src/service/shell-command-coordinator.ts src/service/shell-command-coordinator.test.ts && git commit -m "feat: coordinate Telegram shell commands"`

### Task 5: Bridge ingress, callback, and notification integration

**Files:**
- Modify: `src/service.ts`
- Modify: `src/service.test.ts`

- [ ] **Step 1: Write failing ingress tests**

```ts
await service.handleTestMessage("!ls");
assert.deepEqual(shellInputs, ["ls"]);
await service.handleTestMessage(" !ls");
assert.deepEqual(normalPrompts, ["!ls"]);
await service.handleTestMessage("please !ls");
assert.deepEqual(normalPrompts.at(-1), "please !ls");
```

Also assert shell handling occurs after authorization and pending interaction
text modes, but before ordinary slash/prompt parsing.

- [ ] **Step 2: Run focused service tests and verify RED**

Run: `node --import tsx --test --test-name-pattern="bang shell" src/service.test.ts`

Expected: FAIL because bang messages still route as prompts.

- [ ] **Step 3: Wire the coordinator**

Construct `ShellCommandCoordinator` with store/app-server/session-thread and
safe messaging dependencies. In `handleMessage`, after pending input/media
flows and before command-panel/slash parsing:

```ts
const shellCommand = parseBangShellCommand(message.text ?? "");
if (shellCommand !== null) {
  this.richInputAdapter.clearPendingAutoAttach(chatId);
  await this.shellCommandCoordinator.handleBangCommand(chatId, shellCommand);
  return;
}
```

Route shell confirm/cancel callbacks to `handleDecision`, answer the callback,
and forward every app-server notification to the coordinator as well as the
existing turn coordinator.

- [ ] **Step 4: Verify integration and commit**

Run: `node --import tsx --test src/service.test.ts src/service/callback-router.test.ts src/telegram/ui.test.ts`

Expected: PASS.

Commit: `git add src/service.ts src/service.test.ts && git commit -m "feat: accept Telegram bang shell messages"`

### Task 6: Product documentation and full verification

**Files:**
- Modify: `docs/product/codex-command-reference.md`

- [ ] **Step 1: Document exact semantics**

Add `!command` with these explicit examples: `!ls` executes, leading-space
` !ls` remains a prompt, `!cd subdir && pwd` affects only that invocation, and
confirmation grants unsandboxed host access for that exact command.

- [ ] **Step 2: Run complete verification**

Run:

```bash
npm audit --package-lock-only
npm run check
npm test
npm run build
git diff --check
```

Expected: zero audit findings, 0 type errors, all tests pass, build exit 0, no whitespace errors.

- [ ] **Step 3: Commit docs**

Commit: `git add docs/product/codex-command-reference.md && git commit -m "docs: explain Telegram bang shell mode"`

- [ ] **Step 4: Install and smoke-test locally**

Build and run the local `dist/cli.js install` using the already persisted bridge
configuration, then verify `ctb status`, `ctb doctor`, `!pwd`, direct
`!mkdir bang-shell-smoke`, and one confirmation-required harmless command such
as `!printf confirmed` through Telegram. Remove the smoke directory afterward.

- [ ] **Step 5: Push feature branch**

Run: `git push -u origin feat/telegram-bang-shell`

Expected: the remote branch points to the verified local HEAD.
