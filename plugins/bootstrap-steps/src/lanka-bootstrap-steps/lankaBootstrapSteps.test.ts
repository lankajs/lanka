import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLanka, type ILankaInstance } from "lanka";
import { lankaTestHost } from "@lankajs/tool-testing/lankaTestHost";
import { lankaBootstrapSteps } from "./lankaBootstrapSteps";

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

describe("plugin", () => {
	let lanka: ILankaInstance;

	beforeEach(() => {
		lanka = createLanka({ host: lankaTestHost });
	});

	it("disposing the instance clears the run memory", async () => {
		// Otherwise the next instance — a test beside the app, a dev module
		// reload — would consider bootstrap already done.
		const run = vi.fn((context: IContext) => context);
		const plugin = lankaBootstrapSteps<IContext>({
			createContext,
			steps: [step("signIn", run)],
		});
		lanka.use(plugin);

		await plugin.pipeline.run();
		lanka.dispose();
		await plugin.pipeline.run();

		expect(run).toHaveBeenCalledTimes(2);
	});
});
