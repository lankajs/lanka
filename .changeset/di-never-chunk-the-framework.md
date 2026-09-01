---
"@lankajs/tool-di": patch
---

The shipped skill and the guide state the bundling consequence of the `@lanka_di`
inversion: the framework imports the consumer's barrels, so a manual chunk rule
that captures `lanka` captures the application graph with it, and the chunks that
graph needs import back — circular chunks whose evaluation order decides whether
the application boots. With it, the rule a consumer needs before the first one
bites: match a chunk rule against the package specifier, everything after the last
`node_modules/`, never against the module id, which under pnpm carries the
peer-resolved store directory and therefore the name of every peer.
