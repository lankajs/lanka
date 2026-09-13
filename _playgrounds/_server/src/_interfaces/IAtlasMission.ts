/** What the server calls a mission, and what every wire format carries. */
export interface IAtlasMission {
	id: string;
	/** The short code a person reads on a radio: `AT-104`. */
	code: string;
	title: string;
	status: TAtlasMissionStatus;
	/** 1 is the most urgent. The board sorts on it. */
	priority: number;
	/** Who it is assigned to, or nobody yet. */
	crewId: string | null;
	/**
	 * When it last changed, as an ISO string.
	 *
	 * A version, not decoration: a client that saved a mission recognises the
	 * change it made by comparing this, and a handler that cannot tell its own
	 * write from someone else's overwrites what a person is typing.
	 */
	updatedAt: string;
}

export type TAtlasMissionStatus = "queued" | "active" | "done";
