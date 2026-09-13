# \_playgrounds

> **THIS IS NOT A REFERENCE ARCHITECTURE. IT IS A TEST AND DEMONSTRATION
> ENVIRONMENT FOR EVERY CAPABILITY THE SYSTEM HAS, ALL SWITCHED ON AT ONCE.**
>
> **A REAL PROJECT SHOULD DO THE OPPOSITE: UNIFY ITS APPROACH TO DESIGN AND
> SYSTEM DESIGN, AND CHOOSE THE SPECIFIC TECHNOLOGIES IT NEEDS RATHER THAN
> MIXING EVERYTHING TOGETHER.**

What that means concretely. These packages install five transports, three
storage engines, four validator dialects and every optional module, because the
point is to run all of them against each other and find where they disagree. No
application needs that, and one that copied it would be paying — in bundle size,
in dependencies, in the number of things a new reader must learn — for coverage
that only a test environment has a use for.

The same goes for the shape: four host frameworks side by side is a statement
about the FRAMEWORK's portability, not a suggestion that a project should hold
four. Pick one host, one transport, one validator, one storage engine. What is
worth copying here is the smaller-grained decisions — how a gateway is separated
from a ViewModel, where a scenario's payload type lives, what a silent refresh
does when it fails — and `ARCHITECTURE.md` is where those are actually argued.

One application, written four times over one shared core, against one real
server.

Every package in this repository has a `_playground/` proving its own parts
still fit. Nothing proved that **twenty-two packages fit each other**, inside a
host framework, over a real wire — and the failures that live in that gap are the
ones a consumer meets first. These six packages are that proof.

They are not published. Nothing here is in `scripts/registry.mjs`, nothing is in
`api/`, and every manifest is `private`.

**Two of the six carry an underscore, because they are not applications.**
`_server/` is the OTHER SIDE of the wire and holds no gateway, no scenario and
no ViewModel — it is the thing those talk to. `_shared/` is the half of the
application that no host owns. The four bare names are the four applications, and
the mark is what lets `ls` say which is which. It is the same mark
`skills/structure/SKILL.md` puts on a folder that names a kind rather than a
subject.

## What is here

| Package                          | What it is                                                              |
| -------------------------------- | ----------------------------------------------------------------------- |
| [`_server/`](./_server)          | The API all four talk to: REST, SSE, WebSocket, GraphQL, gRPC-Web        |
| [`_shared/`](./_shared)          | The application: gateways, scenarios, ViewModels, schemas — no host      |
| [`react/`](./react)              | A Vite single-page application: every package a browser can run          |
| [`next/`](./next)                | Next App Router: an instance per request, data as a prop                 |
| [`astro/`](./astro)              | Astro: a server-rendered page and a client island                        |
| [`react-native/`](./react-native)| Expo: no DOM, three storage engines, the one that answers on frame one   |

## Why four applications and not one

Next and Expo cannot be the same program. One bundles for node and the browser
through webpack and Turbopack, the other for Hermes through Metro, and their
dependency trees disagree about React's renderer. Astro adds a third bundler and
a fourth rendering mode.

What they SHARE is the half that is portable by design — gateways, scenarios,
ViewModels, schemas, failures. That half is `_shared/`, and each host package is
the thin part that could not be shared. Reading the four side by side is the
shortest honest answer to "what does this framework actually ask of my app".

## The tree inside each one

The by-layer shape [`ARCHITECTURE.md`](../ARCHITECTURE.md) describes, which is
what the reference applications use:

```
src/
├── App/         the shell: what wraps every screen
├── Core/        Interfaces, Configs, Validation, Failures, Singletons, SharedStores
├── Gateways/    one folder per backend subject
├── Modules/     the screens themselves, one folder per feature
├── Scenarios/   Scenarios/<Name>/ and ScenarioTypes/T<Name>EventData.ts
├── ViewModels/  one folder per screen, with `_Services/` for what its actions use
└── startApp.ts  the one file that starts the framework
```

Not every application has every layer, and that is the point of the shape rather
than a gap in it: the device application has no `Gateways/` of its own because it
uses `_shared/`'s, and the Next application has no `App/` because Next's `app/`
is the shell.

**The layer folders are PascalCase, and the framework's own packages are not.**
Two conventions, one repository, and the line between them is what a package IS:
`core/`, `modules/`, `plugins/` and `tools/` are the framework and follow
`skills/naming/SKILL.md`; everything under `playgrounds/` is a CONSUMER and
follows the shape `ARCHITECTURE.md` recommends to one. A gate that held these to
the framework's canon would be holding an application to rules written for a
published package.

