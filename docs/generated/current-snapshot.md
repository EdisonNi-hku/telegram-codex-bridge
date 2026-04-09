<!-- docmeta
role: leaf
layer: 2
parent: docs/INDEX.md
children: []
summary: high-drift snapshot for current package version, source-tree size, and locally verifiable tooling facts
read_when:
  - the request needs exact current counts, version baselines, or other fast-drifting facts
  - a narrative doc would otherwise need unstable implementation numbers
skip_when:
  - the request is about behavior, control flow, or product boundaries
source_of_truth:
  - docs/generated/current-snapshot.md
  - package.json
  - pack-manifest.json
  - src
-->

# Current Snapshot

Updated: 2026-04-09

This file is the home for high-drift facts that change more often than the narrative docs should.
Use it for version baselines, repo-size snapshots, and similar volatile counts.
Do **not** use it as a behavior spec.

## Current Host And Tooling Snapshot

- package version: `0.1.0`
- required Node engine from `package.json`: `>=24.0.0`
- current supported packs from `pack-manifest.json`: `telegram`, `feishu`
- live `codex --version`: `codex-cli 0.118.0`
- live `codex app-server --help` confirms:
  - `--listen stdio://` default transport
  - `--listen ws://IP:PORT` available
  - `generate-ts`
  - `generate-json-schema`

## Current Repo Size Snapshot

Measured against the current `src/` tree on 2026-04-09.

- production TypeScript: `103` files, `43,572` lines
- test TypeScript: `55` files, `33,510` lines

Largest current non-test modules:
- `src/service.ts` — `4097`
- `src/service/runtime-surface-controller.ts` — `3726`
- `src/telegram/ui-runtime.ts` — `2280`
- `src/service/turn-coordinator.ts` — `1705`
- `src/state/store-open.ts` — `1704`
- `src/activity/tracker.ts` — `1599`
- `src/install.ts` — `1516`
- `src/service/codex-command-coordinator.ts` — `1289`
- `src/service/interaction-broker.ts` — `1246`
- `src/service/rich-input-adapter.ts` — `1127`

Largest current test modules:
- `src/service.test.ts` — `9687`
- `src/service/runtime-surface-controller.test.ts` — `3398`
- `src/state/store.test.ts` — `2883`
- `src/service/turn-coordinator.test.ts` — `2030`
- `src/telegram/ui.test.ts` — `1885`

## Refresh Hints

Refresh this file with live commands rather than memory.
Typical checks:

```bash
codex --version
codex app-server --help
node - <<'NODE'
const fs = require('fs');
const path = require('path');
function walk(dir){
  let res=[];
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) res=res.concat(walk(p));
    else if(ent.isFile() && p.endsWith('.ts')) res.push(p);
  }
  return res;
}
const files=walk('src');
const prod=[], tests=[];
for(const f of files){
  const lines=fs.readFileSync(f,'utf8').split('\n').length;
  (f.endsWith('.test.ts') ? tests : prod).push([lines,f]);
}
const sum = (arr) => arr.reduce((a,[n]) => a + n, 0);
console.log({
  prodFiles: prod.length,
  prodLines: sum(prod),
  testFiles: tests.length,
  testLines: sum(tests)
});
NODE
```
