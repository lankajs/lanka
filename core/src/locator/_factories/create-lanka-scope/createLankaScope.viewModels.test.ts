import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka } from "../../../bootstrap/_factories/create-lanka/createLanka";
import { createLankaScenario } from "../../../scenario/_factories/create-lanka-scenario/createLankaScenario";
import { createLankaVM } from "../../../viewmodel/_factories/create-lanka-vm/createLankaVM";
import { createLazyLankaVM } from "../../../viewmodel/_factories/create-lazy-lanka-vm/createLazyLankaVM";
import { defineLankaVM } from "../../../viewmodel/_factories/define-lanka-vm/defineLankaVM";
import { resolveLankaVM } from "../../../viewmodel/_factories/resolve-lanka-vm/resolveLankaVM";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import type { ILankaInstance } from "../../../bootstrap/_factories/create-lanka/createLanka";

/**
 * A ViewModel's lifetime, tied to a scope.
 *
 * A module that mounts into a page and later leaves it — a route, a modal, a
 * separately built micro-frontend — builds ViewModels that subscribe to
 * scenarios. Without a scope, leaving means remembering `resetScenario()` for
 * each of them, and the one forgotten keeps running handlers against a screen
 * that is gone. Resolved IN a scope, they leave with it.
 *
 * The scope is handed to `resolveLankaVM` rather than wrapping the build in a
 * callback: a scope may only take what is ITS OWN, and "built while this
 * callback ran" is not ownership — a shared ViewModel first touched inside the
 * callback would die with the module. "Resolved from this definition, in this
 * scope" is.
 */

interface IProbeData {
	n: number;
}

const probe = createLankaScenario<IProbeData>({
	name: "ScopeProbe",
	eventType: "SCOPE_PROBE",
	dataTypeName: "ScopeProbeData",
});

/** A ViewModel with one handler, so hearing and not hearing are both visible. */
const buildProbeVM = (heard: (n: number) => void) =>
	createLankaVM<{ last: number }, Record<never, never>>({
		name: "ScopeProbeVM",
		states: { last: 0 },
		createActions: () => ({}),
		scenarioHandlers: [
			{
				scenario: probe,
				handler:
					({ set }) =>
					(data?: IProbeData) => {
						if (!data) return;
						heard(data.n);
						set({ last: data.n });
					},
			},
		],
	});

/** The same ViewModel, built on its first read rather than when it is declared. */
const buildLazyProbeVM = (heard: (n: number) => void) =>
	createLazyLankaVM<{ last: number }, Record<never, never>>({
		name: "LazyProbeVM",
		states: { last: 0 },
		createActions: () => ({}),
		scenarioHandlers: [
			{
				scenario: probe,
				handler:
					({ set }) =>
					(data?: IProbeData) => {
						if (!data) return;
						heard(data.n);
						set({ last: data.n });
					},
			},
		],
	});

/** The definition a module would hold at module level, its build reporting to `heard`. */
const defineProbe = (heard: (n: number) => void) =>
	defineLankaVM({ name: "ScopeProbeVM", build: () => buildProbeVM(heard) });

