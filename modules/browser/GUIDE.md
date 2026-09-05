# @lankajs/browser — user guide

Two platform capabilities that every application needs and nobody enjoys
writing: **cookies** across the two APIs an engine might have, and a **release
guard** that notices when a new build shipped and drops the caches the old one
filled.

## You will learn

- one cookie API over the two an engine might have
- how to notice that a new build shipped, and why the guard does not act on it

## When to reach for this

Reach for the cookies when you touch cookies at all; reach for the release guard
when the app caches anything across deploys — which it does the moment you use
the blob cache or the Cache Storage polyfill.

> [!NOTE]
> Everything below is how this package is _meant_ to be used, not how it must
> be. The framework bends at the seams it publishes — see
> [ARCHITECTURE.md](../../ARCHITECTURE.md) for what is checked and what is
> merely advice.

## Install

```bash
npm install @lankajs/browser
```

## Cookies

```ts
import { lankaCookies } from "@lankajs/browser";

await lankaCookies.set("locale", "uz", { expires: 30, sameSite: "lax", secure: true });
const locale = await lankaCookies.get("locale");
await lankaCookies.remove("locale");
```

| Method                    | Answers                                     |
| ------------------------- | ------------------------------------------- |
| `isEnabled()`             | are cookies available at all                |
| `set(name, value, opts?)` | writes; an object value is JSON-stringified |
| `get<T>(name)`            | the value as it was written, or `null`      |
| `getAll<T>()`             | every cookie as a record                    |
| `has(name)`               | is it there                                 |
| `remove(name, opts?)`     | deletes one                                 |
| `clear()`                 | deletes all                                 |
| `keys()`                  | the names                                   |
| `watch(names, handler)`   | changes, where the engine supports it       |

Everything is `async`, including on engines where the underlying API is not. That
is the point: the same call works on the modern `cookieStore` and on
`document.cookie`, and your code never asks which one it got.

**`get` is the inverse of `set`.** An object goes in and an object comes back; a
string goes in and the same string comes back, whatever it looks like. A cookie
holding `"1234567890123456789"` is a string, not a number whose last digits have
been rounded away, and one holding `"null"` is a cookie that exists.

### Options

```ts
{ expires: 30 | new Date(), path, domain, secure, sameSite: "strict" | "lax" | "none", partitioned }
```

A numeric `expires` is **days**.

### A second instance

`lankaCookies` is the one every caller wants. The class is exported because a
second instance becomes useful the day your application needs cookies under its
own prefix:

```ts
import { LankaCookies } from "@lankajs/browser";

const cookies = new LankaCookies();
```

### Outside a browser

Every method degrades quietly when there is no `window`: `set` does nothing,
`get` answers `null`, `isEnabled()` is `false`. SSR and node tests do not need a
guard around each call.

## The release guard

The failure it prevents: a returning visitor holds Cache Storage entries from a
build that no longer exists — avatars keyed by a URL scheme that changed, a
polyfilled cache whose shape moved — and the new code reads them as its own.

The framework is what _creates_ those caches ([`@lankajs/blob-cache`](../blob-cache/GUIDE.md),
the Cache Storage polyfill in [`@lankajs/storage`](../storage/GUIDE.md)), which is
why noticing is its business.

```ts
import { createLankaReleaseGuard } from "@lankajs/browser";

const guard = createLankaReleaseGuard({
	readVersion: async () => (await fetch("/build-manifest.json").then((r) => r.json())).version,
	report: (message) => lankaLogger.printBootstrapLog(message),
});

const outcome = await guard.check();
```

| Outcome       | Meaning                                        |
| ------------- | ---------------------------------------------- |
| `"released"`  | a new version; the caches were dropped         |
| `"unchanged"` | same build as last time                        |
| `"unknown"`   | the version could not be read; nothing dropped |

**It answers rather than acts.** Reloading the page is the commonest response and
the worst default — a visitor halfway through a form would lose it. What to do
with `"released"` is your decision: a banner, a soft reload on the next
navigation, or nothing at all.

**Not knowing is not a release.** An unreadable version returns `"unknown"` and
drops nothing; the alternative empties the caches on every failed request.

The guard never throws. A guard that took down start-up because it could not read
a cache would be worse than the problem it exists for.

### `readVersion` is required, and unguessable

A framework cannot know your bundler. With vite it is a fetch of a manifest the
build stamps; with a service worker it is the worker; with an environment
variable it is two words. Whatever it is, it is yours.

### Replaceable parts

```ts
createLankaReleaseGuard({
    readVersion,
    memory: { read: () => …, write: (v) => … }, // default: localStorage
    dropCaches: async () => { … },              // default: every Cache Storage cache
    report: (message) => { … },
});
```

All three exist so the guard is testable without a browser, and so an application
with its own storage or its own idea of "what a release invalidates" can say so.

## Where to call it

In a bootstrap service, before the first screen:

```ts
await lanka.bootstrap({
	services: [
		{
			name: "release",
			init: async () => {
				await guard.check();
			},
			sync: true,
		},
	],
});
```

## Common mistakes

**Treating `"unknown"` as a release.** It means the check could not run. Dropping
caches on it turns one failed request into an empty cache.

**Reloading automatically on `"released"`.** See above — it is why the guard
returns a value.

**Passing `expires` in seconds.** It is days, or a `Date`.

## Recap

- Every cookie method is `async` on both APIs, and degrades quietly outside a browser.
- `expires` as a number is **days**.
- The guard returns `released` / `unchanged` / `unknown` and acts on none of them — reloading is the commonest response and the worst default.
- `unknown` is not a release: dropping caches on it empties them on every failed request.

---

Maintaining this package: [SKILL.md](./SKILL.md) · What it is:
[README.md](./README.md) · Repository map: [../../README.md](../../README.md)
