export interface ILankaBootstrapOutcome {
	/**
	 * No need to go further. Set by a STEP — the only way to say "the decision is
	 * made, the rest is pointless".
	 */
	done?: boolean;
	/** Where to send the user. Meaningful only together with `done`. */
	redirectTo?: string | null;
}
