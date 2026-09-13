import { afterEach, describe, expect, it } from "vitest";
import { createLanka } from "./createLanka";
import { createLankaVM } from "../../../viewmodel/index";
import { createLankaScenario, lankaScenarioBootstrap } from "../../../scenario/index";
import { setLankaRuntimeResolver } from "../../../_internal/index";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaRuntime } from "../../../_internal/index";

/**
 * Creating an instance where "which instance is active" is somebody else's
 * question.
 *
 * On a server there is one instance per REQUEST, so `@lankajs/host` installs a
 * resolver and keeps the instance in async-local storage. The resolver is then
 * the WHOLE answer — the module-level pointer is deliberately not consulted
 * behind it — which means `activate()` cannot make an instance active, and the
 * instance only becomes findable once the CALLER has put it in the store.
 *
 * The order that follows is the subject here: `createLanka` runs before its
 * caller can store what it returns, so anything inside it that REQUIRES an
 * active runtime is asking a question that cannot be answered yet.
 */
const arrived = createLankaScenario<{ id: string }>({
	name: "ResolverArrived",
	eventType: "resolver.arrived",
	dataTypeName: "IResolverArrived",
});

/**
 * A ViewModel declared at MODULE level, which is what a screen file does.
 *
 * `Record<never, never>` for "no actions", not `Record<string, never>`. The
 * second reads better and is wrong: its string index signature intersects with
 * the STATE, and `heard` comes out as `never`.
 */
const useScreenVM = createLankaVM<{ heard: string }, Record<never, never>>({
	name: "ResolverScreenVM",
	states: { heard: "" },
	createActions: () => ({}),
	scenarioHandlers: [
		{
			scenario: arrived,
			handler:
				({ set }) =>
				(data?: { id: string }) => {
					set({ heard: data?.id ?? "" });
				},
		},
	],
});

afterEach(() => {
	// The resolver goes LAST of the two, and that order is the same one this file
	// is about: resetting the scenario layer reaches for the active runtime, and
	// with the resolver already gone there is nothing to reach.
	lankaScenarioBootstrap.reset();
	setLankaRuntimeResolver(null);
});

describe("createLanka under a runtime resolver", () => {
	it("does not require an instance that does not exist yet", () => {
		// The failure this pins: `createLanka` adopted the module-level ViewModels
		// declared so far, adoption asked for the ACTIVE runtime, and on a server
		// there was none — because the caller stores the instance only after
		// `createLanka` has returned. Every server render of an application with a
		// client component threw, with a message about a missing request scope,
		// from inside the very call that was creating the scope.
		const store: { runtime: ILankaRuntime | null } = { runtime: null };
		setLankaRuntimeResolver(() => store.runtime);

		expect(() => {
			store.runtime = createLanka({ host: lankaTestHost });
		}).not.toThrow();

		(store.runtime as unknown as { dispose: () => void }).dispose();
	});

	it("still binds a ViewModel declared before the instance existed", async () => {
		// Skipping adoption would be no fix at all if the ViewModel were then
		// forgotten: bootstrap adopts what creation could not.
		const store: { runtime: ILankaRuntime | null } = { runtime: null };
		setLankaRuntimeResolver(() => store.runtime);

		const lanka = createLanka({ host: lankaTestHost });
		store.runtime = lanka;
		await lanka.bootstrap();

		arrived.trigger({ id: "m-7" });

		expect(useScreenVM.getState().heard).toBe("m-7");
		lanka.dispose();
	});
});
