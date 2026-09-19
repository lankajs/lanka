---
"@lankajs/tool-di": minor
---

Server rendering could not start: vite handed `lanka` to node, and node has never
heard of the alias vite invented.

`lankaDiVite` set the alias for vite. Vite externalises anything under
`node_modules` for SSR, and an externalised module is loaded by NODE — so the
framework's published code asked node for a barrel and got

```
Cannot find package '@lanka_di/Singletons' imported from
…/node_modules/lanka/dist/locator.js
```

Every consumer rendering on a server — Astro, SvelteKit, Nuxt, React Router,
TanStack Start — hit this, while the client half of the same application worked
perfectly, which is most of what made it expensive to read.

The `config` hook now returns a third field beside the alias:

```ts
ssr: {
	noExternal: ["lanka"];
}
```

Naming the framework as one to PROCESS keeps it inside vite, where the alias
exists. It is the only package that needs naming — the modules and plugins reach
your barrels through it. Your own `ssr.noExternal` is merged, not replaced, so an
application that added `"lanka"` itself can drop the entry or keep it.

New on the contract: `lankaDiContract.packageName` is `"lanka"`. Everything else
this tool knows is said in terms of the alias, and the alias cannot express this
one — it names what is imported, never who imports it, and a bundler being told
which package to process needs the importer.
