import { LankaEventBusInstance } from "../../../scenario/event-bus/lanka-event-bus-instance/LankaEventBusInstance";
import { createLankaPluginRegistry } from "../../_internal/create-lanka-plugin-registry/createLankaPluginRegistry";
import { LankaScenariosRegistry } from "../../../scenario/_registries/lanka-scenarios-registry/LankaScenariosRegistry";
import { LankaScenarioVMRegistry } from "../../../scenario/_registries/lanka-scenario-vm-registry/LankaScenarioVMRegistry";
import { lankaScenarioBootstrap } from "../../../scenario/lanka-scenario-bootstrap/LankaScenarioBootstrap";
import { LankaGatewayLocator } from "../../../locator/gateway/lanka-gateway-locator/LankaGatewayLocator";
import { LankaScenarioLocator } from "../../../locator/scenario/lanka-scenario-locator/LankaScenarioLocator";
import { LankaSingletonLocator } from "../../../locator/singleton/lanka-singleton-locator/LankaSingletonLocator";
import { LankaSharedStoreLocator } from "../../../locator/shared-store/lanka-shared-store-locator/LankaSharedStoreLocator";
import { createInFlightCounter } from "../../../gateway/inflight/lankaHttpInFlight";
import { lankaLogger } from "../../../logger/lanka-logger/LankaLogger";
import {
	getActiveRuntime,
	setActiveRuntime,
} from "../../../_internal/active-runtime/activeRuntime";
import { createLankaScope } from "../../../locator/_factories/create-lanka-scope/createLankaScope";
import type { ILankaScope } from "../../../locator/_factories/create-lanka-scope/createLankaScope";
import type { ILankaPlugin } from "../../ILankaPlugin";
import type { ILankaRuntime } from "../../../_internal/active-runtime/activeRuntime";
import type { ILankaFlags } from "../../../config/_interfaces/ILankaFlags";
import type { ILankaHost } from "../../../config/_interfaces/ILankaHost";
import type { ILankaRuntimeConfig } from "../../../config/_interfaces/ILankaRuntimeConfig";
import type { ILankaScenarioVM } from "../../../scenario/_interfaces/ILankaScenarioVM";
import type { TLankaRequestMiddleware } from "../../../gateway/request/lankaRequestMiddleware";

/**
 * A framework instance: all framework state in one object.
 *
 * What instance-scoped state buys: two apps in one process (micro-frontends,
 * Storybook beside the app) no longer share a bus, locator caches and mock mode;
 * SSR does not reuse state between different users' requests; and test isolation
 * rests on construction rather than on a global `beforeEach` reaching into
 * internal registries.
 *
 * **Ambient facades** — `lankaEventBus.dispatch`, `lankaSingletons.foo`,
 * `getLankaFlags()`, `lankaHttpInFlight` — resolve THE ONE active instance
 * (`internal/activeRuntime.ts`). Isolation belongs to whoever holds an instance;
 * a facade cannot offer it.
 *
 * One thing stays at module level deliberately: `ALankaScenario` collects
 * constructed scenarios into a static pool. That is a REGISTRY OF DEFINITIONS,
 * not runtime state — the classes come from one `@lanka_di/Scenarios` barrel and
 * both instances must see the same list. Splitting it would be divergence.
 */
export interface ILankaInstance extends ILankaRuntime {
	/**
	 * Adds a wrapper around every request. Returns a function that removes it.
	 *
	 * This is how `@lankajs/plugin-http` installs retry, the idempotency key, the
	 * CSRF header and auth refresh.
	 */
	useRequestMiddleware(middleware: TLankaRequestMiddleware): () => void;
	/** Default timeout for every request of this instance. */
	setRequestTimeout(timeoutMs: number | undefined): void;
	/** Resolves a service in the root scope — for the instance's whole lifetime. */
	resolve<TInstance>(propertyName: string): TInstance;
	/**
	 * Creates a scope: a lifetime shorter than the application's.
	 *
	 * An object created in a scope goes away with it.
	 */
	createScope(): ILankaScope;
	/**
	 * Registers a plugin. Returns a function that removes it.
	 *
	 * The fifth and last extension point. An extension point declared before
	 * anything plugs into it describes an imagined need while costing real
	 * support, so this one arrived with the FIRST plugin.
	 */
	use(plugin: ILankaPlugin): () => void;
	/** Runs services and the scenario layer. Idempotent. */
	bootstrap(config?: ILankaBootstrapConfig): Promise<void>;
	/** Has bootstrap already run? */
	isBootstrapped(): boolean;
	/** Makes this instance the one ambient facades resolve to. */
	activate(): void;
	/**
	 * Removes subscriptions, clears registries and, if this instance was active,
	 * clears the pointer. Returns the framework to its pre-bootstrap state.
	 */
	dispose(): void;
}

