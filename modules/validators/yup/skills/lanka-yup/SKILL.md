---
name: lanka-yup
description: Validate server responses with yup schemas in a lanka application. Use when adding validation to a gateway, when a lanka app's schemas are yup, when core's validator throws "the schema is asynchronous" on a yup schema, when a response shape must be mapped into the application's own, or when reviewing code that imports `@lankajs/yup`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/yup
    version: "0.0.0"
---

# @lankajs/yup

A synchronous bridge over `validateSync`, plus `TLankaInferred`. `reference.md`
beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Do you need it?

**Yes — this is the one package in the family that is not optional.**

yup implements Standard Schema, but `~standard.validate` is declared `async` and
returns a promise for every schema. lanka's validation port is synchronous and
refuses a promise loudly, so `lankaStandardValidator` throws on **every** yup
schema:

```ts
lankaStandardValidator.validate(signUpSchema, body, "sign-up");
// LankaValidationError: The schema is asynchronous and the validation port is synchronous.
```

`lankaYupValidator` goes through `validateSync(value, { abortEarly: false })`
instead. Install this **or** another package from `modules/validators/`, never
two.

## Use

```ts
const todoSchema = yup.object({
	id: yup.number().required(),
	title: yup.string().required(),
	done: yup.boolean().required(),
});

// in a gateway: a failing body is a broken contract, not a branch
const todo = lankaYupValidator.validate(todoSchema, body, "todos.byId");

// in a form: failure is ordinary, and EVERY failing field comes back
const result = lankaYupValidator.validateSafe(todoSchema, body);
if (!result.success) showErrors(result.errors);
```

```ts
type ITodo = TLankaInferred<typeof todoSchema>;
```

The third argument is the label. It appears in the error and the log, and it is
what turns "invalid response" into "which call".

## What a failure looks like

```ts
result.errors; // ["tags.0.id: …"]                       — for a banner
result.fields; // [{ path: ["tags", 0, "id"], message }] — for a form
```

yup writes `tags[0].id`; `path` is segments with the index as a **number**. A
refusal with no field — `yup.number().min(18)` against `3` — has an **empty**
path, which is the form's root rather than an input named `""`.

## Mapping a wire format — the order is yup's, not zod's

zod and valibot transform AFTER validating. **yup's `transform` runs during the
cast, BEFORE the checks**, so the schema describes the DOMAIN and the transform
produces it from the original value:

```ts
const todoFromApi = yup
	.object({ id: yup.number().required(), done: yup.boolean().required() })
	.transform((_cast, original) => ({ id: original?.todo_id, done: original?.is_done === 1 }));

const domain = lankaYupValidator.validate(todoFromApi, wire, "todos.map");
return lankaYupValidator.validate(todoSchema, domain, "todos.check");
```

## Never do these

- **Never reach for `lankaStandardValidator` with a yup schema.** It throws,
  always — that is what this package is for.
- **Never validate outside the gateway.**
- **Never install two validation packages.**
- **Never expect `validate` to return a result object.** It throws;
  `validateSafe` returns.
- **Never parse `fields[].path` back out of a joined string.** It is already
  segments.
- **Never use an async `test()` in a schema lanka validates.** It cannot run
  under `validateSync` and is refused loudly.

## Symptom → cause

| What you see                                  | What it is                                             |
| --------------------------------------------- | ------------------------------------------------------ |
| "the schema is asynchronous" on every call    | `lankaStandardValidator` instead of `lankaYupValidator` |
| the same message, only on one schema          | an async `test()` in that schema                       |
| one error when three fields are wrong         | not this package — it passes `abortEarly: false`       |
| a message with no field to attach it to       | a top-level refusal; its path is empty, show it at the root |
| "invalid response" with no idea which         | a label that does not identify the call                |

## More

`reference.md` — the full guide, including what the bridge does with yup's
bracketed paths.
