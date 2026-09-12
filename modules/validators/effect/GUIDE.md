# @lankajs/effect — user guide

Conveniences for an application whose schemas are **Effect's**: core's validator
over a Standard Schema wrapper held still, and a `TLankaInferred` helper.

## You will learn

- why Effect's Standard Schema support is not quite enough on its own
- why your schemas must live at module level
- what this package deliberately refuses to do with your Effect runtime

## When to reach for this

When your schemas are `effect`'s `Schema`. Core cannot be handed one directly.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/effect effect
```

## Do I need it?

Effect implements [Standard Schema](https://standardschema.dev), but through a
**function** rather than on the schema:

```ts
"~standard" in Schema.Struct({ id: Schema.Number }); // false
Schema.standardSchemaV1(schema); // ← this is the Standard Schema
```

So core's port cannot take your schema as it is, and the obvious fix — wrapping
at the call site — builds a **new wrapper on every call**:

```ts
Schema.standardSchemaV1(user) === Schema.standardSchemaV1(user); // false
```

`lankaEffectValidator` caches that wrapper per schema and hands the rest to
core's validator. That is the whole package: one thing held still.

## Use

```ts
import { lankaEffectValidator } from "@lankajs/effect";
import { Schema } from "effect";

// at MODULE level — the wrapper is cached by the schema's identity
const todoSchema = Schema.Struct({
	id: Schema.Number,
	title: Schema.String,
	done: Schema.Boolean,
});

// throws a LankaValidationError, with the label in the message
const todo = lankaEffectValidator.validate(todoSchema, body, "todos.byId");

// or ask instead of throwing
const result = lankaEffectValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

`validate` is what a gateway wants: a body that fails is a broken contract, not a
branch to handle. `validateSafe` is for a form, where failure is ordinary.

A schema built inside a component body is a new object on every render, so it is
a new cache key. The package's bench measures that row beside the cached one.

## What this package will not do

**It does not start an Effect runtime.** No `Effect.runSync`, no error channel,
no `Layer`. Your application already has a runtime, and a second one started
inside a validator is a second one to reason about — about fibers, about
interruption, about which one a failure belongs to.

The validator is synchronous and returns plain values, like every other package
in `modules/validators/`. If you want the validation itself inside an Effect, wrap
the call — that is your composition to choose, not the framework's to impose.

## Types

```ts
import type { TLankaInferred } from "@lankajs/effect";

type ITodo = TLankaInferred<typeof todoSchema>;
```

This is `Schema.Schema.Type<S>` — the **decoded** side, which is the value your
application holds.

## What you get back when it fails

```ts
result.errors; // ["tags.0.id: Expected number, actual \"x\""] — for a banner
result.fields; // [{ path: ["tags", 0, "id"], message }]      — for a form
```

Paths come back as segments, with the index a number, because a form cannot parse
an address back out of a string.

## Mapping a wire format

A mapping is a schema, not an adapter layer. In Effect that is
`Schema.transform`, and the decoded side is your domain:

```ts
const todoFromApi = Schema.transform(
	Schema.Struct({ todo_id: Schema.Number }),
	Schema.Struct({ id: Schema.Number }),
	{ strict: true, decode: (w) => ({ id: w.todo_id }), encode: (d) => ({ todo_id: d.id }) },
);

const domain = lankaEffectValidator.validate(todoFromApi, wire, "todos.map");
return lankaEffectValidator.validate(todoSchema, domain, "todos.check");
```

Two steps because they are two jobs: the first changes when the **server**
changes, the second when the **application** does.

## Async schemas

Rejected, loudly. An Effect schema with an effectful, asynchronous filter
produces a promise from the Standard Schema wrapper, and a synchronous port
cannot await one — answering "fine" would let unvalidated data through.

## Common mistakes

**Wrapping with `Schema.standardSchemaV1` at the call site.** A new object every
call; that is what this package removes.

**Building the schema inside the component.** A new cache key every render.

**Installing two packages from `modules/validators/`.** Pick one.

## Recap

- Effect's Standard Schema is a function, not a property — this package caches its result.
- Schemas at module level: the wrapper is cached by object identity.
- No Effect runtime is started here, on purpose.
- A mapping is `Schema.transform`, and the decoded side is your domain.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../../README.md](../../../README.md)
