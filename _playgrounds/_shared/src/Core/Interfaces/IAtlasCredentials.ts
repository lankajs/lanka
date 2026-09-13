/**
 * What the server hands back when somebody signs in.
 *
 * The CREDENTIALS rather than "the session": the session is the thing that holds
 * these and knows how to renew them, and it is a class — `AtlasSession`. Two
 * names for two things, so neither has to carry a suffix saying which it is.
 */
export interface IAtlasCredentials {
	token: string;
	refreshToken: string;
	/** The value every unsafe request must echo. */
	csrf: string;
	name: string;
}
