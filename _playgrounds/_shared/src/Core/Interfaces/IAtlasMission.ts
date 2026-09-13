/** A mission, in the application's own vocabulary. */
export interface IAtlasMission {
	id: string;
	/** The short code a person reads aloud: `AT-104`. */
	code: string;
	title: string;
	status: TAtlasMissionStatus;
	/** 1 is the most urgent. */
	priority: number;
	crewId: string | null;
	/**
	 * The version, as an ISO string.
	 *
	 * A string and not a `Date`, deliberately. This value crosses a server
	 * rendering boundary as an ordinary prop, and a `Date` there is serialised on
	 * the way out and arrives as a string anyway — so a type claiming otherwise
	 * would be wrong on exactly one side of the network.
	 */
	updatedAt: string;
}

export type TAtlasMissionStatus = "queued" | "active" | "done";
