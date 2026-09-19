import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/vue";
import { waitFor } from "@testing-library/dom";
import { nextTick } from "vue";
import { LankaError } from "lanka/errors";
import {
	AtlasBoardVM,
	atlasBoardMessagePosted,
	createAtlasAvatarCache,
	createAtlasMissionsVM,
} from "@lanka-playgrounds/_shared";
import { lankaPrefetch } from "@lankajs/plugin-prefetch";
import { startAtlasVue } from "./startAtlasVue";
import type { IAtlasVueApp } from "./startAtlasVue";
import type { TAtlasMissionsVM } from "@lanka-playgrounds/vue-shared";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { resetActiveLanka, startLanka } from "lanka/bootstrap";
import AtlasApp from "./App/AtlasApp.vue";
import AtlasBoardScreen from "./Modules/AtlasBoardModule/AtlasBoardScreen.vue";
import AtlasMissionsScreen from "./Modules/AtlasMissionsModule/AtlasMissionsScreen.vue";
import type {
	AtlasBoardGateway,
	AtlasMissionGateway,
	IAtlasMission,
} from "@lanka-playgrounds/_shared";

/**
 * A real plugin, watched rather than replaced.
 *
 * Nothing in the framework keeps a list of installed plugins, so "prefetch is
 * installed" has no reading to assert — only the call that installs it. `spy`
 * and not a stub for that reason: the plugin still does everything it does, and
 * what the scene pins is the one number with a reason attached to it.
 */
vi.mock("@lankajs/plugin-prefetch", { spy: true });

/**
 * Atlas in Vue, asserting what `_playgrounds/react/spa` asserts.
 *
 * Deliberately the same claims in the same words. Two applications saying the
 * same sentences about the same ViewModels is what a `parallel` shelf means, and
 * reading them side by side should show only each framework's own syntax — a
 * single-file component here, JSX there.
 *
 * These render REAL `.vue` files, which is the half no binding suite covers: an
 * SFC goes through a compiler, and a compiler is what a consumer's build has and
 * a binding's does not.
 */
beforeEach(() => {
	resetActiveLanka();
	void startLanka({ host: lankaTestHost });
});

afterEach(() => {
	cleanup();
	resetActiveLanka();
});

const mission = (id: string, over: Partial<IAtlasMission> = {}): IAtlasMission => ({
	id,
	code: `AT-10${id.replace(/\D/g, "")}`,
	title: `Mission ${id}`,
	status: "queued",
	priority: 3,
	crewId: null,
	updatedAt: "2026-09-15T00:00:00.000Z",
	...over,
});

const ROWS: readonly IAtlasMission[] = [
	// One crewed row and one without, deliberately — the same fixture the other
	// four applications carry. A list whose rows all say `crewId: null` renders
	// the avatar arm in no scene at all, and the guard around it reports as
	// working while nothing has ever gone through it.
	mission("m-1", { title: "Survey the north ridge", crewId: "c-1" }),
	mission("m-2", { title: "Restock the depot" }),
];

const fakeMissionGateway = (over: Record<string, unknown> = {}): AtlasMissionGateway =>
	({
		list: vi.fn(() => Promise.resolve([...ROWS])),
		complete: vi.fn((id: string) => Promise.resolve(mission(id, { status: "done" }))),
		remove: vi.fn((id: string) => Promise.resolve({ id })),
		...over,
	}) as unknown as AtlasMissionGateway;

const fakeBoardGateway = (): AtlasBoardGateway =>
	({
		summary: vi.fn(() => Promise.resolve({ queued: 2, active: 1, done: 0 })),
		post: vi.fn(() => Promise.resolve({ text: "ack", at: "2026-09-15T00:00:00.000Z" })),
	}) as unknown as AtlasBoardGateway;

/**
 * The avatar cache, with every rung of its fallback chain forced off.
 *
 * `indexedDb` and `caches` are `undefined` because this asserts the COMPONENT
 * rather than IndexedDB, and `createObjectUrl` is stubbed because jsdom has
 * none — which is the same reason the real one is allowed to answer `null`.
 */
