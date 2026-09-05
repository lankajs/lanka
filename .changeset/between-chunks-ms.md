---
"@lankajs/plugin-prefetch": minor
---

The pause between two chunks of the sweep is `betweenChunksMs`. It shipped as `thingMs`, a name that said nothing; the old name is still read when the new one is absent, so no configuration breaks on upgrade.
