<!-- docmeta
role: agent
layer: 2
parent: AGENTS.md
children: []
summary: local router for top-level GitHub install scripts
read_when:
  - the task is about hosted shell installer entrypoints
  - the root agent router already chose scripts as the correct domain
skip_when:
  - the task is about runtime behavior, code ownership, or bundled skill logic
source_of_truth:
  - scripts/AGENTS.md
  - scripts
  - docs/operations/install-and-admin.md
-->

# scripts/AGENTS.md

Router for top-level GitHub install scripts.

This directory is intentionally small.
Read a script only when the task is about the hosted shell entrypoints themselves.

## Files

- `scripts/install-from-github.sh` — direct bridge install entrypoint
- `scripts/install-skill-from-github.sh` — bundled skill install entrypoint

## Read Order

For intended install/admin behavior, start with:

- `docs/operations/install-and-admin.md`

Then read one script only if you need to confirm:

- exact shell flags
- bootstrap sequence
- curl-pipe entry behavior
- GitHub raw URL wiring

## Stop Rule

Do not read both scripts unless the task explicitly compares direct install vs skill install.
