import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { createLankaVM } from "lanka/viewmodel";
import { useLankaVM } from "./useLankaVM";

/**
 * The one path Vue's own lifecycle allows and nothing else in this package
 * reaches: a component instance exists — `useLankaVM` took the `onMounted`
 * branch — and its scope is torn down before that mount ever happens. A
 * component whose setup ran inside a `<Suspense>` boundary that resolves
 * elsewhere first, or whose parent unmounts during the same synchronous patch,
 * is the real-world shape of this; racing Vue's own scheduler for it is not
 * deterministic, so `onMounted` is mocked to never fire instead.
 *
 * Isolated in its own file because `vi.mock("vue", …)` is file-wide: a sibling
 * spec asserting the ORDINARY mount behaviour must keep the real `onMounted`.
 */
vi.mock("vue", async (importOriginal) => {
	const actual = await importOriginal<typeof import("vue")>();

	return {
		...actual,
		getCurrentInstance: () => ({}) as unknown as ReturnType<typeof actual.getCurrentInstance>,
		// The lifecycle an abandoned mount never reaches: the callback is
		// discarded rather than stored, exactly as an unmount-before-mount would
		// leave it unfired.
		onMounted: () => undefined,
	};
});

describe("a component instance whose mount is abandoned before `onMounted` ever fires", () => {
	it("releases through the still-default `stop`, having never subscribed at all", () => {
		const counterVM = createLankaVM<{ count: number }, { bump: () => void }>({
			name: "AbandonedMountCounter",
			states: { count: 0 },
			createActions: ({ set, get }) => ({
				bump: () => {
					set({ count: get().count + 1 });
				},
			}),
		});
		const subscribe = vi.spyOn(counterVM, "subscribe");
		const scope = effectScope();

		scope.run(() => {
			useLankaVM(counterVM);
		});

		// `onMounted`'s callback was never called, so `start()` never ran and the
		// ViewModel never heard from this reader.
		expect(subscribe).not.toHaveBeenCalled();

		// `onScopeDispose` still fires on a real scope regardless of whether the
		// component it belonged to ever mounted, so `release()` calls `stop()`
		// while it is still the untouched no-op — and that must not throw.
		expect(() => {
			scope.stop();
		}).not.toThrow();
	});
});
