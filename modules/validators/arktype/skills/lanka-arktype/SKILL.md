---
name: lanka-arktype
description: Validate server responses with arktype schemas in a lanka application. Use when adding validation to a gateway, when choosing a validation library for a lanka app, when a response shape must be mapped into the application's own, or when reviewing code that imports `@lankajs/arktype`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/arktype
    version: "0.0.0"
---

# @lankajs/arktype

A validator named for its library, plus `TLankaInferred`. `reference.md` beside
this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

Not for capability. **arktype implements Standard Schema synchronously, and core
accepts its schemas directly** — `lankaArkTypeValidator` _is_
`lankaStandardValidator`, under a name that says what your application validates
with.

The package exists so the choice is made once and explicitly. Install **one**
package from `modules/validators/`, never two.

There is less code here than in `@lankajs/yup` or `@lankajs/typebox` because those
libraries do not hand a synchronous Standard Schema to the port and arktype does.

## Use

```ts
const todoSchema = type({ id: "number", title: "string", done: "boolean" });

// in a gateway: a failing body is a broken contract, not a branch
const todo = lankaArkTypeValidator.validate(todoSchema, body, "todos.byId");

// in a form: failure is ordinary
const result = lankaArkTypeValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

```ts
type ITodo = TLankaInferred<typeof todoSchema>;
```

The third argument is the label. It appears in the error and the log, and it is
what turns "invalid response" into "which call".

## Mapping a wire format

`validate` returns the **transformed** value, so a mapping is just a second
schema — `.pipe(...)` in arktype:

```ts
const domain = lankaArkTypeValidator.validate(todoApiSchema, wire, "todos.map");
return lankaArkTypeValidator.validate(todoSchema, domain, "todos.check");
```

The first changes when the **server** changes, the second when the
**application** does.

## Never do these

- **Never validate outside the gateway.**
- **Never install two validation packages.**
- **Never expect `validate` to return a result object.** It throws;
  `validateSafe` returns.
- **Never pass an async schema** — it is refused loudly, because a synchronous
  port cannot await one.

## Symptom → cause

| What you see                            | What it is                                  |
| --------------------------------------- | ------------------------------------------- |
| "invalid response" with no idea which   | a label that does not identify the call     |
| a throw where you wanted a form message | `validate` instead of `validateSafe`        |
| a loud refusal about async              | a schema whose `validate` returns a promise |

## More

`reference.md` — the full guide.
