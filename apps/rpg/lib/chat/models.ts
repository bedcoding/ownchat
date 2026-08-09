export const CLAUDE_MODELS = [
  {
    id: 'claude-opus-5',
    label: 'Opus 5',
    note: '가장 균형 좋은 기본값. 어려운 추론·긴 대화에 강함',
    adaptiveThinking: true,
    /** 안전 분류기가 요청을 거절할 수 있어 서버측 폴백을 켜 두는 모델 */
    serverFallback: true,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Sonnet 5',
    note: '빠르고 저렴. 일상 대화·요약에 충분',
    adaptiveThinking: true,
    serverFallback: false,
  },
  {
    id: 'claude-haiku-4-5',
    label: 'Haiku 4.5',
    note: '가장 빠르고 싼 모델. 단순 질의응답용',
    adaptiveThinking: false,
    serverFallback: false,
  },
  {
    id: 'claude-fable-5',
    label: 'Fable 5',
    note: '최고 성능. 단가가 Opus보다 높음',
    adaptiveThinking: true,
    serverFallback: true,
  },
] as const;

export const OPENAI_MODELS = [
  {
    id: 'gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    note: '공모전 데모 기본값 · 무료 일일 토큰 대상',
  },
  {
    id: 'gpt-5.4-nano',
    label: 'GPT-5.4 nano',
    note: '더 빠르고 가벼운 질문용 · 무료 일일 토큰 대상',
  },
] as const;

export const MODELS = [...CLAUDE_MODELS, ...OPENAI_MODELS] as const;

export type ClaudeModelId = (typeof CLAUDE_MODELS)[number]['id'];
export type OpenAIModelId = (typeof OPENAI_MODELS)[number]['id'];
export type ModelId = ClaudeModelId | OpenAIModelId;

export const DEFAULT_CLAUDE_MODEL: ClaudeModelId = 'claude-opus-5';
export const DEFAULT_OPENAI_MODEL: OpenAIModelId = 'gpt-5.4-mini';
export const DEFAULT_MODEL: ModelId =
  process.env.NEXT_PUBLIC_OWNCHAT_HOSTED === '1' ? DEFAULT_OPENAI_MODEL : DEFAULT_CLAUDE_MODEL;

export function modelInfo(id: string) {
  return CLAUDE_MODELS.find((m) => m.id === id) ?? CLAUDE_MODELS[0];
}

export function isOpenAIModel(id: string): id is OpenAIModelId {
  return OPENAI_MODELS.some((model) => model.id === id);
}

export function isClaudeModel(id: string): id is ClaudeModelId {
  return CLAUDE_MODELS.some((model) => model.id === id);
}

export function modelsForProvider(provider: 'openai' | 'claude') {
  return provider === 'openai' ? OPENAI_MODELS : CLAUDE_MODELS;
}

export function normalizeModel(provider: 'openai' | 'claude', model: ModelId): ModelId {
  if (provider === 'openai') return isOpenAIModel(model) ? model : DEFAULT_OPENAI_MODEL;
  return isClaudeModel(model) ? model : DEFAULT_CLAUDE_MODEL;
}
