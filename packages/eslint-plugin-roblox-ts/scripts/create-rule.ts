import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(import.meta.url);
const directoryName = dirname(filePath);

const ruleName = process.argv[2];

if (ruleName === undefined) {
	console.error("Please provide a rule name (e.g., my-new-rule).");
	process.exit(1);
}

if (!/^[a-z]+(?:-[a-z]+)*$/.test(ruleName)) {
	console.error("Rule name must be in kebab-case (e.g., my-new-rule).");
	process.exit(1);
}

const ruleNameCamelCase = ruleName.replace(
	/-([a-z])/g,
	(name) => name[1]?.toUpperCase() ?? "ERROR",
);
const ruleDescription = ruleName
	.split("-")
	.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
	.join(" ");

const rootDirectory = resolve(directoryName, "..");
const rulesDirectory = join(rootDirectory, "src", "rules");
const templateDirectory = join(rootDirectory, "scripts", "template");
const ruleDirectoryPath = join(rulesDirectory, ruleName);
const pluginPath = join(rootDirectory, "src", "plugin.ts");

// --- Create Rule Directory ---
if (existsSync(ruleDirectoryPath)) {
	console.error(`Rule directory already exists: ${ruleDirectoryPath}`);
	process.exit(1);
}

mkdirSync(ruleDirectoryPath);
console.log(`Created directory: ${ruleDirectoryPath}`);

// --- Copy and Process Template Files ---
const templateFiles = ["rule.ts.template", "rule.spec.ts.template", "documentation.md"];

for (const templateFileName of templateFiles) {
	const templateFilePath = join(templateDirectory, templateFileName);
	// Remove .template extension for the final file name
	const resolvedFileName = templateFileName.replace(/\.template$/, "");
	const resolvedFilePath = join(ruleDirectoryPath, resolvedFileName);

	let content = readFileSync(templateFilePath, "utf-8");
	content = content.replace(/\{\{RULE_NAME\}\}/g, ruleName);
	content = content.replace(/\{\{RULE_NAME_CAMEL_CASE\}\}/g, ruleNameCamelCase);
	content = content.replace(/\{\{RULE_DESCRIPTION\}\}/g, ruleDescription);

	writeFileSync(resolvedFilePath, content);
	console.log(`Created file: ${resolvedFilePath}`);
}

// register the rule where the recommended configs derive their rule lists
try {
	let pluginContent = readFileSync(pluginPath, "utf-8");

	// Add import statement
	const importStatement = `import { ${ruleNameCamelCase} } from "./rules/${ruleName}/rule";\n`;
	// Find the last import statement
	const lastImportMatch = pluginContent.match(/import .* from ".*";\n(?!import)/);
	if (lastImportMatch?.index !== undefined) {
		pluginContent =
			pluginContent.slice(0, lastImportMatch.index + lastImportMatch[0].length) +
			importStatement +
			pluginContent.slice(lastImportMatch.index + lastImportMatch[0].length);
	} else {
		// Fallback if no imports found (unlikely)
		pluginContent = importStatement + pluginContent;
	}

	// Add rule to the rules object
	const ruleEntry = `\t\t"${ruleName}": ${ruleNameCamelCase},\n`;
	const rulesObjectRegex = /rules: {\s*([\s\S]*?)\s*},/m;
	const rulesMatch = pluginContent.match(rulesObjectRegex);

	if (rulesMatch) {
		const existingRules = rulesMatch[1];
		if (existingRules === undefined) {
			throw new Error("No existing rules found.");
		}

		// Find the correct alphabetical position
		const lines = existingRules
			.trim()
			.split("\n")
			.map((line) => line.trim());
		let insertIndex = lines.length;
		for (const [index, line] of lines.entries()) {
			const lineRuleNameMatch = line.match(/"([^"]+)"/);
			if (lineRuleNameMatch?.[1] !== undefined && lineRuleNameMatch[1] > ruleName) {
				insertIndex = index;
				break;
			}
		}

		lines.splice(insertIndex, 0, ruleEntry.trim());
		const updatedRules = `\n\t\t${lines.join("\n\t\t")}\n\t`;
		pluginContent = pluginContent.replace(existingRules, updatedRules);

		writeFileSync(pluginPath, pluginContent);
		console.log(`Updated: ${pluginPath}`);
	} else {
		throw new Error(`Could not find the 'rules' object in ${pluginPath}.`);
	}
} catch (err) {
	console.error(`Error updating ${pluginPath}:`, err);
	console.error(`Please add the following manually to ${pluginPath}:`);
	console.error(`  Import: import { ${ruleNameCamelCase} } from "./rules/${ruleName}/rule";`);
	console.error(`  Rule entry: "${ruleName}": ${ruleNameCamelCase},`);
	process.exit(1);
}

console.log(`\nSuccessfully created rule "${ruleName}".`);
console.log("Next steps:");
console.log("1. Implement the rule logic in", join(ruleDirectoryPath, "rule.ts"));
console.log("2. Write tests in", join(ruleDirectoryPath, "rule.spec.ts"));
console.log("3. Update the documentation in", join(ruleDirectoryPath, "documentation.md"));
console.log("4. Run `pnpm eslint-docs` to update the README.");
console.log("5. The rule is now included in the recommended configs via src/plugin.ts.");