const avatars = () =>
	createAtlasAvatarCache({
		indexedDb: undefined,
		caches: undefined,
		now: () => 0,
		createObjectUrl: () => "blob:atlas",
		revokeObjectUrl: () => undefined,
	});

const missionsScreen = async (gateway: AtlasMissionGateway) => {
	const missionsVM = createAtlasMissionsVM(gateway);
	render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });
	await missionsVM.getState().fetchMissions();
	await nextTick();

	return missionsVM;
};

/**
 * A ViewModel that COUNTS the subscriptions standing on it.
 *
 * The only way to ask a binding whether it let go. Nothing in the framework
 * exposes a listener count — on purpose, since a count is a thing application
 * code would start branching on — so the count is kept out here, by a wrapper
 * that hands back the real ViewModel's own functions and one of its own.
 */
const watched = (viewModel: TAtlasMissionsVM) => {
	let live = 0;

	return {
		live: () => live,
		viewModel: {
			...viewModel,
			subscribe: (listener: Parameters<TAtlasMissionsVM["subscribe"]>[0]) => {
				live += 1;

				const stop = viewModel.subscribe(listener);

				return () => {
					live -= 1;
					stop();
				};
			},
		} as TAtlasMissionsVM,
	};
};

describe("a single-file component reading a ViewModel", () => {
	it("renders what the ViewModel loaded, and nothing it did not ask for", async () => {
		await missionsScreen(fakeMissionGateway());

		expect(screen.getByText(/Survey the north ridge/)).toBeTruthy();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows what an action wrote, without being told to re-read", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		missionsVM.getState().applySearch("depot");
		await nextTick();

		expect(screen.queryByText(/Survey the north ridge/)).toBeNull();
		expect(screen.getByText(/Restock the depot/)).toBeTruthy();
	});

	it("shows a failure the ViewModel put there, and owns no error state of its own", async () => {
		// The screen owns no error state and catches nothing: the ViewModel decided
		// what a failure means, and the template reads the word it wrote.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({
				list: vi.fn(() =>
					Promise.reject(new LankaError({ kind: "network", message: "no route" })),
				),
			}),
		);

		expect(missionsVM.getState().error).not.toBeNull();
		expect(screen.getByRole("alert").textContent).toBe(missionsVM.getState().error);
	});

	it("filters as somebody types", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());
		const input = screen.getByLabelText<HTMLInputElement>("Search missions");

		input.value = "ridge";
		input.dispatchEvent(new Event("input"));
		await nextTick();

		// A whole round trip with only Vue's syntax in it: an event handler called
		// an action, the store notified, and the template re-read.
		expect(missionsVM.getState().search).toBe("ridge");
		expect(screen.queryByText(/Restock the depot/)).toBeNull();
	});

	it("pages through what the ViewModel derived", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		expect(screen.getByTestId("page").textContent).toContain("1 /");
		expect(missionsVM.getState().rows().items).toHaveLength(2);
	});

	it("completes a mission through the action, not through the gateway", async () => {
		// A screen that reached the gateway directly would take on the loading flag,
		// the retry and the rollback, and implement none of them.
		const gateway = fakeMissionGateway();
		await missionsScreen(gateway);

		await fireEvent.click(screen.getByText("Complete AT-101"));

		// The FIRST argument only. The second is a deadline signal the framework
		// adds on the way out, and asserting the whole call would be this screen's
		// test failing the day a request policy gains an option.
		await waitFor(() => expect(gateway.complete).toHaveBeenCalled());
		expect(vi.mocked(gateway.complete).mock.calls[0]?.[0]).toBe("m-1");
	});
});

