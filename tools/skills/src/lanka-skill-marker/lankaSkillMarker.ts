/**
 * The file that says "a sync wrote this directory, and from what".
 *
 * A marker rather than a comparison of contents: a consumer is allowed to edit a
 * skill this tool installed, and the next sync should still replace it. What must
 * never be replaced is a directory a sync did not create — and only the marker
 * can tell the two apart.
 */
export const lankaSkillMarker = ".lanka-skill.json";
