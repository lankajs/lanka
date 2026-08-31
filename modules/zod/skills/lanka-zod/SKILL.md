---
name: lanka-zod
description: Validate server responses with zod schemas in a lanka application, including zod 3 without Standard Schema. Use when adding validation to a gateway, when choosing a validation library for a lanka app, when a response shape must be mapped into the application's own, or when reviewing code that imports `@lankajs/zod`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/zod
    version: "0.0.0"
---

# @lankajs/zod

A validator named for its library, `TLankaInferred`, and the zod 3 bridge.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

**zod 4 implements Standard Schema, and core accepts its schemas directly** —
`lankaStandardValidator.validate(schema, body, "todos.list")` already works.

Install this package to make the choice explicit (your dependency list then says
which library your schemas are), and install it if you are on **zod 3**, which
does not expose Standard Schema. The bridge lives here because it is knowledge
about a specific library and version; core knows only the protocol.

Install this **or** `@lankajs/valibot`, never both.

## Use

```ts
const todoSchema = z.object({ id: z.number(), title: z.string(), done: z.boolean() });

// in a gateway: a failing body is a broken contract, not a branch
const todo = lankaZodValidator.validate(todoSchema, body, "todos.byId");

// in a form: failure is ordinary
const result = lankaZodValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

```ts
type ITodo = TLankaInferred<typeof todoSchema>;
```

The third argument is the label. It appears in the error and the log, and it is
what turns "invalid response" into "which call".

## Mapping a wire format

Standard Schema's `validate` returns the **transformed** value, so a mapping is
just a second schema — there is no adapter layer:

```ts
const domain = lankaZodValidator.validate(todoApiSchema, wire, "todos.map");
return lankaZodValidator.validate(todoSchema, domain, "todos.check");
```

Two steps because they are two jobs: the first changes when the **server**
changes, the second when the **application** does.

## Never do these

- **Never validate outside the gateway.** A gateway is where a body stops being
  `unknown`; anywhere else the same guards spread over every consumer.
- **Never install both validation packages.** The point is that the choice is
  visible.
- **Never expect `validate` to return a result object.** It throws;
  `validateSafe` returns.
- **Never pass an async schema.** It is refused loudly — a synchronous port
  cannot await one, and answering "fine" would let unvalidated data through.

## Symptom → cause

| What you see                             | What it is                                  |
| ---------------------------------------- | ------------------------------------------- |
| "invalid response" with no idea which    | a label that does not identify the call     |
| a validation throw where you wanted a UI | `validate` instead of `validateSafe`        |
| a loud refusal about async               | a schema whose `validate` returns a promise |

## More

`reference.md` — the full guide, including what the zod 3 bridge does with
issues.
