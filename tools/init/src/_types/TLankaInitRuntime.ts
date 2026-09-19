/**
 * Where a project runs, and therefore which packages may be offered to it.
 *
 * The same three words `scripts/registry.mjs` declares for every package in the
 * framework, and deliberately not a superset: this is the list a consumer's
 * answer is checked against, so a fourth word here would be a runtime the
 * framework has never said anything about.
 *
 * A UNION and not an enum, per `skills/surface/SKILL.md` 6d.5: adding a member
 * is safe, removal is visible in a diff, and it survives `erasableSyntaxOnly`.
 */
export type TLankaInitRuntime = "browser" | "node" | "native";