describe("the board screen, over the same ViewModel every other application reads", () => {
	it("paints the summary a gateway answered with", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		await boardVM.getState().fetchSummary();
		await nextTick();

		expect(screen.getByTestId("board-summary").textContent).toBe("2 queued");
	});

	it("paints a message that arrived from somewhere else entirely", async () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		// `setState` and not an action, standing in for the scenario subscription a
		// live stream drives. The screen cannot tell the two apart, which is the
		// property that makes a ViewModel portable in the first place.
		boardVM.setState({ messages: [{ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" }] });
		await nextTick();

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});

	it("says so when there is no summary yet", () => {
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		expect(screen.getByTestId("board-summary").textContent).toBe("no summary");
	});
});

describe("the shell, over one started application", () => {
	/**
	 * Everything the shell reads, and nothing else.
	 *
	 * `avatars` is on it because the shell hands it down, and a fake without it
	 * made Vue warn on every shell scene while the screen rendered no face at
	 * all — a broken prop that two scenes ran straight past, because neither
	 * looked for one.
	 */
	const startedApp = () =>
		({
			app: { missionGateway: fakeMissionGateway(), boardGateway: fakeBoardGateway() },
			avatars: avatars(),
		}) as unknown as IAtlasVueApp;

	it("renders both screens", () => {
		// The ViewModels are built INSIDE the shell rather than at module level,
		// which is what lets this be mounted twice in one process — a module-level
		// ViewModel is one store per PROCESS: right for a browser tab, wrong for a
		// suite, and wrong for a server.
		render(AtlasApp, { props: { app: startedApp() } });

		expect(screen.getByLabelText("Missions")).toBeTruthy();
		expect(screen.getByLabelText("Board")).toBeTruthy();
	});

	it("hands the face cache DOWN, rather than letting a screen build one", async () => {
		// The scene the two above could not fail. A cache built per screen starts
		// empty every time somebody navigates, which is the fetch it exists to
		// avoid — so the shell owns exactly one and passes it, and the proof is
		// that a row with a crew member gets a face at all.
		const app = startedApp();
		render(AtlasApp, { props: { app } });

		await waitFor(() => expect(screen.getByAltText("c-1")).toBeTruthy());
		expect(app.avatars).toBeDefined();
	});

	it("can be mounted twice in one process", () => {
		render(AtlasApp, { props: { app: startedApp() } });
		render(AtlasApp, { props: { app: startedApp() } });

		expect(screen.getAllByLabelText("Missions")).toHaveLength(2);
	});
});

describe("the parts of the screen a reader drives", () => {
	it("sorts by priority through the action", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		await fireEvent.click(screen.getByText("Sort by priority"));

		expect(missionsVM.getState().currentSort().field).toBe("priority");
	});

	it("pages, and cannot page past the end", async () => {
		const missionsVM = await missionsScreen(fakeMissionGateway());

		// One page of two rows, so "Previous" and "Next" are both dead ends — and a
		// screen that let a reader press them would be asking the ViewModel for a
		// page it has already said does not exist.
		expect(screen.getByText("Previous").hasAttribute("disabled")).toBe(true);
		expect(screen.getByText("Next").hasAttribute("disabled")).toBe(true);
		expect(missionsVM.getState().page).toBe(1);
	});
});

describe("a board with more rows than a page holds", () => {
	const manyRows = Array.from({ length: 25 }, (_, index) => mission(`m-${index + 1}`));

	it("moves to the next page and back through the actions", async () => {
		// The paging buttons are the two handlers a one-page fixture can never
		// reach: with everything on one page a screen that let a reader press them
		// would be asking the ViewModel for a page it has said does not exist.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		expect(missionsVM.getState().rows().totalPages).toBeGreaterThan(1);

		await fireEvent.click(screen.getByText("Next"));
		expect(missionsVM.getState().page).toBe(2);

		await fireEvent.click(screen.getByText("Previous"));
		expect(missionsVM.getState().page).toBe(1);
	});

	it("renders the page the ViewModel derived, not one of its own", async () => {
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([...manyRows])) }),
		);

		await fireEvent.click(screen.getByText("Next"));
		await nextTick();

		expect(screen.getByTestId("page").textContent).toContain("2 /");
		expect(missionsVM.getState().rows().items.length).toBeLessThan(manyRows.length);
	});
});

