<!-- Generated from modules/validators/any-schema/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/any-schema@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/any-schema react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/validators/any-schema/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/validators/any-schema/_playground/playground.test.ts)

# @lankajs/any-schema — user guide

One validator over the several an application ended up with, routing each schema
to the package for its dialect.

## You will learn

- why you should not need this, and when you do anyway
- how to wire one validator for four dialects
- what mixing costs, so the decision is made with the price visible

## Read this first

**One application, one schema library.** Two means two ways to spell the same
rule, two sets of error messages, and a reviewer who has to know both. Every
other package in [`modules/validators/`](../) says to install exactly one, and
that advice does not change because this package exists.

It happens anyway:

- a merger, and now half the codebase is valibot
- a vendored SDK that exports TypeBox schemas
- a screen older than the decision, still on yup
- a team that standardised on Effect

So mixing is **supported deliberately and with tests**, rather than left to fail
in a way nobody predicted.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/any-schema
```

It has **no peer dependency on any schema library**. You install the vendor
packages you actually use, and this one routes between them.

## Do I need it?

Only if your schemas come from more than one **dialect**. There are four, and
they are not the same as six libraries:

| Dialect    | Libraries                        | Why it is its own dialect                         |
| ---------- | -------------------------------- | ------------------------------------------------- |
| `standard` | zod 4, valibot, arktype          | a synchronous Standard Schema — the port reads it  |
| `yup`      | yup                              | its Standard Schema is `async`, so the port cannot |
| `typebox`  | TypeBox                          | publishes no Standard Schema at all                |
| `effect`   | Effect Schema                    | its Standard Schema is behind a function           |

**An application mixing only zod, valibot and arktype does not need this
package.** They are one dialect; any one of the three validators reads all
three. The playground has the test that says so.

## Use

```ts
import { createLankaAnySchemaValidator } from "@lankajs/any-schema";
import { lankaZodValidator } from "@lankajs/zod";
import { lankaTypeBoxValidator } from "@lankajs/typebox";

