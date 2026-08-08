import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const ALLOWED_MODELS = new Set(['gpt-5.4-mini', 'gpt-5.4-nano']);
const DEFAULT_MODEL = ALLOWED_MODELS.has(process.env.OPENAI_MODEL ?? '')
  ? (process.env.OPENAI_MODEL as string)
  : 'gpt-5.4-mini';
const MAX_BODY_BYTES = 256_000;
const MAX_MESSAGE_CHARS = 60_000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_HISTORY_CHARS = 40_000;
const MAX_OUTPUT_TOKENS = 2_048;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = Math.max(1, Number(process.env.OWNCHAT_RATE_LIMIT ?? 30) || 30);
const DAILY_TOKEN_BUDGET = Math.max(1, Number(process.env.OWNCHAT_DAILY_TOKEN_BUDGET ?? 2_000_000) || 2_000_000);

interface HistoryMessage {
  role?: unknown;
  text?: unknown;
  error?: unknown;
}

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateEntries = new Map<string, RateEntry>();
let dailyBudget = { day: '', reservedTokens: 0 };

function json(status: number, body: object): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function secretMatches(expected: string, provided: string): boolean {
  const expectedHash = createHash('sha256').update(expected).digest();
  const providedHash = createHash('sha256').update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

function bearer(request: NextRequest): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? '';
}

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const current = rateEntries.get(key);
  if (!current || current.resetAt <= now) {
    rateEntries.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateEntries.size > 2_000) {
      for (const [entryKey, entry] of rateEntries) {
        if (entry.resetAt <= now) rateEntries.delete(entryKey);
      }
    }
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

async function readLimitedBody(request: NextRequest): Promise<string | null> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return null;
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      result += decoder.decode(value, { stream: true });
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function reserveDailyTokens(characters: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (dailyBudget.day !== day) dailyBudget = { day, reservedTokens: 0 };
  // 한국어와 코드도 넉넉히 잡도록 1글자를 최대 2토큰으로 추정하고 최대 출력을 더한다.
  const estimate = characters * 2 + MAX_OUTPUT_TOKENS;
  if (dailyBudget.reservedTokens + estimate > DAILY_TOKEN_BUDGET) return false;
  dailyBudget.reservedTokens += estimate;
  return true;
}

function sanitizeHistory(history: unknown): Array<{ role: 'user' | 'assistant'; content: string }> | null {
  if (!Array.isArray(history)) return [];
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let characters = 0;
  for (const item of history.slice(-MAX_HISTORY_MESSAGES) as HistoryMessage[]) {
    if (item?.error) continue;
    if (item?.role !== 'user' && item?.role !== 'assistant') continue;
    if (typeof item.text !== 'string' || !item.text.trim()) continue;
    characters += item.text.length;
    if (characters > MAX_HISTORY_CHARS) return null;
    result.push({ role: item.role, content: item.text });
  }
  return result;
}

export async function POST(request: NextRequest): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
  const demoToken = process.env.OWNCHAT_DEMO_TOKEN?.trim() ?? '';
  if (!apiKey || !demoToken) {
    return json(503, {
      error: 'server_not_configured',
      message: '서버에 OPENAI_API_KEY와 OWNCHAT_DEMO_TOKEN을 설정해야 합니다.',
    });
  }
  if (!secretMatches(demoToken, bearer(request))) {
    return json(401, { error: 'unauthorized', message: '데모 접근 코드가 올바르지 않습니다.' });
  }
  if (rateLimited(clientKey(request))) {
    return json(429, { error: 'rate_limited', message: '10분 요청 한도를 넘었습니다.' });
  }

  const raw = await readLimitedBody(request);
  if (raw === null) return json(413, { error: 'body_too_large', message: '요청이 너무 큽니다.' });

  let body: { message?: unknown; model?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw || '{}') as typeof body;
  } catch {
    return json(400, { error: 'bad_json', message: '요청 본문이 JSON이 아닙니다.' });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(400, { error: 'empty_message', message: '메시지가 비어 있습니다.' });
  if (message.length > MAX_MESSAGE_CHARS) {
    return json(413, { error: 'message_too_long', message: `메시지는 ${MAX_MESSAGE_CHARS}자까지입니다.` });
  }
  const history = sanitizeHistory(body.history);
  if (!history) return json(413, { error: 'history_too_large', message: '대화 이력이 너무 큽니다. 새 대화를 시작하세요.' });

  const requestedModel = typeof body.model === 'string' ? body.model : '';
  const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : DEFAULT_MODEL;
  const inputCharacters = history.reduce((total, item) => total + item.content.length, message.length);
  if (!reserveDailyTokens(inputCharacters)) {
    return json(429, {
      error: 'daily_budget_exhausted',
      message: '오늘의 데모 토큰 예산을 모두 사용했습니다. 내일 다시 시도하세요.',
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: [
          '너는 일반 채팅 어시스턴트다.',
          '한국어로 물으면 한국어로 답한다.',
          '결론을 먼저 말하고 질문 크기에 맞는 길이로 답한다.',
          '확실하지 않은 내용은 추측이라고 분명히 밝힌다.',
        ].join('\n'),
        input: [...history, { role: 'user', content: message }],
        reasoning: { effort: 'none' },
        text: { verbosity: 'medium' },
        max_output_tokens: MAX_OUTPUT_TOKENS,
        store: false,
        stream: true,
      }),
      signal: request.signal,
    });
  } catch (error) {
    return json(502, { error: 'openai_unreachable', message: (error as Error).message || 'OpenAI에 연결하지 못했습니다.' });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    let message =
      upstream.status === 401 || upstream.status === 403
        ? '데모 서버의 OpenAI 인증 설정을 확인해야 합니다.'
        : `OpenAI API 오류 (${upstream.status})`;
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      if (upstream.status !== 401 && upstream.status !== 403) message = parsed.error?.message || message;
    } catch {
      // OpenAI가 JSON이 아닌 응답을 보내도 내부 본문은 브라우저에 그대로 노출하지 않는다.
    }
    return json(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502, {
      error: 'openai_error',
      message,
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
