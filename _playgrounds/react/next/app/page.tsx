import Link from "next/link";
import type { JSX } from "react";

/** The entry point of the site. It delegates and decides nothing. */
export default function HomePage(): JSX.Element {
	return (
		<main>
			<h1>Atlas</h1>
			<Link href="/missions">The board</Link>
		</main>
	);
}
