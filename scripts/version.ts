#!/usr/bin/env bun
import { readFile } from 'fs/promises';
import { join } from 'path';
import { $ } from 'bun';

const rootDir = join(import.meta.dir, '..');
const tauriConfigPath = join(rootDir, 'apps/desktop/src-tauri/tauri.conf.json');
const cargoTomlPath = join(rootDir, 'apps/desktop/src-tauri/Cargo.toml');

async function getVersions() {
  // Read tauri.conf.json
  const tauriContent = await readFile(tauriConfigPath, 'utf-8');
  const tauriConfig = JSON.parse(tauriContent);
  
  // Read Cargo.toml
  const cargoContent = await readFile(cargoTomlPath, 'utf-8');
  const cargoVersionMatch = cargoContent.match(/^version = "(.+)"$/m);
  const cargoVersion = cargoVersionMatch ? cargoVersionMatch[1] : null;
  
  // Get latest desktop git tag
  let latestTag = null;
  try {
    const result = await $`git tag -l desktop-v* --sort=-version:refname | head -1`.quiet();
    const tag = result.text().trim();
    if (tag) {
      latestTag = tag.replace('desktop-v', '');
    }
  } catch {
    // No tags found or git not available
  }
  
  return {
    tauri: tauriConfig.version,
    cargo: cargoVersion,
    latestTag,
  };
}

async function main() {
  try {
    const versions = await getVersions();
    
    if (versions.tauri !== versions.cargo) {
      console.error(`❌ Version mismatch detected:`);
      console.error(`  tauri.conf.json: ${versions.tauri}`);
      console.error(`  Cargo.toml: ${versions.cargo}`);
      process.exit(1);
    }
    
    console.log(`Current version: ${versions.tauri}`);
    if (versions.latestTag) {
      console.log(`Latest git tag: ${versions.latestTag}`);
      
      // Check if current version matches latest tag
      if (versions.tauri === versions.latestTag) {
        console.log(`✓ Version matches latest tag`);
      } else {
        console.log(`⚠️  Version differs from latest tag`);
      }
    } else {
      console.log(`No git tags found`);
    }
  } catch (error) {
    console.error('Error reading version:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();