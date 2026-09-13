/** What a scenario-layer reset should clear beyond the default. */
export interface ILankaScenarioResetConfig {
	/**
	 * Also forget which ViewModels were declared.
	 *
	 * Off by default, and the default is the one an APPLICATION needs: a
	 * module-level ViewModel is built once per process, so its declaration is the
	 * only thing that lets a second instance find it again.
	 *
	 * On, for a suite that builds ViewModels inside test bodies. Nothing
	 * un-declares one otherwise, so the next bootstrap re-adopts every ViewModel
	 * ever built in the process — and a finished test's handlers then run against
	 * the double that test created.
	 */
	withDeclarations?: boolean;
}
