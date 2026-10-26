import { useReducer } from "react";
import { ChatPage } from "./features/chat/ChatPage";
import { StartForm } from "./features/start/StartForm";
import { PortalPage } from "./features/portal/PortalPage";
import { conversationReducer } from "./state/conversation";
import { loadInitialState, useConversationHistory } from "./state/useConversationHistory";
import type { RegionSelection } from "./types/contract";
import { getAuthToken, updateProfile, type UserProfile } from "./api/auth";

export default function App() {
  const [state, dispatch] = useReducer(conversationReducer, undefined, loadInitialState);
  const history = useConversationHistory(state, dispatch);

  // 첫 화면: 로그인 & 비회원 시작 포털 화면
  if (state.phase === "portal") {
    return (
      <PortalPage
        onLoginSuccess={(user: UserProfile) => {
          if (user.default_region_level1) {
            dispatch({
              type: "START",
              region: {
                level1: user.default_region_level1,
                level2: user.default_region_level2 || "",
              },
              age: user.default_age ?? null,
            });
          } else {
            // 거주지 정보가 없는 회원이면 조건입력 화면으로 이동
            dispatch({ type: "EDIT_CONDITIONS" });
          }
        }}
        onGuestStart={(region: RegionSelection, age: number | null) => {
          dispatch({ type: "START", region, age });
        }}
      />
    );
  }

  // 상단 '수정' 버튼 클릭 시 나타나는 조건(지역/나이) 수정 폼
  if (state.phase === "start") {
    return (
      <StartForm
        initialRegion={state.region}
        initialAge={state.age}
        onSubmit={async (region, age) => {
          // 로그인한 회원이면 수정된 지역과 나이를 DB(Oracle)에 영구 반영
          if (getAuthToken()) {
            try {
              await updateProfile({
                default_region_level1: region.level1,
                default_region_level2: region.level2,
                default_age: age,
              });
            } catch (err) {
              console.error("회원 거주지/나이 DB 업데이트 실패:", err);
            }
          }
          dispatch({ type: "START", region, age });
        }}
        onCancel={state.region ? () => dispatch({ type: "CANCEL_EDIT" }) : () => dispatch({ type: "SHOW_PORTAL" })}
      />
    );
  }

  return <ChatPage state={state} dispatch={dispatch} history={history} />;
}


