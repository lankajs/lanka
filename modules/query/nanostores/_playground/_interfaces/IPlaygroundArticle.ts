/** An article, as the server holds it. */
export interface IPlaygroundArticle {
	slug: string;
	title: string;
	/** How many people have it open, which is what makes a second reader visible. */
	readers: number;
}