**The imports are relative rather than `@ViewModels/*`.** A real consumer sets
those aliases up — the reference applications do — but this repository's own
eslint config forbids exactly those specifiers everywhere, because they are how a
framework file would reach into an application. Relative paths say the same thing
and keep that rule meaning what it says.

## Running them

The API first, always. Everything else talks to it.

```bash
pnpm build                                      # once: the build tools read their own dist
pnpm --filter @lanka-playgrounds/_server start   # http://127.0.0.1:4380/api
```

Then whichever application:

```bash
pnpm --filter @lanka-playgrounds/react dev          # http://localhost:4390
pnpm --filter @lanka-playgrounds/next dev           # http://localhost:4392
pnpm --filter @lanka-playgrounds/astro dev          # http://localhost:4393
pnpm --filter @lanka-playgrounds/react-native start # Expo, on a device or an emulator
```

**`pnpm build` first is not optional**, and the reason is worth knowing: a build
config — `vite.config.ts`, `next.config.mjs`, `metro.config.js` — is loaded by
node rather than by the bundler it configures, and node will not compile the
TypeScript source a workspace link points at. Those three files therefore read
`@lankajs/tool-di` from its built output. A consumer installs a package whose
`exports` already point there and needs none of this.

## No `build` script anywhere here

`pnpm verify:build` is `pnpm -r run build`, and it exists to check what is
PUBLISHED. A Next build inside that chain would add a minute to every gate run
and fail on a machine with no network. So these applications build under
`build:app`, which nothing else calls:

```bash
pnpm --filter @lanka-playgrounds/react build:app         # vite build
pnpm --filter @lanka-playgrounds/next build:app          # next build, with SSG
pnpm --filter @lanka-playgrounds/astro build:app         # astro build, server output
pnpm --filter @lanka-playgrounds/react-native build:app  # a Metro bundle, to Hermes bytecode
```

## What the tests are for

Three kinds, and each answers something the others cannot.

**Unit tests** sit beside their unit, over doubles. Fast, hermetic, and the only
place a rollback or a refusal can be driven on demand.

**Live suites** — `atlas.live.test.ts`, `atlas-browser.live.test.ts`, and the
server halves of `next/` and `astro/` — start the REAL server on a free port and
drive the application through it. A 401 becomes a refresh, a retry becomes one
mission rather than two, a `200` carrying GraphQL errors becomes a failure a
screen can branch on, and a gRPC status becomes a kind. A fake transport proves
none of that: a double answers what it was told to answer.

**The builds themselves.** An application that compiles is an application whose
imports resolve — which for `react-native` means Metro resolving the framework,
the shared package, three native modules and the `.lanka_di` barrels, and
compiling the lot to Hermes bytecode.

### Why the live suites say `@vitest-environment node`

Under jsdom, `AbortController` is jsdom's and `fetch` is node's, and node's fetch
refuses a signal built in another realm:

```
TypeError: RequestInit: Expected signal ("AbortSignal {}") to be an instance of AbortSignal.
```

Every request the framework sends carries a signal, because a deadline IS a
signal — so under jsdom every real request fails as `kind: "network"`, after the
retry ladder has spent its backoff. It reads exactly like a server that is not
there.

Nothing in those files renders, so node is the honest environment for them. The
tests that DO render keep jsdom and reach no network, which is the division every
application ends up making.

## What these are not

They are not a template to copy wholesale, and they are not a specification.
`ARCHITECTURE.md` labels every recommendation `Checked`, `Recommended` or
`Taste`, and these applications take the recommended path at each point so a
reader can see what it looks like when followed all the way through — including
where it is inconvenient.

Three places are deliberate exceptions, each stated where it happens:

- **Atlas mixes six schema libraries.** Every package in `modules/validators/`
  says install exactly one, and that advice does not change. Mixing is here
  because a playground with one library cannot show what the other dialects cost
  — and because the mixed case arrives with a merger, a vendored SDK or a screen
  older than the decision.
- **The React application installs two read caches.** `@lankajs/tanstack-query`
  is the one under the ViewModels; the second exists only to prove the port has
  more than one implementation.
- **`playgrounds/react` renders every screen at once**, with no router. A router
  would be the fifth framework in a folder that is about the other four.

---

The canon these follow: [`../skills/`](../skills) · How applications on lanka are
usually organised: [`../ARCHITECTURE.md`](../ARCHITECTURE.md)
