<script setup lang="ts">
import { atlasAvatarSrc } from "@lanka-playgrounds/_shared";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

/**
 * One crew member's face, from the cache when it is there.
 *
 * `getInitialSrc` is SYNCHRONOUS and final for a URL, and both halves of that
 * are the product. Synchronous, because if the blob is in memory an object URL
 * can be minted on the spot and the first render already has it. Final, because
 * swapping `src` on a mounted image makes the browser discard the decoded frame
 * and decode again — which a person sees as a flicker.
 *
 * So nothing here ever upgrades an image that is already on screen. `warmCache`
 * fetches what was missing for the NEXT mount and the next session, and that is
 * the guarantee rather than a limitation.
 *
 * Read beside `_playgrounds/react/spa/src/Modules/AtlasMissionsModule/AtlasAvatar.tsx`:
 * the two say the same three lines in two syntaxes, because the policy is the
 * framework-free one in `@lanka-playgrounds/_shared`.
 */
const props = defineProps<{
	cache: LankaBlobCachePolicy;
	url: string;
	name: string;
}>();

/*
 * Read ONCE into a plain const rather than a `computed`.
 *
 * A computed would re-evaluate when the cache filled and swap the `src` of a
 * mounted image, which is exactly the flicker the policy above exists to
 * prevent. In this component the absence of reactivity IS the behaviour.
 */
const src = atlasAvatarSrc(props.cache, props.url);

props.cache.warmCache(props.url);
</script>

<template>
	<img :src="src" :alt="name" width="32" height="32" class="atlas-avatar" />
</template>
