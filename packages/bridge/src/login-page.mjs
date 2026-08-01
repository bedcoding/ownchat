/**
 * 로그인 코드를 입력받는 페이지는 브리지가 직접 서빙한다.
 *
 * 채팅 UI(우리 도메인)에서 코드를 받지 않는 이유: 그 코드는 계정 접근으로 교환되는 값이다.
 * 우리 페이지에 XSS가 하나라도 나면 사용자 계정이 넘어간다. 코드가 오가는 화면을
 * 127.0.0.1(공식 CLI를 띄운 그 프로세스)이 직접 그리면, 우리 도메인은 그 값을 볼 방법이 없다.
 */

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLoginPage({ flow, loggedIn }) {
  const active = flow.state === 'awaiting_code' || flow.state === 'finishing';
  const url = flow.url ? escapeHtml(flow.url) : null;
  const nonce = active && flow.nonce ? escapeHtml(flow.nonce) : '';

  const body = loggedIn
    ? `<p class="ok">이미 로그인되어 있습니다. 이 창은 닫아도 됩니다.</p>`
    : active
      ? `
        <ol>
          <li>열린 브라우저 창에서 Claude 계정으로 로그인합니다.
            ${url ? `<br><a href="${url}" target="_blank" rel="noopener noreferrer">창이 안 열렸다면 여기를 누르세요</a>` : ''}
          </li>
          <li>로그인이 끝나면 화면에 <b>코드</b>가 나옵니다. 그걸 아래에 붙여넣으세요.</li>
        </ol>
        <form id="f">
          <input id="code" type="text" placeholder="브라우저에 표시된 코드" autocomplete="off" spellcheck="false" autofocus>
          <button type="submit">연결</button>
        </form>
        <p id="msg"></p>`
      : `<p class="warn">진행 중인 로그인이 없습니다. 채팅 화면에서 <b>로그인</b> 버튼을 다시 눌러 주세요.</p>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>Claude 로그인 — ownchat bridge</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1c1b19;--dim:#6b6a65;--line:#e3e2dd;--accent:#b4623a;--ok:#2f7a4d;--warn:#a8741a}
@media(prefers-color-scheme:dark){:root{--bg:#17171a;--fg:#ececf0;--dim:#9a9aa4;--line:#32323a;--accent:#e08b5f;--ok:#6ec48f;--warn:#d9a441}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
background:var(--bg);color:var(--fg);font:15px/1.6 system-ui,-apple-system,"Segoe UI","Malgun Gothic",sans-serif}
.card{width:min(520px,100%);border:1px solid var(--line);border-radius:14px;padding:24px}
h1{font-size:17px;margin:0 0 4px}
.sub{color:var(--dim);font-size:13px;margin:0 0 18px}
ol{padding-left:20px;margin:0 0 16px}li{margin-bottom:8px}
a{color:var(--accent)}
form{display:flex;gap:8px}
input{flex:1;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;
font-family:ui-monospace,Consolas,monospace;font-size:13px}
button{padding:9px 16px;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:8px;cursor:pointer;font:inherit}
button:disabled{opacity:.5;cursor:default}
.ok{color:var(--ok)}.warn{color:var(--warn)}
#msg{font-size:13px;color:var(--dim);min-height:1.4em;margin:12px 0 0}
.foot{margin:18px 0 0;padding-top:14px;border-top:1px solid var(--line);color:var(--dim);font-size:12.5px}
</style></head>
<body><main class="card">
<h1>Claude 로그인</h1>
<p class="sub">이 페이지는 내 PC의 브리지가 직접 띄운 화면입니다. 입력한 코드는 이 컴퓨터 밖으로 나가지 않습니다.</p>
${body}
<p class="foot">로그인 처리는 공식 Claude Code CLI가 합니다. 브리지는 발급된 토큰을 저장하지도, 읽지도 않습니다.</p>
</main>
<script>
(() => {
  const nonce = ${JSON.stringify(nonce)};
  if (!nonce) return;
  const form = document.getElementById('f');
  const input = document.getElementById('code');
  const msg = document.getElementById('msg');
  const button = form.querySelector('button');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    button.disabled = true;
    msg.textContent = '연결 중…';
    try {
      const res = await fetch('/login/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, code }),
      });
      const data = await res.json();
      if (!data.ok) { msg.textContent = data.message || '실패했습니다.'; button.disabled = false; }
    } catch (err) {
      msg.textContent = '브리지에 연결하지 못했습니다.';
      button.disabled = false;
    }
  });

  const poll = setInterval(async () => {
    try {
      const res = await fetch('/login/state?n=' + encodeURIComponent(nonce), { cache: 'no-store' });
      const data = await res.json();
      if (data.loggedIn) {
        clearInterval(poll);
        msg.textContent = '';
        document.querySelector('.card').innerHTML =
          '<h1>로그인 완료</h1><p class="ok">이 창은 닫고 채팅 화면으로 돌아가세요.</p>';
      } else if (data.state === 'error') {
        clearInterval(poll);
        msg.textContent = data.error || '로그인에 실패했습니다.';
        button.disabled = false;
      }
    } catch (err) { /* 브리지가 잠깐 바쁠 수 있다 */ }
  }, 1500);
})();
</script>
</body></html>`;
}