describe("the packages a browser application reaches", () => {
	it("renders a crew member's face through the blob cache", async () => {
		// The row carries a crew id, and the fixtures elsewhere do not: an avatar
		// that only renders for a crewed mission is an avatar no scene reaches
		// unless one is written on purpose.
		const crewed = mission("m-7", { title: "Walk the perimeter", crewId: "c-1" });
		const missionsVM = createAtlasMissionsVM(
			fakeMissionGateway({ list: vi.fn(() => Promise.resolve([crewed])) }),
		);
		render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });
		await missionsVM.getState().fetchMissions();
		await nextTick();

		const face = screen.getByAltText<HTMLImageElement>("c-1");

		// The URL comes from the shared rule, not from a payload field: the server
		// derives the bytes from the id and promises they never change, which is
		// what lets the cache hold them without ever asking again.
		expect(face.getAttribute("src")).toBe("/api/crew/c-1/avatar.png");
	});

	it("gives the row with no crew no face at all", async () => {
		// The other arm, and the one that would rot silently: a screen that rendered
		// an `<img>` for a missionless crew would request a 404 per row.
		//
		// Counted rather than asked for `null`, because the fixture now crews one
		// of its two rows: "no image anywhere" was an assertion the old all-null
		// fixture made true without the guard doing anything.
		await missionsScreen(fakeMissionGateway());

		expect(screen.getAllByRole("img")).toHaveLength(1);
	});
});

describe("a fact from outside, through the whole scenario layer", () => {
	it("shows a message somebody ELSE posted, which arrived as a fact", async () => {
		// The scene the board's older one only stood in for. `setState` proves the
		// screen re-reads; it does not prove the path a live stream actually uses —
		// scenario triggered, handler run, ViewModel written, binding notified.
		//
		// Nothing here touches the ViewModel. That is the point: every other scene
		// in this file moves the screen by calling something the screen can see, and
		// a binding that only notified on its own actions would pass all of them.
		const boardVM = new AtlasBoardVM(fakeBoardGateway()).build();
		render(AtlasBoardScreen, { props: { boardVM } });

		atlasBoardMessagePosted.trigger({ text: "ridge clear", at: "2026-09-15T00:00:00.000Z" });
		await nextTick();

		expect(screen.getByTestId("board-messages").textContent).toContain("ridge clear");
	});
});

describe("the optimistic write, and the rollback behind it", () => {
	it("shows a completion the moment it is pressed, before the server answers", async () => {
		// The gateway NEVER answers, which is what makes the title literally true:
		// the only thing that can have written `done` is the optimistic write, and a
		// binding that waited for the request would leave the row where it was.
		//
		// It is also the hardest notification to deliver, because the action sends
		// two of them in order — the optimistic one and the server's — and a binding
		// that coalesced them would show only the second.
		const missionsVM = await missionsScreen(
			fakeMissionGateway({ complete: vi.fn(() => new Promise(() => undefined)) }),
		);

		await fireEvent.click(screen.getByText("Complete AT-102"));

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));
		expect(missionsVM.getState().error).toBeNull();
	});

	it("puts the row back when the server refuses", async () => {
		// The rejection is HELD rather than immediate, and that is the difference
		// between testing the claim and racing it. A gateway that rejects on the spot
		// rolls back within the same microtask the click yielded, so the optimistic
		// row is never observable and the scene reads as "the button did nothing" —
		// which is also what a broken optimistic write looks like.
		//
		// The row has to be seen going to `done` FIRST, or this passes over a button
		// that did nothing at all: `queued` is also the value it started at.
		let refuse: (reason: unknown) => void = () => undefined;
		await missionsScreen(
			fakeMissionGateway({
				complete: vi.fn(
					() =>
						new Promise((_resolve, reject) => {
							refuse = reject;
						}),
				),
			}),
		);

		await fireEvent.click(screen.getByText("Complete AT-102"));

		await waitFor(() => expect(screen.getByTestId("status-m-2").textContent).toBe("done"));

		refuse(new LankaError({ kind: "domain", message: "already done" }));

		await waitFor(async () => {
			await nextTick();

			expect(screen.getByTestId("status-m-2").textContent).toBe("queued");
		});
	});
});

