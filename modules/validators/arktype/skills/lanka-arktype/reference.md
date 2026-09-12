<!-- Generated from modules/validators/arktype/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/arktype@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/arktype arktype react zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/validators/arktype/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/validators/arktype/_playground/playground.test.ts)

# @lankajs/arktype — user guide

Conveniences for an application that chose **arktype**: a validator under a name
that says which library it is for, and a `TLankaInferred` helper.

## You will learn

- why this package is almost nothing, and why it still exists
- where validation belongs, and what the label is for

## When to reach for this

Install it to make the choice of schema library explicit. Core already accepts
arktype schemas directly, so nothing here is a capability you lack without it.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/arktype arktype
```

## Do I need it?

Honestly: not for capability, and that is by design.

**arktype implements [Standard Schema](https://standardschema.dev) — from its
second major, synchronously — and core accepts its schemas directly.** So this
already works:

```ts
import { lankaStandardValidator } from "lanka/validation";

const todo = lankaStandardValidator.validate(todoSchema, body, "todos.list");
```

`lankaArkTypeValidator` **is** `lankaStandardValidator`, under a name that says
what your application validates with. The package exists so the choice is made
once and explicitly: an application installs **one** package from
[`modules/validators/`](../) — or none, and works with schemas directly. Your
dependency list then shows which library your schemas are.

There is less code here than in [`@lankajs/yup`](https://github.com/lankajs/lanka/blob/main/modules/validators/yup/GUIDE.md) or
[`@lankajs/typebox`](https://github.com/lankajs/lanka/blob/main/modules/validators/typebox/GUIDE.md) for an honest reason: those libraries do
not hand a synchronous Standard Schema to the port, and arktype does. Thickness
in this family is a fact about the library, not about the package.

## Use

```ts
import { lankaArkTypeValidator } from "@lankajs/arktype";
import { type } from "arktype";

const todoSchema = type({ id: "number", title: "string", done: "boolean" });

// throws a LankaValidationError, with the label in the message
const todo = lankaArkTypeValidator.validate(todoSchema, body, "todos.byId");

// or ask instead of throwing
const result = lankaArkTypeValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

`validate` is what a gateway wants: a body that fails is a broken contract, not a
branch to handle. `validateSafe` is for a form, where failure is ordinary.

## Types

```ts
import type { TLankaInferred } from "@lankajs/arktype";

type ITodo = TLankaInferred<typeof todoSchema>;
```

## Transforming as you validate

Standard Schema's `validate` returns the **transformed** value, so mapping a wire
format into your own vocabulary is just a second schema — `.pipe(...)` in
arktype:

```ts
const domain = lankaArkTypeValidator.validate(todoApiSchema, wire, "todos.map");
return lankaArkTypeValidator.validate(todoSchema, domain, "todos.check");
```

Two steps because they are two jobs: the first changes when the **server**
changes, the second when the **application** does.

## Where to validate

In the gateway. A gateway is where a body stops being `unknown`; validating in
the screen instead spreads the same three guards over every consumer, and each
one gets it slightly differently wrong.

## Async schemas

Rejected, loudly. A synchronous port cannot await one, and answering "fine" would
let unvalidated data through.

## Common mistakes

**Installing two packages from `modules/validators/`.** Pick one. The point of
the package is that the choice is visible.

**Expecting `validate` to return a result object.** It throws. `validateSafe`
returns.

**Passing a label that does not identify the call.** The label is what turns
"invalid response" into "which request", in the error and in the log.

## Recap

- `lankaArkTypeValidator` **is** core's validator, under a name that says which library your schemas are.
- Validate in the gateway; `validate` throws, `validateSafe` returns.
- A mapping is just a second schema.
- Install exactly one package from `modules/validators/`, or none.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/validators/arktype/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/validators/arktype/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
