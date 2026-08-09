import type { SendOptions, StreamEvent } from '../types';

interface OpenAIEvent {
  type?: string;
  delta?: string;
  message?: string;
  response?: {
    id?: string;
    model?: string;
    error?: { message?: string } | null;
    usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
  };
  error?: { message?: string };
}

async function errorFrom(response: Response): Promise<{ message: string; hint?: string }> {
  let detail = '';
  try {
    const body = (await response.json()) as { message?: string; error?: { message?: string } | string };
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message ?? '';
  } catch {
    // 응답이 HTML이어도 상태 코드만으로 안내할 수 있다.
  }
  if (response.status === 401 || response.status === 403) {
    return { message: '데모 접근 코드가 올바르지 않습니다.', hint: '공모전 안내에 적힌 코드를 확인하세요.' };
  }
  if (response.status === 429) {
    return { message: '데모 요청 한도에 도달했습니다.', hint: '잠시 뒤 다시 시도하세요.' };
  }
  return { message: detail || `OpenAI 데모 서버 오류 (${response.status})` };
}

function parseEventBlock(block: string): OpenAIEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try {
    return JSON.parse(data) as OpenAIEvent;
  } catch {
    return null;
  }
}

/** 서버가 보관한 OpenAI 키를 쓰는 공모전 데모 공급자. 브라우저에는 키가 내려오지 않는다. */
export async function* streamOpenAI(
  opts: SendOptions & { demoToken: string },
): AsyncGenerator<StreamEvent> {
  let response: Response;
  try {
    response = await fetch('/api/openai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.demoToken ? { Authorization: `Bearer ${opts.demoToken}` } : {}),
      },
      body: JSON.stringify({
        message: opts.message,
        model: opts.model,
        history: opts.history,
        instructions: opts.instructions,
        maxOutputTokens: opts.maxOutputTokens,
      }),
      signal: opts.signal,
    });
  } catch (error) {
    if (opts.signal.aborted) return;
    yield { type: 'error', message: (error as Error).message || '데모 서버에 연결하지 못했습니다.' };
    return;
  }

  if (!response.ok || !response.body) {
    const error = await errorFrom(response);
    yield { type: 'error', ...error };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let completed = false;

  const emit = (event: OpenAIEvent): StreamEvent | null => {
    if (event.type === 'response.created') {
      return { type: 'meta', model: event.response?.model ?? opts.model };
    }
    if (event.type === 'response.output_text.delta' && event.delta) {
      return { type: 'delta', text: event.delta };
    }
    if (event.type === 'response.completed') {
      completed = true;
      const usage = event.response?.usage;
      return {
        type: 'done',
        usage: usage
          ? {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    }
    if (event.type === 'response.failed' || event.type === 'error') {
      completed = true;
      return {
        type: 'error',
        message: event.response?.error?.message ?? event.error?.message ?? event.message ?? 'OpenAI 응답 생성에 실패했습니다.',
      };
    }
    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = done ? '' : (blocks.pop() ?? '');
      for (const block of blocks) {
        const event = parseEventBlock(block);
        if (!event) continue;
        const mapped = emit(event);
        if (mapped) yield mapped;
      }
      if (done) break;
    }
    if (!completed) yield { type: 'error', message: 'OpenAI 스트림이 완료 신호 없이 끝났습니다.' };
  } catch (error) {
    if (!opts.signal.aborted) yield { type: 'error', message: (error as Error).message || '응답 수신에 실패했습니다.' };
  } finally {
    reader.releaseLock();
  }
}
