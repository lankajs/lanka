/** A signed-in session, as the server remembers it. */
export interface IAtlasSession {
	token: string;
	refreshToken: string;
	/** The value an unsafe request must echo in `x-atlas-csrf`. */
	csrf: string;
	name: string;
	/**
	 * How many more protected calls this token answers before it expires.
	 *
	 * A COUNT, not a clock. An expiry in seconds makes "does the refresh work"
	 * a test that either sleeps or never reaches the branch; a count reaches it
	 * on a stated call, in every run, on every machine.
	 */
	callsLeft: number;
}

export interface IAtlasSessionsConfig {
	/** Protected calls a fresh token answers. Small on purpose — see `callsLeft`. */
	callsPerToken?: number;
}

const DEFAULT_CALLS_PER_TOKEN = 4;

/**
 * Who is signed in, and what their token is still good for.
 *
 * The half of an API that exists here for one reason: a client's refresh-on-401
 * cannot be exercised against a server whose tokens never expire. So they expire
 * on a schedule a test can state.
 */
export class AtlasSessions {
	private readonly callsPerToken: number;
	private readonly byToken = new Map<string, IAtlasSession>();
	private readonly byRefresh = new Map<string, IAtlasSession>();
	private issued = 0;

	public constructor(config: IAtlasSessionsConfig = {}) {
		this.callsPerToken = config.callsPerToken ?? DEFAULT_CALLS_PER_TOKEN;
	}

	/** Signs a person in, and hands back everything the client needs to keep. */
	public open(name: string): IAtlasSession {
		const serial = String((this.issued += 1));
		const session: IAtlasSession = {
			token: `atlas-token-${serial}`,
			refreshToken: `atlas-refresh-${serial}`,
			csrf: `atlas-csrf-${serial}`,
			name,
			callsLeft: this.callsPerToken,
		};

		this.byToken.set(session.token, session);
		this.byRefresh.set(session.refreshToken, session);

		return session;
	}

	/**
	 * Spends one call of a token, and says whether it was any good.
	 *
	 * The token is FORGOTTEN once spent rather than marked expired, so a client
	 * that retries with it gets the same 401 — a server that softened on the
	 * second attempt would hide a refresh that never happened.
	 */
	public spend(token: string | undefined): IAtlasSession | null {
		const session = token === undefined ? undefined : this.byToken.get(token);
		if (!session) return null;

		session.callsLeft -= 1;
		if (session.callsLeft < 0) {
			this.byToken.delete(session.token);
			return null;
		}

		return session;
	}

	/**
	 * Exchanges a refresh token for a new access token.
	 *
	 * The refresh token itself is rotated: a refresh token that survived its use
	 * would make a stolen one valid forever, and a client that kept sending the
	 * old one would never find out it was supposed to keep the new one.
	 */
	public refresh(refreshToken: string | undefined): IAtlasSession | null {
		const session = refreshToken === undefined ? undefined : this.byRefresh.get(refreshToken);
		if (!session) return null;

		this.byToken.delete(session.token);
		this.byRefresh.delete(session.refreshToken);

		return this.open(session.name);
	}

	/** The session a CSRF value belongs to, for checking an unsafe call. */
	public bearing(csrf: string | undefined): IAtlasSession | undefined {
		if (csrf === undefined) return undefined;

		return [...this.byToken.values()].find((session) => session.csrf === csrf);
	}
}
