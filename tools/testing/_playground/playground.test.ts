import { describe, expect, it } from "vitest";
import { resetLanka } from "../src/index";
import { createLankaFakeScenario, createLankaFakeTransport } from "../src/index";
import { createLankaEventRecorder, createLankaLogRecorder } from "../src/index";
import { registerLankaFakes, waitForLankaIdle } from "../src/index";
import { createLankaFakeStorageAdapter } from "../src/index";
import { createLankaFakeVM, prepareLankaRender } from "../src/index";
import { lankaStorageAdapterConformance } from "../src/lanka-storage-adapter-conformance/lankaStorageAdapterConformance";
import { createPlaygroundBagAdapter, createPlaygroundDraftStore, startPlaygroundApp } from "./app";
import type { IPlaygroundProfile, IPlaygroundProfileAudit } from "./app";

/**
 * The kit, used the way a consumer's test suite uses it.
 *
 * Its unit tests prove each helper behaves. This proves the promise: that a
 * consumer testing an ordinary screen writes a render call and nothing else —
 * no bootstrap preamble, no doubles of their own, and no cleanup that a later
 * test depends on them remembering.
 *
 * The isolation claims are the ones that cannot live in a unit test at all:
 * they are about what one test leaves behind for the NEXT one, so they need two.
 */
const profile = (name: string): IPlaygroundProfile => ({ name });

describe("the test kit", () => {
	it("builds a ViewModel that needs a live framework, with no bootstrap in sight", () => {
		const { profileVM } = startPlaygroundApp({ transport: { body: profile("Ada") } });

		// Nothing was activated, bootstrapped or registered by this test: without
		// an instance the first locator access inside the ViewModel would throw.
		expect(profileVM.getState().profile).toBeNull();
	});

	it("carries a faked answer all the way to the state a screen reads", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });

		await app.profileVM.getState().load();

		expect(app.profileVM.getState().profile?.name).toBe("Ada");
	});

	it("names the failure the double was told to produce", async () => {
		const app = startPlaygroundApp({
			transport: { failWith: () => new Error("network is down") },
		});

		await app.profileVM.getState().load();

		expect(app.profileVM.getState().error).toBe("network is down");
	});

	it("records what the application actually asked for", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });

		await app.profileVM.getState().load();

		expect(app.transport.callsTo("/profile")).toHaveLength(1);
	});

	it("hands every call a DIFFERENT instance", () => {
		const first = resetLanka();
		const second = resetLanka();

		// A test that inherits its neighbour's instance passes or fails by file
		// order, which is the worst kind of unreliable test: it goes red where
		// nothing is broken. The rendering half of this claim is
		// `@lankajs/react/testing`'s, and its playground makes it there.
		expect(second).not.toBe(first);
	});

	it("disposes the previous instance rather than merely forgetting it", () => {
		let released = false;
		resetLanka().use({
			name: "playground-probe",
			install: () => () => {
				released = true;
			},
		});

		resetLanka();

		// Dropping the pointer is not disposal: ViewModels are declared at module
		// level and outlive any test, and their subscriptions are removed by the
		// dispose() of the instance whose registry holds them.
		expect(released).toBe(true);
	});

	it("gives a scenario double a REAL unsubscribe", () => {
		const scenario = createLankaFakeScenario<{ id: number }>();

		const stop = scenario.subscribe(() => undefined);
		expect(scenario.subscriberCount()).toBe(1);
		stop();

		// A stubbed unsubscribe would let a test "prove" a ViewModel unsubscribes
		// while proving only that it called a function that does nothing.
		expect(scenario.subscriberCount()).toBe(0);
	});
});

describe("waiting for the application to settle", () => {
	it("waits for a load nobody awaited", async () => {
		// What a consumer's test actually looks like: an action is started, and the
		// assertion needs the whole chain behind it to have run. Written by hand
		// that is `await new Promise((r) => setTimeout(r, 0))`, which drains one
		// turn and works until the chain grows a link.
		const app = startPlaygroundApp({
			transport: { routes: [{ match: "/profile", delayMs: 5, body: profile("Ada") }] },
		});

		void app.profileVM.getState().load();
		await waitForLankaIdle({ lanka: app.lanka });

		expect(app.profileVM.getState().profile?.name).toBe("Ada");
	});
});

describe("asserting what the application did", () => {
	it("catches the fact the ViewModel announced", async () => {
		// The scenario layer is what the framework is arranged around, and this is
		// the question it exists to answer: did doing THIS make THAT fire.
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });
		const events = createLankaEventRecorder({ lanka: app.lanka });

		await app.profileVM.getState().load();

		expect(events.of<IPlaygroundProfile>("playground:profile-loaded")).toEqual([
			profile("Ada"),
		]);
		events.stop();
	});

	it("catches what the framework logged, without pinning how it prints", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });
		const log = createLankaLogRecorder({ console: "silence" });

		await app.profileVM.getState().load();

		expect(log.contains("profile loaded: Ada")).toBe(true);
		log.stop();
	});
});

