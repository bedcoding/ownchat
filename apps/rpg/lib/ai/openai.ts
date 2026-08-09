import { DEFAULT_OPENAI_MODEL } from '@/lib/chat/models';
import { streamOpenAI } from '@/lib/chat/providers/openai';
import type { Message } from '@/lib/chat/types';
import type { AiEvent, AiSettings, AskOptions } from './types';

/** Vercel hosted 프로필에서 서버의 OpenAI 키를 사용하는 RPG 전용 어댑터. */
export async function* askOpenAI(
  settings: AiSettings,
  opts: AskOptions,
): AsyncGenerator<AiEvent> {
  const history: Message[] = (opts.history ?? []).map((turn, index) => ({
    id: `rpg-${index}`,
    role: turn.role,
    text: turn.text,
    createdAt: index,
  }));

  for await (const event of streamOpenAI({
    message: opts.prompt,
    model: DEFAULT_OPENAI_MODEL,
    history,
    instructions: opts.system,
    maxOutputTokens: opts.maxTokens,
    demoToken: settings.demoToken,
    signal: opts.signal,
  })) {
    if (event.type === 'delta') yield { type: 'delta', text: event.text };
    else if (event.type === 'error') yield { type: 'error', message: event.message, hint: event.hint };
  }
}
