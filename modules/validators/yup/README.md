# @lankajs/yup

**▸ module** · yup conveniences

> The one package in the family a yup application cannot work without: a synchronous bridge.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `lankaYupValidator` — the synchronous bridge, because yup's Standard Schema is async
- `TLankaInferred<S>` — schema type inference

## Why this package is not optional

Every other package in `modules/validators/` exists to make a CHOICE visible: core
already accepts the library's schemas and the package is a name. This one is different.

yup does implement Standard Schema — since 1.7.x — but its `~standard.validate` is
declared `async` and therefore returns a promise for every schema, valid or not. The
framework's validation port is SYNCHRONOUS and refuses a promise loudly, on purpose: a
port that answered "fine" to a value it never inspected would let unvalidated data
through. So without this package a yup schema cannot be validated by lanka at all —
not slowly, not partially: every call throws.

The bridge is `validateSync(value, { abortEarly: false })`, which yup has had all
along. It lives here rather than in core for the same reason the zod 3 bridge does:
it is knowledge about a specific library and a specific version, and core knows only
the protocol.

## What the bridge has to translate

Three things, each found by a test rather than by reading the documentation:

- **Paths are bracketed.** yup says `tags[0].id`; `ILankaFieldError.path` is
  segments, so it becomes `["tags", 0, "id"]` and the message string stays
  `tags.0.id: …`, which is how the whole family reads.
- **A top-level failure has no path.** `yup.number().min(18)` refusing `3` reports
  `path: undefined`, which is the form's ROOT rather than an input named `""`.
- **An async test cannot run synchronously.** yup throws a plain `Error` saying so.
  Passed through as-is it would reach a consumer as a stray library error; it comes
  back as the port's own loud refusal instead.

---

Repository map: [../../../README.md](../../../README.md)
