---
"@lankajs/tool-di": minor
---

Vite 8 is supported: the optional peer range is now `vite ^7.3.1 || ^8.0.0`.

`_playgrounds/versions/vitest-5` runs a real Vite 8 build of an application that
loads lanka through `lankaDiVite`, and asserts that every `@lanka_di/…` import was
bundled and the barrels were scaffolded — the two things that fail without the
adapter, since Vite 8 in library mode leaves an unresolved import external
instead of refusing it.
