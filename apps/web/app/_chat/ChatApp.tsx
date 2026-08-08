'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hostedOpenAIAvailable } from '@/lib/capabilities';
import { modelsForProvider, normalizeModel, type ModelId } from '@/lib/models';
import { checkLocal, isDesktop, resolveProvider, send } from '@/lib/providers';
import { DEFAULT_SETTINGS, loadConversations, loadSettings, newId, saveConversations, saveSettings } from '@/lib/storage';
import type { BridgeHealth, Conversation, Message, Settings } from '@/lib/types';
import Composer from './Composer';
import EmptyState from './EmptyState';
import MessageList from './MessageList';
import SettingsPanel from './SettingsPanel';
import Sidebar from './Sidebar';

/** 스트리밍 중 토큰마다 setState하면 렌더가 과하다. 이 간격으로 모아서 반영한다 */
const FLUSH_MS = 60;
const BRIDGE_POLL_MS = 20_000;
/** 로그인 창을 띄운 직후에는 빠르게 확인해서 끝나는 즉시 화면을 넘긴다 */
const LOGIN_POLL_MS = 2_000;
const LOGIN_WATCH_MS = 5 * 60_000;

function titleFrom(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 28 ? `${flat.slice(0, 28)}…` : flat || '새 대화';
}

function emptyConversation(model: ModelId): Conversation {
  const now = Date.now();
  return {
    id: newId(),
    title: '새 대화',
    model,
    messages: [],
    bridgeSessionId: null,
    bridgeSessionProvider: null,
    bridgeSessionModel: null,
    contextProvider: null,
    createdAt: now,
    updatedAt: now,
  };
}

