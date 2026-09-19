# @lanka-playgrounds/_shared

The half of the application that does not know which host renders it.

The underscore is the same mark `_server/` carries: this is not one of the four
applications, it is what all four are made of.

Gateways, scenarios, ViewModels, schemas and the start-up chain — everything that
runs unchanged in a browser, on a server and on a device. What is left in each
host package is precisely what could NOT be shared, which is the most useful
thing these playgrounds have to say.

## What is in it, and why each piece is there

| Layer            | What it demonstrates                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| gateways         | both writing styles, four transports, and a body that stops being `unknown`      |
| scenarios        | facts in the past tense, one of them written as a class and three by calling      |
| ViewModels       | stateful (both styles), shared-store (both styles), stateless, lazy, and a form's other half |
| shared store     | two dispatch steps co-editing one draft                                          |
| singletons       | one with a dependency (registered as an instance), one declared by calling        |
| validation       | six libraries, four dialects, one hub                                            |
| failures         | what a screen shows, and what goes under which input                             |

## Six schema libraries, deliberately

**Read this before copying it.** One application, one schema library is what
every package in `modules/validators/` says, and that advice does not change
because this application mixes.

Atlas mixes on purpose, because a playground with one library cannot show what
the other three dialects cost — and because the mixed case is the one that
arrives with a merger, a vendored SDK, or a screen older than the decision. The
price is visible at every call site: `validate` cannot infer across dialects, so
the type is named.

## The tree

The by-layer shape, so a reader who knows one lanka application knows this one:

```
src/
├── Core/
│   ├── Configs/       the host's copy, and the start-up chain
│   ├── Failures/      what a screen shows, and what goes under which input
│   ├── Interfaces/    the domain, as this application says it
│   ├── SharedStores/  one draft, two editors
│   ├── Singletons/    the session, and a clock a test can replace
│   └── Validation/    six libraries, four dialects, one hub
├── Gateways/          AtlasMissionGateway, AtlasCrewGateway, …
├── Scenarios/
│   ├── ScenarioTypes/ T<Name>EventData.ts — a payload has more than one reader
│   └── Scenarios/     <Name>/ — the fact itself
├── ViewModels/        <Name>ViewModel/, with `_Services/` for what its actions use
└── startAtlas.ts
```

A payload type lives in `ScenarioTypes/` rather than beside its scenario because
it has more than one owner: the scenario declares it, every subscriber reads it,
and so does whatever bridge turns a server event into it.

## Two barrels

`index.ts` is what a host imports. `di.ts` is what a host's `.lanka/` barrels
import, and it is narrower on purpose: the framework reads those barrels from
inside `lanka/locator`, so whatever they reach for is pulled in while the locator
is still evaluating. Pointed at the main barrel, that meant pulling in the
start-up file and every ViewModel — and one of them read a framework class off a
module that had not finished initialising.

**A `.lanka` barrel imports the narrowest thing that has what it needs.**

## Testing it

```bash
pnpm --filter @lanka-playgrounds/_shared test
```

`atlas.live.test.ts` starts the real API on a free port and drives the whole
stack through it. Everything else uses doubles, which is where a rollback, a
refusal and a cancelled call can be driven on demand.
