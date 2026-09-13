import type { AtlasSession } from "../Singletons/AtlasSession/AtlasSession";
import type {
	ILankaBootstrapOutcome,
	ILankaBootstrapPipelineConfig,
} from "@lankajs/plugin-bootstrap-steps";

/** What the start-up chain passes along, and what it decides. */
export interface IAtlasStartupContext extends ILankaBootstrapOutcome {
	/** Who is signed in when the chain finishes, if anybody. */
	name: string | null;
	/** Whether the crew list may be asked for yet. */
	canRead: boolean;
}

/** How long a start-up step may take before failing is more honest than waiting. */
const STEP_TIMEOUT_MS = 4000;

/**
 * Start-up as a CHAIN rather than a set, because these steps talk to each other.
 *
 * Core's `bootstrap({ services })` runs a set by priority and can only run or
 * throw. "The user is not signed in" is neither: it is a DECISION, and a decision
 * carries a destination. An exception cannot, which is the whole reason this
 * pipeline exists beside core's services rather than instead of them.
 *
 * Every step returns a NEW context rather than writing into the one it was
 * given. A failed optional step must leave nothing behind, and that only works if
 * steps return.
 */
export const createAtlasStartupSteps = (
	session: AtlasSession,
	signInAs: string | undefined,
): ILankaBootstrapPipelineConfig<IAtlasStartupContext> => ({
	createContext: () => ({ name: null, canRead: false }),

	steps: [
		{
			name: "restore-session",
			// A deadline, because a step that never settles holds bootstrap forever
			// and the application never paints its first screen.
			timeoutMs: STEP_TIMEOUT_MS,
			run: async (context) => {
				if (signInAs === undefined) return context;

				const opened = await session.signIn(signInAs);

				return { ...context, name: opened.name };
			},
		},
		{
			name: "require-sign-in",
			run: (context) =>
				context.name === null
					? // `done`, not a throw. A throw means failure; this is a decision,
						// and only a value can carry a place to send somebody.
						{ ...context, done: true, redirectTo: "/sign-in" }
					: { ...context, canRead: true },
		},
		{
			name: "report-arrival",
			// Optional: analytics failing at start-up must not take sign-in down with
			// it. The context continues UNTOUCHED — a step that failed midway may
			// have written half its result, and half is worse than none.
			optional: true,
			run: (context) => context,
		},
	],
});