export interface ILankaInstanceConfig {
	host: ILankaHost;
	flags?: ILankaFlags;
}

export interface ILankaServiceConfig {
	name?: string;
	init: () => void | Promise<void>;
	sync?: boolean;
	priority?: number;
	/**
	 * A failure of this service does not abort bootstrap.
	 *
	 * Without the flag one failed service takes the WHOLE phase with it: the async
	 * phase because of `Promise.all`, the sync phase because later tasks never run.
	 * Wrapping the failure in a swallowing `try/catch` is worse still — the app
	 * starts with a partially executed plan and does not know it.
	 */
	optional?: boolean;
	/**
	 * How long to wait for the service. Overrunning counts as a failure.
	 *
	 * Without a deadline a service that never settles holds bootstrap forever and
	 * the app never paints its first screen. Failing is more honest than waiting:
	 * an optional service is skipped, a required one names itself.
	 */
	timeoutMs?: number;
}

export interface ILankaScenarioBootstrapConfig {
	sync?: boolean;
	priority?: number;
}

export interface ILankaBootstrapConfig {
	services?: ILankaServiceConfig[];
	scenarios?: ILankaScenarioBootstrapConfig;
}

/**
 * Config merge: patch over previous, flags over flags.
 *
 * Lives HERE rather than in `config/lankaConfig` because the rule belongs to
 * whoever holds the config — the instance. Importing it from the config module
 * would pull that module into EVERY test's graph through the test kit, and any
 * test that partially mocks the config module would break the suite with "No
 * export is defined on the mock".
 */
function mergeLankaConfig(
	previous: ILankaRuntimeConfig,
	patch: ILankaRuntimeConfig,
): ILankaRuntimeConfig {
	return {
		// `host` is read field by field: `setConfig({ host: undefined })` through a
		// spread would leave the instance with no host, and every request URL would
		// then carry the string "undefined". Flags stay a spread — there both
		// absent and undefined mean "not set", so nothing can be lost.
		host: patch.host ?? previous.host,
		flags: { ...previous.flags, ...patch.flags },
	};
}

type TExecutionTask = {
	name: string;
	priority: number;
	optional: boolean;
	timeoutMs?: number;
	execute: () => void | Promise<void>;
};

/**
 * Creates an instance and makes it active.
 *
 * Activating on creation is the deliberate default: there is almost always one
 * app and the facades must work immediately. A second instance takes the
 * pointer — the last one created serves the facades. Callers needing another
 * order call `activate()` explicitly.
 */
