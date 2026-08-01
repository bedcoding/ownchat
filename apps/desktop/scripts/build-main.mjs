import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 메인 프로세스를 한 파일로 번들한다.
 *
 * 왜 번들하는가: 이걸 안 하면 apps/desktop 이 `@ownchat/core` 를 런타임 의존성으로
 * 갖게 되고, electron-builder가 "installing production dependencies" 단계에서 워크스페이스
 * 심볼릭 링크를 풀려고 루트 node_modules를 다시 설치한다. 그 과정에서 electron-builder가
 * 자기 실행 바이너리(app-builder-bin)를 지워 버려 패키징이 실패한다.
 *
 * 번들하면 앱의 프로덕션 의존성이 0이 되어 그 단계 자체가 사라진다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..');
const OUT_DIR = path.join(APP_DIR, 'build');

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(APP_DIR, 'src', 'main.mjs')],
  outfile: path.join(OUT_DIR, 'main.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // electron은 런타임이 제공한다. 번들에 넣으면 안 된다.
  external: ['electron'],
  sourcemap: true,
  logLevel: 'info',
});

// 프리로드는 sandbox:true 때문에 CommonJS여야 하고, 의존성이 없어 번들할 필요가 없다.
fs.copyFileSync(path.join(APP_DIR, 'src', 'preload.cjs'), path.join(OUT_DIR, 'preload.cjs'));

console.log(`메인 프로세스 번들 완료 → ${path.relative(process.cwd(), OUT_DIR)}`);
