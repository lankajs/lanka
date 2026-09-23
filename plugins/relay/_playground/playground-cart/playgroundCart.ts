import { createLankaVM } from "lanka/viewmodel";
import { defineLankaVM } from "lanka/extend";
import type { ILankaVMDefinition } from "lanka/extend";
import { playgroundCartChanged } from "../playground-cart-changed/playgroundCartChanged";

interface IPlaygroundCartState {
	items: number;
}

interface IPlaygroundCartActions {
	addItem: () => void;
}

const buildCart = () =>
	createLankaVM<IPlaygroundCartState, IPlaygroundCartActions>({
		name: "PlaygroundCartVM",
		states: { items: 0 },
		createActions: ({ get, set }) => ({
			addItem: () => {
				const items = get().items + 1;
				set({ items });
				playgroundCartChanged.trigger({ items });
			},
		}),
	});

export type TPlaygroundCartVM = ReturnType<typeof buildCart>;

/** The shop's cart: it owns the count, and announces every change. */
export const playgroundCart: ILankaVMDefinition<TPlaygroundCartVM> = defineLankaVM({
	name: "PlaygroundCartVM",
	build: buildCart,
});
