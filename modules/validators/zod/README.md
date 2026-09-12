# @lankajs/zod

**▸ module** · zod conveniences

> An explicit validator choice: typed helpers plus a bridge for zod 3.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lankaZodValidator` — core's port under a name that says which library, plus a zod 3 bridge
- `TLankaInferred<S>` — schema type inference

## Mapping a server shape is a schema, not an adapter

A backend whose names are not the application's is read by a TRANSFORMING schema —
`.transform(...)` — because the validator returns what the schema produced. One call
reads the wire and builds the domain object, so there is no adapter layer and no
`adapt()` beside `validate()`.

Keep the mapping and the domain check as TWO schemas. The first changes when the
server changes, the second when the application does, and each names its own
context — so a failure says which of the two contracts broke, which is the
difference between calling the backend team and reading your own reducer.

The reverse direction is the same thing: the payload a backend expects back is a
mapping from the domain, not a serialiser. Both are in this package's playground.

## What this package is for

zod 4 implements Standard Schema, so there is nothing left to adapt. The package exists
to make the CHOICE explicit: an app installs one validation package — this or
`@lankajs/valibot` — or none, and works with schemas directly.

What lives here is zod-specific and therefore cannot live in core: typed helpers and
parsing for schemas that do not expose Standard Schema (zod 3). Core knows only the
protocol.

The symmetry with `@lankajs/valibot` is deliberate: two libraries, two identically shaped
modules, so the difference between them is the difference between the libraries.

---

Repository map: [../../../README.md](../../../README.md)
