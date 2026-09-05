import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(desktopDir, '..');
const stagingDir = path.join(os.tmpdir(), 'mafia-party-electron-build');
const outputDir = path.join(appDir, 'release');
const target = process.argv.includes('--nsis') ? 'nsis' : 'dir';

await rm(stagingDir, { recursive: true, force: true });
await mkdir(path.join(stagingDir, 'dist'), { recursive: true });
await mkdir(path.join(stagingDir, 'desktop'), { recursive: true });
await mkdir(path.join(stagingDir, 'node_modules', 'mafia-party-runtime'), { recursive: true });
await cp(path.join(appDir, 'dist', 'public'), path.join(stagingDir, 'dist', 'public'), { recursive: true });
await cp(path.join(desktopDir, 'main.cjs'), path.join(stagingDir, 'desktop', 'main.cjs'));

const stagedPackage = {
  name: 'mafia-party-desktop',
  version: '1.0.0',
  private: true,
  main: 'desktop/main.cjs',
  dependencies: { 'mafia-party-runtime': '1.0.0' },
  build: {
    appId: 'com.mafiaparty.desktop',
    productName: 'Mafia Party',
    electronVersion: '38.8.6',
    directories: { output: outputDir },
    files: ['dist/public/**/*', 'desktop/**/*'],
    npmRebuild: false,
    nodeGypRebuild: false,
    buildDependenciesFromSource: false,
    win: { target: [{ target, arch: ['x64'] }] },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      shortcutName: 'Mafia Party',
    },
  },
};
await writeFile(path.join(stagingDir, 'package.json'), JSON.stringify(stagedPackage, null, 2));
await writeFile(
  path.join(stagingDir, 'node_modules', 'mafia-party-runtime', 'package.json'),
  JSON.stringify({ name: 'mafia-party-runtime', version: '1.0.0', private: true }, null, 2),
);
await writeFile(
  path.join(stagingDir, 'package-lock.json'),
  JSON.stringify({
    name: stagedPackage.name,
    version: stagedPackage.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: stagedPackage.name, version: stagedPackage.version, dependencies: stagedPackage.dependencies },
      'node_modules/mafia-party-runtime': { name: 'mafia-party-runtime', version: '1.0.0' },
    },
  }, null, 2),
);

const builderCli = path.resolve(appDir, 'node_modules', 'electron-builder', 'cli.js');
const builderEnv = { ...process.env, npm_config_user_agent: `npm/10.0.0 node/${process.versions.node}` };
delete builderEnv.npm_config_recursive;
delete builderEnv.npm_config_filter;
delete builderEnv.npm_execpath;
const result = spawnSync(process.execPath, [builderCli, '--win', target, '--x64', '--projectDir', stagingDir], {
  cwd: stagingDir,
  env: builderEnv,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) console.error(`electron-builder exited with status ${result.status ?? 'unknown'}${result.signal ? ` (${result.signal})` : ''}`);
if (result.status !== 0) process.exit(result.status ?? 1);