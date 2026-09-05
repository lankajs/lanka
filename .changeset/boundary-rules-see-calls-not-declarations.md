---
"@lankajs/tool-eslint": minor
---

The boundary rules report calls, not declarations. `gateways-only-in-viewmodels`, `no-gateway-to-gateway` and `no-viewmodel-to-viewmodel` no longer report a type-only import (`import type { X }`, or every specifier marked `type`) — it is erased before anything runs, and the first consumer's 240 findings were 219 of those. The two gateway rules take `declarationPattern`, a pattern over the import source naming the gateway's schemas, error classes and response types, which are shapes shared rather than requests made; `no-viewmodel-to-viewmodel` takes `sharedStores`, the folder names of the ladder's third rung, so the session store is named instead of the rule being switched off for the files that read it. The guide and the skill now use the options' real names — `upperDirs`, `gatewayPattern`, `allowedDirs` — where they had `topLayers`, `gatewayImport` and `allowedIn`, which the schemas rejected.
