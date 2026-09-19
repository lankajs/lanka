---
"@lankajs/tool-di": patch
---

A relative `root` in your bundler config produced a relative alias, and a relative
alias is not a path.

`root: "app"` is an ordinary vite config, and every bundler resolves its root
against the working directory before using it. `lankaDiSetup` normalised the
separators and passed the relative form straight through, so the alias became
`app/.lanka` — which vite reads as a bare specifier and looks for in
`node_modules`. On a real dev server: HTTP 500, `Failed to resolve import
@lanka_di/Singletons`. After: 200.

What hid it is that the other half still worked. The directory is found with
`existsSync`, which resolves against the same working directory, so the barrels
were scaffolded correctly and the plugin reported a healthy setup — only the
alias was wrong, and only at import time.

The root is now resolved in `lankaDiSetup`, so every adapter gets an absolute
alias whether its root came from the bundler or from you.
