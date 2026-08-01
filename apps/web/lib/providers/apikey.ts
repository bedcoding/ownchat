import Anthropic from '@anthropic-ai/sdk';
import { modelInfo } from '../models';
import type { Message, SendOptions, StreamEvent } from '../types';

/**
 * BYOK(Bring Your Own Key) 공급자.
 *
 * 사용자가 console.anthropic.com에서 발급한 본인 키로 브라우저가 api.anthropic.com을
 * 직접 호출한다. `dangerouslyAllowBrowser`는 SDK가 브라우저에서 동작하도록 여는 스위치이고,
 * 내부적으로 `anthropic-dangerous-direct-browser-access` 헤더를 붙여 CORS를 통과한다.
 * "dangerous"라는 이름은 서비스 운영자의 키를 프런트에 심는 경우를 경고하는 것이고,
 * 사용자가 자기 키를 넣는 BYOK는 Anthropic이 이 옵션의 의도된 용례로 문서화한 형태다.
 *
 * 키는 이 브라우저 밖으로 나가지 않는다. 우리 서버로도 전송되지 않는다.
 */

const SYSTEM_PROMPT = [
  '너는 일반 채팅 어시스턴트다.',
  '한국어로 물으면 한국어로 답한다.',
  '답의 길이는 질문의 크기에 맞춘다. 간단한 질문에 머리말·목차·요약을 덧붙이지 마라.',
  '확실하지 않은 것은 확실하지 않다고 말한다. 그럴듯한 추측을 사실처럼 쓰지 마라.',
  '결론을 먼저 쓰고 근거를 뒤에 쓴다.',
].join('\n');

const MAX_TOKENS = 64_000;

type StreamParams = Parameters<Anthropic['messages']['stream']>[0];
type BetaStreamParams = Parameters<Anthropic['beta']['messages']['stream']>[0];

/** 두 스트림(정식/beta)이 공통으로 갖는 최소 형태 */
interface MinimalStream {
  [Symbol.asyncIterator](): AsyncIterator<unknown>;
  finalMessage(): Promise<{ content: unknown[]; stop_reason: string | null; stop_details?: unknown }>;
}

function toApiMessages(history: Message[], nextUserText: string): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const m of history) {
    // 실패한 턴은 이력에서 뺀다. 같은 역할이 연속되어도 API가 하나의 턴으로 합쳐준다.
    if (m.error) continue;
    if (m.role === 'user') {
      if (m.text) messages.push({ role: 'user', content: m.text });
    } else if (m.raw && m.raw.length > 0) {
      // thinking 블록은 편집하지 않고 받은 그대로 돌려줘야 API가 받아준다.
      messages.push({ role: 'assistant', content: m.raw as Anthropic.ContentBlockParam[] });
    } else if (m.text) {
      messages.push({ role: 'assistant', content: m.text });
    }
  }
  messages.push({ role: 'user', content: nextUserText });
  return messages;
}

function friendlyError(e: unknown): { message: string; hint?: string | null } {
  if (e instanceof Anthropic.AuthenticationError) {
    return { message: 'API 키가 유효하지 않습니다.', hint: 'console.anthropic.com에서 키를 다시 확인하세요.' };
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return { message: '이 키로는 해당 모델을 쓸 수 없습니다.', hint: '다른 모델을 고르거나 조직 권한을 확인하세요.' };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { message: '요청이 너무 잦습니다 (rate limit).', hint: '잠시 뒤 다시 시도하세요.' };
  }
  if (e instanceof Anthropic.NotFoundError) {
    return { message: '모델을 찾을 수 없습니다.', hint: '모델 목록이 오래됐을 수 있습니다.' };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return {
      message: 'api.anthropic.com에 연결하지 못했습니다.',
      hint: '네트워크 또는 확장 프로그램이 요청을 막고 있을 수 있습니다.',
    };
  }
  if (e instanceof Anthropic.APIError) {
    return { message: `API 오류 ${e.status ?? ''}: ${e.message}`.trim(), hint: null };
  }
  return { message: (e as Error)?.message ?? '알 수 없는 오류', hint: null };
}

