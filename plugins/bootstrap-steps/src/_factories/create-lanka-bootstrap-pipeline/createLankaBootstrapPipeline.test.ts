import { describe, expect, it, vi } from "vitest";
import { createLankaBootstrapPipeline } from "./createLankaBootstrapPipeline";

/**
 * The bootstrap pipeline.
 *
 * What is pinned here is what core's bootstrap does not have and what this
 * plugin exists for: context, early exit and a redirect target. Failures and
 * deadlines behave exactly as in core, and that is an assertion too — identical
 * words must mean identical things.
 */

interface IContext {
	steps: string[];
	userId: number | null;
	done?: boolean;
	redirectTo?: string | null;
}

const createContext = (): IContext => ({ steps: [], userId: null });

const step = (name: string, run?: (context: IContext) => IContext | Promise<IContext>) => ({
	name,
	run: run ?? ((context: IContext) => ({ ...context, steps: [...context.steps, name] })),
});

describe("pipeline — context", () => {
	it("a step reads what the previous one produced", async () => {
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("signIn", (context) => ({ ...context, userId: 7 })),
				step("confirm", (context) => ({
					...context,
					steps: [...context.steps, `saw ${String(context.userId)}`],
				})),
			],
		});

		await expect(pipeline.run()).resolves.toMatchObject({
			userId: 7,
			steps: ["saw 7"],
		});
	});

	it("steps run in declaration order", async () => {
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("first"), step("second"), step("third")],
		});

		const context = await pipeline.run();

		expect(context.steps).toEqual(["first", "second", "third"]);
	});
});

describe("pipeline — early exit", () => {
	it("a step returning `done` stops the pipeline", async () => {
		const later = vi.fn((context: IContext) => context);
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("check", (context) => ({ ...context, done: true, redirectTo: "/login" })),
				step("next", later),
			],
		});

		const context = await pipeline.run();

		expect(context.redirectTo).toBe("/login");
		expect(later).not.toHaveBeenCalled();
	});

	it("an early exit is a decision, not a failure", async () => {
		// Core can only "run or throw", and an early exit cannot be expressed that
		// way: an exception would mean bootstrap failed, while here everything is
		// fine — the user is simply sent elsewhere.
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("check", (context) => ({ ...context, done: true, redirectTo: "/login" }))],
		});

		await expect(pipeline.run()).resolves.toBeDefined();
	});

	it("an early exit is NOT remembered", async () => {
		// Remembering it would strand the app on the sign-in screen forever: the
		// next attempt would return the same answer without going anywhere.
		let attempt = 0;
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("signIn", (context) => {
					attempt += 1;
					return attempt === 1
						? { ...context, done: true, redirectTo: "/login" }
						: { ...context, userId: 7 };
				}),
			],
		});

		await pipeline.run();
		const second = await pipeline.run();

		expect(second.userId).toBe(7);
		expect(attempt).toBe(2);
	});
});

describe("pipeline — run memory", () => {
	it("runs once per session", async () => {
		const run = vi.fn((context: IContext) => context);
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("signIn", run)],
		});

		await pipeline.run();
		await pipeline.run();

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("concurrent calls share one promise", async () => {
		// Several routes call bootstrap at once. Two runs would mean two sign-ins,
		// two analytics sends and two attempts to record one fact.
		const run = vi.fn(
			(context: IContext) =>
				new Promise<IContext>((resolve) => {
					setTimeout(() => resolve(context), 10);
				}),
		);
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("signIn", run)],
		});

		await Promise.all([pipeline.run(), pipeline.run(), pipeline.run()]);

		expect(run).toHaveBeenCalledTimes(1);
	});

	it("a reset makes it run again", async () => {
		const run = vi.fn((context: IContext) => context);
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("signIn", run)],
		});

		await pipeline.run();
		pipeline.reset();
		await pipeline.run();

		expect(run).toHaveBeenCalledTimes(2);
	});

	it("a repeat run starts from a CLEAN context", async () => {
		// The initial value is a function, not an object: a shared object would
		// accumulate traces of the previous session, and the second sign-in would
		// see the first one's data.
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [step("step")],
		});

		const first = await pipeline.run();
		pipeline.reset();
		const second = await pipeline.run();

		expect(first.steps).toEqual(["step"]);
		expect(second.steps).toEqual(["step"]);
	});

	it("a failure is not remembered — the next attempt runs again", async () => {
		let attempt = 0;
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("signIn", (context) => {
					attempt += 1;
					if (attempt === 1) throw new Error("network unavailable");
					return context;
				}),
			],
		});

		await expect(pipeline.run()).rejects.toThrow("network unavailable");
		await expect(pipeline.run()).resolves.toBeDefined();
	});
});

describe("pipeline — failures and deadlines", () => {
	it("a required step aborts the pipeline", async () => {
		const later = vi.fn((context: IContext) => context);
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("signIn", () => {
					throw new Error("no session");
				}),
				step("next", later),
			],
		});

		await expect(pipeline.run()).rejects.toThrow("no session");
		expect(later).not.toHaveBeenCalled();
	});

	it("an optional step is skipped and the pipeline continues", async () => {
		// Analytics failing at startup must not take sign-in down with it.
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				{
					name: "analytics",
					optional: true,
					run: () => {
						throw new Error("sink unavailable");
					},
				},
				step("signIn", (context) => ({ ...context, userId: 7 })),
			],
		});

		await expect(pipeline.run()).resolves.toMatchObject({ userId: 7 });
	});

	it("a failed optional step's result is discarded", async () => {
		// The pipeline continues with the context as it was BEFORE the step.
		// Continuing with half of it is worse than continuing without it: the next
		// step would read what was written and treat it as complete.
		//
		// True for a step that RETURNS a new context, which is the only kind the
		// pipeline promises to serve: a step writing into the object it received
		// leaves its half behind, and guarding against that would cost a deep copy
		// per step.
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [
				step("signIn", (context) => ({ ...context, userId: 7 })),
				{
					name: "half",
					optional: true,
					run: (context) => {
						const half = { ...context, userId: 42 };
						void half;
						throw new Error("threw after computing");
					},
				},
			],
		});

		const context = await pipeline.run();

		expect(context.userId).toBe(7);
	});

	it("a step that overruns its deadline counts as failed", async () => {
		vi.useFakeTimers();
		try {
			const pipeline = createLankaBootstrapPipeline<IContext>({
				createContext,
				steps: [
					{
						name: "forever",
						timeoutMs: 50,
						run: () => new Promise<IContext>(() => undefined),
					},
				],
			});

			const assertion = expect(pipeline.run()).rejects.toThrow(/did not finish/);
			await vi.advanceTimersByTimeAsync(100);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("an optional step with a deadline is skipped, not fatal", async () => {
		vi.useFakeTimers();
		try {
			const pipeline = createLankaBootstrapPipeline<IContext>({
				createContext,
				steps: [
					{
						name: "forever",
						timeoutMs: 50,
						optional: true,
						run: () => new Promise<IContext>(() => undefined),
					},
					step("signIn", (context) => ({ ...context, userId: 7 })),
				],
			});

			const pending = pipeline.run();
			await vi.advanceTimersByTimeAsync(100);

			await expect(pending).resolves.toMatchObject({ userId: 7 });
		} finally {
			vi.useRealTimers();
		}
	});

	it("a step that finishes does not hold the pipeline until its deadline", async () => {
		const pipeline = createLankaBootstrapPipeline<IContext>({
			createContext,
			steps: [{ name: "fast", timeoutMs: 10_000, run: (context) => context }],
		});

		await expect(pipeline.run()).resolves.toBeDefined();
	});
});
