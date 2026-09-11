# RWD Cleaner AI

모바일 헬스케어 서비스에서 수집된 RWD를 분석 전에 점검하고 전처리하는 웹 프로토타입입니다.

## 주요 기능

- CSV 업로드 및 브라우저 내 로컬 처리
- 결측치, 중복값, 형식 오류, 이상값, 개인정보 의심값 탐지
- 데이터 정의서 기반 표준 코드·단위·기계적 범위 검사
- 수정 가능한 항목별 사용자 승인
- 정리된 RWD와 변경 로그 CSV 다운로드
- OpenAI API를 이용한 애매한 문제 후보의 보조 검토

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`에 `OPENAI_API_KEY`를 설정하면 AI 보조 검토가 활성화됩니다. 키가 없어도 규칙 기반 품질 검사는 작동합니다.

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 push합니다.
2. Vercel에서 `Add New Project`를 선택하고 저장소를 가져옵니다.
3. Framework Preset은 Next.js를 사용합니다.
4. Environment Variables에 `OPENAI_API_KEY`와 필요 시 `OPENAI_MODEL`을 설정합니다.
5. Deploy를 실행합니다.

## 개인정보 및 한계

- 샘플은 완전한 가상 데이터입니다.
- 원본 CSV는 브라우저에서 처리되며, AI 검토 요청에는 최대 20개의 문제 후보 요약만 전송됩니다.
- 개인정보 의심값은 AI 요청 전에 `[가림]`으로 대체됩니다.
- 의료적 판단, 서비스 효과 분석, 실제 개인정보 처리 목적으로 사용할 수 없습니다.
