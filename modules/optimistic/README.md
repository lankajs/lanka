# @lankajs/optimistic

**▸ module** · Optimistic mutations

> Two concurrency strategies with real request cancellation.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaOptimisticActions` — `runLatest` (last click wins) and `runExclusive` (per-item lock)

## Rollback is what separates the two strategies

`runLatest` does NOT roll back a cancelled request: a fresher click superseded it, and
restoring the previous state would undo what the user just chose.

`runExclusive` has no superseding click, so it rolls back on ANY failure including
cancellation and timeout. Its lock expires on a timeout for the same reason — a hung
server would otherwise freeze the button forever.

Cancellation is recognised from `LankaError{kind:"aborted"}`, from `DOMException`, and
from the error name: the framework transport classifies it, but in node `AbortController`
throws a plain `Error`. A missed cancellation costs more than a string comparison.

---

Repository map: [../../README.md](../../README.md)