/**
 * Start-up, with the wire stubbed at `fetch` and nothing else replaced.
 *
 * The live suite next door drives this same function against the REAL server and
 * is the file that proves the transport. What it cannot ask is whether the
 * browser-only installs happened, because devtools is off unless the build says
 * development and the answer would then be about the live suite's flags. So this
 * suite stubs the one seam that reaches the network and asserts the wiring.
 *
 * Vue was the last of the five to get this describe, and its absence is exactly
 * the asymmetry `check:playgrounds` exists to catch: four applications proved
 * that start-up registers a read cache by name, and the fifth proved it under
 * nothing at all.
 */
describe("what the browser half of start-up installs", () => {
	const CREDENTIALS = { token: "t", refreshToken: "r", csrf: "c", name: "Ada" };

	const startWired = () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((resource: unknown) =>
				Promise.resolve(
					new Response(
						JSON.stringify(String(resource).includes("/session") ? CREDENTIALS : []),
						{ status: 200, headers: { "content-type": "application/json" } },
					),
				),
			),
		);

		return startAtlasVue({
			apiBaseUrl: "http://atlas.test/api",
			connect: false,
			isDevelopment: true,
		});
	};

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("registers the read cache by NAME, so a screen resolves it rather than importing it", async () => {
		// `registerInstance` and not `register`: the locator builds a class with no
		// arguments, and the query client is an argument. A default would let a
		// second client exist without anybody noticing — and two clients disagree
		// on the first mutation, silently.
		const started = await startWired();

		expect(started.app.lanka.locators.singletons.get("AtlasReadCache")).toBe(started.cache);

		started.stop();
	});

	it("exposes the inspector under the name a console user has to type", async () => {
		const started = await startWired();

		const inspector = (globalThis as { __atlas?: { getSnapshot: () => unknown } }).__atlas;

		expect(inspector).toBeDefined();

		started.stop();

		// Removed again on teardown. An inspector left on `globalThis` after the
		// instance it watched is gone keeps that instance alive, and a leak with a
		// user interface is the hardest kind to notice.
		expect((globalThis as { __atlas?: unknown }).__atlas).toBeUndefined();
	});

	it("wraps the request layer, so one call the application made is one row", async () => {
		// The order is the claim: devtools is installed FIRST, so its middleware
		// sits OUTSIDE the retry policy. Inside it, a request that succeeded on its
		// second attempt would be two rows, and the panel would be describing the
		// ladder rather than the application.
		const started = await startWired();
		const inspector = (
			globalThis as { __atlas?: { getSnapshot: () => { requests: readonly unknown[] } } }
		).__atlas;

		await started.app.missionGateway.list();

		expect(inspector?.getSnapshot().requests).toHaveLength(1);

		started.stop();
	});

	it("installs the prefetch ladder with the intent buffer's own deadline", async () => {
		const started = await startWired();

		// The TTL is the number with a reason: a buffered response older than it is
		// a guess about a page the reader has already left, and serving it is worse
		// than fetching again.
		expect(vi.mocked(lankaPrefetch)).toHaveBeenCalledWith({ intent: { ttlMs: 20_000 } });

		started.stop();
	});

	it("hands back ONE face cache, built outside every screen", async () => {
		// The cache belongs to start-up rather than to a screen, and the reason is
		// a navigation: a cache built per screen starts empty each time somebody
		// arrives, which is precisely the fetch it exists to avoid.
		const started = await startWired();
		const second = await startWired();

		expect(started.avatars).toBeDefined();
		expect(second.avatars).not.toBe(started.avatars);

		started.stop();
		second.stop();
	});
});

