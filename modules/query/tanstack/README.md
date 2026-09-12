# @lankajs/tanstack-query

**▸ module** · TanStack Query as a read cache

> The recommended member: the only measured library that implements all seven operations.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser, node and React Native — everywhere.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `LankaTanstackCache` + `createLankaTanstackCache` — `ILankaReadCache` over a `QueryClient`

## Install this only where there is no host cache

Next, React Router v7 and TanStack Start each carry a request cache and its
revalidation. A second one disagrees with theirs on the first mutation, and the
application owns the disagreement. This package is for the case where the slot is
EMPTY — a plain Vite SPA — not for the case where it is taken.

## The client is a parameter, never a default

If anything else in the application reads the same cache — `useQuery` in a component,
devtools — it must be the SAME `QueryClient`. Two of them disagree on the first
mutation, silently, so the constructor refuses to invent one.

---

Repository map: [../../../README.md](../../../README.md)
