import type { JSX, ReactNode } from "react";

export const metadata = { title: "Atlas — Next" };

/**
 * The root layout Next requires, and nothing else in it.
 *
 * Every file under `app/` here is an ENTRY: it is named by Next rather than by
 * this application, and it delegates immediately. The decisions live under
 * `src/`, where they are ordinary modules a test can import without a router.
 */
export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