/** beta 파라미터(fallbacks 등)를 이 계정/SDK가 못 받는 경우를 구분한다 */
function isBetaParamRejection(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  if (e.status !== 400 && e.status !== 404) return false;
  return /fallback|beta|unknown|unsupported|unexpected/i.test(e.message ?? '');
}

export async function* streamApiKey(opts: SendOptions & { apiKey: string }): AsyncGenerator<StreamEvent> {
  const info = modelInfo(opts.model);
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });

  const base: Record<string, unknown> = {
    model: opts.model,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: toApiMessages(opts.history, opts.message),
  };
  // Haiku 4.5는 adaptive thinking을 지원하지 않으므로 파라미터를 아예 넣지 않는다.
  if (info.adaptiveThinking) base.thinking = { type: 'adaptive', display: 'summarized' };

  const openStream = (withFallback: boolean): MinimalStream => {
    if (withFallback) {
      // 안전 분류기가 요청을 거절하면 API가 같은 호출 안에서 다른 모델로 재실행한다.
      // 어떤 모델로 넘길지는 거절 사유에 따라 서버가 고른다("default").
      const params = {
        ...base,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      } as unknown as BetaStreamParams;
      return client.beta.messages.stream(params, { signal: opts.signal }) as unknown as MinimalStream;
    }
    return client.messages.stream(base as unknown as StreamParams, { signal: opts.signal }) as unknown as MinimalStream;
  };

  let useFallback = info.serverFallback;
  let stream: MinimalStream;
  try {
    stream = openStream(useFallback);
  } catch (e) {
    if (useFallback && isBetaParamRejection(e)) {
      useFallback = false;
      stream = openStream(false);
    } else {
      const { message, hint } = friendlyError(e);
      yield { type: 'error', message, hint };
      return;
    }
  }

  yield { type: 'meta', model: opts.model };

  let sawAny = false;
  try {
    for await (const raw of stream) {
      const event = raw as { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
      if (event.type !== 'content_block_delta' || !event.delta) continue;
      if (event.delta.type === 'text_delta' && event.delta.text) {
        sawAny = true;
        yield { type: 'delta', text: event.delta.text };
      } else if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
        yield { type: 'thinking', text: event.delta.thinking };
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason === 'refusal') {
      yield {
        type: 'error',
        message: '안전 정책에 따라 이 요청에는 답하지 않았습니다.',
        hint: sawAny ? '일부만 생성된 응답은 완결된 답이 아닙니다.' : '질문을 다르게 표현해 보세요.',
      };
      return;
    }

    yield { type: 'done', raw: final.content };
  } catch (e) {
    if (opts.signal.aborted) return;
    // 스트림을 여는 데는 성공했지만 beta 파라미터를 서버가 늦게 거부한 경우
    if (useFallback && isBetaParamRejection(e)) {
      useFallback = false;
      try {
        const retry = openStream(false);
        for await (const raw of retry) {
          const event = raw as { type?: string; delta?: { type?: string; text?: string; thinking?: string } };
          if (event.type !== 'content_block_delta' || !event.delta) continue;
          if (event.delta.type === 'text_delta' && event.delta.text) yield { type: 'delta', text: event.delta.text };
          else if (event.delta.type === 'thinking_delta' && event.delta.thinking)
            yield { type: 'thinking', text: event.delta.thinking };
        }
        const final = await retry.finalMessage();
        yield { type: 'done', raw: final.content };
        return;
      } catch (retryError) {
        const { message, hint } = friendlyError(retryError);
        yield { type: 'error', message, hint };
        return;
      }
    }
    const { message, hint } = friendlyError(e);
    yield { type: 'error', message, hint };
  }
}
