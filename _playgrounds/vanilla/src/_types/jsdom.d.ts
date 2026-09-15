/**
 * The two members of `jsdom` the live suite uses, declared here rather than
 * installed.
 *
 * `@types/jsdom` was the obvious answer and it broke a package that does not
 * import jsdom at all: it drags an `@types/node` of its own into the store, and
 * `_playgrounds/_server` — a node program with no DOM anywhere — then typechecked
 * against a `BodyInit` with no `ArrayBufferView` in it and refused every `fetch`
 * carrying a `Buffer`. A type package that changes another package's program is
 * a dependency with a blast radius, and this one buys four lines.
 *
 * So: the surface actually used, and nothing else. It is deliberately narrow —
 * a line reaching for something not declared here fails, which is the reminder
 * that this application is the one with no framework and should stay small.
 */
declare module "jsdom" {
	export class JSDOM {
		constructor(html?: string);
		readonly window: Window & typeof globalThis;
	}
}
