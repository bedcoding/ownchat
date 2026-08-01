export const MODELS = [
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

export type ModelId = (typeof MODELS)[number]['id'];

export const DEFAULT_MODEL: ModelId = 'claude-opus-5';

export function modelInfo(id: string) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}
