import { usePlaygroundLazyTodosVM } from "../use-playground-lazy-todos-vm/usePlaygroundLazyTodosVM";

/**
 * The same screen over a LAZY declaration, and it reads no differently.
 *
 * Which is the point: laziness is a property of when the store is built, not of
 * how it is read, so the file a consumer writes is the file above with one
 * import changed. The store arrives on the first read this component performs.
 */
export const PlaygroundLazyTodoScreen = () => {
	const { heading, titles } = usePlaygroundLazyTodosVM();

	return (
		<section>
			<h1>{heading}</h1>
			<ul>
				{titles.map((title) => (
					<li key={title}>{title}</li>
				))}
			</ul>
		</section>
	);
};
