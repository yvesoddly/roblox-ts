import style, { GLOB_MARKDOWN } from "@isentinel/eslint-config";

export default style(
	{
		eslintPlugin: true,
		markdown: false,
		pnpm: true,
		roblox: false,
		rules: {
			"antfu/consistent-list-newline": [
				"error",
				{
					CallExpression: false,
				},
			],
		},
		type: "package",
	},
	{
		ignores: ["fixtures/**", "scripts/template/**", GLOB_MARKDOWN],
	},
	{
		rules: {
			"eslint-plugin/no-meta-schema-default": "off",
		},
	},
	{
		files: ["package.json"],
		rules: {
			// the parent workspace cannot resolve this package's private catalogs
			"pnpm/json-enforce-catalog": "off",
		},
	},
);
