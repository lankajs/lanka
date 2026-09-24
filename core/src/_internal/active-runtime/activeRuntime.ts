import type { LankaEventBusInstance } from "../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import type { LankaScenariosRegistry } from "../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import type { LankaScenarioVMRegistry } from "../../scenario/_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import type { ILankaRuntimeConfig } from "../../config/_interfaces/ILankaRuntimeConfig";
import type { ILankaInFlightCounter } from "../../gateway/inflight/lankaHttpInFlight";
import type { ILankaScenarioVM } from "../../scenario/_interfaces/ILankaScenarioVM";
import type { TLankaRequestMiddleware } from "../../gateway/request/lankaRequestMiddleware";
import type { LankaGatewayLocator } from "../../locator/gateway/lanka-gateway-locator/LankaGatewayLocator";
import type { LankaScenarioLocator } from "../../locator/scenario/lanka-scenario-locator/LankaScenarioLocator";
import type { LankaSingletonLocator } from "../../locator/singleton/lanka-singleton-locator/LankaSingletonLocator";
import type { LankaSharedStoreLocator } from "../../locator/shared-store/lanka-shared-store-locator/LankaSharedStoreLocator";
import { lankaCopies } from "./lankaCopies";

/**
 * The pointer to the framework instance that ambient facades resolve to.
 *
 * ## Why this module is separate and imports no value
 *
 * Framework state belongs to an instance (`createLanka`), but the callers of
 * `lankaEventBus.dispatch`, `getLankaFlags()`, `lankaSingletons.foo`, `lankaHttpInFlight` —
 * the ambient facades cannot hold one — a user-extended `ALankaScenario`, the
 * static `LankaScenarioBootstrap` — so they ask which instance is active.
 *
 * The module is dependency-free DELIBERATELY: every import here is `import type`
 * and disappears at compile time, except `lankaCopies`, which imports nothing
 * itself. Otherwise there would be a cycle
 * `createLanka → locator → gateway → config → createLanka`, and module
 * evaluation order would start deciding what ends up `undefined`.
 *
 * This is still a global pointer. Real isolation belongs to whoever holds an
 * instance: their own bus, registries and counter. The facades serve ONE active
 * instance — exactly what an application with one needs.
 */
export interface ILankaRuntime {
	readonly eventBus: LankaEventBusInstance;
	readonly scenarios: LankaScenariosRegistry;
	readonly viewModels: LankaScenarioVMRegistry;
	readonly inFlight: ILankaInFlightCounter;
	/**
	 * Request wrappers, in registration order: the first wraps them all.
	 *
	 * An array, not a set: order carries meaning — retry must sit outside request
	 * signing, or the second attempt goes out unsigned.
	 */
	readonly requestMiddleware: readonly TLankaRequestMiddleware[];
	/** Default response deadline. `undefined` means no limit. */
	readonly requestTimeoutMs: number | undefined;
	readonly locators: {
		readonly gateways: LankaGatewayLocator;
		readonly scenarios: LankaScenarioLocator;
		readonly singletons: LankaSingletonLocator;
		readonly sharedStores: LankaSharedStoreLocator;
	};
	readonly config: ILankaRuntimeConfig;
	/**
	 * Bootstrap state of the scenario layer.
	 *
	 * A mutable object rather than contract fields: `LankaScenarioBootstrap` is an
	 * ambient facade and must write here without holding an instance.
	 */
	readonly scenarioState: {
		bootstrapped: boolean;
		initialized: WeakSet<ILankaScenarioVM>;
	};
	setConfig(patch: ILankaRuntimeConfig): void;
	getFlags(): NonNullable<ILankaRuntimeConfig["flags"]>;
}

/**
 * How "which instance is active" is answered.
 *
 * A strategy, because the answer depends on where the code runs. In a browser
 * there is one instance per document and a module-level pointer IS the answer. In
 * a server process there is one instance per REQUEST, and a module-level pointer
 * is the bug: the last request to start would answer for all of them.
 */
export type TLankaRuntimeResolver = () => ILankaRuntime | null;

/**
 * How "which SCOPE is this" is answered, which is a different question.
 *
 * `TLankaRuntimeResolver` answers which framework INSTANCE serves a call, and on
 * a server that is one per request. This answers which unit of work the call
 * belongs to, and the two are not interchangeable: `runInLankaServerScope`
 * creates its instance INSIDE the scope, and `createLanka` activates every
 * instance it builds — so the process pointer and the scope's runtime are the
 * same object during a request, and nothing downstream can tell "inside a
 * scope" from "after one ended".
 *
 * That distinction is what a per-scope lifetime needs. Without it a call made
 * outside every request resolves against the LAST request's runtime and is
 * handed the last stranger's state, which is the failure a scope exists to
 * abolish.
 *
 * Core ships no resolver here either, and knows only that the question exists.
 */
export type TLankaScopeResolver = () => object | null;

let active: ILankaRuntime | null = null;
let resolveRuntime: TLankaRuntimeResolver | null = null;
let resolveScope: TLankaScopeResolver | null = null;

/**
 * Whether THIS copy has ever had an instance — what tells "not yet" from "no
 * longer" when a call finds none. Without it the one message named a missing
 * `createLanka` for a page that had been rendering off one for minutes.
 */
let hadInstance = false;

export function setActiveLankaRuntime(runtime: ILankaRuntime | null): void {
	active = runtime;

	if (runtime) {
		hadInstance = true;
		lankaCopies.noteActivation(runtime.getFlags().isDevelopment === true);
	}
}