export function createLanka(config: ILankaInstanceConfig): ILankaInstance {
	let runtimeConfig: ILankaRuntimeConfig = mergeLankaConfig(
		{},
		{ host: config.host, flags: config.flags },
	);
	let bootstrapped = false;
	let bootstrapping: Promise<void> | null = null; // the plan in flight, joined by later callers

	const eventBus = new LankaEventBusInstance();
	const scenarios = new LankaScenariosRegistry();
	const viewModels = new LankaScenarioVMRegistry();
	const inFlight = createInFlightCounter();
	const scenarioState = {
		bootstrapped: false,
		initialized: new WeakSet<ILankaScenarioVM>(),
	};
	const scopes = new Set<ILankaScope>();
	const requestMiddleware: TLankaRequestMiddleware[] = [];
	let requestTimeoutMs: number | undefined;

	const locators = {
		gateways: new LankaGatewayLocator(),
		scenarios: new LankaScenarioLocator(),
		singletons: new LankaSingletonLocator(),
		sharedStores: new LankaSharedStoreLocator(),
	};

	const instance: ILankaInstance = {
		eventBus,
		scenarios,
		viewModels,
		inFlight,
		locators,
		scenarioState,
		requestMiddleware,
		get requestTimeoutMs() {
			return requestTimeoutMs;
		},
		useRequestMiddleware(middleware: TLankaRequestMiddleware): () => void {
			requestMiddleware.push(middleware);
			return () => {
				const at = requestMiddleware.indexOf(middleware);
				if (at !== -1) requestMiddleware.splice(at, 1);
			};
		},
		setRequestTimeout(timeoutMs: number | undefined): void {
			requestTimeoutMs = timeoutMs;
		},
		resolve<TInstance>(propertyName: string): TInstance {
			return locators.singletons.get(propertyName) as TInstance;
		},
		use(plugin: ILankaPlugin): () => void {
			return plugins.use(plugin);
		},
		createScope(): ILankaScope {
			const scope = createLankaScope(locators.singletons);
			scopes.add(scope);
			return scope;
		},
		get config() {
			return runtimeConfig;
		},
		setConfig(patch: ILankaRuntimeConfig): void {
			runtimeConfig = mergeLankaConfig(runtimeConfig, patch);
		},
		getFlags(): ILankaFlags {
			return runtimeConfig.flags ?? {};
		},
		isBootstrapped(): boolean {
			return bootstrapped;
		},
		activate(): void {
			setActiveRuntime(instance);
		},
		dispose(): void {
			teardown();
			requestMiddleware.length = 0;
			requestTimeoutMs = undefined;
			bootstrapped = false;
		},
		bootstrap(bootstrapConfig: ILankaBootstrapConfig = {}): Promise<void> {
			if (bootstrapped) {
				lankaLogger.printBootstrapLog("LANKA ALREADY BOOTSTRAPPED");
				return Promise.resolve();
			}
			// One run, shared: the flag flips when the plan has FINISHED, so two
			// callers arriving before that — two routes, StrictMode mounting twice —
			// both read "not bootstrapped" and every service ran twice.
			bootstrapping ??= runBootstrap(instance, bootstrapConfig, () => {
				bootstrapped = true;
			}).finally(() => {
				bootstrapping = null;
			});
			return bootstrapping;
		},
	};

	/**
	 * Tears the instance down, in the ONE order that works.
	 *
	 * Scopes close FIRST: they hold objects built from this instance's classes, so
	 * disposing without them would leave alive exactly what a scope exists to
	 * remove. Plugins go AFTER scopes and BEFORE the registries: removing them
	 * earlier would leave the objects being disposed with half a framework — no
	 * middleware, but still expecting it.
	 */
	function teardown(): void {
		for (const scope of scopes) scope.dispose();
		scopes.clear();

		plugins.removeAll();

		viewModels.resetAll();
		scenarios.clear();
		eventBus.reset();

		locators.gateways.clearCache();
		locators.scenarios.clearCache();
		locators.singletons.clearCache();
		locators.sharedStores.clearCache();

		scenarioState.bootstrapped = false;
		scenarioState.initialized = new WeakSet<ILankaScenarioVM>();

		if (getActiveRuntime() === instance) setActiveRuntime(null);
	}

	const plugins = createLankaPluginRegistry(instance);

	instance.activate();
	// EVERY new instance adopts the declared ViewModels: a screen file creates
	// them at module level, and neither import order nor test number may decide
	// whether the framework knows about them.
	lankaScenarioBootstrap.adoptDeclaredViewModels();

	return instance;
}

function createExecutionPlan(config: ILankaBootstrapConfig) {
	const syncTasks: TExecutionTask[] = [];
	const asyncTasks: TExecutionTask[] = [];
	const postAsyncTasks: TExecutionTask[] = [];

	config.services?.forEach((service, index) => {
		const task: TExecutionTask = {
			name: service.name || `Service-${index + 1}`,
			priority: service.priority ?? 0,
			optional: service.optional ?? false,
			timeoutMs: service.timeoutMs,
			execute: service.init,
		};

		if (service.sync) syncTasks.push(task);
		else asyncTasks.push(task);
	});

	// Field by field rather than a spread over defaults: a caller forwarding its
	// own optional config passes `{ sync: undefined }`, and a spread would put that
	// over `sync: true` — moving the whole scenario layer out of the sync phase
	// because somebody did not set a variable.
	const scenarioSync = config.scenarios?.sync ?? true;
	const scenarioTask: TExecutionTask = {
		name: "LankaScenarioBootstrap",
		priority: config.scenarios?.priority ?? 0,
		// The scenario layer is required: without it nothing subscribed to it
		// works, and continuing silently would start an app where half the screens
		// never update.
		optional: false,
		execute: () => {
			lankaScenarioBootstrap.bootstrap();
		},
	};

	if (scenarioSync) syncTasks.push(scenarioTask);
	else postAsyncTasks.push(scenarioTask);

	syncTasks.sort((a, b) => b.priority - a.priority);

	return { syncTasks, asyncTasks, postAsyncTasks };
}

