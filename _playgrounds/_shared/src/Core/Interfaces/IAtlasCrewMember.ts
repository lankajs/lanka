/** Somebody a mission can be assigned to. */
export interface IAtlasCrewMember {
	id: string;
	name: string;
	/** Immutable by contract — which is the only kind of address worth caching. */
	avatarUrl: string;
}
