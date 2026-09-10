/**
 * 기억해 둔 로그인 상태의 `localStorage` 키.
 *
 * 별도 파일인 이유: 서버 컴포넌트(`app/layout.tsx` 의 인라인 스크립트)와 클라이언트 모듈
 * (`useSession.ts`)이 **같은 키**를 써야 하는데, `'use client'` 모듈에서 값을 import 하면 서버 쪽에서는
 * 클라이언트 참조가 되어 문자열로 쓸 수 없다. 🚫 두 곳에 문자열을 따로 적지 않는다.
 */
export const SESSION_STORAGE_KEY = "nerd:session";
