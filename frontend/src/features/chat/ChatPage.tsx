import { useEffect, useMemo, useState } from "react";
import { askPolicy, askPolicyInSession, searchPolicies, searchPoliciesInSession } from "../../api/policies";
import { ApiClientError, toErrorCode } from "../../api/client";
import { conversationFromServer } from "../../utils/serverHistory";
import { USE_MOCK } from "../../config";
import { DISCLAIMER, SERVICE_NAME } from "../../constants/text";
import type { ConversationState, Action } from "../../state/conversation";
import { uid } from "../../state/conversation";
import type { AskIntent, PolicyCandidate } from "../../types/contract";
import { loadApiKey } from "../../utils/apiKey";
import type { ConversationHistory } from "../../state/useConversationHistory";
import { ApiKeyDialog } from "../settings/ApiKeyDialog";
import { ThemeToggle } from "../settings/ThemeToggle";
import { ChatInput } from "./ChatInput";
import { ConversationList } from "./ConversationList";
import { CurrentPolicyBar } from "./CurrentPolicyBar";
import { MessageList } from "./MessageList";
import { getAuthToken, getMe, removeAuthToken, UserProfile } from "../../api/auth";
import { createServerSession, deleteServerSession, fetchServerSessions, fetchServerSessionDetail, renameServerSession, ServerSessionSummary } from "../../api/history";
import { CommonLoginModal } from "../portal/CommonLoginModal";
import { ServerConversationList } from "./ServerConversationList";

interface Props {
  state: ConversationState;
  dispatch: React.Dispatch<Action>;
  history: ConversationHistory;
}

