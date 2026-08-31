import { describe, expect, it } from "vitest";
import { ALankaBootstrapStep, createLankaBootstrapPipeline } from "../src/index";
import { createPlaygroundBootstrap, startPlaygroundBootstrap } from "./app";
import type { IPlaygroundContext } from "./app";

/**
 * The package, used as an application's entry point uses it.
 *
 * Every property here needs the WHOLE chain: that a step reads what the previous
 * one produced, that an early exit stops the rest without being a failure, that
 * an optional step's failure is survivable, and that the run happens once.
 */
describe("the bootstrap-steps playground", () => {
	it("carries the context from step to step", async () => {
		const pipeline = createPlaygroundBootstrap({ token: "t" });

		const context = await pipeline.run();

		expect(context.token).toBe("t");
		expect(context.profile).toEqual({ name: "Ada" });
		expect(context.visited).toEqual([
			"restore-session",
			"redirect-anonymous",
			"load-profile",
			"analytics",
		]);
	});

	it("stops at an early exit and says where to send the visitor", async () => {
		const pipeline = createPlaygroundBootstrap({ token: null });

		const context = await pipeline.run();

		expect(context.done).toBe(true);
		expect(context.redirectTo).toBe("/sign-in");
		expect(context.visited).toEqual(["restore-session", "redirect-anonymous"]);
	});

	it("treats an early exit as a decision, not a failure", async () => {
		const pipeline = createPlaygroundBootstrap({ token: null });

		await expect(pipeline.run()).resolves.toBeTruthy();
	});

	it("survives an optional step that fails", async () => {
		const pipeline = createPlaygroundBootstrap({ token: "t", analyticsFails: true });

		const context = await pipeline.run();

		expect(context.profile).toEqual({ name: "Ada" });
		expect(context.analyticsReady).toBe(false);
	});

	it("survives an optional step that overruns its deadline", async () => {
		const pipeline = createPlaygroundBootstrap({ token: "t", analyticsDelayMs: 200 });

		const context = await pipeline.run();

		expect(context.profile).toEqual({ name: "Ada" });
		expect(context.analyticsReady).toBe(false);
	});

	it("aborts on a required step that fails", async () => {
		const pipeline = createPlaygroundBootstrap({ token: "t", profileFails: true });

		await expect(pipeline.run()).rejects.toThrow(/profile unavailable/);
	});

	it("runs once per session, however many routes ask", async () => {
		// Two runs would mean two sign-ins and two analytics sends for one visit.
		const backend = { token: "t" };
		const pipeline = createPlaygroundBootstrap(backend);

		const [first, second] = await Promise.all([pipeline.run(), pipeline.run()]);

		expect(first).toBe(second);
	});

	it("runs again after a reset, from a clean context", async () => {
		const pipeline = createPlaygroundBootstrap({ token: "t" });
		const first = await pipeline.run();

		pipeline.reset();
		const second = await pipeline.run();

		expect(second).not.toBe(first);
		expect(second.visited).toEqual(first.visited);
	});
});

describe("the sequence as a plugin", () => {
	it("runs through the instance a consumer installed it on", async () => {
		const app = startPlaygroundBootstrap({ token: "abc" });

		const context = await app.run();

		// What the package is FOR: the sequence arrives with the framework, and an
		// application writes one `use(plugin)` rather than holding a pipeline.
		expect(context.visited).toContain("load-profile");
		app.lanka.dispose();
	});

	it("forgets what it ran when the plugin is removed", async () => {
		const app = startPlaygroundBootstrap({ token: "abc" });
		await app.run();

		app.lanka.dispose();

		// Disposal resets the pipeline: a second instance in the same process must
		// not inherit the first one's start-up state.
		const second = startPlaygroundBootstrap({ token: null });
		expect((await second.run()).redirectTo).toBe("/sign-in");
		second.lanka.dispose();
	});
});

describe("a step written as a class", () => {
	it("runs in the same pipeline as the ones written as objects", async () => {
		class LoadProfileStep extends ALankaBootstrapStep<IPlaygroundContext> {
			public readonly name = "load-profile-class";

			protected run(context: IPlaygroundContext): IPlaygroundContext {
				return {
					...context,
					profile: { name: "Ada" },
					visited: [...context.visited, this.name],
				};
			}
		}

		const pipeline = createLankaBootstrapPipeline<IPlaygroundContext>({
			createContext: () => ({
				token: "abc",
				profile: null,
				analyticsReady: false,
				visited: [],
			}),
			steps: [new LoadProfileStep().toConfig()],
		});

		const context = await pipeline.run();

		// The pipeline takes a config either way: `toConfig()` is the one place the
		// two styles meet, and above it nothing knows which wrote the step.
		expect(context.profile).toEqual({ name: "Ada" });
		expect(context.visited).toEqual(["load-profile-class"]);
	});
});
