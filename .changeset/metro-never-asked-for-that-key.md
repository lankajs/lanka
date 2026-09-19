---
"@lankajs/tool-di": patch
---

`lankaDiMetro` filed the alias under a key Metro never asks for, so React Native
consumers could not resolve a single barrel.

The adapter wrote one `extraNodeModules` entry — `{ "@lanka_di": dir }` — the way
every other adapter here writes an alias. Metro's map is keyed by PACKAGE NAME,
and `metro-resolver` reads a specifier starting with `@` as a scope:
`@lanka_di/Gateways` arrives as one package name with an empty subpath, never as
`@lanka_di` plus `Gateways`. Nothing matched, and every consumer got

```
Unable to resolve module @lanka_di/Gateways
```

naming a specifier their config plainly contained.

The adapter now registers one entry per barrel, named in full, and Metro adds the
extension from `sourceExts` as it does for any other module. All six barrels were
resolved through the real `metro-resolver` 0.83.3 from the config the adapter
hands back. The bare `@lanka_di` entry stays beside the six: Metro ignores it, and
a wrapper composing after this adapter reads it to find the directory.

Nothing to change in your `metro.config.js`.
