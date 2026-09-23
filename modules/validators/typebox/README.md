# @lankajs/typebox

**▸ module** · TypeBox conveniences

> A bridge for the one library in the family with no Standard Schema, and a compiled checker it caches.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lankaTypeBoxValidator` — the bridge, over a compiled checker cached per schema
- `TLankaInferred<S>` — schema type inference

## Why a bridge rather than a name

TypeBox publishes no `~standard` at all — not asynchronously like yup, not at all —
so core's port cannot be handed a TypeBox schema. The bridge reads `Compile` and
`typebox/value` and produces the same two lists every package in the family produces.

## TypeBox 1.x, and where 0.34 went

TypeBox 1.x is a different package — `typebox`, not `@sinclair/typebox` — with a
different API, so this package's 2.x binds it and its 1.x line binds 0.34. That line
depends on lanka 2: an application on 0.34 stays on `@lankajs/typebox@1`, and moving
it to a later lanka means moving to TypeBox 1.x.

A TypeBox 1.x schema is recognised by its `~kind`, the mark every builder sets. Not by
`IsSchema`: that answers true for any object, since any object is a JSON Schema, and a
schema from another library would then validate as "accept everything".

## Why the compiled checker is cached, and why that is not premature

`Compile(schema)` turns a schema into a function, and the function is the
fastest validator in JavaScript. Compilation itself is not fast. Compiling on every
call would make this the SLOWEST package in the family while advertising the
opposite — the exact shape of a claim that measures well in a microbenchmark and
loses in an application.

So a `WeakMap` keyed by the schema object holds the compiled checker and whether the
schema contains a codec. Weak because the key is the consumer's schema: a strong
map here would keep every schema a screen ever built alive for the life of the tab.

## Why `Decode` is not simply always called

`Decode` applies codecs AND re-checks, so calling it after the compiled
check would validate every body twice. `HasCodec` is asked once per schema and
cached beside the checker, so a schema without codecs — which is most of them —
pays for one pass.

---

Repository map: [../../../README.md](../../../README.md)
