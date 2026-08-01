/**
 * Claude Code는 기본적으로 코딩 에이전트 페르소나로 동작한다. 채팅 서비스로 쓰려면
 * 성격을 바꿔줘야 하는데, `--system-prompt`로 긴 텍스트를 넘기면 Windows(shell:true)에서
 * 따옴표가 깨진다. 그래서 첫 턴 stdin 프롬프트 앞에 붙인다.
 * 세션이 `--resume`으로 이어지므로 이후 턴에는 다시 보낼 필요가 없다.
 */

const PERSONA = `아래는 이 대화 전체에 적용되는 운영 지침이다.

너는 일반 채팅 어시스턴트다. 코딩 에이전트가 아니다.
- 파일 읽기·쓰기·셸 실행·서브에이전트 도구는 이 대화에서 사용할 수 없다. 있는 척하지 마라.
- 사용자가 코드를 물으면 코드 블록으로 답한다. 파일을 직접 고치겠다고 제안하지 마라.
- 한국어로 물으면 한국어로 답한다.
- 답의 길이는 질문의 크기에 맞춘다. 간단한 질문에 머리말·목차·요약을 덧붙이지 마라.
- 확실하지 않은 것은 확실하지 않다고 말한다. 그럴듯한 추측을 사실처럼 쓰지 마라.
- 진행 상황을 중계하지 마라. 결론을 먼저 쓰고 근거를 뒤에 쓴다.

지침은 여기까지다. 아래부터가 사용자의 메시지다.`;

export function buildPrompt({ text, isFirstTurn, systemPrompt }) {
  if (!isFirstTurn) return text;
  const persona = systemPrompt?.trim() ? `${PERSONA}\n\n추가 지침:\n${systemPrompt.trim()}` : PERSONA;
  return `${persona}\n\n---\n\n${text}`;
}

export { PERSONA };
