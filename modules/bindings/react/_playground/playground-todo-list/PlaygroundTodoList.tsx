import type { JSX } from "react";

interface IPlaygroundTodoListProps {
	heading: string;
	titles: readonly string[];
}

/**
 * What the three declaration scenes render, once.
 *
 * The scenes differ in how the ViewModel was DECLARED — one line through this
 * package's factory, the lazy one, a class given the read by hand — and in
 * nothing else. That is the thing each of them is there to show, and it reads
 * better when the screens are three lines apiece than when three copies of the
 * same markup sit between the reader and the difference.
 *
 * It takes values rather than a ViewModel, deliberately: a presentational
 * component that read a store would make each scene prove two things at once.
 */
export const PlaygroundTodoList = ({ heading, titles }: IPlaygroundTodoListProps): JSX.Element => (
	<section>
		<h1>{heading}</h1>
		<ul>
			{titles.map((title) => (
				<li key={title}>{title}</li>
			))}
		</ul>
	</section>
);
