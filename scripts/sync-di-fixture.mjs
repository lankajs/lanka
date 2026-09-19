/**
 * Rewrites the test kit's barrel fixture from the scaffold stubs.
 *
 * The contract spec compares the fixture with the stubs BYTE FOR BYTE: a stub
 * changed without the fixture would mean the framework writes one thing into a
 * consumer's repository and verifies itself against another. The test catches
 * the divergence; this script fixes it without hand-editing.
 *
 * Single source of truth: `tools/di/src/lanka-di-contract/lankaDiContract.ts`. This only copies.
 *
 * Run: pnpm run sync:di-fixture
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lankaDiContract } from "../tools/di/src/lanka-di-contract/lankaDiContract";
import { LANKA_DI_FIXTURE } from "../tools/testing/src/vitest";

// The kit's own export, NOT `lankaDiContract.dirname`. That field is the default
// a NEW consumer gets, and it became `.lanka` when the second directory name was
// admitted — while this fixture is where it has always been, named by nineteen
// `vitest.config.ts` files and by `tsconfig.base.json`. Following the default
// here would have written a SECOND fixture beside the one everything reads, and
// the whole repository's tests would have kept resolving the old one: green, and
// stale, which is the exact failure this script exists to prevent.
const FIXTURE = LANKA_DI_FIXTURE;
mkdirSync(FIXTURE, { recursive: true });

for (const barrel of lankaDiContract.barrels) {
	writeFileSync(join(FIXTURE, barrel.file), barrel.stub, "utf8");
}

console.log(`fixture synced: ${lankaDiContract.barrels.length} barrels`);
