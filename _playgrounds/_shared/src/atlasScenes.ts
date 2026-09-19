/**
 * What every Atlas application must SAY, as data.
 *
 * Six applications written by hand diverge the way six hand-written validator
 * suites would — not on the day they are written, but on the day one of them
 * gets a scene and five do not. The lists below are what `check-playgrounds`
 * holds them to: a scene here is an `it(...)` title that must appear verbatim in
 * the application's suite.
 *
 * ## Titles, and why matching them exactly is the point
 *
 * A gate that matched "something about paging" would pass a suite that renamed
 * a scene into meaninglessness. Exact titles make the contract readable in two
 * directions: from here you can see what every application claims, and from a
 * suite you can see which claim each scene belongs to. `check-family` holds the
 * validator shelf together the same way.
 *
 * ## These are the MINIMUM, never the whole suite
 *
 * `_playgrounds/react/spa` exercises ten packages and seven ViewModels; the
 * four younger applications exercise the missions board and the dispatch board.
 * The lists below are what all of them share, so the gate says "this claim went
 * missing" rather than "these suites are not identical" — which they are not
 * meant to be.
 */

/**
 * The missions screen, in every SPA.
 *
 * One claim per line, and each is about the VIEWMODEL rather than the
 * framework: what a screen renders, what an action does, who owns a failure,
 * and what a screen may not decide for itself. Reading the five suites side by
 * side should show only each framework's own syntax between these titles.
 *
 * ## The wording is `_playgrounds/react/spa`'s, and that was a decision
 *
 * The four younger applications were written with titles of their own, and
 * bringing them to React's rather than the other way round is the rule that a
 * list must not rewrite the code it holds. React's suite came first, was
 * reviewed, and says these things in words chosen against the behaviour; a
 * contract assembled later has no standing to rename them.
 *
 * ## It is today's INTERSECTION, and it is meant to grow
 *
 * Five claims, not fifteen. React's application asserts optimistic completion,
 * a rollback, a crew avatar from a cache and four more screens; the younger
 * four assert the missions board and the dispatch board. A list naming what
 * only one of them does would be a list nobody could satisfy, so this one names
 * what all of them already do — and the next claim to be added is the next one
 * that becomes true everywhere.
 */
export const ATLAS_SPA_SCENES: readonly string[] = [
	"renders what the ViewModel loaded, and nothing it did not ask for",
	"shows a failure the ViewModel put there, and owns no error state of its own",
	"filters as somebody types",
	"pages, and cannot page past the end",
	"sorts by priority through the action",
];

/**
 * The server contract, in every HOST.
 *
 * Five claims, and the third and fourth are the ones a host is most likely to
 * skip: a prerender has no caller, so `runLankaStatic` must exist AND must be a
 * different name rather than `runLankaRequest` with a flag. A flag is a thing
 * somebody passes wrongly; a missing parameter is a thing that does not
 * compile, and a host without the scene is a host where somebody will add the
 * flag.
 */
export const ATLAS_HOST_SCENES: readonly string[] = [
	"reads the board through a gateway resolved by name",
	"gives two overlapping requests two instances",
	"carries the caller's identity into the API call",
	"reads the board for output that will be shared by everybody",
	"REFUSES a caller's identity, which is the only difference from the request call",
];

/**
 * What each Astro island claims, on the one page that has four of them.
 *
 * Deliberately short. An island is a client component, so most of what it does
 * is already covered by its ecosystem's own application — what is only true
 * HERE is that it starts from what the page fetched and then goes on being
 * interactive, in a bundle that also contains three other frameworks.
 *
 * `_plans/14` asks for two more: one ViewModel read by two islands at once, and
 * a scenario released by one island arriving at another. Neither is written
 * yet, and neither is listed here, because a gate that named a scene nobody has
 * written would be red on arrival and would be silenced rather than satisfied.
 */
export const ATLAS_ISLAND_SCENES: readonly string[] = [
	"starts from what the page already fetched",
	"is interactive, which is the whole reason it is an island",
];

/**
 * Which bindings have an Astro integration, and which deliberately do not.
 *
 * This is the ratchet on the shelf: `check-playgrounds` requires one island per
 * name here, and requires this list plus the exclusions to account for every
 * member of `modules/bindings/`. A sixth binding is a line here or a line in
 * the exclusions, and either way it is a DECISION rather than a forgotten
 * island.
 */
export const ASTRO_ISLAND_BINDINGS: readonly string[] = ["react", "vue", "svelte", "solid"];

/**
 * Bindings with no Astro island, and the reason each has none.
 *
 * Written down so the absence is a recorded fact rather than an oversight. The
 * gate reads it: a binding that is in neither list fails.
 */
export const ASTRO_ISLAND_EXCLUSIONS: Readonly<Record<string, string>> = {
	angular:
		"No official @astrojs/angular integration exists, and writing one means building a meta-framework to satisfy a scene. Angular's own application carries both its SPA and its server render.",
};

/**
 * The ecosystems every package must be reachable from.
 *
 * "Reachable" means an application in that ecosystem, or the shared code it is
 * built on, names the package. Not "installed" — `check-playgrounds` has a
 * separate rule for a dependency nobody imports.
 */
export const ATLAS_ECOSYSTEMS: readonly string[] = ["react", "vue", "svelte", "solid", "angular"];

/**
 * Packages one ecosystem may not reach, and the reason for each.
 *
 * The point of five applications over one framework each is that a complex
 * change can be tried against all of them: if `@lankajs/optimistic` is exercised
 * only under React, then "it works" means "it works under React". So the rule is
 * that every package is reachable from every ecosystem, and every exception is
 * written here rather than discovered by someone wondering why a package has no
 * second witness.
 *
 * ## A FAMILY is exempt, and that is not a loophole
 *
 * `validators`, `bindings`, `query` and `storage-adapters` are families: one
 * package per vendor, all binding one port, and an application installs exactly
 * one member. Requiring every ecosystem to reach every member would require the
 * Vue application to install React's binding, which is the thing the shelf
 * exists to make unnecessary. So a family member is held to a weaker rule the
 * gate applies on its own — reached by at least ONE ecosystem — and the family
 * gate proves the members are interchangeable.
 *
 * What is left here is the exception that is neither: a package outside every
 * family that one ecosystem genuinely cannot reach. There are none today, and
 * an empty map is the honest state rather than a missing one — the gate reads
 * it, and the day something lands here it will have a reason beside it.
 *
 * A reason is required and its length is asserted. "Not yet" is legitimate as
 * long as it says what would change it.
 */
export const ATLAS_REACH_EXCLUSIONS: Readonly<Record<string, Readonly<Record<string, string>>>> =
	{};

/**
 * Packages no application imports, and cannot.
 *
 * A build tool is used through a config or a generator rather than through an
 * import line, so a rule demanding one would demand a line nobody should write.
 * Listed rather than pattern-matched: a fourth tool is a decision, not a prefix.
 */
export const ATLAS_UNIMPORTABLE: Readonly<Record<string, string>> = {
	"@lankajs/tool-di": "A bundler plugin, reached by path from a vite or metro config.",
	"@lankajs/tool-eslint": "A shareable config the root eslint file spreads.",
	"@lankajs/tool-testing": "A setup file and a bench calibration, named in a vitest config.",
	"@lankajs/tool-skills":
		"The generator that writes the shipped skills. It runs over the repository; nothing installs it.",
};
