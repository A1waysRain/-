#!/usr/bin/env node
// Build an arm64 APK that contains the local game server, browser client and locally downloaded art.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache', 'android');
const runtimeVersion = '18.20.4';
const tarball = path.join(cache, `nodejs-mobile-react-native-${runtimeVersion}.tgz`);
const nodeLibrary = path.join(cache, 'jniLibs', 'arm64-v8a', 'libnode.so');
const nodeHeader = path.join(cache, 'include', 'node.h');
const apk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function requireFile(file, hint) {
  if (!fs.existsSync(file)) throw new Error(`${hint}: ${file}`);
}

function stageRuntime() {
  if (fs.existsSync(nodeLibrary) && fs.existsSync(nodeHeader)) return;
  fs.mkdirSync(cache, { recursive: true });
  if (!fs.existsSync(tarball)) {
    run('npm', ['pack', `nodejs-mobile-react-native@${runtimeVersion}`, '--pack-destination', cache, '--silent']);
  }
  const libs = path.dirname(nodeLibrary);
  const headers = path.dirname(nodeHeader);
  fs.mkdirSync(libs, { recursive: true });
  fs.mkdirSync(headers, { recursive: true });
  run('tar', ['-xzf', tarball, '-C', libs, '--strip-components=5',
    'package/android/libnode/bin/arm64-v8a/libnode.so']);
  run('tar', ['-xzf', tarball, '-C', headers, '--strip-components=5',
    'package/android/libnode/include/node']);
  requireFile(nodeLibrary, '缺少 Android Node 运行库');
  requireFile(nodeHeader, '缺少 Android Node 头文件');
}

function main() {
  if (process.argv.slice(2).some((arg) => !['--prepare-only'].includes(arg))) {
    throw new Error('Usage: node android/build-android.mjs [--prepare-only]');
  }
  requireFile(path.join(root, 'node_modules', 'ws', 'package.json'), '请先运行 npm ci');
  requireFile(path.join(root, 'public', 'vendor', 'preact.module.js'), '请先运行 npm run vendor');
  requireFile(path.join(root, 'public', 'assets', 'audio', 'bgm', 'm_sys_act1autochess_loop.mp3'), '请先运行 npm run setup 下载素材');
  requireFile(path.join(root, 'public', 'fonts', 'fonts.css'), '请先运行 npm run setup 准备字体');
  stageRuntime();
  if (process.argv.includes('--prepare-only')) {
    console.log('Android Node 运行库已准备好。');
    return;
  }
  const gradle = process.env.GRADLE_CMD || 'gradle';
  run(gradle, ['--no-daemon', ':app:assembleDebug'], path.join(root, 'android'));
  requireFile(apk, 'Android 构建没有产生 APK');
  console.log(`\n可安装 APK：${apk}`);
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
