# @lankajs/effect

**▸ module** · Effect Schema conveniences

> Effect keeps its Standard Schema behind a wrapper function; this holds the wrapper still.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lankaEffectValidator` — core's port over `Schema.standardSchemaV1`, cached per schema
- `TLankaInferred<S>` — schema type inference

## Why a wrapper rather than a name

An Effect schema carries no `~standard` of its own. The specification is implemented
by `Schema.standardSchemaV1(schema)`, which BUILDS one — a different object on every
call, measured rather than assumed. Handed straight to the port, every validation
would allocate a wrapper and throw it away, and the schema's own compilation would
happen again with it.

So the wrapper is cached in a `WeakMap` keyed by the schema. Weak because the key is
the consumer's schema: a strong map would keep every schema a screen ever built alive
for the life of the tab.

## What is deliberately NOT here

No Effect runtime, no `Effect.runSync`, no error channel. The package binds one port
and nothing else — an application already using Effect has its own runtime, and a
second one started by a validator is a second one to reason about.

---

Repository map: [../../../README.md](../../../README.md)
