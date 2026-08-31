export function caseConvert(
	str: string,
	toCase: "camelCase" | "kebabCase" | "snakeCase" | "pascalCase" | "titleCase",
): string {
	if (!str || typeof str !== "string") return str;

	const words = str
		.replace(/([A-Z])/g, " $1")
		.trim()
		.split(/\s+|_|-/)
		.filter((word) => word);

	switch (toCase) {
		case "camelCase":
			return words
				.map((word, index) =>
					index === 0
						? word.toLowerCase()
						: word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
				)
				.join("");
		case "kebabCase":
			return words.map((word) => word.toLowerCase()).join("-");
		case "snakeCase":
			return words.map((word) => word.toLowerCase()).join("_");
		case "pascalCase":
			return words
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
				.join("");
		case "titleCase":
			return words
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
				.join(" ");
		default:
			return str;
	}
}