describe("the arms a settled screen never shows", () => {
	it("shows the loading status while a fetch is in flight", async () => {
		// The spinner belongs to the ViewModel, not to the screen: `isLoading` is a
		// key it writes, and the markup reads it. A screen with a flag of its own
		// would have two answers to one question.
		//
		// Neither this application nor React's had a scene for it, and both render
		// the arm — an `isLoading` nothing reads is a spinner that can be deleted
		// by accident and noticed by a user.
		let release: (rows: IAtlasMission[]) => void = () => undefined;
		const missionsVM = createAtlasMissionsVM(
			fakeMissionGateway({
				list: vi.fn(
					() =>
						new Promise<IAtlasMission[]>((resolve) => {
							release = resolve;
						}),
				),
			}),
		);
		render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });

		await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Loading"));

		release([...ROWS]);

		await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
	});
});

/**
 * Three seams no scene in this repository touched, and one of them is a leak.
 *
 * Every other scene here reads a ViewModel through the tracked overload, from one
 * screen, and never takes the screen away. So three questions had no answer in
 * any application: whether the SELECTED overload works under a compiler, whether
 * a binding releases its subscription on unmount, and whether two screens over
 * one ViewModel both move. The binding packages answer them for themselves; what
 * nothing answered is whether they hold once a real build is in the way.
 */
describe("the seams between a binding and the ViewModel it reads", () => {
	it("counts through a SELECTOR, and keeps counting when the board is filtered away", async () => {
		// The selected read is not the tracked read with fewer keys: tracking is
		// BYPASSED, and what decides an update is whether the selector's answer
		// moved. Two of the fixture's rows are queued, and filtering the list down
		// to one row changes what the board shows without changing that number.
		const missionsVM = await missionsScreen(fakeMissionGateway());

		expect(screen.getByTestId("queued-count").textContent).toBe("2 queued");

		missionsVM.getState().applySearch("depot");
		await nextTick();

		expect(screen.getAllByRole("listitem")).toHaveLength(1);
		expect(screen.getByTestId("queued-count").textContent).toBe("2 queued");

		missionsVM.setState({ missions: [mission("m-1", { status: "done" })] });
		await nextTick();

		expect(screen.getByTestId("queued-count").textContent).toBe("0 queued");
	});

	it("lets go of the ViewModel when the screen is taken away", async () => {
		// A binding that forgot this leaks the SCREEN, not the ViewModel: the
		// listener closes over the component, so a page that mounts and unmounts a
		// list a hundred times holds a hundred of them, and nothing anywhere
		// reports it.
		const { live, viewModel } = watched(createAtlasMissionsVM(fakeMissionGateway()));
		const rendered = render(AtlasMissionsScreen, {
			props: { missionsVM: viewModel, avatars: avatars() },
		});
		await viewModel.getState().fetchMissions();
		await nextTick();

		expect(live()).toBeGreaterThan(0);

		rendered.unmount();

		expect(live()).toBe(0);
	});

	it("moves two screens that read one ViewModel", async () => {
		// One store, two readers. A binding holding its subscription on the MODULE
		// rather than on the component would wake only one of them, and the second
		// would sit there correct-looking and stale — which is the bug a shared
		// ViewModel is supposed to make impossible.
		const missionsVM = createAtlasMissionsVM(fakeMissionGateway());
		render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });
		render(AtlasMissionsScreen, { props: { missionsVM, avatars: avatars() } });
		await missionsVM.getState().fetchMissions();
		await nextTick();

		expect(screen.getAllByText(/Restock the depot/)).toHaveLength(2);

		missionsVM.getState().applySearch("ridge");
		await nextTick();

		expect(screen.queryAllByText(/Restock the depot/)).toHaveLength(0);
		expect(screen.getAllByText(/Survey the north ridge/)).toHaveLength(2);
	});
});
