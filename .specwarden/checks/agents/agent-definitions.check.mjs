/**
 * The roster `AGENTS.md` divides the work by. A role that omits `tools:` does not
 * lose tools — it inherits the whole session's, which is how a read-only reviewer
 * silently gains Write; and a name that differs from its file loads and is then
 * uncallable.
 *
 * `orchestrators: []` — no role here spawns. A subagent cannot, and `lead`
 * returns a plan for the main session to run: its tools carry no spawn tool, and
 * one appearing there would turn a bounded pipeline into an unbounded one.
 */
import { agentDefinitions } from "@specwarden/agents";

export const check = agentDefinitions({
	orchestrators: [],
	corpus: {
		atLeast: 10,
		why: "the roster holds ten roles — fewer read means `.claude/agents` moved or a file stopped parsing.",
	},
	rule: {
		id: "the-roster-is-well-formed",
		statement:
			"every role names itself as its file does, declares its tools and its model, and cannot spawn",
		owner: "AGENTS.md",
	},
});
