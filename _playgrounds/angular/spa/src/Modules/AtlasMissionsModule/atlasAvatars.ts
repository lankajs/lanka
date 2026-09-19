import { InjectionToken } from "@angular/core";
import type { LankaBlobCachePolicy } from "@lankajs/blob-cache";

/**
 * How an Angular component is GIVEN the avatar cache.
 *
 * The same decision `ATLAS_MISSIONS_VM` and `ATLAS_BOARD_VM` make, about a thing
 * that is not a ViewModel — and it holds for the same reason. An `input` is DATA
 * a parent owns and changes; a provider is a DEPENDENCY that lives as long as
 * the injector does. The cached bytes outlive every view that reads them, so a
 * cache built inside a screen starts empty each time somebody navigates, which
 * is the fetch it exists to avoid.
 *
 * Passing it down as an input would be worse than useless: every row of every
 * list would have to be handed the same object by every parent, and the first
 * parent that built one of its own would be a second cache nobody could see —
 * two stores of the same faces, each holding half of them.
 *
 * ## What is deliberately NOT here
 *
 * The avatar's URL and the crew member's name. Those are data a row owns and
 * changes as the list is filtered and paged, which is exactly what an `input`
 * is — and `AtlasAvatar` takes them as inputs for that reason.
 *
 * Here rather than in `@lanka-playgrounds/angular-shared`, on the rule
 * `ATLAS_BOARD_VM` states: there is nothing about this token two Angular hosts
 * would share, and a token in the shared package would be a layer with no
 * reason.
 */
export const ATLAS_AVATARS = new InjectionToken<LankaBlobCachePolicy>("ATLAS_AVATARS");
