# @lankajs/browser

**▸ module** · Platform capabilities

> Things with no single API and a fallback for older engines.

A library in the same box. The app imports and calls it; core does not know it exists.

**Runs in:** the browser.

**How to use it:** [GUIDE.md](./GUIDE.md) — the user guide, with examples. **How to change it:** [SKILL.md](./SKILL.md).

## Contents

- `cookies/` — Cookie Store API with a `document.cookie` fallback

## The release guard needs one thing from the application

`createLankaReleaseGuard` notices that a new build shipped and drops the caches the old one filled — the framework's own among them, since `@lankajs/blob-cache` and the Cache Storage polyfill are what fill them.

It cannot know what version this build is: that is the bundler's answer, and this package has no bundler. `readVersion` is required and unguessable — with vite it is a fetch of a manifest the build stamps, with a service worker it is the worker, with an env variable it is two words.

Everything else has a default that can be replaced: where the last seen version is kept (`localStorage`), and what a new release invalidates (every Cache Storage cache).

It ANSWERS rather than acts. Reloading the page is the commonest response and the worst default: a visitor halfway through a form would lose it.

---

Repository map: [../../README.md](../../README.md)
