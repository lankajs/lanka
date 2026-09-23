import { createLankaVM } from "lanka/viewmodel";
import { defineLankaVM } from "lanka/extend";
import type { ILankaVMDefinition } from "lanka/extend";
import { playgroundCartChanged } from "../playground-cart-changed/playgroundCartChanged";

interface IPlaygroundBadgeState {
	count: number;
}

const buildBadge = () =>
	createLankaVM<IPlaygroundBadgeState, Record<never, never>>({
		name: "PlaygroundBadgeVM",
		states: { count: 0 },
		createActions: () => ({}),
		scenarioHandlers: [
			{
				scenario: playgroundCartChanged,
				handler:
					({ set }) =>
					(data?: { items: number }) => {
						if (data) set({ count: data.items });
					},
				options: { replay: "last" },
			},
		],
	});

export type TPlaygroundBadgeVM = ReturnType<typeof buildBadge>;

/**
 * The header's badge: it owns nothing, and shows the last count it heard.
 *
 * `replay: "last"` is what lets a header that loads AFTER the cart changed show
 * the current count — the relay keeps the retained value waiting on the header's
 * bus, and a subscriber has to ask for it, as it would for a local event.
 */
export const playgroundBadge: ILankaVMDefinition<TPlaygroundBadgeVM> = defineLankaVM({
	name: "PlaygroundBadgeVM",
	build: buildBadge,
});