// What another copy of the package asks this one, registered as this copy loads.
lankaCopies.join(() => (active === null ? null : active.getFlags().isDevelopment === true));

/**
 * Replaces the strategy, or restores the default one with `null`.
 *
 * The installed resolver is the WHOLE answer — the module-level pointer is not
 * consulted behind it. That is deliberate: a fallback would turn "this ran
 * outside a request" from a loud error into one request quietly reading another
 * request's instance, which is the failure this seam exists to make impossible.
 *
 * Core ships no resolver and knows of none. What installs one is a package that
 * knows the shape of a request; core knows only that the question has more than
 * one answer.
 */
export function setLankaRuntimeResolver(resolver: TLankaRuntimeResolver | null): void {
	resolveRuntime = resolver;
}

/**
 * The PROCESS's own instance, read without asking the strategy.
 *
 * `getActiveRuntime` consults the installed resolver and is the answer for
 * almost everything. This is the one question it cannot answer: what a call
 * would have resolved to if nobody had installed a resolver at all.
 *
 * It exists for a resolver that wants to DEFER. A server's resolver answers from
 * its request scope, and a process that also holds an ambient instance — a
 * worker with a cache, a dev server between reloads, a suite between cases —
 * has a right answer outside every scope that the resolver cannot see. Without
 * this, the first request in such a process makes every later ambient call fail
 * for the life of it.
 *
 * Not a fallback inside `getActiveRuntime`, deliberately: a resolver that wants
 * to defer says so, and one that wants a call outside its scope to fail loudly
 * goes on failing loudly. The choice belongs to whoever knows what a scope is.
 */
export function getLankaProcessRuntime(): ILankaRuntime | null {
	return active;
}

export function getActiveRuntime(): ILankaRuntime | null {
	return resolveRuntime ? resolveRuntime() : active;
}

/**
 * Installs the strategy that says which unit of work a call belongs to.
 *
 * Installed by whoever knows what a scope IS — `@lankajs/host` wraps a request
 * in `AsyncLocalStorage` and answers from its store. A browser installs none,
 * and that is the right answer there: a tab is one scope for its whole life.
 */
export function setLankaScopeResolver(resolver: TLankaScopeResolver | null): void {
	resolveScope = resolver;
}

/** Whether anything at all knows how to answer "which scope". */
export function hasLankaScopeResolver(): boolean {
	return resolveScope !== null;
}

/**
 * The current unit of work, or `null`.
 *
 * `null` means two different things and the caller has to tell them apart with
 * `hasLankaScopeResolver`: with no resolver installed there are no scopes and a
 * process-wide lifetime is correct; with one installed it means this call ran
 * OUTSIDE every scope, which on a server is a mistake worth failing on.
 */
export function getActiveLankaScope(): object | null {
	return resolveScope ? resolveScope() : null;
}

/**
 * The same page keeping a stale evaluation of lanka beside a fresh one, which
 * is not a bundling accident: a dev server kept the page open while lanka was
 * upgraded or reinstalled, and a module loaded afterwards got the new files.
 */
const RELOADED_UNDER_AN_OPEN_PAGE =
	"a dev server kept this page open while lanka was upgraded or reinstalled, and " +
	"a module loaded since then got the new files: reload the page";

/**
 * Why a call found no instance — four different causes, each with its own fix.
 *
 * Out of line, and only ever built on the way to a throw: the success path of
 * `requireActiveRuntime` stays exactly what it was.
 */
function noInstanceMessage(): string {
	if (resolveRuntime) {
		return (
			"lanka has no instance for this call. A runtime resolver is installed and " +
			"answered with none, which on a server means the code ran outside a " +
			"request scope — start one, or do this work inside it."
		);
	}

	if (lankaCopies.anotherIsRunning()) {
		return (
			"lanka used before an instance existed in THIS copy of the package, while " +
			"another copy of lanka on this page has one. Either the module calling it " +
			"bundled its own lanka — ship one: a singleton in Module Federation's " +
			"`shared`, an import map, or `lanka` external in its build — or " +
			`${RELOADED_UNDER_AN_OPEN_PAGE}.`
		);
	}

	if (hadInstance) {
		return (
			"lanka has no instance: one was active in this copy and has been cleared — " +
			"disposed, or deactivated by whatever manages instances here — and none has " +
			"been activated since. Either the call outlived it (a timer, a subscription " +
			"or a pending request still running after dispose), or a new one is due: " +
			"createLanka({ host }) and activate it."
		);
	}

	// A copy from before 2.2.0 never announces itself, so a stale one beside
	// this fresh one lands here rather than in the branch above.
	return (
		"lanka used before an instance existed. Call createLanka({ host }) and activate " +
		"it. If that already ran on this page, it ran in another evaluation of lanka " +
		"and this one started empty — most often, " +
		`${RELOADED_UNDER_AN_OPEN_PAGE}; or a module bundled a copy older than lanka ` +
		"2.2.0, which does not announce itself to this one."
	);
}

/**
 * The active instance, or a loud failure.
 *
 * No fallback, deliberately, for the same reason `getLankaHost` has none: an
 * instance created silently on the fly would mean subscriptions went to one bus
 * and events to another, and the divergence would surface three layers away.
 */
export function requireActiveRuntime(): ILankaRuntime {
	// The strategy is read here rather than through `getActiveRuntime()`: this is
	// the hottest path in the framework — every ambient facade, every request,
	// every dispatch — and a call that only forwards is a call that shows up in
	// `perf/`.
	const runtime = resolveRuntime ? resolveRuntime() : active;

	if (!runtime) throw new Error(noInstanceMessage());

	return runtime;
}
