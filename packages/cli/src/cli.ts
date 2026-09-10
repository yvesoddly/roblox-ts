#!/usr/bin/env node

import { CLIError } from "CLI/errors/CLIError";
import { COMPILER_VERSION } from "roblox-ts";
import { LogService } from "roblox-ts/out/Shared/classes/LogService";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";

const cli = yargs(hideBin(process.argv));

cli
	// help
	.usage("roblox-ts - A TypeScript-to-Luau Compiler for Roblox")
	.help("help")
	.alias("h", "help")
	.describe("help", "show help information")

	// version
	.version(COMPILER_VERSION)
	.alias("v", "version")
	.describe("version", "show version information")

	// commands
	.commandDir(`${__dirname}/commands`)

	// options
	.recommendCommands()
	.strict()
	.wrap(cli.terminalWidth())

	// execute
	// .fail() is necessary to properly `.toString()` custom error objects like CLIError
	.fail(str => {
		process.exitCode = 1;
		if (str) {
			LogService.fatal(str);
		}
	})
	.parseAsync()
	.catch(e => {
		if (e instanceof CLIError) {
			e.log();
			debugger;
		} else {
			throw e;
		}
	});
