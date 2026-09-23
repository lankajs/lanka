---
"@lankajs/plugin-devtools": minor
---

The inspector runs anywhere lanka does — and refuses a server's request scope
when enabled.

Only the panel needs a document. Its two DOM touches are now guarded in their own
files — the panel view says it needs a DOM instead of failing on its first
element, and a redraw falls back to the next tick where a document has no
animation frames — so the package is declared for Node and React Native as well
as the browser. The plugin, the collector, `subscribe` and `getSnapshot` work in
a Node script, a test or on a device; `renderLankaDevtoolsPanel` still returns
`undefined` without a document.

**One behaviour change.** Installing an ENABLED inspector where a scope resolver
is installed — `@lankajs/host/server` — now throws. Its logger sink is the
process's, and on a server it collected every concurrent request's log lines into
one request's history. A disabled inspector, which is what a production build
ships, still installs and collects nothing. If you enabled it in server code, pass
`{ enabled: false }` there.
