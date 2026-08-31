/** What both buttons act on, and what a rollback restores. */
export interface IPlaygroundPost {
	id: number;
	likes: number;
	isLiked: boolean;
	isPublished: boolean;
}
