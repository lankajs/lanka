<!-- Generated from modules/validators/yup/GUIDE.md by scripts/skills.mjs. Edit the guide. -->

> **`@lankajs/yup@0.0.0`** — this document describes that version.
>
> Install: `npm install @lankajs/yup react yup zustand` (the peers are not optional; only npm adds a missing one for you).
>
> Complete code, compiled and run in CI: [modules/validators/yup/_playground/playground.test.ts](https://github.com/lankajs/lanka/blob/main/modules/validators/yup/_playground/playground.test.ts)

# @lankajs/yup — user guide

The bridge an application that chose **yup** cannot work without: a synchronous
validator, and a `TLankaInferred` helper.

## You will learn

- why this package is required rather than a matter of taste
- where validation belongs, and what the label is for
- how to map a wire format when yup transforms before it checks

## When to reach for this

The moment your schemas are yup. Unlike the rest of
[`modules/validators/`](../), this one is not about making a choice visible — it
is what makes yup work with lanka at all.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](https://github.com/lankajs/lanka/blob/main/ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/yup yup
```

## Do I need it?

Yes, and this is the only package in the family where the answer is yes.

yup implements [Standard Schema](https://standardschema.dev) — since 1.7.x — so
you would expect core to accept its schemas directly, the way it accepts zod's
and valibot's. It does not, and the reason is one word in yup's source:

```js
get ['~standard']() {
	return { version: 1, vendor: 'yup', async validate(value) { … } };
}
```

`async`. Every yup schema returns a **promise** from `~standard.validate`, valid
value or not. lanka's validation port is synchronous and refuses a promise
loudly, on purpose — a port that answered "fine" to a value it never inspected
would let unvalidated data through. So this throws, for every yup schema you
have:

```ts
import { lankaStandardValidator } from "lanka/validation";

lankaStandardValidator.validate(signUpSchema, body, "sign-up");
// LankaValidationError: The schema is asynchronous and the validation port is synchronous.
```

`lankaYupValidator` goes through `validateSync(value, { abortEarly: false })`,
which yup has had all along, and gives you back exactly what the rest of the
family gives back.

## Use

```ts
import { lankaYupValidator } from "@lankajs/yup";
import * as yup from "yup";

const todoSchema = yup.object({
	id: yup.number().required(),
	title: yup.string().required(),
	done: yup.boolean().required(),
});

// throws a LankaValidationError, with the label in the message
const todo = lankaYupValidator.validate(todoSchema, body, "todos.byId");

// or ask instead of throwing
const result = lankaYupValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

`validate` is what a gateway wants: a body that fails is a broken contract, not a
branch to handle. `validateSafe` is for a form, where failure is ordinary.

Every failing field comes back, not the first — the bridge passes
`abortEarly: false`, because a form that reveals one problem per submit makes a
user fix three fields in three round trips.

## Types

```ts
import type { TLankaInferred } from "@lankajs/yup";

type ITodo = TLankaInferred<typeof todoSchema>;
```

## What you get back when it fails

Two lists, the same two every package in the family produces:

```ts
result.errors; // ["tags.0.id: tags[0].id must be a `number` type", …] — for a banner
result.fields; // [{ path: ["tags", 0, "id"], message: "…" }, …]        — for a form
```

yup addresses a field as `tags[0].id`; `fields[].path` is **segments**, with the
index as a number, because a form cannot parse an address back out of a string —
a message may contain a colon, a key may contain a dot.

A failure with no field at all — `yup.number().min(18)` refusing a bare `3` —
comes back with an **empty** path. That is the form's root, not an input named
`""`.

## Mapping a wire format

A mapping is a schema, not an adapter layer. **In yup the order is the opposite
of zod's**, and it matters:

- zod, valibot and arktype transform **after** validating, so their mapping
  schema describes the wire and pipes it into the domain.
- yup's `transform` is part of the **cast** and runs **before** the checks. So
  the schema describes the **domain**, and the transform produces it from the
  original value.

```ts
const todoFromApi = yup
	.object({
		id: yup.number().required(),
		title: yup.string().required(),
		done: yup.boolean().required(),
	})
	.transform((_cast, original) => ({
		id: original?.todo_id,
		title: original?.todo_title,
		done: original?.is_done === 1,
	}));

const domain = lankaYupValidator.validate(todoFromApi, wire, "todos.map");
return lankaYupValidator.validate(todoSchema, domain, "todos.check");
```

Two steps because they are two jobs: the first changes when the **server**
changes, the second when the **application** does, and each names its own label —
so a failure says which of the two contracts broke.

## Where to validate

In the gateway. A gateway is where a body stops being `unknown`; validating in
the screen instead spreads the same three guards over every consumer, and each
one gets it slightly differently wrong.

## Async tests

Refused, loudly. A yup test that returns a promise cannot run under
`validateSync`, and yup throws a plain `Error` saying so. The package turns that
into the port's own refusal, which names what to do about it: parse such data by
hand, because passing it silently would be worse than failing.

## What it costs to stay on yup

Honest numbers, from `perf/yup.perf.md` — yardsticks per call, where a yardstick
is one plain property read measured in the same process:

| | one object | a hundred of them | a refusal |
| --- | --- | --- | --- |
| zod | 1.86 | 43 | 53 |
| arktype | 1.87 | 11 | 254 |
| TypeBox | 2.63 | 8 | 68 |
| **yup** | **68** | **8,647** | **3,421** |

yup is roughly **36x dearer per object** than zod and two orders of magnitude
dearer on a list screen. None of that is this package's doing —
`lankaYupValidator` is a thin call to `validateSync` — and none of it is a reason
to panic: a hundred objects still validate in under half a millisecond, which no
user can see.

It IS a reason to know where you stand. If a screen validates a thousand rows on
every keystroke, that is the number to weigh, and the migration is a schema
rewrite rather than a framework change. If it validates a form on submit, the
cost is invisible and yup's ecosystem is worth more than the microseconds.

## Common mistakes

**Reaching for `lankaStandardValidator` because "yup supports Standard Schema".**
It does, asynchronously, which is the one shape the port cannot use.

**Splitting `fields[].path` yourself.** It is already segments. Joining it is
your call; parsing it back is not safe.

**Installing two packages from `modules/validators/`.** Pick one.

**Expecting `validate` to return a result object.** It throws. `validateSafe`
returns.

## Recap

- Without this package, lanka refuses every yup schema — yup's Standard Schema is asynchronous.
- Validate in the gateway; `validate` throws, `validateSafe` returns.
- All failing fields come back, with paths in segments and the index a number.
- A mapping is a schema — but in yup the transform runs before the checks.

---

Maintaining this package: [SKILL.md](https://github.com/lankajs/lanka/blob/main/modules/validators/yup/SKILL.md) · What it is:
[README.md](https://github.com/lankajs/lanka/blob/main/modules/validators/yup/README.md) · Repository map: [../../../README.md](https://github.com/lankajs/lanka/blob/main/README.md)
