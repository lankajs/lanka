/**
 * No credential in a tracked file. This repository publishes every package to
 * npm from a token, and the day that token is pasted into a doc or a fixture is
 * a day nothing else here would notice. The built-in library is kept whole: a
 * scan that quietly stopped looking for a format reads exactly like one that
 * looked and found nothing.
 */
import { secretScan } from "@specwarden/security";

export const check = secretScan({
	corpus: {
		atLeast: 1000,
		why: "the repository tracks thousands of files — a scan over fewer means the pathspec or `except` swallowed them.",
	},
});
