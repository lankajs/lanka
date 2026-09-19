import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { atlasAvatarSrc } from "@lanka-playgrounds/_shared";
import { ATLAS_AVATARS } from "./atlasAvatars";

/**
 * One crew member's face, from the cache when it is there.
 *
 * `atlasAvatarSrc` is SYNCHRONOUS and final for a URL, and both halves of that
 * are the product. Synchronous, because if the blob is in memory an object URL
 * can be minted on the spot and the first render already has it. Final, because
 * swapping `src` on a mounted image makes the browser discard the decoded frame
 * and decode again — which a person sees as a flicker.
 *
 * So nothing here ever upgrades an image that is already on screen. `warmCache`
 * fetches what was missing for the NEXT mount and the next session, and that is
 * the guarantee rather than a limitation.
 *
 * Read beside `_playgrounds/react/spa/src/Modules/AtlasMissionsModule/AtlasAvatar.tsx`
 * and the `.vue` next to it: the three say the same three lines in three
 * syntaxes, because the policy is the framework-free one in
 * `@lanka-playgrounds/_shared`.
 *
 * ## The cache is injected and the row's data is an input
 *
 * The two ways Angular has of handing a component something mean different
 * things, and this component needs both at once. The cache is a dependency with
 * the injector's lifetime, so it arrives from `ATLAS_AVATARS`; the URL and the
 * name are data the row owns and changes as a list is filtered and paged, so
 * they arrive as inputs.
 *
 * ## Declared in the metadata, and neither `input()` nor `@Input()`
 *
 * Both of the forms an Angular application would reach for first are unavailable
 * HERE, and for one underlying reason: these files never reach the Angular
 * compiler. Vite hands them to the plugin's JIT path — the "contains Angular
 * decorators but is not in the TypeScript program" line `README.md` records —
 * and each form fails differently against it.
 *
 * `input.required()` fails silently and then loudly. A signal input is written
 * into the component definition by the COMPILER, because nothing can read a
 * field initialiser before an instance exists; under JIT the definition lists no
 * input, the parent's `[url]` binding matches nothing, and the first read is
 * NG0950 — an error naming the input rather than the build that lost it.
 *
 * `@Input()` fails before a scene runs at all: this project has no
 * `experimentalDecorators`,
 * on purpose, so a field decorator is emitted in the STANDARD form and Angular
 * refuses it outright — "Standard Angular field decorators are not supported in
 * JIT mode".
 *
 * The `inputs` array is the third form and the only one that is data rather than
 * syntax, so both compilers read it the same way. It is also the honest one:
 * what a component accepts is part of its definition, and here it is written in
 * the definition.
 */
@Component({
	selector: "atlas-avatar",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	inputs: [
		{ name: "url", required: true },
		{ name: "name", required: true },
	],
	template: `<img [src]="src" [alt]="name" width="32" height="32" class="atlas-avatar" />`,
})
export class AtlasAvatar implements OnInit {
	url!: string;

	name!: string;

	/**
	 * The `src` this image is mounted with, and the only one it will ever have.
	 *
	 * A plain field read ONCE, and not `[src]="avatarSrc()"`. A template
	 * expression is re-evaluated on every change detection, so the moment the
	 * cache filled, the binding would answer with an object URL and Angular would
	 * write it onto a mounted `<img>` — the flicker this whole policy exists to
	 * prevent, arriving through the one mechanism that makes it look like the
	 * framework's doing.
	 */
	src = "";

	private readonly avatars = inject(ATLAS_AVATARS);

	/**
	 * `ngOnInit` and not the field initialiser above, which is not a preference.
	 *
	 * An input's value arrives AFTER construction, so a field initialiser reading
	 * `url` would read whatever it was before the parent bound anything. The
	 * mount hook is the first moment both the input and the injector are there,
	 * and it runs before the first frame — so the image is never rendered with an
	 * empty `src` and then corrected.
	 */
	ngOnInit(): void {
		this.src = atlasAvatarSrc(this.avatars, this.url);

		// For the NEXT mount, never for this one. `atlasAvatarSrc` has already
		// answered, and nothing below it is allowed to change what it said.
		this.avatars.warmCache(this.url);
	}
}
