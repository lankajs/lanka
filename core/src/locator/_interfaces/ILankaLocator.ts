/**
 * Resolves instances by camelCase property name, mapping it to the PascalCase
 * class name.
 */
export interface ILankaLocator<TInstance> {
	/**
	 * The instance for a camelCase property name.
	 *
	 * @param propertyName For example, `userGateway`
	 * @throws If no such instance exists
	 */
	get(propertyName: string): TInstance;
}
