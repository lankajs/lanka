import { describe, expect, it } from "vitest";
import { screen, act, render } from "@testing-library/react";
import { renderWithLanka, resetLanka } from "../src/index";
import { createLankaFakeScenario, createLankaFakeTransport } from "../src/index";
import { createLankaEventRecorder, createLankaLogRecorder } from "../src/index";
import { registerLankaFakes, waitForLankaIdle } from "../src/index";
import { PlaygroundProfileScreen, startPlaygroundApp } from "./app";
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
	it("renders a screen that needs a live framework, with no bootstrap in sight", () => {
		const { useProfileVM } = startPlaygroundApp({ transport: { body: profile("Ada") } });

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);

		// Nothing was activated, bootstrapped or registered by this test: without
		// an instance the first locator access inside the ViewModel would throw.
		expect(screen.getByText("nobody")).toBeTruthy();
	});

	it("carries a faked answer all the way to the screen", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });

		render(<PlaygroundProfileScreen useProfileVM={app.useProfileVM} />);
		await act(async () => {
			await app.useProfileVM.getState().load();
		});

		expect(screen.getByText("Ada")).toBeTruthy();
	});

	it("shows the failure the double was told to produce", async () => {
		const app = startPlaygroundApp({
			transport: { failWith: () => new Error("network is down") },
		});

		render(<PlaygroundProfileScreen useProfileVM={app.useProfileVM} />);
		await act(async () => {
			await app.useProfileVM.getState().load();
		});

		expect(screen.getByRole("alert").textContent).toBe("network is down");
	});

	it("records what the application actually asked for", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });

		await act(async () => {
			await app.useProfileVM.getState().load();
		});

		expect(app.transport.callsTo("/profile")).toHaveLength(1);
	});

	it("hands every render a DIFFERENT instance", () => {
		const { useProfileVM } = startPlaygroundApp();

		const first = renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);
		const second = renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />);

		// A test that inherits its neighbour's instance passes or fails by file
		// order, which is the worst kind of unreliable test: it goes red where
		// nothing is broken.
		expect(second.lanka).not.toBe(first.lanka);
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

	it("lets a test set the instance up before the screen ever renders", () => {
		const { useProfileVM } = startPlaygroundApp();
		let sawInstance = false;

		renderWithLanka(<PlaygroundProfileScreen useProfileVM={useProfileVM} />, {
			setup: () => {
				sawInstance = true;
			},
		});

		// Plugins and scenario registration happen BEFORE the first render, which
		// is the only order in which a screen can read what they install.
		expect(sawInstance).toBe(true);
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
		render(<PlaygroundProfileScreen useProfileVM={app.useProfileVM} />);

		await act(async () => {
			void app.useProfileVM.getState().load();
			await waitForLankaIdle({ lanka: app.lanka });
		});

		expect(screen.getByText("Ada")).toBeTruthy();
	});
});

describe("asserting what the application did", () => {
	it("catches the fact the ViewModel announced", async () => {
		// The scenario layer is what the framework is arranged around, and this is
		// the question it exists to answer: did doing THIS make THAT fire.
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });
		const events = createLankaEventRecorder({ lanka: app.lanka });

		await act(async () => {
			await app.useProfileVM.getState().load();
		});

		expect(events.of<IPlaygroundProfile>("playground:profile-loaded")).toEqual([
			profile("Ada"),
		]);
		events.stop();
	});

	it("catches what the framework logged, without pinning how it prints", async () => {
		const app = startPlaygroundApp({ transport: { body: profile("Ada") } });
		const log = createLankaLogRecorder({ console: "silence" });

		await act(async () => {
			await app.useProfileVM.getState().load();
		});

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
		await act(async () => {
			await app.useProfileVM.getState().load();
		});

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
