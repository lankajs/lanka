import type { IPlaygroundServerScript } from "../../_interfaces/IPlaygroundServerScript";

/** A backend a test can state in one line. */
export const createPlaygroundScript = (
	statuses: number[],
	body?: unknown,
): IPlaygroundServerScript => ({ statuses, body, seen: [] });
