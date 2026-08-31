export const sleep = (ms: number = 300): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};
