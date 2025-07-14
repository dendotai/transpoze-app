#!/usr/bin/env bun
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';
import { parseArgs } from 'util';

const { values } = parseArgs({
  args: Bun.argv,
  options: {
    version: {
      type: 'string',
      short: 'v',
    },
    'skip-tag': {
      type: 'boolean',
      default: false,
    },
    'skip-commit': {
      type: 'boolean',
      default: false,
    },
    help: {
      type: 'boolean',
      short: 'h',
    },
  },
  strict: true,
  allowPositionals: true,
});

if (values.help) {
  console.log(`
Usage: bun run scripts/release.ts [options]

Options:
  -v, --version <version>  Version to release (e.g., 1.0.0)
  --skip-tag              Skip creating git tag
  --skip-commit           Skip creating git commit
  -h, --help              Show this help message

Examples:
  bun run scripts/release.ts -v 1.0.0
  bun run scripts/release.ts --version 1.0.0 --skip-tag
`);
  process.exit(0);
}

const version = values.version;

if (!version) {
  console.error('Error: Version is required. Use -v or --version to specify.');
  process.exit(1);
}

// Validate version format
const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
if (!versionRegex.test(version)) {
  console.error('Error: Invalid version format. Use semantic versioning (e.g., 1.0.0 or 1.0.0-beta.1)');
  process.exit(1);
}

const rootDir = join(import.meta.dir, '..');
const tauriConfigPath = join(rootDir, 'apps/desktop/src-tauri/tauri.conf.json');
const cargoTomlPath = join(rootDir, 'apps/desktop/src-tauri/Cargo.toml');

function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('-')[0].split('.').map(Number);
  const parts2 = v2.split('-')[0].split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  
  // If base versions are equal, check pre-release
  const pre1 = v1.split('-')[1];
  const pre2 = v2.split('-')[1];
  
  if (!pre1 && pre2) return 1;  // v1 is release, v2 is pre-release
  if (pre1 && !pre2) return -1;  // v1 is pre-release, v2 is release
  if (pre1 && pre2) return pre1.localeCompare(pre2);
  
  return 0;
}

async function getCurrentVersions() {
  const tauriContent = await readFile(tauriConfigPath, 'utf-8');
  const tauriConfig = JSON.parse(tauriContent);
  
  const cargoContent = await readFile(cargoTomlPath, 'utf-8');
  const cargoVersionMatch = cargoContent.match(/^version = "(.+)"$/m);
  const cargoVersion = cargoVersionMatch ? cargoVersionMatch[1] : null;
  
  return {
    tauri: tauriConfig.version,
    cargo: cargoVersion,
  };
}

async function updateTauriConfig(newVersion: string) {
  const content = await readFile(tauriConfigPath, 'utf-8');
  const config = JSON.parse(content);
  const oldVersion = config.version;
  config.version = newVersion;
  await writeFile(tauriConfigPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`✓ Updated tauri.conf.json: ${oldVersion} → ${newVersion}`);
}

async function updateCargoToml(newVersion: string) {
  const content = await readFile(cargoTomlPath, 'utf-8');
  const oldVersionMatch = content.match(/^version = "(.+)"$/m);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';
  const updated = content.replace(/^version = ".+"$/m, `version = "${newVersion}"`);
  await writeFile(cargoTomlPath, updated);
  console.log(`✓ Updated Cargo.toml: ${oldVersion} → ${newVersion}`);
}

async function gitCommit(version: string) {
  console.log('\nCreating git commit...');
  await $`git add ${tauriConfigPath} ${cargoTomlPath}`;
  await $`git commit -m "Bump version to ${version}"`;
  console.log(`✓ Created commit: "Bump version to ${version}"`);
}

async function gitTag(version: string) {
  const tag = `desktop-v${version}`;
  console.log(`\nCreating git tag: ${tag}`);
  await $`git tag ${tag}`;
  console.log(`✓ Created tag: ${tag}`);
  
  console.log('\nTo push the release:');
  console.log(`  git push origin main`);
  console.log(`  git push origin ${tag}`);
  console.log('\nOr push everything at once:');
  console.log(`  git push origin main ${tag}`);
}

async function checkGitStatus() {
  const result = await $`git status --porcelain`.quiet();
  const output = result.text().trim();
  
  if (output && !values['skip-commit']) {
    console.error('Error: You have uncommitted changes. Please commit or stash them first.');
    console.error('Or use --skip-commit to skip git operations.');
    process.exit(1);
  }
}

async function main() {
  console.log(`🚀 Preparing release v${version}\n`);

  try {
    // Check git status
    await checkGitStatus();

    // Get current versions and validate bump
    const currentVersions = await getCurrentVersions();
    console.log(`Current versions:`);
    console.log(`  tauri.conf.json: ${currentVersions.tauri}`);
    console.log(`  Cargo.toml: ${currentVersions.cargo}`);

    // Check version consistency
    if (currentVersions.tauri !== currentVersions.cargo) {
      console.error('\n❌ Error: Version mismatch between tauri.conf.json and Cargo.toml');
      console.error(`  tauri.conf.json: ${currentVersions.tauri}`);
      console.error(`  Cargo.toml: ${currentVersions.cargo}`);
      process.exit(1);
    }

    // Validate version bump
    const comparison = compareVersions(version, currentVersions.tauri);
    if (comparison === 0) {
      console.error(`\n❌ Error: New version (${version}) is the same as current version`);
      process.exit(1);
    } else if (comparison < 0) {
      console.error(`\n❌ Error: New version (${version}) is lower than current version (${currentVersions.tauri})`);
      console.error('Version must be bumped, not downgraded');
      process.exit(1);
    }

    console.log(`\n✓ Version bump validated: ${currentVersions.tauri} → ${version}`);

    // Update version files
    await updateTauriConfig(version);
    await updateCargoToml(version);

    // Git operations
    if (!values['skip-commit']) {
      await gitCommit(version);
    }

    if (!values['skip-tag']) {
      await gitTag(version);
    }

    console.log('\n✅ Release preparation complete!');
    
    if (values['skip-commit'] || values['skip-tag']) {
      console.log('\n⚠️  Some git operations were skipped.');
    }

    console.log('\n📋 Next steps:');
    console.log('1. Review the changes');
    console.log('2. Push to trigger the release workflow');
    console.log('3. Check GitHub Actions for the build progress');
    console.log('4. Once the draft release is created, add release notes and publish');

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();