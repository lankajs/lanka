import type { ILankaBootstrapOutcome } from "../../src/index";

/**
 * What each step reads from the previous one.
 *
 * It extends the outcome because the two early exits — "done" and "go here
 * instead" — are part of the context a step returns, not a separate channel.
 */
export interface IPlaygroundContext extends ILankaBootstrapOutcome {
	token: string | null;
	profile: { name: string } | null;
	analyticsReady: boolean;
	visited: string[];
}
