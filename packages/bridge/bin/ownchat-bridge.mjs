#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.mjs';
import { resolveCli } from '../src/claude-cli.mjs';
import { createServer } from '../src/server.mjs';
import { formatForDisplay, loadOrCreateToken } from '../src/token.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

function line(label, value) {
  return `  ${label.padEnd(14)} ${value}`;
}

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  if (config.help) {
    console.log(config.usage);
    return;
  }

  const token = loadOrCreateToken(config.home, { reset: config.resetToken });

  if (config.printToken) {
    console.log(token);
    return;
  }

  const server = createServer({ config, token, version: pkg.version });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(
        `포트 ${config.port}가 이미 사용 중입니다.\n` +
          `브리지가 이미 켜져 있는지 확인하거나 --port 로 다른 포트를 지정하세요.`,
      );
      process.exit(1);
    }
    console.error(`브리지를 시작하지 못했습니다: ${e.message}`);
    process.exit(1);
  });

  // 0.0.0.0이 아니라 루프백에만 바인딩한다. 같은 네트워크의 다른 기기는 접근할 수 없다.
  server.listen(config.port, '127.0.0.1', async () => {
    const cli = await resolveCli(config.cliCmd);

    console.log('');
    console.log(`  ownchat-bridge v${pkg.version}`);
    console.log('  ─────────────────────────────────────────────');
    console.log(line('주소', `http://127.0.0.1:${config.port}`));
    console.log(line('페어링 코드', formatForDisplay(token)));
    console.log(line('작업 폴더', config.workspace));
    console.log(line('기본 모델', config.defaultModel));
    console.log(line('웹 도구', config.allowWebTools ? '켜짐 (검색·페이지 읽기)' : '꺼짐'));
    console.log(line('허용 오리진', [...config.origins].join(', ')));
    console.log('');

    if (cli) {
      console.log(line('Claude Code', `${cli.version}  (${cli.cmd})`));
      console.log('');
      console.log('  이 페어링 코드를 채팅 UI의 설정에 붙여넣으면 연결됩니다.');
      console.log('  요청은 이 PC의 Claude Code가 보내며, 로그인 정보는 이 프로그램을 통과하지 않습니다.');
    } else {
      console.log('  ⚠ Claude Code를 찾지 못했습니다.');
      console.log('     1) npm install -g @anthropic-ai/claude-code');
      console.log('     2) 터미널에서 `claude` 를 한 번 실행해 로그인');
      console.log('     설치했는데도 안 잡히면 --cli <claude 전체 경로> 로 실행하세요.');
    }
    console.log('');
    console.log('  종료: Ctrl+C');
    console.log('');
  });

  const shutdown = () => {
    console.log('\n브리지를 종료합니다.');
    server.close(() => process.exit(0));
    // 진행 중인 SSE 연결이 남아 close 콜백이 늦어질 수 있다. 여유를 준 뒤 강제 종료한다.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
