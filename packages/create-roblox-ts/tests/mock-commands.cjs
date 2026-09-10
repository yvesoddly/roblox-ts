const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { PassThrough } = require("node:stream");

// replace external commands only, keeping the CLI, prompts and filesystem behavior real
childProcess.spawn = (command, args, options) => {
	const child = new EventEmitter();
	child.stdout = new PassThrough();
	child.stderr = new PassThrough();
	const invocation = [command, ...args].join(" ");
	fs.appendFileSync(process.env.CREATE_ROBLOX_TS_COMMAND_LOG, `${invocation}\n`);
	process.nextTick(() => {
		if (args[0] === "init" && command !== "git") {
			fs.writeFileSync(path.join(options.cwd, "package.json"), JSON.stringify({ name: "generated-project" }));
		}
		child.stdout.end();
		child.stderr.end();
		child.emit("close", invocation === process.env.CREATE_ROBLOX_TS_FAIL_COMMAND ? 1 : 0);
	});
	return child;
};
