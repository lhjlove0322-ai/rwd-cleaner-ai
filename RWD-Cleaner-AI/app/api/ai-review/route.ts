import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }

  const body = await request.json();
  const issues = Array.isArray(body.issues) ? body.issues.slice(0, 20) : [];
  const safeIssues = issues.map((issue: Record<string, unknown>) => ({
    field: issue.field,
    category: issue.category,
    reason: issue.reason,
    recommendation: issue.recommendation,
    value: issue.category === "개인정보 의심값" ? "[가림]" : issue.value,
  }));

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5-mini",
    instructions: "너는 모바일 헬스케어 RWD 전처리 검토자다. 의료적 진단이나 서비스 효과 분석을 하지 않는다. 제공된 문제 후보를 한국어로 검토하고, 데이터로 확정되는 사실과 추가 확인이 필요한 판단을 구분하라. 값을 임의로 보완하거나 삭제하지 말라. 5개 이하의 간결한 항목으로 답하라.",
    input: JSON.stringify({
      data_dictionary: "event/measurement 유형별 필수값, ISO 8601 시간, 표준 이벤트 코드, 지표별 단위와 기계적 범위를 적용한다.",
      issues: safeIssues,
    }),
  });

  return NextResponse.json({ review: response.output_text });
}
