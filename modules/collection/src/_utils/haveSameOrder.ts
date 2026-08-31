/** Whether two arrays hold the same objects in the same places. */
export const haveSameOrder = <TItem>(left: readonly TItem[], right: readonly TItem[]): boolean => {
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false;
	}

	return true;
};