// once, at module level
export const appValidator = createLankaAnySchemaValidator({
	standard: lankaZodValidator, // serves zod, valibot and arktype
	typebox: lankaTypeBoxValidator,
});
```

Then a gateway holds **one** validator and serves every feature:

```ts
const order = appValidator.validate<IOrder>(orderSchema, body, "orders.byId"); // zod
const invoice = appValidator.validate<IInvoice>(billingSchema, body, "billing"); // TypeBox
```

Register only the dialects you use. A schema whose dialect has no entry is
refused by name, and the message says which package to install.

## A library lanka has never heard of

Four dialects ship here, and they are the four with a lanka package behind them.
superstruct, io-ts, your company's own schema type, something published next
year — register it, and nothing in the framework has to change:

```ts
export const appValidator = createLankaAnySchemaValidator({
	standard: lankaZodValidator,
	custom: [
		{
			name: "superstruct",
			accepts: (schema) => schema instanceof Struct,
			validator: mySuperstructValidator,
		},
	],
});
```

A custom dialect is three things: a **name** (it appears in the message when
nothing recognises a value), an **accepts** predicate, and a **validator** with
the port's two methods.

Two rules for the predicate, both learned the hard way:

- **It is asked about ANY value** — `null`, a number, an object with a null
  prototype — before anything has decided the value is a schema. One that reaches
  into the value without a guard is reported as a dialect that threw, rather than
  crashing the router.
- **Prefer a marker to `instanceof`** where the library gives you one. A
  duplicate copy of a library in a dependency tree produces schemas that fail
  `instanceof` and work perfectly.

**Custom dialects are asked FIRST, in the order given.** That is also how a
built-in one is overridden — a team wrapping their TypeBox validator with logging
registers a custom dialect that recognises TypeBox, and it wins. Nothing is
forked.

The package's playground carries a worked example: a superstruct validator in
about forty lines, serving the same gateway as the six shipped packages.

## A schema with no library at all

`createLankaSchema` builds a Standard Schema out of a function. What comes back
is the `standard` dialect, so **every** validator in the family reads it — and
core's `lankaStandardValidator` reads it with no package installed:

```ts
const frameSchema = createLankaSchema<IFrame>((data, issue) => {
	if (!isRecord(data)) return issue("a frame is an object");

	if (data.kind !== "ping" && data.kind !== "pong") issue(`must be "ping" or "pong"`, ["kind"]);
	if (typeof data.seq !== "number") issue("must be a number", ["seq"]);

	// The returned value IS the parsed value — a mapping is a schema here too.
	return { kind: data.kind, sequence: data.seq, sentAt: new Date(Number(data.at) * 1000) };
});
```

- `issue` may be called as often as there are problems, and returns `undefined`
  so `return issue(...)` reads as the early exit it is.
- The returned value is **ignored** when anything was reported, which is what
  lets a reader collect several problems and still end with one `return`.
- A path is **segments** — `["lines", 0, "sku"]` — and no path means the form's
  root.
- A second argument names the vendor, which is what a trace shows in a mixed
  application.

**When this is the right tool:** one shape in a package that should not gain a
dependency; a rule no library spells (a format from a protocol document, a
cross-field check reaching a service); or before a library has been chosen.

**It is not a library and will not become one.** There is no `string()`, no
`object()`, no composition. Wanting those is the signal to install one of the six
packages.

## What it costs

**Inference.** `validate` cannot infer an output type across four dialects, so it
returns `unknown` unless you name one — `validate<IOrder>(…)`. With a single
library you would have had the type for free. That is a real cost, it is the
reason the type parameter is explicit rather than hidden, and it is one more
argument for choosing one library.

## What it refuses, and how

Two failures that look alike and are not:

```ts
appValidator.validate(typeBoxSchema, body, "billing");
// LankaValidationError: This is a typebox schema, and no validator was registered
// for the "typebox" dialect. Install `@lankajs/typebox` and pass it to
// `createLankaAnySchemaValidator`.

appValidator.validate({ nope: true }, body, "billing");
// LankaValidationError: This value is not a schema of any dialect lanka knows.
```

The first is an install; the second is a bug in the calling code. A single
message would send half the readers the wrong way.

**Both throw, from `validateSafe` too.** A refused **value** is an outcome a form
renders; a schema nothing was registered for is a wiring mistake, and returning
it in `errors` would put a programmer's error beside a user's input. Core and all
six vendor packages refuse an unusable schema the same way.

## Why not just try each validator in turn

Because it turns a wiring mistake into a value that passed on the third attempt,
with a validator nobody chose. And it cannot tell "your schema is from a library
you did not register" from "your data is wrong" — the two failures every one of
these packages works to keep apart.

## How a dialect is recognised

By the marker its library puts on every schema — `~standard`, `validateSync`,
TypeBox's `Kind`, Effect's own symbol — never by `instanceof`. A duplicate copy
of a library in a dependency tree produces schemas that fail `instanceof` and
work perfectly.

One ordering matters: **yup is asked before `standard`**, because a yup schema
carries `~standard` and cannot be run through it.

## Common mistakes

**Reaching for this with zod + valibot.** One dialect. You do not need it.

**Building the hub inside a component.** The TypeBox and Effect validators cache
per schema; declare the hub and the schemas at module level.

**Treating it as permission to mix.** It is a way out of a situation, not a
design.

## Recap

- Four dialects, not six libraries — zod, valibot and arktype are one.
- Register what you use; an unregistered dialect names the package to install.
- An unusable schema throws, even from `validateSafe`.
- You lose inference. That is the price of mixing, made visible.
- A library with no package: register a `custom` dialect — asked first, so it also overrides a built-in one.
- A shape with no library: `createLankaSchema`, which is the `standard` dialect and needs no registration.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/validators/any-schema/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/validators/any-schema/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