describe("ViewModels resolved in a scope", () => {
	let lanka: ILankaInstance;

	beforeEach(async () => {
		lanka = createLanka({ host: lankaTestHost });
		// Bootstrapped, so a ViewModel registered from now on subscribes at once
		// rather than at the next bootstrap — which is the state a page is in when
		// a module arrives.
		await lanka.bootstrap();
	});

	it("hear a scenario while the scope is open", () => {
		const heard = vi.fn();
		const scope = lanka.createScope();
		const vm = resolveLankaVM(defineProbe(heard), { scope });

		probe.trigger({ n: 1 });

		expect(heard).toHaveBeenCalledWith(1);
		expect(vm.getState().last).toBe(1);
	});

	it("hear nothing once the scope is closed", () => {
		const heard = vi.fn();
		const scope = lanka.createScope();
		const vm = resolveLankaVM(defineProbe(heard), { scope });

		scope.dispose();
		probe.trigger({ n: 2 });

		expect(heard).not.toHaveBeenCalled();
		expect(vm.getState().last).toBe(0);
	});

	it("leave the registry as it was", () => {
		const before = lanka.viewModels.getAllViewModels().length;
		const scope = lanka.createScope();
		resolveLankaVM(defineProbe(vi.fn()), { scope });

		expect(lanka.viewModels.getAllViewModels().length).toBe(before + 1);

		scope.dispose();

		expect(lanka.viewModels.getAllViewModels().length).toBe(before);
	});

	it("are not adopted by a later instance", () => {
		// A module-level ViewModel is declared once and adopted by every instance
		// ever created. A scoped one belongs to the scope that built it: a second
		// instance — the next test, the next request — must not inherit it.
		const scope = lanka.createScope();
		const vm = resolveLankaVM(defineProbe(vi.fn()), { scope });

		const later = createLanka({ host: lankaTestHost });

		expect(later.viewModels.getAllViewModels()).not.toContain(vm.getState());
	});

	it("leave a ViewModel built outside the scope alone", () => {
		const heard = vi.fn();
		buildProbeVM(heard);
		const scope = lanka.createScope();
		resolveLankaVM(defineProbe(vi.fn()), { scope });

		scope.dispose();
		probe.trigger({ n: 3 });

		// A scope takes ITS OWN. Closing a module must not silence the page.
		expect(heard).toHaveBeenCalledWith(3);
	});

	it("cannot be resolved in a closed scope", () => {
		const scope = lanka.createScope();
		scope.dispose();

		expect(() => resolveLankaVM(defineProbe(vi.fn()), { scope })).toThrowError(/closed/i);
	});

	it("are one instance per definition in a scope, and two across two scopes", () => {
		const definition = defineProbe(vi.fn());
		const first = lanka.createScope();
		const second = lanka.createScope();

		expect(resolveLankaVM(definition, { scope: first })).toBe(
			resolveLankaVM(definition, { scope: first }),
		);
		expect(resolveLankaVM(definition, { scope: second })).not.toBe(
			resolveLankaVM(definition, { scope: first }),
		);
	});

	it("are a different instance from the page's own", () => {
		// The module-level answer and the module's answer must not be one object:
		// the module's leaves with the module, the page's stays.
		const definition = defineProbe(vi.fn());
		const scope = lanka.createScope();

		expect(resolveLankaVM(definition, { scope })).not.toBe(resolveLankaVM(definition));
	});

	it("belong to the scope when they are LAZY, whenever they are first read", () => {
		// A lazy ViewModel builds on its first read, which is after `resolveLankaVM`
		// returned. Built then outside the scope, it would join the process-wide
		// list every later instance adopts — the leak a scope exists to prevent —
		// and `dispose()` would not find it.
		const heard = vi.fn();
		const definition = defineLankaVM({
			name: "LazyProbeVM",
			build: () => buildLazyProbeVM(heard),
		});
		const scope = lanka.createScope();
		const vm = resolveLankaVM(definition, { scope });
		const before = lanka.viewModels.getAllViewModels().length;

		vm.getState(); // the first read builds it
		expect(lanka.viewModels.getAllViewModels().length).toBe(before + 1);

		scope.dispose();
		probe.trigger({ n: 5 });

		expect(heard).not.toHaveBeenCalled();
		expect(lanka.viewModels.getAllViewModels().length).toBe(before);
		expect(createLanka({ host: lankaTestHost }).viewModels.getAllViewModels()).not.toContain(
			vm.getState(),
		);
	});

	it("refuse to build lazily once their scope has closed", () => {
		const definition = defineLankaVM({
			name: "LazyProbeVM",
			build: () => buildLazyProbeVM(vi.fn()),
		});
		const scope = lanka.createScope();
		const vm = resolveLankaVM(definition, { scope });

		scope.dispose();

		// A reference that outlived its screen, read for the first time. Building
		// now would subscribe a ViewModel whose scope is gone.
		expect(() => vm.getState()).toThrowError(/closed/i);
	});

	it("go when the instance goes", () => {
		const heard = vi.fn();
		const scope = lanka.createScope();
		resolveLankaVM(defineProbe(heard), { scope });

		lanka.dispose();
		const next = createLanka({ host: lankaTestHost });
		probe.trigger({ n: 4 });

		expect(heard).not.toHaveBeenCalled();
		next.dispose();
	});
});
