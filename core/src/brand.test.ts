import { describe, expect, it } from "vitest";
import * as root from "./index";
import * as bootstrap from "./bootstrap/index";
import * as config from "./config/index";
import * as errors from "./errors/index";
import * as gateway from "./gateway/index";
import * as locator from "./locator/index";
import * as logger from "./logger/index";
import * as mock from "./mock/index";
import * as scenario from "./scenario/index";
import * as validation from "./validation/index";
import * as viewmodel from "./viewmodel/index";

/**
 * The naming rule: everything a consumer SEES in their own code carries the
 * framework name.
 *
 * Two reasons, the second the stronger:
 *
 * 1. A reader of an unfamiliar file can see where `ALankaGateway` came from;
 *    `AGateway` says nothing and could be anything from anywhere.
 * 2. The framework does not squat popular names. `Logger`, `EventBus`, `Storage`,
 *    `Singletons`, `Scenarios` are exactly the names an app wants for ITS own
 *    things. One case was not hypothetical: a class `Storage` collided with the
 *    browser GLOBAL, and inside its own adapter the type `Storage` meant both.
 *
 * The rule is executed HERE rather than stated in a document: a convention
 * nothing is built from and nothing fails on diverges silently, and is
 * discovered when renaming is too late because the package is published.
 */

/** Names left bare. The reason for each is in `skills/naming/SKILL.md`. */
const KEPT = new Set(["isRecord", "getStringField", "generateUuid"]);

const BARRELS: Record<string, Record<string, unknown>> = {
	lanka: root,
	"lanka/bootstrap": bootstrap,
	"lanka/config": config,
	"lanka/errors": errors,
	"lanka/gateway": gateway,
	"lanka/locator": locator,
	"lanka/logger": logger,
	"lanka/mock": mock,
	"lanka/scenario": scenario,
	"lanka/validation": validation,
	"lanka/viewmodel": viewmodel,
};

/**
 * A name carries the brand if `Lanka`/`lanka` appears anywhere in it:
 * `ALankaGateway`, `createLankaVM`, `lankaHttpInFlight`, `getLankaFlags` all read
 * equally clearly, and requiring a PREFIX specifically would break the verbs.
 */
const carriesBrand = (name: string): boolean => /lanka/i.test(name);

describe("the naming rule for the public surface", () => {
	for (const [specifier, barrel] of Object.entries(BARRELS)) {
		it(`${specifier} exports only branded names`, () => {
			const unbranded = Object.keys(barrel).filter(
				(name) => !carriesBrand(name) && !KEPT.has(name),
			);

			expect(unbranded).toEqual([]);
		});
	}

	it("exceptions are listed by name, not by a rule", () => {
		// "Except utilities" is not machine-checkable: what counts as a utility is
		// decided differently by everyone and such a list grows unnoticed. A list
		// of names grows visibly, in a diff.
		expect([...KEPT]).toEqual(["isRecord", "getStringField", "generateUuid"]);
	});
});
