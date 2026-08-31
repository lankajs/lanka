import { createLanka } from "../../src/bootstrap/index";
import { getLankaFlags } from "../../src/config/index";
import { getLankaHost } from "../../src/config/index";
import { lankaGateways } from "../../src/locator/index";
import { lankaScenarios } from "../../src/locator/index";
import { lankaSharedStores } from "../../src/locator/index";
import { lankaScenarioBootstrap } from "../../src/scenario/index";
import { lankaSingletons } from "../../src/locator/index";
import { PlaygroundSessionService } from "../playground-session-service/PlaygroundSessionService";
import { PlaygroundClock } from "../playground-clock/PlaygroundClock";
import { PlaygroundTodoGateway } from "../playground-todo-gateway/PlaygroundTodoGateway";
import { PlaygroundTodoStore } from "../playground-todo-store/PlaygroundTodoStore";
import { createPlaygroundBadgeVM } from "../create-playground-badge-vm/createPlaygroundBadgeVM";
import { createPlaygroundLazyTodosVM } from "../create-playground-lazy-todos-vm/createPlaygroundLazyTodosVM";
import { createPlaygroundStatsVM } from "../create-playground-stats-vm/createPlaygroundStatsVM";
import { createPlaygroundTodosVM } from "../view-models/create-playground-todos-vm/createPlaygroundTodosVM";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../src/bootstrap/index";
import type { ILankaTransport } from "../../src/gateway/index";

/** A started application: the instance to dispose, and what a screen is given. */
export interface IPlaygroundApp {
	lanka: ILankaInstance;
	useTodosVM: ReturnType<typeof createPlaygroundTodosVM>;
	/** The same ViewModel, built on first use. */
	useLazyTodosVM: ReturnType<typeof createPlaygroundLazyTodosVM>;
	/** A ViewModel that holds nothing and answers questions about a list. */
	useStatsVM: ReturnType<typeof createPlaygroundStatsVM>;
	/** A second reader of the shared selection. */
	useBadgeVM: ReturnType<typeof createPlaygroundBadgeVM>;
	/** What the two ViewModels above agree on. */
	store: PlaygroundTodoStore;
	/** Where a screen reads the API base URL and the development flags. */
	describeEnvironment: () => string;
}

/**
 * The entry point, in the order an application's own must use.
 *
 * Activate before anything ambient is touched, register what the locator will be
 * asked for, construct the graph, then bootstrap: a ViewModel built before
 * activation resolves against no runtime, and scenario bootstrap after
 * construction is what binds the ViewModels that registered themselves while
 * being built.
 */
export const startPlayground = async (
	transport: ILankaTransport<RequestInit>,
): Promise<IPlaygroundApp> => {
	const lanka = createLanka({ host: lankaTestHost });
	lanka.activate();

	const todoGateway = new PlaygroundTodoGateway(transport);

	// Published to the locator rather than imported by whoever needs them. A
	// screen asks for a name and never learns where the object came from, which
	// is what lets a test — or an application with its own idea — put a different
	// one behind the same name.
	lanka.locators.singletons.register("PlaygroundSessionService", PlaygroundSessionService);
	// The same call for a singleton DECLARED by calling: the locator is given a
	// class either way, and cannot tell which style produced it.
	lanka.locators.singletons.register("PlaygroundClock", PlaygroundClock);
	lanka.locators.gateways.registerInstance("PlaygroundTodoGateway", todoGateway);

	const store = new PlaygroundTodoStore();

	await lanka.bootstrap();
	lankaScenarioBootstrap.bootstrap();

	return {
		lanka,
		store,
		// Resolved by NAME, never constructed here: that is what makes the object
		// behind the name replaceable. An application with its own `.lanka_di`
		// barrels writes `lankaGateways.playgroundTodoGateway` and gets the same
		// object with a type; core cannot, because its own fixture is empty by
		// contract — see the scene that proves the two paths agree.
		useTodosVM: createPlaygroundTodosVM(
			lanka.locators.gateways.get("playgroundTodoGateway") as PlaygroundTodoGateway,
		),
		useLazyTodosVM: createPlaygroundLazyTodosVM(todoGateway),
		useStatsVM: createPlaygroundStatsVM(),
		useBadgeVM: createPlaygroundBadgeVM(store),
		describeEnvironment: () =>
			`${getLankaHost().apiBaseUrl}${getLankaFlags().isDevelopment === true ? " (dev)" : ""}`,
	};
};

/** The session service, resolved the way a screen resolves one. */
export const playgroundSession = (lanka: ILankaInstance): PlaygroundSessionService =>
	lanka.resolve<PlaygroundSessionService>("playgroundSessionService");

/**
 * The same two objects through the AMBIENT facades.
 *
 * `lankaSingletons.playgroundSessionService` is what an application writes: no
 * instance in hand, no import of the class. It is untyped here and only here —
 * the type comes from a consumer's own `.lanka_di` barrels, and core's fixture is
 * empty because the contract says it ships empty.
 */
export const playgroundAmbient = () => ({
	// All four facades, because all four answer the same way to a name nobody
	// registered: a named refusal rather than `undefined` reaching a screen.
	scenarios: lankaScenarios,
	sharedStores: lankaSharedStores,
	session: (lankaSingletons as unknown as Record<string, PlaygroundSessionService>)
		.playgroundSessionService,
	gateway: (lankaGateways as unknown as Record<string, PlaygroundTodoGateway>)
		.playgroundTodoGateway,
});
