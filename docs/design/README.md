# docs/design — UI 시안·프로토타입

디자인 검토용 산출물을 둔다. **제품 코드가 아니다** — 빌드·배포·CI 어디에도 들어가지 않는다.

| 파일 | 무엇 |
|---|---|
| [`my-story-flow.html`](my-story-flow.html) | My Story 전체 플로우 프로토타입 (시연·체험 2모드, 단일 HTML) |

## 여는 법

브라우저로 파일을 직접 열면 된다. 빌드·서버가 필요 없다.

```bash
open docs/design/my-story-flow.html
```

⚠️ **체험 모드의 카메라는 `file://` 에서 막힌다.** `getUserMedia` 는 secure context 전용이라
`localhost` 나 HTTPS 가 아니면 동작하지 않는다. 카메라까지 보려면 로컬 서버로 연다.

```bash
npx serve docs/design   # 또는 python3 -m http.server
```

카메라를 못 쓰면 프로토타입이 예시 얼굴로 자동 폴백하므로 나머지 플로우는 그대로 확인된다.

## 규칙

🚫 **이 디렉터리를 결정의 근거로 삼지 않는다.** My Story 의 SSOT 는
[`docs/tasks/tasks-my-story.md`](../tasks/tasks-my-story.md) 다. 프로토타입과 그 문서가
어긋나면 **문서가 이긴다** — 시안은 문서보다 먼저 만들어지고 늦게 갱신되기 때문이다.

🚫 **여기 있는 코드를 `apps/front` 로 복사하지 않는다.** 바닐라 JS + 단일 파일이라
React·Tailwind 규약과 맞지 않는다. 가져갈 것은 **색·타이포·삽화·카피**이고,
구조는 `components/` 의 기존 컴포넌트 위에서 다시 짠다.

## 토큰

프로토타입의 CSS 변수 이름은 `apps/front/app/globals.css` 의 `@theme` 과 **의도적으로 같다**
(`--color-primary` · `--color-accent-a` · `--radius-card` · `--spacing-touch` …).
값이 확정되면 옮겨 적을 때 이름을 바꾸지 않아도 된다.

색 값은 여전히 **초안**이다. 확정 절차는 `tasks-my-story.md` 의 「디자인 시스템」이 소유한다 —
표를 먼저 고치고 `globals.css` 를 고친다.
