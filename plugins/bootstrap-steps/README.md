# @lankajs/plugin-bootstrap-steps

**⬡ plugin** · Bootstrap pipeline with context

> A step receives context, returns it changed, may exit early and redirect.

A core capability core does not implement itself. Registered with `use()`, then called by core. `peerDependencies: lanka` is mandatory.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Extension point

Plugs into:

```
use(plugin)
```

## Contents

- `createLankaBootstrapPipeline` — a chain of steps with context, early exit and run memory
- `lankaBootstrapSteps` — the same pipeline bound to a framework instance's lifetime

## Boundary against core's service plan

Core runs a SET of services: each has a name, priority, sync flag, failure mode and
timeout, and they do not talk to each other. This is a CHAIN: a step reads what the
previous one produced and may say "stop here, send the user there". Core can only
"run or throw", and an early exit cannot be expressed that way — an exception would mean
bootstrap failed, and this is not a failure but a decision.

So the plugin holds exactly four things core does not: a typed context, early exit, a
redirect target, and run memory (once per session; concurrent calls share one promise).
Concurrency, priorities and phase order stayed in core.

`optional` and `timeoutMs` exist here TOO, and that is not duplication: the executor is
different (sequential, with context) while the questions the configuration answers are
the same. Different words for one thing would force the reader to remember which of the
two they are in.

## What is remembered

Only a COMPLETED run. An early exit means "the user is not signed in"; remembering it
would strand the app on the sign-in screen forever, because the next attempt would
return the same answer without going anywhere. A failure is not remembered for the same
reason.

---

Repository map: [../../README.md](../../README.md)
