/**
 * `lanka/extend` — mechanism.
 *
 * What is needed to build a devtool, a competing implementation or a deep
 * integration, and nothing a normal application should reach for. Everything
 * here is reachable on purpose: a framework that hides its mechanism does not
 * stop the person who needs it, it makes them fork the whole thing.
 *
 * **This tier may change in a minor.** That is the price of it being open, and
 * it is written in every import line that uses it. The facade
 * (`lanka`, `lanka/scenario`, …) is where the promise lives.
 *
 * Canon: `skills/surface/SKILL.md`.
 */

// ── The registries the framework fills and a devtool reads ───────────────────
//
// A screen never touches these: it declares a scenario and subscribes. They are
// here for what reads the whole picture — an inspector, a diagnostic panel, a
// test that asserts on registration rather than on behaviour.
export { LankaScenariosRegistry } from "../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
export { LankaScenarioVMRegistry } from "../scenario/_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";

// ── The resolution behind the four ambient facades ───────────────────────────
//
// An application writes `lankaGateways.resolve(...)`; these are what answers it.
// Needed to build a second kind of resolution, a diagnostic over what is
// registered, or a scope with different lifetimes — and by nothing else.
export { ALankaLocator } from "../locator/_abstractions/lanka-locator/ALankaLocator";
export { createLankaScope } from "../locator/_factories/create-lanka-scope/createLankaScope";
export { createLankaLocatorProxy } from "../locator/_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
export type { ILankaLocatorProxyConfig } from "../locator/_factories/create-lanka-locator-proxy/createLankaLocatorProxy";
export { LankaGatewayLocator } from "../locator/gateway/lanka-gateway-locator/LankaGatewayLocator";
export { LankaScenarioLocator } from "../locator/scenario/lanka-scenario-locator/LankaScenarioLocator";
export { LankaSingletonLocator } from "../locator/singleton/_facades/lanka-singletons/lankaSingletons";
export { LankaSharedStoreLocator } from "../locator/shared-store/_facades/lanka-shared-stores/lankaSharedStores";

// ── Request wrapping, as the runtime performs it ─────────────────────────────
//
// A consumer ADDS a middleware through `useRequestMiddleware`, which is the
// extension point. Composing a chain by hand is what the runtime does with what
// it collected, and belongs to whoever is replacing that.
export { composeLankaRequestMiddleware } from "../gateway/request/lankaRequestMiddleware";

// ── What a view binding is built out of ──────────────────────────────────────
//
// `modules/bindings/*` is the shelf of them, and this is the one piece of core
// each member calls. Published here rather than on the facade because a normal
// application never tracks reads by hand: it writes `useLankaVM(vm)` and the
// binding does this.
//
// A third-party binding — for a framework this repository has never heard of —
// is then a subscription, a render trigger and these calls, and the behaviour a
// consumer sees is lanka's rather than that author's reading of it.
//
// `createLankaViewSubscription` is those steps written once: subscribe, ask
// whether the change touched anything this reader read, report the skip so the
// blind-spot diagnostic can fire, and hand back a recording read. A binding with
// no selector arm needs nothing else.
export { createLankaAccessTracker } from "../viewmodel/_internal/create-lanka-access-tracker/createLankaAccessTracker";
export { createLankaViewSubscription } from "../viewmodel/_factories/create-lanka-view-subscription/createLankaViewSubscription";
export type { ILankaAccessTracker } from "../viewmodel/_internal/create-lanka-access-tracker/createLankaAccessTracker";
export type { ILankaViewSubscription } from "../viewmodel/_factories/create-lanka-view-subscription/createLankaViewSubscription";

// ── A ViewModel whose LIFETIME is the current scope ──────────────────────────
//
// Here rather than on the facade, deliberately. The shape is young: a browser
// needs none of it, a server needs all of it, and whether the five bindings
// should learn an overload that resolves at mount is a decision that has not
// been made. `lanka/extend` may change in a minor, which is exactly the room a
// decision like that needs — and `useLankaVM(resolveLankaVM(vm))` already works
// on every binding today, at the cost of one pair of brackets.
//
// What it answers is the one thing a module-level ViewModel cannot: on a server
// one module is one instance per PROCESS, shared by every user connected to it.
export { defineLankaVM } from "../viewmodel/_factories/define-lanka-vm/defineLankaVM";
export { resolveLankaVM } from "../viewmodel/_factories/resolve-lanka-vm/resolveLankaVM";
export type { ILankaVMDefinition } from "../viewmodel/_factories/define-lanka-vm/defineLankaVM";
