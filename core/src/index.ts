/**
 * lanka — a layered React application framework.
 *
 * ## The one rule
 *
 * `gateways → ViewModels → views`, and imports go ONE way. A ViewModel may reach
 * a gateway; a gateway does not know ViewModels exist. Not a convention — a
 * check: a violation names the file and the line.
 *
 * ## What the framework provides
 *
 * - **Gateways** — transport with tagged failures and a validated response body.
 * - **ViewModels** — the state a screen reads, and the only place a gateway is
 *   called from.
 * - **Scenarios** — named units of coordination over an event bus: what happens
 *   BETWEEN screens (a session change, a list to refresh, a reconnect). They
 *   register themselves rather than being wired by hand, so a new one is one
 *   file.
 * - **Locator** — service resolution, so nothing above reaches for a constructor.
 *
 * ## What it does not do
 *
 * It has no opinion about routing, styling or which server you talk to, and it
 * ships no components. A frame, not a building — which is what "lanka" means: a
 * link that matters only through what it connects.
 *
 * ## Getting started
 *
 * ```ts
 * import { startLanka } from "lanka";
 *
 * const lanka = await startLanka({ apiBaseUrl: "https://api.example.com" });
 * ```
 *
 * That is the whole start-up: it creates the instance, installs any plugins and
 * awaits bootstrap. Everything else — services, flags, a host of your own — is a
 * field on the same call.
 *
 * Every field is optional, `apiBaseUrl` included: omit it and a gateway's paths
 * are used as written, which is what an application on its API's origin — or one
 * talking to several APIs — wants. What is deliberately absent is a GUESSED
 * default like `/api`, which would be silently wrong for everyone who does not
 * use it. Pass `host` instead when the copy is yours from the start: the
 * interface requires all four members, so a missing translator is a compile error
 * rather than an untranslated string in somebody's interface.
 *
 * `createLanka` and `bootstrap` remain, for a start-up that needs something
 * between the two steps.
 *
 * ## What this barrel is and is not
 *
 * It is the COMMON surface: what every application touches once — bootstrap,
 * configuration, the locator base class, the logger, narrowing guards.
 *
 * It is not the whole surface. Layers are taken by subpath — `lanka/gateway`,
 * `lanka/viewmodel` — and those paths are public too. Funnelling every call site
 * through one barrel would trade a readable import for a wall of re-exports and
 * lose the tree-shaking granularity paid for on every cold start.
 *
 * The boundary that IS enforced goes the other way: nothing inside this package
 * may import from a consumer. See `NO_CONSUMER_IMPORTS` in `eslint.config.js`.
 */

// ── Bootstrap ────────────────────────────────────────────────────────────────
export { createLanka } from "./bootstrap/_factories/create-lanka/createLanka";
export { startLanka } from "./bootstrap/start-lanka/startLanka";
export { resetActiveLanka } from "./bootstrap/reset-active-lanka/resetActiveLanka";
export { ALankaPlugin } from "./bootstrap/_abstractions/lanka-plugin/ALankaPlugin";
export type { ILankaPlugin } from "./bootstrap/ILankaPlugin";
export type {
	ILankaBootstrapConfig,
	ILankaInstance,
	ILankaInstanceConfig,
} from "./bootstrap/_factories/create-lanka/createLanka";
export type {
	ILankaScenarioBootstrapConfig,
	ILankaServiceConfig,
} from "./bootstrap/_factories/create-lanka/createLanka";

// ── Defining a role of your own, in both styles ──────────────────────────────
//
// The bridge the framework uses for its own nine roles, published because an
// application with a layer of its own — a repository, a presenter, a command —
// gets both styles for it from one line. Canon: `skills/parity/SKILL.md`.
export { defineLankaRole } from "./role/define-lanka-role/defineLankaRole";
export type {
	ILankaRoleFactory,
	ILankaRoleOpening,
	TLankaRoleOpener,
} from "./role/define-lanka-role/defineLankaRole";

// ── Configuration and what the host must provide ─────────────────────────────
export { getLankaFlags } from "./config/get-lanka-flags/getLankaFlags";
export { createLankaHost } from "./config/_factories/create-lanka-host/createLankaHost";
export { getLankaHost } from "./config/get-lanka-host/getLankaHost";
export type { ILankaFlags } from "./config/_interfaces/ILankaFlags";
export type { ILankaHost } from "./config/_interfaces/ILankaHost";
export type { ILankaHostConfig } from "./config/_factories/create-lanka-host/createLankaHost";
export type { ILankaStartOptions, TLankaStartConfig } from "./bootstrap/_types/TLankaStartConfig";
export type { ILankaRuntimeConfig } from "./config/_interfaces/ILankaRuntimeConfig";

// ── The locator ──────────────────────────────────────────────────────────────
//
// The base a fifth KIND of locator would extend is mechanism and lives in
// `lanka/extend`; an application resolves through the four ambient facades and
// never writes one.
export type { ILankaLocatorConfig } from "./locator/_abstractions/lanka-locator/ALankaLocator";

// ── Logging ──────────────────────────────────────────────────────────────────
export { lankaLogger } from "./logger/lanka-logger/LankaLogger";

// ── A failure you can branch on ──────────────────────────────────────────────
export { LankaError } from "./errors/lanka-error/LankaError";
export type { ILankaErrorInit, TLankaErrorKind } from "./errors/lanka-error/LankaError";

// ── What is NOT here ─────────────────────────────────────────────────────────
//
// Primitives — `generateUuid`, `isRecord`, `getStringField` — are published as
// `lanka/internal`, and mechanism as `lanka/extend`. Both are reachable; neither
// is promised by this barrel, and the import line says which one a reader is
// looking at. `skills/surface/SKILL.md` owns the tiers.
//
// They used to be re-exported here, which made this file contradict itself: it
// said `_internal` may be refactored without a major and then promised three
// things out of it.
