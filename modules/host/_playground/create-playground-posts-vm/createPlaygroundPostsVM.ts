import { createLankaVM } from "lanka/viewmodel";
import type { IPlaygroundPost } from "../_interfaces/IPlaygroundPost";

export interface IPlaygroundPostsState {
	posts: readonly IPlaygroundPost[];
	loads: number;
}

export interface IPlaygroundPostsActions {
	/** What the screen would do if nothing had been hydrated into it. */
	loadInTheBrowser: (posts: readonly IPlaygroundPost[]) => void;
}

/**
 * The screen's state, as an application would declare it.
 *
 * `loads` counts what the BROWSER had to fetch. A server-rendered screen that
 * hydrates correctly leaves it at zero, and that is the assertion the scene is
 * built around.
 */
export const createPlaygroundPostsVM = () =>
	createLankaVM<IPlaygroundPostsState, IPlaygroundPostsActions>({
		name: "PlaygroundPostsVM",
		states: { posts: [], loads: 0 },
		createActions: (ctx) => ({
			loadInTheBrowser: (posts) => {
				ctx.set({ posts, loads: ctx.get().loads + 1 });
			},
		}),
	});
