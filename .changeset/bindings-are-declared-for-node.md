---
"@lankajs/react": patch
"@lankajs/vue": patch
"@lankajs/svelte": patch
"@lankajs/solid": patch
"@lankajs/angular": patch
---

The bindings are declared for Node.

Vue, Svelte, Solid and Angular's bindings said "browser" and React's said
"browser, React Native" — while Next, Nuxt, SvelteKit and Angular's and Solid's
server renders run every one of them in Node, and this repository's own HOST
applications do exactly that. No code changed: a binding's entries touch
nothing a server lacks, which is why `check-runtime` accepts the wider
declaration. What changes is what the package README and `COMPATIBILITY.md` tell
you — a binding no longer appears among the packages to keep out of server code.

A React Server Component still may not import `@lankajs/react`; that is what its
`"use client"` boundary is for, and it is unchanged.
