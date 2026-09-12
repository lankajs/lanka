# @lankajs/any-schema

**▸ module** · Any schema, one validator

> For the application that ended up with two schema libraries: one validator that routes by dialect.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `createLankaAnySchemaValidator` — one validator over the vendor validators an app installed
- `lankaSchemaDialect` — which dialect a schema belongs to, by shape alone

## This is not the recommended way to use lanka

One application, one schema library. Two means two ways to spell the same rule, two
sets of error messages, and a reviewer who has to know both. The advice in every
other package in this family — install exactly one — still stands.

It happens anyway: a merger, a team that standardised on something else, a vendored
SDK exporting zod schemas into an application written in Effect. So it is supported,
deliberately and with tests, rather than left to fail in a way nobody predicted.

## Why a package and not a snippet

Because the interesting part is the REFUSAL. Each vendor validator now rejects a
schema from another library loudly, which means a gateway holding one validator
cannot serve two libraries — and the obvious workaround, a `try`/`catch` ladder over
all of them, turns a wiring mistake into a value that passed on the third attempt.

Routing by DIALECT makes the failure land in the right place: a schema whose dialect
nothing was registered for says which package to install, and a schema of no known
dialect says that instead of guessing.

## It depends on none of the six

The dialects are told apart by SHAPE — `~standard`, `validateSync`, TypeBox's `Kind`,
Effect's own guard — so this package has no peer dependency on any schema library and
an application pays only for the ones it installed.

---

Repository map: [../../../README.md](../../../README.md)