export function ChatPage({ state, dispatch, history }: Props) {
  const { region, age, current_policy, messages, pending } = state;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [keyDialog, setKeyDialog] = useState<{ open: boolean; reason: "required" | "invalid" | null }>({
    open: false,
    reason: null,
  });
  const [keyVersion, setKeyVersion] = useState(0);
  const hasKey = useMemo(() => loadApiKey() !== null, [keyVersion]);

  // 회원 인증 상태
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [serverSessions, setServerSessions] = useState<ServerSessionSummary[]>([]);
  const [activeServerSessionId, setActiveServerSessionId] = useState<string | null>(null);

  // 초기 마운트 시 로그인 확인
  useEffect(() => {
    getMe().then((profile) => {
      if (profile) {
        setUser(profile);
        fetchServerSessions().then(setServerSessions).catch(() => {});
      }
    });
  }, []);

  const refreshSessions = () => {
    if (user) {
      fetchServerSessions().then(setServerSessions).catch(() => {});
    }
  };

  // 로그인 상태에서 AI 요청이 거치는 기록 서버 상담 세션. 대화(conversation_id)가 바뀌면 새로 만든다.
  const [serverSession, setServerSession] = useState<{ conversationId: string; sessionId: string } | null>(null);
  const activeSessionId =
    serverSession && serverSession.conversationId === (state.conversation_id ?? "") ? serverSession.sessionId : null;

  const clearAuthenticatedState = (showAuthModal: boolean) => {
    removeAuthToken();
    setUser(null);
    setServerSessions([]);
    setActiveServerSessionId(null);
    setServerSession(null);
    history.purgeServerCopies();
    dispatch({ type: "NEW_CHAT" });
    setAuthModalOpen(showAuthModal);
  };

  // 게스트는 세션 서버를 거치지 않는다. 로그인 요청은 저장된 계정 키를 쓰도록 세션을 만든다.
  const ensureServerSession = async (firstQuestion: string): Promise<string | null> => {
    if (USE_MOCK || !region || !getAuthToken()) return null;
    if (activeSessionId) return activeSessionId;
    try {
      const created = await createServerSession({
        region_level1: region.level1,
        region_level2: region.level2,
        age,
        title: firstQuestion.slice(0, 30),
      });
      setServerSession({ conversationId: state.conversation_id ?? "", sessionId: created.session_id });
      return created.session_id;
    } catch (error) {
      if (error instanceof ApiClientError && error.code === "UNAUTHORIZED") throw error;
      return null;
    }
  };

  // 로그인 요청은 Spring을 통해야 DB의 계정 키를 사용하므로 세션 오류를 FastAPI 직접 호출로 우회하지 않는다.
  // SESSION_NOT_FOUND / FORBIDDEN이면 세션 연결을 끊고 다음 질문에서 새로 만든다.
  // 키 오류(API_KEY_REQUIRED, INVALID_API_KEY)나 한도 초과는 FastAPI가 준 오류이므로 그대로 보여 준다.
  const viaServer = async <T,>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === "SESSION_NOT_FOUND" || error.code === "FORBIDDEN") {
          setServerSession(null);
        }
      }
      throw error;
    }
  };

  const send = async (text: string, intent?: AskIntent) => {
    if (!region || pending) return;
    dispatch({ type: "USER_SEND", text });
    try {
      const token = getAuthToken();
      const sessionId = await ensureServerSession(text);
      // 로그인 계정 키는 Spring이 Oracle에서 복호화해 FastAPI로 전달하므로
      // 회원 요청을 브라우저 키가 없는 FastAPI 직접 경로로 보내지 않는다.
      if (!USE_MOCK && token && sessionId === null) {
        throw new ApiClientError("NETWORK_ERROR", "계정 저장 키를 사용할 AI 서버에 연결하지 못했습니다.");
      }
      const server = sessionId !== null && token !== null ? { sessionId, token } : null;
      if (current_policy) {
        const askBody = {
          question: text,
          policy_title: current_policy.title,
          ...(intent ? { intent } : {}), // 자주 묻는 질문 버튼이면 질문 유형을 함께 보낸다
        };
        const policyId = current_policy.policy_id;
        const res = server
          ? await viaServer(() => askPolicyInSession(server.sessionId, policyId, askBody, server.token))
          : await askPolicy(policyId, askBody);
        if (res.route !== "current_policy_question" || !res.answer) {
          dispatch({ type: "RESOLVE", message: { id: uid(), type: "ai_notice", code: "NOT_CURRENT_POLICY" } });
        } else {
          dispatch({ type: "RESOLVE", message: { id: uid(), type: "ai_answer", answer: res.answer } });
        }
      } else {
        const searchBody = { question: text, region, age };
        const res = server
          ? await viaServer(() => searchPoliciesInSession(server.sessionId, searchBody, server.token))
          : await searchPolicies(searchBody);
        dispatch({
          type: "RESOLVE",
          message: {
            id: uid(),
            type: "ai_candidates",
            analysis: res.analysis,
            local_policies: res.local_policies,
            national_policies: res.national_policies,
            relevance_checked: res.relevance_checked,
            low_relevance_ids: res.low_relevance_ids,
          },
        });
      }
      refreshSessions();
    } catch (error) {
      const code = toErrorCode(error);
      if (code === "UNAUTHORIZED") {
        clearAuthenticatedState(true);
        return;
      }
      dispatch({ type: "RESOLVE", message: { id: uid(), type: "ai_error", code } });
      if (code === "API_KEY_REQUIRED") setKeyDialog({ open: true, reason: "required" });
      if (code === "INVALID_API_KEY") setKeyDialog({ open: true, reason: "invalid" });
    }
  };

  // 사이드바에서 서버 상담을 고르면 저장된 대화를 불러오고, 이어서 질문하면 같은 세션에 기록한다.
  const handleSelectServerSession = async (sessionId: string) => {
    try {
      const detail = await fetchServerSessionDetail(sessionId);
      const conversation = conversationFromServer(detail);
      dispatch({ type: "LOAD", conversation });
      setServerSession({ conversationId: conversation.id, sessionId });
      setActiveServerSessionId(sessionId);
      setSidebarOpen(false);
    } catch (e: any) {
      alert("상담 기록 로드 실패: " + e.message);
    }
  };

  const handleRenameServerSession = async (sessionId: string, title: string) => {
    await renameServerSession(sessionId, title.trim());
    await fetchServerSessions().then(setServerSessions);
  };

  const handleDeleteServerSession = async (sessionId: string) => {
    await deleteServerSession(sessionId);
    setServerSessions((sessions) => sessions.filter((session) => session.session_id !== sessionId));
    if (sessionId === activeServerSessionId) {
      setActiveServerSessionId(null);
      setServerSession(null);
      dispatch({ type: "NEW_CHAT" });
    }
  };

  // 로그아웃: 서버(Oracle)에서 불러온 대화가 다음 사용자에게 보이지 않도록 화면과 브라우저의 복사본을 비운다.
  // 게스트가 직접 만든 상담 기록은 건드리지 않는다.
  const handleLogout = () => {
    clearAuthenticatedState(false);
  };

  const regionLabel = region ? [region.level1, region.level2].filter(Boolean).join(" ") : "";

  return (
    <div className={`app${sidebarOpen ? " sidebar-open" : ""}`}>
      <aside className="sidebar">
        {/* 상단 브랜드: 비로그인(WelfareOne) vs 로그인(사용자 이름 + 로그아웃) */}
        {!user ? (
          <div className="brand">{SERVICE_NAME}</div>
        ) : (
          <div className="brand user-brand">
            <span className="user-name" title={user.email}>
              👤 {user.nickname} 님
            </span>
            <button type="button" className="btn small" disabled={pending} onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        )}

        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => {
            dispatch({ type: "NEW_CHAT" });
            setActiveServerSessionId(null);
            setSidebarOpen(false);
          }}
        >
          + 새 상담
        </button>

        {/* 이전 대화 목록: 비로그인(LocalStorage) vs 로그인(Oracle DB 세션 목록) */}
        {!user ? (
          <ConversationList history={history} disabled={pending} onSelected={() => setSidebarOpen(false)} />
        ) : (
          <ServerConversationList
            sessions={serverSessions}
            activeId={activeServerSessionId}
            disabled={pending}
            onSelect={handleSelectServerSession}
            onRename={handleRenameServerSession}
            onDelete={handleDeleteServerSession}
          />
        )}

        {/* 사이드바 하단: 비로그인(로그인/가입 버튼) vs 로그인(클라우드 보관 배너) */}
        {!user ? (
          <div className="sidebar-login">
            <button type="button" className="btn primary block" onClick={() => setAuthModalOpen(true)}>
              로그인 / 회원가입
            </button>
          </div>
        ) : (
          <div className="cloud-note">☁️ 상담 기록이 Oracle DB에 안전하게 보관 중입니다.</div>
        )}

        <div className="sidebar-bottom">
          <ThemeToggle />
        </div>
      </aside>

      <section className="main">
        <header className="header">
          <button
            type="button"
            className="btn icon sidebar-toggle"
            aria-label="사이드바 열기/닫기"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            ☰
          </button>
          <h1>{SERVICE_NAME}</h1>
          {USE_MOCK && <span className="badge mock">MOCK</span>}
          <span className="conditions">
            {regionLabel} · {age === null ? "나이 미입력" : `${age}세`}
          </span>
          <button type="button" className="btn small" onClick={() => dispatch({ type: "EDIT_CONDITIONS" })}>
            수정
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => setKeyDialog({ open: true, reason: null })}
          >
            API 키{hasKey || user?.has_api_key ? " ✓" : ""}
          </button>
        </header>

        {current_policy && (
          <CurrentPolicyBar
            policy={current_policy}
            onClear={() => dispatch({ type: "CLEAR_POLICY" })}
            pending={pending}
            onAsk={send}
          />
        )}

        <MessageList
          messages={messages}
          actions={{
            selectedPolicyId: current_policy?.policy_id ?? null,
            pending,
            onSend: send,
            onSelectPolicy: (policy: PolicyCandidate) =>
              dispatch({ type: "SELECT_POLICY", policy: { policy_id: policy.policy_id, title: policy.title } }),
            onClearPolicy: () => dispatch({ type: "CLEAR_POLICY" }),
          }}
        />

        <footer className="footer">
          <ChatInput
            disabled={pending}
            placeholder={
              current_policy ? "이 정책에 대해 질문하세요" : "상황이나 정책 이름을 입력하세요"
            }
            onSend={send}
          />
          <p className="notice">{DISCLAIMER}</p>
        </footer>
      </section>

      {/* API 키 설정 다이얼로그 */}
      <ApiKeyDialog
        open={keyDialog.open}
        reason={keyDialog.reason}
        onClose={() => setKeyDialog({ open: false, reason: null })}
        onChange={() => {
          setKeyVersion((v) => v + 1);
          if (getAuthToken()) getMe().then(setUser);
        }}
      />

      {/* 공통 로그인/회원가입/비회원 시작 2단 모달 */}
      <CommonLoginModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(loggedUser) => {
          setUser(loggedUser);
          fetchServerSessions().then(setServerSessions).catch(() => {});
        }}
        onGuestStart={(newRegion, newAge) => {
          dispatch({ type: "START", region: newRegion, age: newAge });
        }}
      />
    </div>
  );
}
