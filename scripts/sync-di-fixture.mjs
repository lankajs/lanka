/**
 * Rewrites the `.lanka_di` fixture from the scaffold stubs.
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

const FIXTURE = join(process.cwd(), "tools", "testing", "_fixtures", lankaDiContract.dirname);
mkdirSync(FIXTURE, { recursive: true });

for (const barrel of lankaDiContract.barrels) {
	writeFileSync(join(FIXTURE, barrel.file), barrel.stub, "utf8");
}

console.log(`fixture synced: ${lankaDiContract.barrels.length} barrels`);
