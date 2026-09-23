---
"@lankajs/typebox": major
---

TypeBox 1.x. The peer is now `typebox ^1.3.34` — the new package, with the new
API — in place of `@sinclair/typebox ^0.34`.

**Migrating.** Import from `typebox` instead of `@sinclair/typebox`, and write a
mapping as `Type.Codec(...).Decode(...).Encode(...)` where it was
`Type.Transform(...)`. `TLankaInferred` is now TypeBox's `StaticDecode` — what
`validate` returns — because TypeBox 1.x's `Static` is the encoded side. An
application staying on TypeBox 0.34 stays on `@lankajs/typebox@1`, which
supports lanka 2.

**What else a consumer can see.**

- A schema is recognised by the `~kind` every TypeBox 1.x builder sets. A plain
  JSON Schema object is refused as not a TypeBox schema, as a zod schema is:
  TypeBox's own `IsSchema` accepts any object, and would compile one into a
  checker that accepts everything.
- A schema with a codec is decoded on a copy: the caller's body is left as it
  arrived. Properties the schema did not name are kept, exactly as they are for a
  schema without a codec — TypeBox 1.x's `Decode` would drop them.
- A decode function that throws `undefined` or `null` is reported as "The
  schema's decode function refused the value without saying why." instead of
  TypeBox 0.34's "Unknown error".
