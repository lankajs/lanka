import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { useLankaVM } from "../src/index";
import { renderWithLanka } from "../src/testing";
import {
	PlaygroundMigratedCountScreen,
	PlaygroundMigratedTodoScreen,
	usePlaygroundTodosVM,
} from "./app";
import type { JSX } from "react";

/**
 * The 1.x React spelling, end to end, after the 2.0 migration.
 *
 * ## What this file is for that the scenes next door are not
 *
 * `playground.test.tsx` drives the callable spelling over a ViewModel it builds
 * per test and passes as a prop. That proves the wrapper. It cannot prove the
 * MIGRATION, because the migration is about a file a consumer already has:
 * a ViewModel at module level, a screen importing the hook by name, and a loader
 * reading `getState()` outside any component. Those three are one subject and
 * they only exist together, so they are one file — canon: testing §3 and §8.
 *
 * Every assertion here is written as the question a consumer asks about the
 * upgrade: "does my screen still render", "do my selectors still work", "did I
 * lose the render skipping I was relying on", "is my ViewModel still one store".
 */

/** The state the module-level ViewModel starts every scene from. */
const reset = () => {
	usePlaygroundTodosVM.setState(usePlaygroundTodosVM.getInitialState());
};

beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
	reset();
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

describe("a 1.x screen, unedited", () => {
	it("renders what the imported hook holds", async () => {
		render(<PlaygroundMigratedTodoScreen />);
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		expect(screen.getByText("write the canon")).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		render(<PlaygroundMigratedTodoScreen />);
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		act(() => {
			usePlaygroundTodosVM.getState().complete(1);
		});

		expect(screen.getByText("write the canon ✓")).toBeTruthy();
	});

	it("shows the failure the ViewModel named", () => {
		render(<PlaygroundMigratedTodoScreen />);

		act(() => {
			usePlaygroundTodosVM.getState().fail("the canon refused");
		});

		expect(screen.getByRole("alert").textContent).toBe("the canon refused");
	});

	it("takes a selector, which is the other call shape 1.x had", async () => {
		render(<PlaygroundMigratedCountScreen />);
		expect(screen.getByTestId("count").textContent).toBe("0");

		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		expect(screen.getByTestId("count").textContent).toBe("2");
	});
});

describe("what the upgrade must not have taken away", () => {
	it("skips the render for a key the screen never read", async () => {
		// The whole reason a consumer tolerates access tracking. A ViewModel at
		// module level is where it would be lost, because a recording opened at
		// IMPORT time belongs to no component and answers for all of them.
		const onRender = vi.fn();
		render(<PlaygroundMigratedTodoScreen onRender={onRender} />);
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});
		const afterLoad = onRender.mock.calls.length;

		act(() => {
			usePlaygroundTodosVM.getState().touchUnread();
		});

		expect(onRender.mock.calls.length).toBe(afterLoad);
	});

	it("gives each mounted screen its OWN recording, not one shared at import", async () => {
		/*
		 * Two TRACKED readers of the one module-level ViewModel, reading disjoint
		 * keys, and each change must wake exactly one of them.
		 *
		 * Both arms are asserted because only the pair rules out the two ways this
		 * passes while broken: one shared recording wakes both, and a reader that
		 * never subscribed wakes for nothing. Written first with the selector screen
		 * as the second reader, where it proved nothing — a selector bypasses
		 * tracking, so the held selection kept it still and the scene stayed green
		 * with the recording switched off.
		 */
		const onList = vi.fn();
		const onUnread = vi.fn();

		const UnreadScreen = (): JSX.Element => {
			const { unread } = usePlaygroundTodosVM();
			onUnread();

			return <p data-testid="unread">{String(unread)}</p>;
		};

		render(
			<>
				<PlaygroundMigratedTodoScreen onRender={onList} />
				<UnreadScreen />
			</>,
		);
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		const listAfterLoad = onList.mock.calls.length;
		const unreadAfterLoad = onUnread.mock.calls.length;

		act(() => {
			usePlaygroundTodosVM.getState().touchUnread();
		});

		expect(onUnread.mock.calls.length).toBeGreaterThan(unreadAfterLoad);
		expect(onList.mock.calls.length).toBe(listAfterLoad);

		const listBeforeComplete = onList.mock.calls.length;
		const unreadBeforeComplete = onUnread.mock.calls.length;

		act(() => {
			usePlaygroundTodosVM.getState().complete(1);
		});

		expect(onList.mock.calls.length).toBeGreaterThan(listBeforeComplete);
		expect(onUnread.mock.calls.length).toBe(unreadBeforeComplete);
	});

	it("releases a screen's subscription when it unmounts", () => {
		// The other half of the same claim: a subscription opened at import time is
		// never released, so an unmounted screen keeps being woken and React warns
		// about a state update on a component that is gone.
		const onCount = vi.fn();
		const { unmount } = render(<PlaygroundMigratedCountScreen onRender={onCount} />);
		const mounted = onCount.mock.calls.length;

		unmount();
		act(() => {
			usePlaygroundTodosVM.getState().fail("after the screen left");
		});

		expect(onCount.mock.calls.length).toBe(mounted);
	});

	it("answers getState, setState and subscribe outside a component, as a loader does", () => {
		const seen: number[] = [];
		const stop = usePlaygroundTodosVM.subscribe((next) => seen.push(next.unread));

		usePlaygroundTodosVM.setState({ unread: 7 });
		stop();
		usePlaygroundTodosVM.setState({ unread: 8 });

		expect(seen).toEqual([7]);
		expect(usePlaygroundTodosVM.getState().unread).toBe(8);
		expect(usePlaygroundTodosVM.name).toBe("PlaygroundTodosVM");
	});
});

describe("what the upgrade gave the same file", () => {
	it("is still a ViewModel, so the portable spelling reads it too", async () => {
		/*
		 * The migration's actual payoff, and the thing a wrapper could quietly cost:
		 * `usePlaygroundTodosVM` is the ViewModel as well as the hook, so a screen
		 * written the portable way — the way a Vue or Svelte screen is written —
		 * reads the SAME store with no second export and no unwrapping.
		 */
		const Portable = () => {
			const { todos } = useLankaVM(usePlaygroundTodosVM);

			return <p data-testid="portable">{String(todos.length)}</p>;
		};

		render(
			<>
				<PlaygroundMigratedCountScreen />
				<Portable />
			</>,
		);
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		expect(screen.getByTestId("portable").textContent).toBe("2");
		expect(screen.getByTestId("count").textContent).toBe("2");
	});

	it("renders under the helper the migration moved, from its new package", async () => {
		// The second line of the migration diff: `renderWithLanka` left
		// `@lankajs/tool-testing` for `@lankajs/react/testing`, and a consumer who
		// changed only the import must get the same render.
		const { lanka } = renderWithLanka(<PlaygroundMigratedTodoScreen />, {
			host: lankaTestHost,
		});
		await act(async () => {
			await usePlaygroundTodosVM.getState().load();
		});

		expect(lanka).toBeTruthy();
		expect(screen.getByText("run the canon")).toBeTruthy();
	});
});
