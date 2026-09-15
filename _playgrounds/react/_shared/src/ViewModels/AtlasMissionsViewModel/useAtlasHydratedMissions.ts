import { hydrateLankaVM } from "@lankajs/host";
import { useAtlasMissions } from "./useAtlasMissions";
import type {
	IAtlasMission,
	IAtlasMissionsActions,
	IAtlasMissionsState,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";

/**
 * The missions ViewModel as a HOST receives it — writable.
 *
 * Wider than `TAtlasMissionsVM` because hydration WRITES, which is the whole
 * difference between a screen and a host. A screen never gets this type, and
 * that is what keeps `setState` out of the render tree.
 *
 * Spelled as the factory's return rather than as `ILankaVM<State & Actions>`,
 * and the reason is a real failure: `setState` takes the state, so `ILankaVM` is
 * INVARIANT in it — a ViewModel that also carries `ILankaScenarioVM` is not
 * assignable to one that does not, however much of the shape it shares. Naming
 * the factory says exactly what a caller has, and stays true when the ViewModel
 * gains a mixin.
 */
export type TAtlasWritableMissionsVM = ReturnType<typeof createAtlasMissionsVM>;

/**
 * Read the missions ViewModel, starting from what the server already had.
 *
 * The handoff is DATA, not state: the page fetched through a gateway inside a
 * scope, handed the result down as an ordinary prop, and this makes it the
 * ViewModel's first state. There is no second request from the browser for what
 * the HTML already contained.
 *
 * `hydrateLankaVM` applies ONCE per store. A later call does nothing — not a
 * throw, because React renders a component twice in StrictMode and again on
 * every re-render, and a throw would turn correct code into a crash visible only
 * in development. Changing hydrated state afterwards is an action's job.
 *
 * Called during render rather than in an effect, deliberately. An effect runs
 * AFTER the first paint, so the first frame would be the empty state and the
 * second the server's — the flash a server-rendered page exists to avoid.
 *
 * The Next application and the Astro island are the two callers, and they are the
 * two places in this repository where a host renders first. Every word above was
 * written twice before it was written here.
 */
export const useAtlasHydratedMissions = (
	missionsVM: TAtlasWritableMissionsVM,
	missions: readonly IAtlasMission[],
): IAtlasMissionsState & IAtlasMissionsActions => {
	hydrateLankaVM(missionsVM, { missions });

	return useAtlasMissions(missionsVM);
};