/**
 * One bootstrap, start to finish: the three phases in the one order that works,
 * then `markDone` — which the instance uses to flip its flag, and only then.
 *
 * Outside `createLanka` because it closes over nothing the instance holds: the
 * flag it must flip arrives as a callback, and everything else it needs it is
 * handed. That keeps the factory readable as the object it builds.
 */
async function runBootstrap(
	instance: ILankaInstance,
	config: ILankaBootstrapConfig,
	markDone: () => void,
): Promise<void> {
	instance.activate();
	lankaLogger.printBootstrapLog("LANKA BOOTSTRAP START");

	const plan = createExecutionPlan(config);
	await runSequential(plan.syncTasks, "SYNC TASKS");
	await runParallel(plan.asyncTasks, "ASYNC TASKS");
	await runSequential(plan.postAsyncTasks, "POST-ASYNC TASKS (lankaScenarios)");

	markDone();
	lankaLogger.printBootstrapLog("LANKA BOOTSTRAP FINISH");
}

/**
 * Runs a task under its deadline.
 *
 * A race against a timer rather than an `AbortSignal`: a service is an arbitrary
 * application function and cannot be cancelled. The deadline bounds the WAIT,
 * not the work — hung work continues in the background, bootstrap stops waiting.
 */
async function runWithDeadline(task: TExecutionTask): Promise<void> {
	if (task.timeoutMs === undefined) {
		await task.execute();
		return;
	}

	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			Promise.resolve(task.execute()),
			new Promise<never>((_resolve, reject) => {
				timer = setTimeout(
					() =>
						reject(
							new Error(
								`Service "${task.name}" did not finish within ${String(task.timeoutMs)}ms`,
							),
						),
					task.timeoutMs,
				);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

/**
 * One task's failure: swallow and log, or abort the plan.
 *
 * The TASK's flag decides, not a blanket tolerance in the runner — otherwise
 * `optional` would mean nothing.
 */
function handleTaskFailure(task: TExecutionTask, phaseName: string, error: unknown): void {
	lankaLogger.printBootstrapLog(`[${phaseName}] ERROR IN ${task.name}`, formatError(error));
	if (!task.optional) throw error;
	lankaLogger.printBootstrapLog(`[${phaseName}] SKIPPED (optional): ${task.name}`);
}

async function runSequential(tasks: TExecutionTask[], phaseName: string): Promise<void> {
	if (tasks.length === 0) return;

	for (const task of tasks) {
		try {
			lankaLogger.printBootstrapLog(
				`[${phaseName}] EXECUTING: ${task.name} (Priority: ${String(task.priority)})`,
			);
			await runWithDeadline(task);
		} catch (error) {
			handleTaskFailure(task, phaseName, error);
		}
	}
}

async function runParallel(tasks: TExecutionTask[], phaseName: string): Promise<void> {
	if (tasks.length === 0) return;

	lankaLogger.printBootstrapLog(
		`[${phaseName}] EXECUTING ${String(tasks.length)} TASKS IN PARALLEL`,
	);

	// `allSettled`, not `all`: `all` rejects on the first failure, so an optional
	// service would take down required ones that were still running. Outcomes are
	// examined after everything has finished.
	const outcomes = await Promise.allSettled(
		tasks.map(async (task) => {
			lankaLogger.printBootstrapLog(`[${phaseName}] EXECUTING: ${task.name}`);
			await runWithDeadline(task);
		}),
	);

	for (const [index, outcome] of outcomes.entries()) {
		if (outcome.status === "rejected") {
			handleTaskFailure(tasks[index], phaseName, outcome.reason);
		}
	}
}

function formatError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
