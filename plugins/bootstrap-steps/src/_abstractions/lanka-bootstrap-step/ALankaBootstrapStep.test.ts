import { describe, expect, it } from "vitest";
import { ALankaBootstrapStep } from "./ALankaBootstrapStep";
import type { ILankaBootstrapOutcome } from "../../_interfaces/ILankaBootstrapOutcome";

interface IContext extends ILankaBootstrapOutcome {
	visited: string[];
}

class PlainStep extends ALankaBootstrapStep<IContext> {
	public readonly name = "plain";

	protected run(context: IContext): IContext {
		return { ...context, visited: [...context.visited, this.name] };
	}
}

class TolerantStep extends ALankaBootstrapStep<IContext> {
	public readonly name = "tolerant";
	protected override readonly optional = true;
	protected override readonly timeoutMs = 50;

	protected run(context: IContext): IContext {
		return context;
	}
}

describe("a step written as a class", () => {
	it("hands the pipeline what a config object would have", async () => {
		const config = new PlainStep().toConfig();

		expect(config.name).toBe("plain");
		expect(await config.run({ visited: [] })).toEqual({ visited: ["plain"] });
	});

	it("is required and unbounded unless the subclass says otherwise", () => {
		const config = new PlainStep().toConfig();

		// A step nobody marked optional is required, and one with no deadline
		// inherits the pipeline's — the same defaults the config object has.
		expect(config.optional).toBe(false);
		expect(config).not.toHaveProperty("timeoutMs");
	});

	it("carries the two settings a subclass did state", () => {
		const config = new TolerantStep().toConfig();

		expect(config.optional).toBe(true);
		expect(config.timeoutMs).toBe(50);
	});
});
