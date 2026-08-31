---
name: lanka-browser
description: Read and write cookies across both browser APIs, and drop stale caches when a new build ships — with @lankajs/browser. Use when working with cookies, when returning visitors see data from an old build, when adding a release check at startup, or when reviewing code that imports `@lankajs/browser`.
license: MIT
metadata:
    author: lankajs
    package: @lankajs/browser
    version: "1.0.0"
---

# @lankajs/browser

Two platform capabilities. `reference.md` beside this file is the full guide.

> [!NOTE]
> Only what the framework or a gate refuses is binding. Everything else here is a
> recommendation you can adapt.

## Cookies

```ts
await lankaCookies.set("locale", "uz", { expires: 30, sameSite: "lax", secure: true });
const locale = await lankaCookies.get("locale");
await lankaCookies.remove("locale");
```

`isEnabled` `set` `get` `getAll` `has` `remove` `clear` `keys` `watch`.

Everything is `async`, including on engines where the underlying API is not —
the same call works on the modern `cookieStore` and on `document.cookie`, and
your code never asks which one it got.

`expires` as a number is **days**; a `Date` also works.

Outside a browser every method degrades quietly: `set` does nothing, `get`
answers `null`, `isEnabled()` is `false`. No guard needed around each call.

A second instance (`new LankaCookies()`) is for an application that wants its own
prefix.

## The release guard

Prevents this: a returning visitor holds Cache Storage entries from a build that
no longer exists, and the new code reads them as its own.

```ts
const guard = createLankaReleaseGuard({
	readVersion: async () => (await fetch("/build-manifest.json").then((r) => r.json())).version,
	report: (message) => lankaLogger.printBootstrapLog(message),
});

const outcome = await guard.check(); // "released" | "unchanged" | "unknown"
```

`readVersion` is required and unguessable — a framework cannot know your bundler.

**It answers rather than acts.** What to do with `"released"` is yours: a banner,
a soft reload on the next navigation, or nothing. Reloading is the commonest
response and the worst default — a visitor mid-form loses it.

`memory`, `dropCaches` and `report` are all replaceable, which is what makes the
guard testable without a browser.

Call it in a bootstrap service, before the first screen.

## Never do these

- **Never treat `"unknown"` as a release.** It means the check could not run;
  dropping caches on it empties them on every failed request.
- **Never reload automatically on `"released"`** unless the product asked for it.
- **Never pass `expires` in seconds.** It is days, or a `Date`.
- **Never wrap `guard.check()` in your own try/catch as if it throws.** It cannot;
  a guard that took down start-up would be worse than the staleness.

## Symptom → cause

| What you see                      | What it is                                     |
| --------------------------------- | ---------------------------------------------- |
| caches emptied on every start     | `"unknown"` treated as a release               |
| the guard never reports a release | `readVersion` returns the same value, or empty |
| a cookie is not set               | no `window` — SSR or node; by design           |
| a cookie expires immediately      | `expires` given in seconds instead of days     |

## More

`reference.md` — the full guide, with every cookie option and the guard's
replaceable parts.