export default function ChatApp() {
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [sending, setSending] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 좁은 화면에서만 의미가 있다. 넓은 화면에서는 사이드바가 항상 보인다 */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** 로그인 창을 띄운 시각. 이 동안은 브리지 상태를 빠르게 다시 묻는다 */
  const [loginWatchStartedAt, setLoginWatchStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── 초기 로드 / 저장 ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadedSettings = loadSettings();
    const loadedConversations = loadConversations();
    setSettings(loadedSettings);
    setConversations(loadedConversations);
    setActiveId(loadedConversations[0]?.id ?? null);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveSettings(settings);
  }, [hydrated, settings]);

  useEffect(() => {
    if (hydrated) saveConversations(conversations);
  }, [hydrated, conversations]);

  // ── 브리지 감지 ─────────────────────────────────────────────────────────────
  const pollBridge = useCallback(async (url: string) => {
    const health = await checkLocal(url);
    setHealth(health);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (
      settings.mode === 'apikey' ||
      settings.mode === 'openai' ||
      (settings.mode === 'auto' && hostedOpenAIAvailable())
    ) {
      setHealth(null);
      return;
    }
    const watching = loginWatchStartedAt !== null && Date.now() - loginWatchStartedAt < LOGIN_WATCH_MS;
    let cancelled = false;
    const run = async () => {
      const health = await checkLocal(settings.bridgeUrl);
      if (cancelled) return;
      setHealth(health);
      // 로그인이 끝났거나, 감시 시간이 지나면 빠른 폴링을 멈춘다.
      if (watching && loginWatchStartedAt !== null) {
        const expired = Date.now() - loginWatchStartedAt >= LOGIN_WATCH_MS;
        if (health?.claudeCli.loggedIn || expired) setLoginWatchStartedAt(null);
      }
    };
    void run();
    const timer = setInterval(run, watching ? LOGIN_POLL_MS : BRIDGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [hydrated, settings.bridgeUrl, settings.mode, loginWatchStartedAt]);

  const resolution = useMemo(() => resolveProvider(settings, health), [settings, health]);
  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const openAISelected =
    resolution.provider === 'openai' ||
    settings.mode === 'openai' ||
    (settings.mode === 'auto' && hostedOpenAIAvailable());
  const modelProvider = openAISelected ? 'openai' : 'claude';
  const selectedModel = normalizeModel(modelProvider, active?.model ?? settings.model);
  const availableModels = modelsForProvider(modelProvider);

  // ── 대화 조작 ───────────────────────────────────────────────────────────────
  const patchConversation = useCallback((id: string, patch: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? patch(c) : c)));
  }, []);

  const startNew = useCallback(() => {
    const conv = emptyConversation(normalizeModel(openAISelected ? 'openai' : 'claude', settings.model));
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
  }, [openAISelected, settings.model]);

  const removeConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      setActiveId((current) => (current === id ? (next[0]?.id ?? null) : current));
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── 전송 ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (!resolution.provider || sending) return;

      const provider = resolution.provider;
      const model = normalizeModel(provider === 'openai' ? 'openai' : 'claude', active?.model ?? settings.model);
      // 공급자를 바꾸면 이전 공급자의 보이지 않는 문맥을 잃는다. 같은 화면에서 이어지는 척하지 않고 새 대화로 분리한다.
      const providerChanged = Boolean(active?.contextProvider && active.contextProvider !== provider);
      const conv = !active || providerChanged ? emptyConversation(model) : active;
      if (!active || providerChanged) {
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
      }

      const now = Date.now();
      const userMsg: Message = { id: newId(), role: 'user', text, createdAt: now };
      const assistantId = newId();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        text: '',
        streaming: true,
        createdAt: now + 1,
      };

      const localProvider = provider === 'desktop' || provider === 'bridge';
      const sessionMatches =
        localProvider &&
        conv.bridgeSessionId &&
        (!conv.bridgeSessionProvider || conv.bridgeSessionProvider === provider) &&
        (!conv.bridgeSessionModel || conv.bridgeSessionModel === model);
      const sessionId = sessionMatches ? conv.bridgeSessionId : null;
      const history = conv.messages;

      patchConversation(conv.id, (c) => ({
        ...c,
        model,
        contextProvider: provider,
        bridgeSessionId: localProvider ? sessionId : null,
        bridgeSessionProvider: localProvider ? provider : null,
        bridgeSessionModel: localProvider ? model : null,
        title: c.messages.length === 0 ? titleFrom(text) : c.title,
        messages: [...c.messages, userMsg, assistantMsg],
        updatedAt: now,
      }));

      setSending(true);
      const controller = new AbortController();
      abortRef.current = controller;

      let buffer = '';
      let thinkingBuffer = '';
      let notice: string | null = null;
      let lastFlush = 0;

      const flush = (force = false) => {
        const at = Date.now();
        if (!force && at - lastFlush < FLUSH_MS) return;
        lastFlush = at;
        const textSnapshot = buffer;
        const thinkingSnapshot = thinkingBuffer;
        patchConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId ? { ...m, text: textSnapshot, thinking: thinkingSnapshot || undefined } : m,
          ),
        }));
      };

      try {
        const stream = send(provider, settings, {
          message: text,
          model,
          sessionId,
          history,
          signal: controller.signal,
        });

        for await (const event of stream) {
          switch (event.type) {
            case 'meta':
              if (event.sessionId) {
                patchConversation(conv.id, (c) => ({
                  ...c,
                  bridgeSessionId: event.sessionId ?? null,
                  bridgeSessionProvider: localProvider ? provider : null,
                  bridgeSessionModel: localProvider ? model : null,
                }));
              }
              break;
            case 'delta':
              buffer += event.text;
              flush();
              break;
            case 'thinking':
              thinkingBuffer += event.text;
              flush();
              break;
            case 'notice':
              notice = event.message;
              break;
            case 'done':
              flush(true);
              patchConversation(conv.id, (c) => ({
                ...c,
                bridgeSessionId: localProvider ? (event.sessionId ?? c.bridgeSessionId) : null,
                bridgeSessionProvider: localProvider ? provider : null,
                bridgeSessionModel: localProvider ? model : null,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: buffer, thinking: thinkingBuffer || undefined, raw: event.raw, streaming: false }
                    : m,
                ),
              }));
              break;
            case 'error':
              flush(true);
              patchConversation(conv.id, (c) => ({
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantId
                    ? { ...m, streaming: false, error: { message: event.message, hint: event.hint ?? null } }
                    : m,
                ),
              }));
              break;
            default:
              break;
          }
        }
      } finally {
        flush(true);
        // done/error를 못 받고 끝난 경우(사용자 중단 등)도 스트리밍 표시는 반드시 걷는다.
        patchConversation(conv.id, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantId && m.streaming
              ? {
                  ...m,
                  streaming: false,
                  error: m.text ? undefined : { message: '응답이 중단됐습니다.', hint: notice },
                }
              : m,
          ),
        }));
        abortRef.current = null;
        setSending(false);
      }
    },
    [active, patchConversation, resolution.provider, sending, settings],
  );

  const setModel = useCallback(
    (model: ModelId) => {
      setSettings((s) => ({ ...s, model }));
      if (active) {
        if (active.messages.length > 0 && active.model !== model) {
          const conv = emptyConversation(model);
          setConversations((prev) => [conv, ...prev]);
          setActiveId(conv.id);
        } else {
          patchConversation(active.id, (c) => ({ ...c, model }));
        }
      }
    },
    [active, patchConversation],
  );

  if (!hydrated) {
    // localStorage를 읽기 전에 UI를 그리면 서버 렌더 결과와 어긋난다.
    return <div className="shell" aria-busy="true" />;
  }

  const subscription = resolution.provider === 'desktop' || resolution.provider === 'bridge';
  const badgeState = subscription || resolution.provider === 'openai' ? 'ok' : resolution.provider === 'apikey' ? 'warn' : 'err';
  const badgeLabel = subscription
    ? '구독 (추가 비용 없음)'
    : resolution.provider === 'openai'
      ? 'OpenAI 데모'
      : resolution.provider === 'apikey'
        ? 'API 키 (종량제)'
        : '연결 안 됨';

  return (
    <div className="shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          startNew();
          setSidebarOpen(false);
        }}
        onDelete={removeConversation}
        onOpenSettings={() => {
          setSettingsOpen(true);
          setSidebarOpen(false);
        }}
      />

      {sidebarOpen ? (
        <button type="button" className="backdrop" aria-label="대화 목록 닫기" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <main className="main">
        <div className="topbar">
          {/* 좁은 화면에서만 보인다. 사이드바가 서랍으로 바뀌므로 여는 수단이 필요하다 */}
          <button
            type="button"
            className="btn ghost mobile-only"
            aria-label="대화 목록"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>

          <span className="badge" title={resolution.reason}>
            <span className={`dot ${badgeState}`} aria-hidden="true" />
            {badgeLabel}
          </span>

          <select
            className="select"
            value={selectedModel}
            onChange={(e) => setModel(e.target.value as ModelId)}
            aria-label="모델 선택"
            disabled={sending}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <span className="spacer" />

          <button type="button" className="btn ghost" onClick={() => setSettingsOpen(true)}>
            설정
          </button>
          <button type="button" className="btn" onClick={startNew} disabled={sending}>
            새 대화
          </button>
        </div>

        <div className="messages">
          {active && active.messages.length > 0 ? (
            <MessageList messages={active.messages} showThinking={settings.showThinking} />
          ) : (
            <EmptyState
              resolution={resolution}
              health={health}
              settings={settings}
              onOpenSettings={() => setSettingsOpen(true)}
              onLoginStarted={() => setLoginWatchStartedAt(Date.now())}
            />
          )}
        </div>

        <Composer
          disabled={!resolution.provider}
          sending={sending}
          placeholder={resolution.provider ? '메시지를 입력하세요' : resolution.reason}
          hint={resolution.reason}
          onSend={handleSend}
          onStop={stop}
        />
      </main>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          health={health}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onRecheck={() => pollBridge(settings.bridgeUrl)}
          onLoginStarted={() => setLoginWatchStartedAt(Date.now())}
        />
      )}
    </div>
  );
}
