---
"@lankajs/tool-di": patch
---

`lankaDiWebpack` destroyed every alias a project had already declared, if it
declared them as a list.

`resolve.alias` is a map OR a list of `{ name, alias }` — both are webpack, and
the plugin merged only the map. Spread over the list form, which is
`{ "0": entry, "1": entry }` to the spread operator, each of your aliases came
back named after its index and pointing at an object.

Webpack does not complain about that. It fails later, resolving something this
plugin never touched, and the alias named in the message is not the one that
broke.

Both shapes are now answered, and a list stays a list. If you moved your aliases
to the map form to work around this, you can move them back.
