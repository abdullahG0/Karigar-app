const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the full monorepo so shared/ imports resolve later.
config.watchFolders = [monorepoRoot];

// Prefer local node_modules, fall back to hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// expo is hoisted to the repo root by npm workspaces. Its AppEntry.js uses
// '../../App' which, from repo_root/node_modules/expo/, resolves to repo_root/App
// instead of apps/mobile/App. Intercept that specific import and redirect it.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === '../../App' &&
    context.originModulePath.includes(path.join('node_modules', 'expo', 'AppEntry'))
  ) {
    return {
      filePath: path.resolve(projectRoot, 'App.tsx'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
