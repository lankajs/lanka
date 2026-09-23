---
"lanka": minor
---

A ViewModel can belong to a scope, and leaves the bus when the scope closes.

A module that mounts into a page and later leaves it — a route, a modal, a
separately built micro-frontend — builds ViewModels that subscribe to
scenarios. Until now, leaving meant remembering `resetScenario()` for each of
them, and the one forgotten kept running handlers against a screen that was
gone. Scopes already gave services that lifetime; ViewModels did not have it.

## What changes

- **`resolveLankaVM(definition, { scope })`** — `lanka/extend`, a new optional
  second argument, typed `ILankaResolveVMOptions`. The ViewModel resolved with a
  scope is that scope's own: one per definition in it, a different instance from
  the page's, and never adopted by a later framework instance.
- **`scope.dispose()`** now also takes the scope's ViewModels off the bus and out
  of the registry, before it disposes the scope's services.
- A closed scope refuses to resolve a ViewModel, as it already refused to resolve
  a service.

A scope still takes only ITS OWN. A ViewModel joins one by being resolved in it,
never by having been built while some callback ran — so a shared ViewModel first
touched from inside a module survives the module.

## A lazy ViewModel belongs where it was resolved

`createLazyLankaVM` and its two siblings build on their first READ, which comes
after `resolveLankaVM` returned. That build ran outside the scope it was resolved
in, so a lazy ViewModel resolved per request on a server was declared into the
process-wide list every later request adopts — one request's handlers running
against another's. A lazy ViewModel now builds under the scope it was declared
in, whenever it is first read; and a first read after its scope closed is refused
with the same "the scope is closed" a resolve gets.

## Also in this release

- **`ILankaEventBusOutcome` carries `data` on a DELIVERED outcome**, and only
  there: a payload handed out on "stopped" would route around the middleware
  that stopped it. An observer that repeats a delivery elsewhere needs exactly
  this. `@lankajs/plugin-relay` is the first.
- **`hasLankaScopeResolver`** is published from `lanka/internal`, the tier
  sibling packages read.

## What you do

Nothing, unless a screen of yours mounts and unmounts. If one does, hold its
ViewModel as a `defineLankaVM` definition and resolve it in the scope the screen
lives in. `core/GUIDE.md`, "Scopes", has the four lines.
