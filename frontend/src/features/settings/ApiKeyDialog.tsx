import { useEffect, useRef, useState } from "react";
import { deleteServerApiKey, getAuthToken, getServerApiKeyStatus, saveServerApiKey } from "../../api/auth";
import { clearApiKey, loadApiKey, maskApiKey, saveApiKey, validateApiKey } from "../../utils/apiKey";

interface Props {
  open: boolean;
  // 서버가 키 때문에 요청을 거절했을 때 안내 문구를 바꾼다
  reason?: "required" | "invalid" | null;
  onClose: () => void;
  onChange?: () => void; // 저장·삭제 후 호출(헤더의 "키 등록됨" 표시 갱신용)
}

const REASON_TEXT = {
  required: "이 서버는 사용자 본인의 Gemini API 키로 AI를 호출해요. 키를 입력하면 바로 이어서 질문할 수 있어요.",
  invalid: "입력한 키를 Gemini가 받아들이지 않았어요. 키를 다시 확인해 주세요.",
};

export function ApiKeyDialog({ open, reason = null, onClose, onChange }: Props) {
  const stored = open ? loadApiKey() : null;
  const loggedIn = Boolean(getAuthToken());
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverHasKey, setServerHasKey] = useState(false);
  const [, refresh] = useState(0); // 삭제 직후 "저장된 키" 표시를 다시 그리기 위한 값
  const inputRef = useRef<HTMLInputElement>(null);

  // 열릴 때마다 입력값을 비우고 현재 저장 방식을 반영한다(저장된 키 자체는 입력란에 다시 채우지 않는다).
  useEffect(() => {
    if (!open) return;
    setValue("");
    setError(null);
    setServerHasKey(false);
    setRemember(loadApiKey()?.storage === "local");
    inputRef.current?.focus();
    if (loggedIn) {
      getServerApiKeyStatus()
        .then((status) => setServerHasKey(status.has_api_key))
        .catch(() => setServerHasKey(false));
    }
  }, [open, loggedIn]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateApiKey(value);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (loggedIn) {
        const result = await saveServerApiKey(value.trim());
        clearApiKey(); // 계정에 저장한 키가 브라우저의 이전 키보다 우선하도록 정리한다.
        setServerHasKey(result.has_api_key);
      } else if (!saveApiKey(value, remember ? "local" : "session")) {
        setError("이 브라우저에서는 키를 저장할 수 없어요. 사생활 보호 모드나 저장소 차단 설정을 확인해 주세요.");
        return;
      }
      setValue("");
      onChange?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? `저장하지 못했어요: ${saveError.message}` : "API 키를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      if (loggedIn && serverHasKey) {
        await deleteServerApiKey();
        setServerHasKey(false);
      }
      clearApiKey();
      setValue("");
      refresh((n) => n + 1);
      onChange?.();
    } catch (removeError) {
      setError(removeError instanceof Error ? `삭제하지 못했어요: ${removeError.message}` : "API 키를 삭제하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={save}
      >
        <h2 id="api-key-title">Gemini API 키</h2>
        {reason && <p className="error-text" role="alert">{REASON_TEXT[reason]}</p>}
        <p className="muted">
          본인의 Gemini API 키를 입력하면 그 키로 질문 분석과 답변 생성을 해요. {loggedIn
            ? "로그인한 계정의 키는 암호화되어 서버 DB에 저장돼요."
            : "키는 이 브라우저에만 저장되고, 요청할 때만 서버로 전달돼요."}{" "}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            키 발급받기
          </a>
        </p>

        {loggedIn && serverHasKey && (
          <p className="muted" role="status">이 계정에 API 키가 저장돼 있어요. 새 키를 저장하면 교체됩니다.</p>
        )}

        {stored && (
          <p className="muted" role="status">
            브라우저에 저장된 키: <code>{maskApiKey(stored.key)}</code> ({stored.storage === "local" ? "이 브라우저에 유지" : "이 탭에서만"})
          </p>
        )}

        <label className="field">
          <span>{stored || serverHasKey ? "새 키로 바꾸기" : "API 키"}</span>
          <input
            ref={inputRef}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            aria-invalid={error !== null}
          />
          {error && <small className="field-error">{error}</small>}
        </label>

        {!loggedIn && (
          <>
            <label className="check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>이 브라우저에 기억하기 (끄면 탭을 닫을 때 삭제돼요)</span>
            </label>
            <small className="muted">공용 PC에서는 기억하기를 끄고, 사용 후 삭제해 주세요.</small>
          </>
        )}

        <div className="actions">
          {(stored || (loggedIn && serverHasKey)) && (
            <button type="button" className="btn" onClick={remove} disabled={saving}>
              키 삭제
            </button>
          )}
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            닫기
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
