/** One member of the crew a mission can be assigned to. */
export interface IAtlasCrewMember {
	id: string;
	name: string;
	/**
	 * An immutable address: the id is in the path and the bytes never change.
	 *
	 * That is what makes it cacheable at all — `@lankajs/blob-cache` never checks
	 * freshness, so a URL whose content can change would be served stale forever.
	 */
	avatarUrl: string;
}
