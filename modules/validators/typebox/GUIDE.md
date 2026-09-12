# @lankajs/typebox — user guide

The bridge for the one library in the family with no Standard Schema, over a
compiled checker it caches, plus a `TLankaInferred` helper.

## You will learn

- why this package is required rather than a matter of taste
- why your schemas must live at module level, and what it costs when they do not
- how to map a wire format with `Type.Transform`

## When to reach for this

The moment your schemas are TypeBox. Core's validator cannot be handed one.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/typebox @sinclair/typebox
```

## Do I need it?

Yes. TypeBox publishes no `~standard` at all — not asynchronously as yup does,
not at all — and core's port speaks
[Standard Schema](https://standardschema.dev) and nothing else. There is no
version of "just use `lankaStandardValidator`" that compiles or runs.

## Use

```ts
import { lankaTypeBoxValidator } from "@lankajs/typebox";
import { Type } from "@sinclair/typebox";

// at MODULE level — see below, this is not a style point
const todoSchema = Type.Object({
	id: Type.Number(),
	title: Type.String(),
	done: Type.Boolean(),
});

// throws a LankaValidationError, with the label in the message
const todo = lankaTypeBoxValidator.validate(todoSchema, body, "todos.byId");

// or ask instead of throwing
const result = lankaTypeBoxValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

`validate` is what a gateway wants: a body that fails is a broken contract, not a
branch to handle. `validateSafe` is for a form, where failure is ordinary.

## Declare schemas at module level

`TypeCompiler.Compile(schema)` turns a schema into a generated function — the
fastest validator in JavaScript — and **compiling is the slow part**. This
package compiles each schema once and keeps the result in a `WeakMap` keyed by
the schema object.

A schema built inside a component body is a **new object on every render**, so it
is a new cache key and it is compiled again each time. The package's own bench
measures exactly that row, beside the cached one, so the cost is a number rather
than a warning.

```ts
// ✗ compiled on every render
const Screen = () => {
	const schema = Type.Object({ id: Type.Number() });
	…
};

// ✓ compiled once, for the life of the module
const screenSchema = Type.Object({ id: Type.Number() });
```

The map is **weak** on purpose: the key is your schema, and a strong map would
keep every schema any screen ever built alive for the life of the tab.

## Types

```ts
import type { TLankaInferred } from "@lankajs/typebox";

type ITodo = TLankaInferred<typeof todoSchema>;
```

## What you get back when it fails

```ts
result.errors; // ["tags.0.id: Expected number", …]      — for a banner
result.fields; // [{ path: ["tags", 0, "id"], message }] — for a form
```

TypeBox addresses a field with a JSON Pointer — `/tags/0/id`. `fields[].path` is
**segments**, with the index as a number, and the pointer's `~1` / `~0` escapes
are decoded, so a key containing a slash stays one field.

A failure at the root — `Type.Number()` refusing `"no"` — has an **empty** path:
the form's root, not an input named `""`.

## Mapping a wire format

A mapping is a schema, not an adapter layer. In TypeBox it is
`Type.Transform(...).Decode(...)`:

```ts
const todoFromApi = Type.Transform(
	Type.Object({ todo_id: Type.Number(), is_done: Type.Union([Type.Literal(0), Type.Literal(1)]) }),
)
	.Decode((wire) => ({ id: wire.todo_id, done: wire.is_done === 1 }))
	.Encode((domain) => ({ todo_id: domain.id, is_done: domain.done ? 1 : 0 }));

const domain = lankaTypeBoxValidator.validate(todoFromApi, wire, "todos.map");
return lankaTypeBoxValidator.validate(todoSchema, domain, "todos.check");
```

A schema **without** transforms never pays for the decode pass: whether it has
one is asked once and cached beside the compiled checker, because `Value.Decode`
re-checks and calling it unconditionally would validate every body twice.

A decode function that throws is a **refused body**, not a crash — it comes back
as a failure, because `validateSafe` promises to throw nothing.

## Formats are a registry, not a keyword

`Type.String({ format: "email" })` checks nothing until the application registers
that format with TypeBox. Unregistered, it is reported as `Unknown format` — a
rule that looks present in the schema and is not. Use `pattern`, or register the
format at start-up.

## Where to validate

In the gateway. A gateway is where a body stops being `unknown`; validating in
the screen instead spreads the same three guards over every consumer, and each
one gets it slightly differently wrong.

## Common mistakes

**Building the schema inside the component.** It compiles every render. Module
level.

**Installing two packages from `modules/validators/`.** Pick one.

**Expecting `validate` to return a result object.** It throws. `validateSafe`
returns.

**Trusting `format` without registering it.**

## Recap

- TypeBox has no Standard Schema, so this package is what makes it work with lanka.
- Schemas at module level: the compiled checker is cached by object identity.
- Paths come back as segments, with JSON Pointer escapes decoded.
- A mapping is `Type.Transform`, and only a schema that has one pays for the decode pass.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../../README.md](../../../README.md)
