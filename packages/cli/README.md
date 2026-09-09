# roblox-ts CLI

`@roblox-ts/cli` provides the `rbxtsc` command and depends on the `roblox-ts` compiler package.
Install it with `npm install --save-dev @roblox-ts/cli`, then run `npx rbxtsc`.

Build locally with `pnpm --filter @roblox-ts/cli build` and pack with
`pnpm --filter @roblox-ts/cli pack`. Publish the compiler dependency before releasing a CLI
version that needs it. The compiler retains its Node and browser entry points and runtime files.

The CLI should create ProjectBuild instances as needed based on input from the user.

Only behavior unique to CLI environments should go here. Any behavior that is common to both the CLI and the playground environments belongs in Project.

## Structure

**commands/** - stores all of the yargs-based subcommands for the cli interface

**commands/build.ts** - the `build` command, this runs by default and can have the following flags:

- `--project, -p` - Location of the tsconfig.json or folder containing the tsconfig.json _(defaults to ".")_
- `--watch, -w` - Enable watch mode, recompiles files as they change. Creates a Watcher object. _(defaults to false)_
- `--includePath, -i` - Path to where the runtime library files should be stored. _(defaults to "include")_
- `--rojo` - Path to the Rojo configuration file. By default this will attempt to find a \*.project.json in your project folder.

**cli.ts** - used to kickstart yargs
