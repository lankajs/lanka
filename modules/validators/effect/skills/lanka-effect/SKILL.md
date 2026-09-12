---
name: lanka-effect
description: Validate server responses with Effect Schema in a lanka application. Use when adding validation to a gateway, when a lanka app's schemas come from `effect`, when core's validator cannot accept an Effect schema, when a response shape must be mapped into the application's own, or when reviewing code that imports `@lankajs/effect`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/effect
    version: "0.0.0"
---

# @lankajs/effect

Core's validator over a cached Standard Schema wrapper, plus `TLankaInferred`.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

Effect implements Standard Schema through a **function**, not on the schema:

```ts
"~standard" in Schema.Struct({ id: Schema.Number }); // false
Schema.standardSchemaV1(schema); // ← the Standard Schema, built fresh each call
Schema.standardSchemaV1(s) === Schema.standardSchemaV1(s); // false
```

So core cannot take your schema directly, and wrapping at the call site allocates
a wrapper per validation. This package caches the wrapper per schema and delegates
the rest to core.

Install this **or** another package from `modules/validators/`, never two.

## Declare schemas at MODULE level

The wrapper is cached in a `WeakMap` keyed by the schema OBJECT. A schema built
inside a component body is a new object every render, and therefore a new key.

## Use

```ts
const todoSchema = Schema.Struct({
	id: Schema.Number,
	title: Schema.String,
	done: Schema.Boolean,
});

// in a gateway: a failing body is a broken contract, not a branch
const todo = lankaEffectValidator.validate(todoSchema, body, "todos.byId");

// in a form: failure is ordinary
const result = lankaEffectValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

```ts
type ITodo = TLankaInferred<typeof todoSchema>; // Schema.Schema.Type<S>, the decoded side
```

The third argument is the label. It appears in the error and the log, and it is
what turns "invalid response" into "which call".

## What this package will NOT do

**It starts no Effect runtime.** No `Effect.runSync`, no `Layer`, no error
channel. The validator is synchronous and returns plain values, like every other
package in the family. Your application already has a runtime; a second one
inside a validator is a second one to reason about.

If you want the validation inside an Effect, wrap the call yourself — that is
your composition to choose.

## Mapping a wire format

```ts
const todoFromApi = Schema.transform(
	Schema.Struct({ todo_id: Schema.Number }),
	Schema.Struct({ id: Schema.Number }),
	{ strict: true, decode: (w) => ({ id: w.todo_id }), encode: (d) => ({ todo_id: d.id }) },
);

const domain = lankaEffectValidator.validate(todoFromApi, wire, "todos.map");
return lankaEffectValidator.validate(todoSchema, domain, "todos.check");
```

The first changes when the **server** changes, the second when the
**application** does.

## Never do these

- **Never wrap with `Schema.standardSchemaV1` at the call site.** A new object
  every call; this package exists to remove that.
- **Never build a schema inside a component body.** A new cache key every render.
- **Never validate outside the gateway.**
- **Never install two validation packages.**
- **Never expect `validate` to return a result object.** It throws;
  `validateSafe` returns.
- **Never pass a schema with an asynchronous filter** — it is refused loudly,
  because a synchronous port cannot await one.

## Symptom → cause

| What you see                               | What it is                                            |
| ------------------------------------------ | ----------------------------------------------------- |
| core's port rejects your schema outright   | an Effect schema has no `~standard` — use this package |
| validation slower than expected            | a schema rebuilt per render — nothing is cached       |
| a loud refusal about async                 | an effectful filter that cannot run synchronously     |
| "invalid response" with no idea which      | a label that does not identify the call               |

## More

`reference.md` — the full guide, including what is deliberately absent.
