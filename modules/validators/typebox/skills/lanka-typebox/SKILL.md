---
name: lanka-typebox
description: Validate server responses with TypeBox schemas in a lanka application. Use when adding validation to a gateway, when a lanka app's schemas are TypeBox, when core's validator cannot accept a TypeBox schema, when a response shape must be mapped into the application's own, or when reviewing code that imports `@lankajs/typebox`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/typebox
    version: "0.0.0"
---

# @lankajs/typebox

A bridge over TypeBox's compiled checker, plus `TLankaInferred`. `reference.md`
beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

**Yes.** TypeBox publishes no `~standard` at all, and lanka's validation port
speaks Standard Schema and nothing else. There is no version of "just use
`lankaStandardValidator`" that compiles or runs.

Install this **or** another package from `modules/validators/`, never two.

## Declare schemas at MODULE level

This is the one rule that costs real performance if ignored.
`TypeCompiler.Compile(schema)` produces the fastest validator in JavaScript, and
compiling is the slow part. The package compiles each schema once and caches it
in a `WeakMap` keyed by the schema OBJECT.

```ts
// ✗ a new object every render — recompiled every render
const Screen = () => {
	const schema = Type.Object({ id: Type.Number() });
};

// ✓ compiled once
const screenSchema = Type.Object({ id: Type.Number() });
```

## Use

```ts
const todoSchema = Type.Object({
	id: Type.Number(),
	title: Type.String(),
	done: Type.Boolean(),
});

// in a gateway: a failing body is a broken contract, not a branch
const todo = lankaTypeBoxValidator.validate(todoSchema, body, "todos.byId");

// in a form: failure is ordinary
const result = lankaTypeBoxValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

```ts
type ITodo = TLankaInferred<typeof todoSchema>;
```

The third argument is the label. It appears in the error and the log, and it is
what turns "invalid response" into "which call".

## What a failure looks like

```ts
result.errors; // ["tags.0.id: Expected number"]         — for a banner
result.fields; // [{ path: ["tags", 0, "id"], message }] — for a form
```

TypeBox reports a JSON Pointer — `/tags/0/id`. `path` is segments with the index
as a **number**, and `~1` / `~0` escapes are decoded. A root failure has an
**empty** path.

## Mapping a wire format

```ts
const todoFromApi = Type.Transform(Type.Object({ todo_id: Type.Number() }))
	.Decode((wire) => ({ id: wire.todo_id }))
	.Encode((domain) => ({ todo_id: domain.id }));

const domain = lankaTypeBoxValidator.validate(todoFromApi, wire, "todos.map");
return lankaTypeBoxValidator.validate(todoSchema, domain, "todos.check");
```

A schema without transforms never pays for the decode pass. A decode function
that throws is a refused body, not a crash.

## Never do these

- **Never build a schema inside a component body.** It is a new cache key on
  every render.
- **Never reach for `lankaStandardValidator` with a TypeBox schema.** It cannot
  take one.
- **Never validate outside the gateway.**
- **Never install two validation packages.**
- **Never expect `validate` to return a result object.** It throws;
  `validateSafe` returns.
- **Never trust `format: "email"` without registering the format.** Unregistered,
  it is reported as `Unknown format` and checks nothing. Use `pattern`, or
  register it at start-up.

## Symptom → cause

| What you see                                | What it is                                       |
| ------------------------------------------- | ------------------------------------------------ |
| validation slower than expected             | a schema rebuilt per render — nothing is cached  |
| "Unknown format" in a message               | a `format` keyword nothing registered            |
| a path like `/a/b` reaching your form       | not from here — this package returns segments    |
| "invalid response" with no idea which       | a label that does not identify the call          |

## More

`reference.md` — the full guide, including what the bridge does with JSON
Pointer escapes.