describe("standing a double in for a real dependency", () => {
	it("gives the application the audit the test wrote, not its own", async () => {
		// The application registers a real `PlaygroundProfileAudit` when it starts.
		// A test replaces it by NAME, and the ViewModel — which resolves it rather
		// than importing it — never learns the difference.
		const recorded: string[] = [];
		const audit: IPlaygroundProfileAudit = {
			recorded,
			record: (name) => recorded.push(name),
		};

		const app = startPlaygroundApp({
			transport: { body: profile("Ada") },
			fakes: { singletons: { PlaygroundProfileAudit: audit } },
		});
		await app.profileVM.getState().load();

		expect(recorded).toEqual(["Ada"]);
	});

	it("registers doubles into a running instance too", () => {
		const lanka = resetLanka();
		const audit = { recorded: [], record: () => undefined };

		registerLankaFakes(lanka, { singletons: { PlaygroundProfileAudit: audit } });

		expect(lanka.resolve("playgroundProfileAudit")).toBe(audit);
	});

	it("answers each endpoint the application reads", async () => {
		// One answer for every endpoint is why a consumer writes the twenty-line
		// double the kit exists to prevent.
		const transport = createLankaFakeTransport({
			routes: [
				{ match: "/profile", body: profile("Ada") },
				{ match: "/settings", body: { theme: "dark" } },
			],
		});

		await transport.request("/api/settings");

		expect(transport.callsTo("/settings")).toHaveLength(1);
		expect(transport.callsTo("/profile")).toHaveLength(0);
	});
});

describe("the kit, when what is under test persists something", () => {
	/**
	 * A consumer's unit that writes to a store, tested with no browser in sight.
	 *
	 * The kit's other doubles stand in for the wire and the bus. This one stands
	 * in for the DISK, and the promise is the same: a consumer testing ordinary
	 * code writes no double of their own and no cleanup between tests.
	 */
	const dayInMs = 24 * 60 * 60 * 1000;

	it("reads back what the application saved, and says what reached the store", async () => {
		const adapter = createLankaFakeStorageAdapter();
		const drafts = createPlaygroundDraftStore(adapter, () => 1_000);

		await drafts.save("half a sentence");

		expect(await drafts.read()).toBe("half a sentence");
		// What a double is FOR: the assertion is on the bytes the application
		// chose to write, not only on what it can read back afterwards.
		expect([...adapter.entries.values()]).toEqual([
			'{"text":"half a sentence","savedAt":1000}',
		]);
	});

	it("does not resurrect a stale draft, and does not leave it behind either", async () => {
		const adapter = createLankaFakeStorageAdapter();
		let now = 1_000;
		const drafts = createPlaygroundDraftStore(adapter, () => now);

		await drafts.save("yesterday's sentence");
		now += dayInMs + 1;

		expect(await drafts.read(), "a draft older than a day").toBeNull();
		// The half that "returns null" alone would hide: the store is empty, so the
		// next sign-in does not carry a stranger's text in a place nobody looks.
		expect([...adapter.entries]).toEqual([]);
	});

	it("answers the same over the engine the application already had", async () => {
		// The port's promise, from the consumer's side: the unit under test never
		// learns which engine it was handed.
		const bag: Record<string, string> = {};
		const overTheBag = createPlaygroundDraftStore(createPlaygroundBagAdapter(bag), () => 5);
		const overTheFake = createPlaygroundDraftStore(createLankaFakeStorageAdapter(), () => 5);

		await overTheBag.save("one sentence");
		await overTheFake.save("one sentence");

		expect(await overTheBag.read()).toBe(await overTheFake.read());

		await overTheBag.signOut();

		expect(await overTheBag.read()).toBeNull();
		expect(bag, "sign-out reached the application's own object").toEqual({});
	});
});

/**
 * The suite, pointed at an adapter this repository has never heard of.
 *
 * `createPlaygroundBagAdapter` belongs to the fixture application, declares
 * neither optional capability, and is exactly what a consumer writes first. That
 * it answers the same list as the framework's own adapters is the whole reason
 * the suite is published rather than kept in `modules/`.
 */
lankaStorageAdapterConformance({
	vendor: "the playground's bag",
	create: () => createPlaygroundBagAdapter(),
});

describe("the two halves a view binding is built from", () => {
	it("brings a framework up, ready for whatever is about to render", () => {
		// What every binding's `renderWithLanka` calls before it renders. Reached
		// directly here because that is also how somebody writing a binding for a
		// framework this repository has never heard of reaches it.
		const recorded: string[] = [];
		const audit: IPlaygroundProfileAudit = { recorded, record: (name) => recorded.push(name) };
		const lanka = prepareLankaRender({
			fakes: { singletons: { PlaygroundProfileAudit: audit } },
		});

		expect(lanka.resolve("PlaygroundProfileAudit")).toBe(audit);
	});

	it("hands every call a FRESH instance, as a render must", () => {
		const first = prepareLankaRender();
		const second = prepareLankaRender();

		expect(second).not.toBe(first);
	});

	it("builds the ViewModel every binding's playground reads", async () => {
		// One ViewModel for four playgrounds, so that four sets of deliberately
		// identical claims are made about the same thing. It is a REAL
		// `createLankaVM`, not an object shaped like one — a binding passing
		// against a hand-shaped double would be passing against nothing.
		const viewModel = createLankaFakeVM({ rows: ["a", "b"] });

		expect(viewModel.getState().rows).toEqual([]);
		expect(viewModel.isAccessTracked).toBe(true);

		await viewModel.getState().load();

		expect(viewModel.getState().rows).toEqual(["a", "b"]);
	});

	it("builds one that asks a reader NOT to track, when told", () => {
		expect(createLankaFakeVM({ tracked: false }).isAccessTracked).toBe(false);
	});
});
