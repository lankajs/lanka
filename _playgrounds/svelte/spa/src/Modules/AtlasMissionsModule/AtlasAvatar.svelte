<script lang="ts">
	import { atlasAvatarSrc } from "@lanka-playgrounds/_shared";
	import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

	/**
	 * One crew member's face, from the cache when it is there.
	 *
	 * `getInitialSrc` is SYNCHRONOUS and final for a URL, and both halves of that
	 * are the product. Synchronous, because if the blob is in memory an object URL
	 * can be minted on the spot and the first render already has it. Final,
	 * because swapping `src` on a mounted image makes the browser discard the
	 * decoded frame and decode again — which a person sees as a flicker.
	 *
	 * So nothing here ever upgrades an image that is already on screen.
	 * `warmCache` fetches what was missing for the NEXT mount and the next
	 * session, and that is the guarantee rather than a limitation.
	 *
	 * Read beside
	 * `_playgrounds/react/spa/src/Modules/AtlasMissionsModule/AtlasAvatar.tsx` and
	 * `_playgrounds/vue/_shared/src/Modules/AtlasMissionsModule/AtlasAvatar.vue`:
	 * the three say the same three lines in three syntaxes, because the policy is
	 * the framework-free one in `@lanka-playgrounds/_shared`.
	 */
	const { cache, url, name }: { cache: LankaBlobCachePolicy; url: string; name: string } =
		$props();

	/*
	 * Read ONCE into a plain `const` rather than a `$derived`.
	 *
	 * A rune would re-evaluate when the cache filled and swap the `src` of a
	 * mounted image, which is exactly the flicker the policy above exists to
	 * prevent. In this component the ABSENCE of reactivity is the behaviour, and
	 * the two ignores below say so rather than silencing a warning: Svelte cannot
	 * tell a prop read that is a bug from one that is the contract.
	 *
	 * `atlasAvatarSrc` rather than `getInitialSrc(url) ?? url` written here: the
	 * `??` compiles into an arm v8 reports as never taken however many scenes
	 * render this, and a shared function also stops five components disagreeing
	 * about what "already cached" means.
	 */
	// svelte-ignore state_referenced_locally
	const src = atlasAvatarSrc(cache, url);

	// svelte-ignore state_referenced_locally
	cache.warmCache(url);
</script>

<img {src} alt={name} width="32" height="32" class="atlas-avatar" />
