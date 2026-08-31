<!-- Generated from modules/zod/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

# @lankajs/zod — user guide

Conveniences for an application that chose **zod**: a validator under a name that
says which library it is for, a `TLankaInferred` helper, and a bridge for zod 3.

## You will learn

- whether you need this package at all
- where validation belongs, and what the label is for
- how to map a wire format without an adapter layer

## When to reach for this

Install it to make the choice of schema library explicit, and install it if you
are on zod 3, which does not expose Standard Schema. On zod 4 core already
accepts your schemas directly.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/zod zod
```

## Do I need it?

Honestly: often not, and that is by design.

**zod 4 implements [Standard Schema](https://standardschema.dev), and core
accepts its schemas directly.** So `lankaStandardValidator` already works:

```ts
import { lankaStandardValidator } from "lanka/validation";

const todo = lankaStandardValidator.validate(todoSchema, body, "todos.list");
```

The package exists to make the choice **explicit**. An application installs one
validation package — this or [`@lankajs/valibot`](https://github.com/lankajs/lanka/blob/main/modules/valibot/GUIDE.md) — or neither
and works with schemas directly. Your dependency list then says which library
your schemas are.

You **do** need it if you are on **zod 3**, which does not expose Standard
Schema. The bridge is here rather than in core for the same reason the package
exists: it is knowledge about a specific library and a specific version, and core
knows only the protocol.

## Use

```ts
import { lankaZodValidator } from "@lankajs/zod";
import { z } from "zod";

const todoSchema = z.object({ id: z.number(), title: z.string(), done: z.boolean() });

// throws a LankaValidationError, with the label in the message
const todo = lankaZodValidator.validate(todoSchema, body, "todos.byId");

// or ask instead of throwing
const result = lankaZodValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

`validate` is what a gateway wants: a body that fails is a broken contract, not a
branch to handle. `validateSafe` is for a form, where failure is ordinary.

It detects which zod it was given. A schema exposing `~standard` goes straight to
core's validator; anything else goes through `safeParse`, and the errors come
back as `"path: message"` strings.

## Types

```ts
import type { TLankaInferred } from "@lankajs/zod";

type ITodo = TLankaInferred<typeof todoSchema>;
```

## Transforming as you validate

Standard Schema's `validate` returns the **transformed** value, so mapping a wire
format into your own vocabulary is just a second schema — there is no adapter
layer, because there is nothing for it to do:

```ts
const domain = lankaZodValidator.validate(todoApiSchema, wire, "todos.map");
return lankaZodValidator.validate(todoSchema, domain, "todos.check");
```

Two steps because they are two jobs: the first changes when the **server**
changes, the second when the **application** does.

## Where to validate

In the gateway. A gateway is where a body stops being `unknown`; validating in
the screen instead spreads the same three guards over every consumer, and each
one gets it slightly differently wrong.

## Async schemas

Rejected, loudly. A synchronous port cannot await one, and answering "fine" would
let unvalidated data through — a check that cannot fail reporting success.

## Common mistakes

**Installing both `@lankajs/zod` and `@lankajs/valibot`.** Pick one. The point of the
package is that the choice is visible.

**Expecting `validate` to return a result object.** It throws. `validateSafe`
returns.

**Passing a label that does not identify the call.** The label is what turns
"invalid response" into "which request", in the error and in the log.

## Recap

- Validate in the gateway — that is where a body stops being `unknown`.
- `validate` throws, `validateSafe` returns; a broken response contract is not a branch.
- The label turns "invalid response" into "which call".
- A mapping is just a second schema, because `validate` returns the transformed value.
- Install this **or** `@lankajs/valibot`, never both.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/zod/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/zod/README.md) · Repository map: [../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
