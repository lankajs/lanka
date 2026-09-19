---
"@lankajs/tool-di": patch
---

`lankaDiVite` gave vite the alias and stopped there, and vite's dependency
optimizer then froze the application's own source into its cache.

**Two symptoms, one cause, and nothing reported for either.** The optimizer
pre-bundles what it finds under `node_modules` and follows aliases while it does,
so it walked `lanka`'s dist out of `node_modules`, through `@lanka_di`, into the
consuming application's source, and copied that source into
`node_modules/.vite/deps`. The cache is keyed by the lockfile and by parts of the
vite config — not by application source, and not by `.env.*` — so once app code
was inside it, no edit invalidated it:

- **the browser ran the copy taken on the day the cache was written.** Editing a
  singleton changed nothing and raised nothing; the only evidence is a stack
  frame naming `node_modules/.vite/deps/dist-*.js` where it should name `src/`;
- **`import.meta.env.VITE_*` read that day's env.** A key added to `.env.local`
  afterwards arrived as `""`, which surfaces a long way from its cause.

Reported as lankajs/lanka#6, on an app carrying 63 of its own files inside one
pre-bundle.

The vite adapter now returns `optimizeDeps.exclude` beside the alias it already
returned, from the same `lankaDiSetup` call, so the two cannot name different
things. It excludes the ALIAS and not `lanka`: an exclude entry matches as a
prefix, so `@lanka_di` covers every barrel and every package that reads one,
while `lanka` itself stays pre-bundled — which is what the optimizer is for.
Your own `optimizeDeps.exclude` is merged, not replaced.

**Nothing to clean up on upgrade.** Changing `optimizeDeps` changes the
optimizer's hash, so a poisoned cache is discarded the next time the dev server
starts, and the browser asks for new URLs. To confirm one existed:
`grep -l "#region src/" node_modules/.vite/deps/*.js` — any match is your source,
frozen. An application carrying the `optimizeDeps.exclude` workaround by hand can
drop it.

The other five bundlers need no equivalent, and three of them do cache to disk
just as heavily: webpack's filesystem cache, Turbopack's and Metro's transform
cache were each given the same test — build, edit a file the barrels export,
build again in a fresh process with the cache kept — and all three served the new
value, as do Rollup's `cache` and esbuild's incremental rebuild. Vite's
dependency optimizer is the only one of the six that treats what it pre-bundled
as immutable, because it is keyed by the lockfile rather than by the files it
read.
