# A recommended architecture

This document describes how applications built on lanka have ended up being
organised, and why. **Almost none of it is required.** The framework ships four
layers and one direction of imports; everything below that — folder names, action
names, where a test lives, how a screen is split — is a set of choices that
worked, offered so you do not have to make them from scratch.

> [!IMPORTANT]
> If your project already has conventions, keep them. A framework that demands a
> file tree is a framework you fork the day your tree differs. What lanka
> actually requires is [in one short section](#what-is-actually-required); the
> rest of this page is advice you can take piecewise.

## How to read the advice on this page

Every recommendation below carries one of three labels, so you always know
whether you are reading a rule or an opinion.

| Label           | What it means                                                        | If you do otherwise                                |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| **Checked**     | The framework or one of its gates enforces this.                     | The build, the lint or the type checker stops you. |
| **Recommended** | What these projects converged on after living with the alternatives. | Nothing breaks. Be deliberate, and be consistent.  |
| **Taste**       | Several options are equally good; the value is in picking one.       | Nothing at all. Pick one and stay with it.         |

Nothing on this page is labelled "essential" except the handful of things the
machine already refuses, and those are the ones you cannot get wrong by accident.

## What is actually required

**Checked.** This is the whole list.

1. **Imports go one way.** A ViewModel may reach a gateway; a gateway does not
   know ViewModels exist. `@lankajs/tool-eslint` names the file and the line.
2. **A gateway is called from a ViewModel**, not from a component.
3. **A ViewModel does not import another ViewModel.**
4. **Your `.lanka_di/` barrels exist** and are read by the framework alone.

That is it. Four things, three of which are one idea seen from different sides.
Not even a base URL: omit it and a gateway's paths are used as written, which is
what an application on its API's origin — or one talking to several APIs — wants.

Everything after this heading is the other kind of advice.

## The layers

**Checked** — the direction. **Recommended** — everything else here.

```
View (React)          renders. Reads one hook.
   │
   ▼
ViewModel             owns state and actions. Calls gateways, triggers scenarios.
   │
   ▼
Gateway               states endpoints. No state, no error policy.
   │
   ▼
Request / Transport   what a response IS, and how bytes travel.
```

| Layer               | May use                                       | Must never                                   |
| ------------------- | --------------------------------------------- | -------------------------------------------- |
| View                | its ViewModel's hook                          | import a gateway; own loading or retry state |
| ViewModel           | gateways, services, scenarios, a shared store | import another ViewModel                     |
| Gateway             | its request, a validator, a mock handler      | import another gateway; hold state           |
| Request / Transport | `fetch`, or whatever you supply               | know an endpoint or a domain type            |

Two things sit **across** the layers: **scenarios**, which are how two ViewModels
reach each other without importing anything, and **the locator**, which is how a
screen asks for a name instead of an object.

> [!NOTE]
> The layers are lanka's opinion; the folder tree below is not. You can honour
> every arrow above with files arranged by feature, by route, or in one flat
> directory. The arrows are what the lint rules read.

## A folder tree that works

**Recommended.** Two shapes have both worked well, and the choice between them
is about how your team navigates, not about the framework.

### By layer

```
src/
├── Core/            types, enums, pure helpers — no React, no state
├── Gateways/        one folder per backend domain
├── Scenarios/       the facts screens announce to each other
├── ViewModels/      one folder per screen or feature
└── Modules/         the screens themselves
.lanka_di/           the barrels the framework reads
```

Newcomers find things by _kind_: "where do gateways live" has one answer. This is
the shape both reference applications use, and it holds up to a few hundred
files.

### By feature

```
src/
├── shared/          what more than one feature uses
└── features/
    └── checkout/
        ├── gateways/
        ├── viewModels/
        ├── scenarios/
        └── ui/
```

Newcomers find things by _what they are working on_. This suits a codebase where
features are owned by different people and rarely touch each other.

> [!TIP]
> Both work with lanka unchanged. If you pick the feature shape, tell the eslint
> rules your folder names — every path in them is a setting, and a different tree
> **configures** a rule rather than switching it off.

## Deciding where a new file goes

**Recommended.** Three questions, and the answer to all three is usually forced.

**① What kind of work does it do?**

| The work                               | Where it lives |
| -------------------------------------- | -------------- |
| talks to a server, a storage, an SDK   | a gateway      |
| remembers something, decides something | a ViewModel    |
| draws the screen                       | a component    |
| pure input → output, no memory         | a plain helper |
| announces "something happened"         | a scenario     |

One file doing two of these is two files in a trench coat.

**② Who may use it?** Pick the smallest scope that fits today: one component →
one screen → one feature → the whole app. Widening later is easy; narrowing is
not.

**③ Which way does it point?** Downward, toward the more general. A screen may
use a helper; a helper may never use a screen.

## Choosing a coordination tool

**Checked** — that ViewModels do not import each other. **Recommended** — which
of the remaining two you reach for.

When "A must affect B", one question decides it: **do A and B co-own a thing, or
does A announce something to independent Bs?**

| The link                                                 | The tool           |
| -------------------------------------------------------- | ------------------ |
| one screen owns the state and nothing else needs it      | one ViewModel      |
| A announces a fact; B, C and D each react their own way  | a **scenario**     |
| A and B edit the same in-flight thing before it is saved | a **shared store** |

Read in that order and stop at the first that fits.

> [!WARNING]
> The commonest mistake is reaching past the first two: a shared store for what
> is really an announcement. A scenario carries something that **happened**; a
> shared store holds something being **co-edited**. If you would describe the
> link with a past-tense verb, it is a scenario.

**A scenario begins in a ViewModel action and ends in a ViewModel handler.** A
form that subscribed to one would be a second ViewModel the lint cannot see; a
handler that wrote into a form's fields would erase what somebody is typing; and
turning a cache's own event back into a scenario makes `invalidate → refetch →
event → announce` a loop with no end. `lanka`'s guide carries the boundary in
full, under **Forms**.

<details>
<summary><b>Deep dive:</b> one feature, three links, three different tools</summary>

A two-step checkout. Both steps edit one order draft; placing the order must
clear a cart badge in the header and refresh an orders list on another screen.

```
 AddressStep ─┐
              ├─► CheckoutStore (shared)   ← one draft, two editors
 PaymentStep ─┘
       │ user presses "Place order"
       ▼
 PaymentStepVM.placeOrder()
       ├─► orderGateway.place(draft)          ← the only network call
       ├─► trigger(orderPlaced, { order })    ← ONE announcement…
       │        ├─► CartBadgeVM   (subscribed) → clears the badge
       │        └─► OrdersListVM  (subscribed) → applies the order
       ├─► clear the store (the draft is spent)
       └─► navigate to the confirmation
```

- A **shared store** between the steps, not a scenario: they co-own one buffer.
- A **scenario** for the badge, not a shared store: those are independent owners.
- The orchestration lives in the ViewModel, not in the button.

And the one that only bites later: if the confirmation screen's ViewModel is
**lazy**, it is not subscribed yet, so the scenario will not reach it. Write what
it needs before navigating, or pass an id in the route.

</details>

## Naming a ViewModel's actions

**Recommended.** A prefix that states what kind of retrieval an action performs
means a reader knows, without opening it, whether it hits the network, whether it
shows a spinner and whether it writes state.

| Prefix      | Calls a gateway?                   | Shows loading? | Writes state?        |
| ----------- | ---------------------------------- | -------------- | -------------------- |
| `fetch*`    | yes                                | yes            | yes                  |
| `apply*`    | **no** — merges data it was handed | no             | yes                  |
| `refresh*`  | yes                                | **no**, silent | yes                  |
| `prefetch*` | yes                                | no             | **no** — a pure read |

`prefetch*` writing nothing is the load-bearing row: a payload can be warmed
before a screen opens without seeding a ViewModel speculatively.

> [!NOTE]
> This is a convention, not a mechanism — lanka does not read your action names.
> Its value is entirely in consistency, which is why it is worth adopting on day
> one and not worth retrofitting in a hurry.

`load*` is worth avoiding: it is ambiguous between "fetch from the network" and
"merge what I was handed", which is exactly the distinction the other four make.

## Where tests go

**Recommended.** Beside the unit, in the unit's own folder. A test that lives in
a mirror tree drifts from what it tests the first time a file moves.

What is worth pinning, from experience with these applications:

- a ViewModel's **actions**, against a fake gateway — `createLankaFakeTransport`
  makes this three lines;
- a **scenario handler**, by firing the scenario and asserting the state;
- a **gateway's** URL construction and its validation, not the network;
- anything the framework cannot see: your own invariants.

Components are worth testing where they make a decision, and not worth testing
where they only render what a hook gave them.

## Start-up

**Recommended.** One file that starts the framework, and nothing else in it.

```ts
export const startApp = async () => {
	const lanka = await startLanka({
		apiBaseUrl: import.meta.env.VITE_API_URL, // omit it entirely if there is no one prefix
		plugins: [lankaHttp(lankaCookieSessionPolicy({ csrf, auth }))],
		services: [{ name: "session", init: restoreSession }],
	});

	return lanka;
};
```

When the application has ordered start-up stages that pass values along and can
redirect — restore the session, then decide whether to send the user to sign-in —
[`@lankajs/plugin-bootstrap-steps`](./plugins/bootstrap-steps/GUIDE.md) is the shape
for that, and core's `services` is the shape for tasks that do not talk to each
other.

## Adopting the packages

**Taste**, mostly. lanka's core is enough to build an application; every other
package earns its place by solving a problem you already have.

| Add it when                                                   | Package                        |
| ------------------------------------------------------------- | ------------------------------ |
| requests need retry, auth refresh, deadlines, CSRF            | `@lankajs/plugin-http`           |
| the server pushes changes                                     | `@lankajs/plugin-sse`            |
| the wire carries traffic both ways                            | `@lankajs/plugin-websocket`      |
| the API is GraphQL                                            | `@lankajs/plugin-graphql`        |
| the API is gRPC and the client is a browser                   | `@lankajs/plugin-grpc`           |
| a burst of events causes a burst of identical requests        | `@lankajs/async`                 |
| a button must feel instant and must not double-fire           | `@lankajs/optimistic`            |
| you have a table: sort, filter, paginate                      | `@lankajs/collection`            |
| something must survive a reload, or must not sit in the clear | `@lankajs/storage`               |
| avatars reload and flicker                                    | `@lankajs/blob-cache`            |
| cookies, or stale caches after a deploy                       | `@lankajs/browser`               |
| you validate responses with zod or valibot                    | `@lankajs/zod`, `@lankajs/valibot` |
| navigation is measurably slow                                 | `@lankajs/plugin-prefetch`       |

> [!WARNING]
> Two worth **not** installing early: `@lankajs/plugin-prefetch`, which is three
> tiers of machinery for a problem you may not have; and both validation packages
> at once — pick one, so your dependency list says which library your schemas
> are.

## Inside another framework

**Checked** — where each layer may run, and which entries are client-only.
**Recommended** — everything else in this section.

lanka is not an application shell. If you are using Next, React Router v7,
TanStack Start, Astro or Expo, that framework owns the application and lanka is
the layer underneath your screens. The division follows from what each layer is
made of, not from taste:

| lanka owns                                                       | Your host framework owns                                        | Where they meet                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| gateways: endpoints, tagged failures, validated response bodies   | routing, layouts, navigation                                     | a loader or server component calls a gateway in a scope   |
| request policy: retry, auth refresh, CSRF, deadlines              | SSR, streaming, hydrating the HTML                               | the policy installs per scope, so both sides behave alike |
| the state a screen reads (ViewModels) and scenarios between them  | which components are client components                           | server data arrives as a prop, then hydrates the VM       |
| nothing about caching                                            | the request cache, `revalidate`, `revalidateTag`, stale windows   | the gateway answers; the host decides what to remember    |
| nothing about rendering, styling or bundling                     | the renderer, `<Suspense>`, error boundaries, the bundler         | one build alias, from `@lankajs/tool-di`                    |

**The rule behind the table: a capability your host already ships is not a
feature here — it is a second answer to one question**, and your application ends
up owning the disagreement. That is why there is no lanka router, no lanka
renderer and no cache inside a gateway.

### Which layer may run where

**Checked** by `check-runtime.mjs`, per published entry.

| Layer                            | Runs in                          |
| -------------------------------- | -------------------------------- |
| gateway, locator, scenario bus   | the browser, node, React Native  |
| ViewModel                        | a CLIENT only — the browser or a device |
| view                             | wherever your host renders it    |

A ViewModel is a store created at module level and read through React hooks: one
per process, which on a server means one shared by every user connected to it.
The gateway layer holds no such state, which is exactly why it is the layer that
travels.

### The two server calls

**Recommended.** `@lankajs/host` is the seam. If your host scopes requests its
own way, `setLankaRuntimeResolver` in `lanka/internal` is the strategy core reads
— it ships none itself.

| Rendering mode                                                   | Call                                     |
| ---------------------------------------------------------------- | ---------------------------------------- |
| SSR, server components, loaders, server functions, actions       | `runLankaRequest({ headers })`             |
| SSG, prerender, ISR revalidation                                 | `runLankaStatic`                           |
| the browser, after hydration                                     | nothing — the instance `startLanka` made   |

Each call gives that unit of work its own framework instance, so two overlapping
requests never share a bus, a locator cache or a mock-mode flag. The difference
between the two names is what may cross into them: a request carries the caller's
`cookie` and `authorization`; a build refuses them, because output served to
everybody must not carry one reader's identity.

The handoff back to the browser is data, not state: the loader returns what it
fetched, the page passes it as a prop, and `hydrateLankaVM` makes it the screen's
first state — once, before the first read.

Full recipes per host, including both halves of `next.config.js`:
[`modules/host/GUIDE.md`](./modules/host/GUIDE.md) and
[`tools/di/GUIDE.md`](./tools/di/GUIDE.md).

## Server state when there is no host

**Recommended.** The table above says the host owns the request cache and lanka
has none. That holds while there IS a host. In a plain Vite SPA the slot is
empty, and the consequence is honest: two screens reading one resource send two
requests and grow two independently ageing copies.

Three ways to fill it, and only the middle one is wrong.

**A cache as a service UNDER the ViewModel.** Register one `QueryClient` with the
locator and write the five operations your screens actually use over it — read,
write, invalidate, subscribe, cancel. The ViewModel calls `fetchQuery` from an
action, so the gateway is still called from a ViewModel; the component still
reads one hook. Reactivity is a subscription in `onInit`, released in `onReset`.

```ts
lanka.locators.singletons.register("ReadCache", ReadCache);

// in an action
const orders = await services.cache.read(["orders"], (signal) => gateways.orderGateway.list({ signal }));
```

**A cache in the COMPONENT.** For an application already built on TanStack Query
that adopts lanka underneath: `useQuery` in a query-hooks folder, ViewModels for
everything that is not a resource. That folder calls gateways, so tell the lint
rule its name — `allowedDirs` — which configures the rule rather than switching
it off. You lose "one hook per screen"; that is the trade.

**Both, split by domain.** Don't. Two owners of one responsibility with no line
between them is a conflict with a delay on it.

### What you must divide up

| | Keep it in |
| --- | --- |
| retry, timeouts, idempotency | `@lankajs/plugin-http`, where retry travels with the idempotency key. Set `retry: false` on the cache |
| optimistic updates | pick one: `@lankajs/optimistic` over the ViewModel's state, or the cache's own `setQueryData` and rollback |
| invalidation | a scenario announces the FACT, and one line in `onInit` turns it into `invalidateQueries`. **One way only** — a cache event must never trigger a scenario, or `invalidate → refetch → event → announce` never ends |
| failures | nothing: a `LankaError` passes through a query function untouched, `kind` and `fields` included |
| SSR | the cache's `dehydrate`/`hydrate` and `hydrateLankaVM` are separate mechanisms; with a cache, hydration is the cache's and `hydrateLankaVM` is not needed |

> [!NOTE]
> SWR is hook-first: its public surface has no cache subscription and no
> cancellation, so it fits the second shape and not the first. Apollo, urql and
> RTK Query are a transport AND a cache, and lanka already has a transport.

**The first shape is now a package.** `lanka/cache` publishes the port —
`ILankaReadCache`, seven operations and no implementation — and
`modules/query/` holds the two libraries that can bind it:

| | Take it when |
| --- | --- |
| `@lankajs/tanstack-query` | **the default.** The only measured library implementing all seven |
| `@lankajs/nanostores-query` | the application already uses nanostores for its own state. Six of seven: no cancellation, because no signal reaches its fetcher |

> [!TIP]
> A third implementation is supported and does not need a release:
> `@lankajs/tool-testing/lankaReadCacheConformance` is the contract, executable.
> Twelve of the port's clauses are assertions there; the four no suite can see —
> a subscriber must not write the key it observes, the cache is per REQUEST on a
> server, one client per application, and the loader always comes from a gateway
> — are in the port's own docblock.

> [!WARNING]
> Install ONE. Two members in one application is the "two caches disagree"
> failure a level down: if an application genuinely needs both, the split is by
> RESOURCE and no key lives in both.

## Deviating on purpose

Every recommendation here has a shape that survives being ignored. Some worked
examples of legitimate deviation:

- **A different folder tree.** Configure the eslint rules' paths. Nothing else
  cares.
- **A different state library inside a ViewModel.** The ViewModel owns its state;
  lanka gives you a store and does not check that you used it.
- **No scenarios at all.** A small application with one screen has nothing to
  announce. The layer costs nothing unused.
- **Your own transport.** Implement `ILankaTransport`; the gateway is typed
  against the port, not the implementation.
- **Your own request policy** instead of `@lankajs/plugin-http`. Request middleware
  is a public extension point, and the plugin is one consumer of it.
- **Your own roles.** `defineLankaRole` gives a layer of your own — a repository,
  a presenter — both writing styles over one implementation, the same way the
  framework's own roles get them.

> [!NOTE]
> If a deviation makes you fight the framework rather than configure it, that is
> worth reporting: the framework is meant to bend at the seams it publishes, and
> a seam that does not bend is a defect rather than your problem.

## Recap

- Five things are required; everything else on this page is advice.
- The **direction** of imports is the one architectural rule the machine
  enforces — folder names are yours.
- Decide a file's home with three questions: what work, what scope, which way it
  points.
- For "A must affect B", ask whether they **co-own** or one **announces**.
- Name actions for what they retrieve, keep tests beside their unit, start the
  framework in one file.
- Add a package when you have the problem it solves, not before.
- Inside a host framework, gateways travel to the server and ViewModels stay in
  the client — and anything your host already owns, it keeps.

---

Start here: [core/GUIDE.md](./core/GUIDE.md) · Every package:
[README.md](./README.md)
