---
name: lanka-any-schema
description: Use one lanka validator for schemas from several libraries at once. Use when an application has schemas from more than one library (a merger, a vendored SDK, a legacy screen), when a gateway must validate zod and TypeBox bodies, when a validator refuses a schema saying it belongs to another library, or when reviewing code that imports `@lankajs/any-schema`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/any-schema
    version: "0.0.0"
---

# @lankajs/any-schema

One validator that routes each schema to the package for its dialect.
`reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Say this first, before reaching for it

**One application, one schema library.** If the user can still choose, advise
that — two libraries mean two ways to spell the same rule and two sets of error
messages. This package is a way out of a situation (a merger, a vendored SDK, a
screen older than the decision), not a design to propose.

## Do they actually need it?

There are four **dialects**, not six libraries:

| Dialect    | Libraries               | Why separate                                |
| ---------- | ----------------------- | ------------------------------------------- |
| `standard` | zod 4, valibot, arktype | a synchronous Standard Schema                |
| `yup`      | yup                     | its Standard Schema is `async`               |
| `typebox`  | TypeBox                 | publishes no Standard Schema                 |
| `effect`   | Effect Schema           | its Standard Schema is behind a function     |

**zod + valibot + arktype is ONE dialect — no hub needed.** Any one of those
three validators reads all three. Check this before recommending anything.

## Use

```ts
// once, at module level
export const appValidator = createLankaAnySchemaValidator({
	standard: lankaZodValidator, // serves zod, valibot and arktype
	typebox: lankaTypeBoxValidator,
});

const order = appValidator.validate<IOrder>(orderSchema, body, "orders.byId");
const invoice = appValidator.validate<IInvoice>(billingSchema, body, "billing");
```

Register only the dialects in use. The output type must be NAMED — inference is
impossible across four dialects, and that is the price of mixing.

## A library with no lanka package

superstruct, io-ts, a company's own schema type — register it, and nothing in the
framework changes:

```ts
createLankaAnySchemaValidator({
	standard: lankaZodValidator,
	custom: [{ name: "superstruct", accepts: (s) => s instanceof Struct, validator: mine }],
});
```

`accepts` is asked about ANY value — `null`, a number — before anything decided
it was a schema, so guard it. Custom dialects are asked FIRST, which is also how
a built-in dialect is overridden (a wrapped validator, registered under a
predicate that recognises TypeBox, wins).

## A schema with no library

`createLankaSchema` builds a Standard Schema from a function, so it is the
`standard` dialect and every validator in the family reads it — core included, no
package needed:

```ts
const frameSchema = createLankaSchema<IFrame>((data, issue) => {
	if (!isRecord(data)) return issue("a frame is an object");
	if (typeof data.seq !== "number") issue("must be a number", ["seq"]);

	return { sequence: data.seq, sentAt: new Date(Number(data.at) * 1000) };
});
```

Reach for it when a package must not gain a dependency, when the rule is one no
library spells, or before a library has been chosen. **It is not a library** —
wanting `string()` and composition means installing one of the six packages.

## Never do these

- **Never reach for this with only zod, valibot and arktype.** One dialect.
- **Never try each validator in turn in a `try`/`catch`.** It turns a wiring
  mistake into a value that passed on the third attempt, with a validator nobody
  chose.
- **Never build the hub or the schemas inside a component body.** The TypeBox and
  Effect validators cache per schema object.
- **Never expect `validateSafe` not to throw on an unusable SCHEMA.** A refused
  value is an outcome; a schema nothing was registered for is a wiring mistake
  and is loud on purpose.
- **Never write a custom `accepts` that reaches into the value unguarded.** It is
  asked about `null` and about numbers.
- **Never build a schema library on top of `createLankaSchema`.** Six exist.

## Symptom → cause

| What you see                                                    | What it is                                        |
| --------------------------------------------------------------- | ------------------------------------------------- |
| "no validator was registered for the X dialect"                 | install `@lankajs/X` and pass it to the factory   |
| "not a schema of any dialect lanka knows"                       | the value is not a schema — a bug in the caller   |
| "This is not a zod/yup/TypeBox/Effect schema"                   | a schema handed to a vendor validator directly    |
| "the schema is asynchronous" on a yup schema                    | core's port — route it through `@lankajs/yup`     |
| the result typed `unknown`                                      | name the output: `validate<IOrder>(…)`            |
| "custom dialect X threw while deciding whether it owns a schema" | an `accepts` predicate that does not guard      |
| a custom dialect never being asked                              | a built-in claimed it first? no — custom go first; check `accepts` |

## More

`reference.md` — the full guide, including the dialect table and what mixing
costs.
