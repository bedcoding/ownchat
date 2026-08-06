import type Anthropic from '@anthropic-ai/sdk';
import type { AiEvent, AskOptions } from './types';

/** SDK 네임스페이스 (에러 클래스 비교에 쓴다). 값은 동적 import 로만 들어온다 */
type Sdk = typeof import('@anthropic-ai/sdk').default;

/**
 * 본인 API 키 경로 — 브라우저가 api.anthropic.com 을 직접 호출한다.
 *
 * `dangerouslyAllowBrowser` 는 SDK 가 브라우저에서 동작하게 여는 스위치이고, 내부적으로
 * `anthropic-dangerous-direct-browser-access` 헤더를 붙여 CORS 를 통과한다. "dangerous" 는
 * **서비스 운영자의 키를 프런트에 심는 경우**를 경고하는 이름이고, 사용자가 자기 키를 넣는
 * BYOK 는 Anthropic 이 이 옵션의 의도된 용례로 문서화한 형태다.
 *
 * 키는 이 브라우저 밖으로 나가지 않는다. 이 저장소의 서버로도 전송되지 않는다.
 *
 * 폰에서 심문 노드를 켤 수 있는 유일한 경로가 이것이다 — 모바일 웹에서는 사용자 PC 의
 * Claude Code 에 닿을 방법이 없다(로컬 브리지는 그 기기 안에서만 유효하다).
 */

/**
 * 안전 분류기 거절(`stop_reason: "refusal"`)은 다른 모델로 조용히 넘기지 않고 그대로 알린다.
 *
 * 저작 도구에서는 그게 옳다 — 관리자는 "왜 이 회차만 품질이 다른가"를 겪는 대신
 * "이 소재가 거절됐다"를 알고 설정을 고쳐야 한다. 추리물처럼 범죄를 소재로 하는 작품에서
 * 실제로 마주칠 수 있는 상황이라, 서버측 폴백 대신 명시적인 안내를 택했다.
 */
function friendlyError(Anthropic: Sdk, e: unknown): { message: string; hint: string | null } {
  if (e instanceof Anthropic.AuthenticationError) {
    return { message: 'API 키가 유효하지 않습니다.', hint: 'console.anthropic.com 에서 키를 다시 확인하세요.' };
  }
  if (e instanceof Anthropic.PermissionDeniedError) {
    return { message: '이 키로는 해당 모델을 쓸 수 없습니다.', hint: '다른 모델을 고르거나 조직 권한을 확인하세요.' };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { message: '요청이 너무 잦습니다 (rate limit).', hint: '잠시 뒤 다시 시도하세요.' };
  }
  if (e instanceof Anthropic.NotFoundError) {
    return { message: '모델을 찾을 수 없습니다.', hint: '모델 id 가 오래됐을 수 있습니다.' };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return {
      message: 'api.anthropic.com 에 연결하지 못했습니다.',
      hint: '네트워크 또는 확장 프로그램이 요청을 막고 있을 수 있습니다.',
    };
  }
  if (e instanceof Anthropic.APIError) {
    return { message: `API 오류 ${e.status ?? ''}: ${e.message}`.trim(), hint: null };
  }
  return { message: (e as Error)?.message ?? '알 수 없는 오류', hint: null };
}

export async function* askApiKey(
  opts: AskOptions & { apiKey: string; model: string },
): AsyncGenerator<AiEvent> {
  /*
   * SDK 는 여기서만 필요하므로 동적으로 불러온다. 심문 노드가 없는 작품만 하는 사용자는
   * 이 청크를 아예 받지 않는다 — 그 사람들에게 이 게임은 오프라인 정적 페이지다.
   */
  let Anthropic: Sdk;
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
  } catch {
    yield { type: 'error', message: 'AI 모듈을 불러오지 못했습니다.', hint: '네트워크를 확인하고 다시 시도하세요.' };
    return;
  }

  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });

  const messages: Anthropic.MessageParam[] = [
    ...(opts.history ?? []).map((turn) => ({ role: turn.role, content: turn.text })),
    { role: 'user' as const, content: opts.prompt },
  ];

  let sawText = false;
  try {
    // 트리 초안은 출력이 길어질 수 있어 스트리밍으로 받는다 — HTTP 타임아웃을 피하고,
    // 관리자 화면에 진행 상황을 흘려 보여줄 수 있다.
    const stream = client.messages.stream(
      {
        model: opts.model,
        max_tokens: opts.maxTokens ?? 32_000,
        system: opts.system,
        messages,
      },
      { signal: opts.signal },
    );

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;
      if (event.delta.type === 'text_delta' && event.delta.text) {
        sawText = true;
        yield { type: 'delta', text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();

    if (final.stop_reason === 'refusal') {
      yield {
        type: 'error',
        message: '안전 정책에 따라 이 요청에는 답하지 않았습니다.',
        hint: sawText
          ? '일부만 생성된 결과는 완결된 트리가 아닙니다. 설정 문구를 바꿔 다시 시도하세요.'
          : '소재나 표현을 바꿔 다시 시도하세요.',
      };
      return;
    }
    if (final.stop_reason === 'max_tokens') {
      yield {
        type: 'error',
        message: '출력이 길이 제한에 걸려 잘렸습니다.',
        hint: '회차를 더 작게 나누어 요청하세요 (노드 수를 줄이거나 한 화씩).',
      };
    }
  } catch (e) {
    if (opts.signal.aborted) return;
    const { message, hint } = friendlyError(Anthropic, e);
    yield { type: 'error', message, hint };
  }
}
