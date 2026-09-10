module.exports = {
	hooks: {
		readPackage(pkg) {
			// this standalone Oxlint suite must not import the root Vite Plus runner's incompatible Vitest peers
			if (pkg.name === "oxlint" && pkg.version === "1.74.0") {
				delete pkg.peerDependencies?.["vite-plus"];
				delete pkg.peerDependenciesMeta?.["vite-plus"];
			}

			return pkg;
		},
	},
};
