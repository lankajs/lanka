# @lankajs/nanostores-query

**▸ module** · nanostores as a read cache

> For an application already on nanostores: one cache and one subscription model instead of two.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaNanostoresCache` + `createLankaNanostoresCache` — `ILankaReadCache` over `nanoquery()`

## TanStack Query is the default answer; this one has a reason

Take this member when the application ALREADY uses nanostores for its own state:
then it is one cache rather than two, and one subscription model rather than two.
Take TanStack Query otherwise — it implements all seven operations, this one
implements six.

## What it cannot do, and why that is honest

`cancel` is absent. `@nanostores/query` declares its fetcher as
`(...keyParts) => Promise<T>`, so no `AbortSignal` ever reaches the loader — and the
port makes `cancel` optional for exactly this reason. Declaring it as a no-op would
be worse: a ViewModel would believe the request stopped.

---

Repository map: [../../../README.md](../../../README.md)
