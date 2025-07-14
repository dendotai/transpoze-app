#!/usr/bin/env bun
import { $ } from 'bun';
import { readFile } from 'fs/promises';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const tauriConfigPath = join(rootDir, 'apps/desktop/src-tauri/tauri.conf.json');

async function getCurrentVersion() {
  const content = await readFile(tauriConfigPath, 'utf-8');
  const config = JSON.parse(content);
  return config.version;
}

async function getLatestTag(version: string) {
  const expectedTag = `desktop-v${version}`;
  try {
    // Check if the tag exists locally
    await $`git rev-parse ${expectedTag}`.quiet();
    return expectedTag;
  } catch {
    return null;
  }
}

async function isTagPushed(tag: string) {
  try {
    // Check if tag exists on remote
    await $`git ls-remote origin refs/tags/${tag}`.quiet();
    return true;
  } catch {
    return false;
  }
}

async function checkUnpushedCommits() {
  try {
    const result = await $`git log origin/main..HEAD --oneline`.quiet();
    const commits = result.text().trim();
    return commits ? commits.split('\n') : [];
  } catch {
    return [];
  }
}

async function getGitHubUrl() {
  try {
    const result = await $`git remote get-url origin`.quiet();
    const url = result.text().trim();
    
    // Convert git URL to HTTPS URL
    if (url.startsWith('git@github.com:')) {
      return url.replace('git@github.com:', 'https://github.com/').replace('.git', '');
    } else if (url.startsWith('https://github.com/')) {
      return url.replace('.git', '');
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  try {
    const version = await getCurrentVersion();
    const tag = await getLatestTag(version);
    const repoUrl = await getGitHubUrl();
    
    console.log(`📦 Release Information:`);
    console.log(`  Version: ${version}`);
    console.log(`  Tag: ${tag || 'Not found'}`);
    
    if (!tag) {
      console.error(`\n❌ Error: Tag desktop-v${version} not found`);
      console.error(`Run 'make prepare-release ${version}' first`);
      process.exit(1);
    }
    
    // Check if tag is already pushed
    const tagPushed = await isTagPushed(tag);
    if (tagPushed) {
      console.log(`\n✅ Release ${tag} has already been pushed!`);
      if (repoUrl) {
        console.log(`\n🔗 View release: ${repoUrl}/releases/tag/${tag}`);
        console.log(`📦 Download artifacts: ${repoUrl}/actions`);
      }
      process.exit(0);
    }
    
    // Check for unpushed commits
    const unpushedCommits = await checkUnpushedCommits();
    if (unpushedCommits.length > 0) {
      console.log(`\n📝 Unpushed commits:`);
      unpushedCommits.forEach(commit => console.log(`  ${commit}`));
    }
    
    // Confirm with user
    console.log(`\n🚀 This will push:`);
    console.log(`  - Current branch to origin/main`);
    console.log(`  - Tag ${tag} to trigger the release workflow`);
    console.log(`\n⚠️  This action cannot be undone!`);
    
    const response = prompt('\nContinue? (y/N): ');
    
    if (response?.toLowerCase() !== 'y') {
      console.log('❌ Release cancelled');
      process.exit(0);
    }
    
    // Push everything
    console.log('\n🚀 Pushing release...');
    await $`git push origin main ${tag}`;
    
    console.log('\n✅ Release pushed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Check GitHub Actions for the build progress');
    console.log('2. Once the draft release is created, add release notes');
    console.log('3. Publish the release on GitHub');
    
    if (repoUrl) {
      console.log(`\n🔗 ${repoUrl}/releases/tag/${tag}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();