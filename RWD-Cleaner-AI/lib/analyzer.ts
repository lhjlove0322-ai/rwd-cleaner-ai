import type { Analysis, ChangeLog, DataRow, Issue, IssueCategory } from "./types";

const requiredCommon = ["record_id", "record_type", "user_pseudo_id", "recorded_at", "source_type"];
const requiredEvent = ["event_name", "screen_name", "session_id"];
const requiredMeasurement = ["metric_type", "value", "unit", "start_time", "end_time"];
const eventCodes = new Set(["app_open", "notification_opened", "health_record_started", "health_record_completed", "weekly_report_viewed", "goal_completed"]);
const screenCodes = new Set(["home", "record", "report", "goal"]);
const sourceCodes = new Set(["mobile_app", "smartphone", "wearable", "manual"]);
const osCodes = new Set(["Android", "iOS"]);
const iso8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?82[- ]?|0)1[016789][- ]?\d{3,4}[- ]?\d{4}/;
const aliases: Record<string, string> = {
  record_done: "health_record_completed",
  "notification opened": "notification_opened",
};

const metricRules: Record<string, { unit: string; min: number; max: number; integer?: boolean }> = {
  steps: { unit: "count", min: 0, max: 100000 },
  sleep_duration: { unit: "hour", min: 0, max: 24 },
  heart_rate: { unit: "bpm", min: 20, max: 250 },
  stress_score: { unit: "score", min: 1, max: 5, integer: true },
};

function makeIssue(rowIndex: number, row: DataRow, field: string, category: IssueCategory, reason: string, recommendation: string, extra: Partial<Issue> = {}): Issue {
  return {
    id: `${rowIndex}-${field}-${category}-${reason}`,
    rowIndex,
    recordId: row.record_id || `(행 ${rowIndex + 2})`,
    field,
    value: row[field] ?? "",
    category,
    reason,
    recommendation,
    fixable: false,
    ...extra,
  };
}

export function analyzeData(headers: string[], rows: DataRow[]): Analysis {
  const issues: Issue[] = [];
  const seenRows = new Map<string, number>();

  rows.forEach((row, rowIndex) => {
    const required = [...requiredCommon, ...(row.record_type === "event" ? requiredEvent : row.record_type === "measurement" ? requiredMeasurement : [])];
    required.forEach((field) => {
      if (!(row[field] ?? "").trim()) {
        issues.push(makeIssue(rowIndex, row, field, "결측치", `${row.record_type || "해당"} 레코드의 필수값이 비어 있습니다.`, "원본 수집 경로를 확인하고 값을 보완하거나 검토 필요로 유지하세요."));
      }
    });

    if (row.record_type && !["event", "measurement"].includes(row.record_type)) {
      issues.push(makeIssue(rowIndex, row, "record_type", "형식 오류", "허용된 레코드 유형이 아닙니다.", "event 또는 measurement인지 확인하세요."));
    }
    if (row.recorded_at && !iso8601.test(row.recorded_at)) {
      issues.push(makeIssue(rowIndex, row, "recorded_at", "형식 오류", "ISO 8601 날짜·시간 형식과 일치하지 않습니다.", "연도와 시간대를 확인한 뒤 ISO 8601로 변환하세요."));
    }
    if (row.start_time && !iso8601.test(row.start_time)) {
      issues.push(makeIssue(rowIndex, row, "start_time", "형식 오류", "ISO 8601 날짜·시간 형식과 일치하지 않습니다.", "원본 시간과 시간대를 확인하세요."));
    }
    if (row.end_time && !iso8601.test(row.end_time)) {
      issues.push(makeIssue(rowIndex, row, "end_time", "형식 오류", "ISO 8601 날짜·시간 형식과 일치하지 않습니다.", "원본 시간과 시간대를 확인하세요."));
    }
    if (row.source_type && !sourceCodes.has(row.source_type)) {
      issues.push(makeIssue(rowIndex, row, "source_type", "형식 오류", "데이터 정의서의 허용 출처 코드가 아닙니다.", "새 출처인지 오기인지 확인하세요."));
    }
    if (row.device_os && !osCodes.has(row.device_os)) {
      issues.push(makeIssue(rowIndex, row, "device_os", "형식 오류", "허용된 운영체제 코드가 아닙니다.", "Android 또는 iOS인지 확인하세요."));
    }

    if (row.record_type === "event") {
      const normalized = row.event_name?.trim().toLowerCase();
      if (row.event_name && !eventCodes.has(row.event_name)) {
        const replacement = aliases[normalized];
        issues.push(makeIssue(rowIndex, row, "event_name", "형식 오류", "표준 이벤트 코드와 일치하지 않습니다.", replacement ? `${replacement}로 표준화할 수 있습니다.` : "새 이벤트인지 오기인지 확인하세요.", replacement ? { fixable: true, fixType: "replace", newValue: replacement } : {}));
      }
      if (row.screen_name && !screenCodes.has(row.screen_name)) {
        issues.push(makeIssue(rowIndex, row, "screen_name", "형식 오류", "표준 화면 코드와 일치하지 않습니다.", "화면 코드 정의서를 확인하세요."));
      }
    }

    if (row.record_type === "measurement" && row.metric_type) {
      const rule = metricRules[row.metric_type];
      const value = Number(row.value);
      if (!rule) {
        issues.push(makeIssue(rowIndex, row, "metric_type", "형식 오류", "정의서에 없는 건강지표입니다.", "오류로 단정하지 말고 정의서 갱신 여부를 확인하세요."));
      } else {
        if (row.unit && row.unit !== rule.unit) {
          const canConvertSleep = row.metric_type === "sleep_duration" && row.unit === "min" && Number.isFinite(value);
          issues.push(makeIssue(rowIndex, row, "unit", "형식 오류", `표준 단위는 ${rule.unit}입니다.`, canConvertSleep ? `${value / 60}시간으로 변환할 수 있습니다.` : "단위 의미를 확인한 뒤 변환하세요.", canConvertSleep ? { fixable: true, fixType: "convert-sleep", newValue: "hour" } : {}));
        }
        if (row.value && (!Number.isFinite(value) || value < rule.min || value > rule.max || (rule.integer && !Number.isInteger(value)))) {
          issues.push(makeIssue(rowIndex, row, "value", "이상값", `${row.metric_type}의 기계적 유효 범위 ${rule.min}~${rule.max}${rule.integer ? " 정수" : ""}를 벗어났습니다.`, "의료적으로 해석하지 말고 원본 기기·입력 기록을 확인하세요."));
        }
      }
    }

    Object.entries(row).forEach(([field, value]) => {
      if (value && (emailPattern.test(value) || phonePattern.test(value))) {
        issues.push(makeIssue(rowIndex, row, field, "개인정보 의심값", "이메일 또는 전화번호 형식의 직접식별정보가 감지되었습니다.", "정리본에서는 마스킹하세요.", { fixable: true, fixType: "mask", newValue: maskValue(value) }));
      }
    });

    const rowKey = headers.map((header) => row[header] ?? "").join("\u241F");
    if (seenRows.has(rowKey)) {
      issues.push(makeIssue(rowIndex, row, "전체 행", "중복값", `행 ${seenRows.get(rowKey)! + 2}와 모든 필드가 동일합니다.`, "사용자 승인 후 뒤의 중복 행을 제거하세요.", { fixable: true, fixType: "remove-row" }));
    } else {
      seenRows.set(rowKey, rowIndex);
    }
  });

  const issueRows = new Set(issues.map((issue) => issue.rowIndex));
  return {
    headers,
    rows,
    issues,
    qualityScore: Math.max(0, Math.round((1 - issueRows.size / Math.max(rows.length, 1)) * 100)),
    normalRows: rows.length - issueRows.size,
    reviewRows: issueRows.size,
  };
}

function maskValue(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return value.replace(/\d(?=\d{4})/g, "*");
}

export function applyApproved(analysis: Analysis, approved: Set<string>) {
  const rows = analysis.rows.map((row) => ({ ...row }));
  const removed = new Set<number>();
  const log: ChangeLog[] = [];

  analysis.issues.forEach((issue) => {
    if (!approved.has(issue.id) || !issue.fixable) return;
    const row = rows[issue.rowIndex];
    if (issue.fixType === "remove-row") {
      removed.add(issue.rowIndex);
      log.push({ record_id: issue.recordId, field_name: "전체 행", old_value: "중복 행", new_value: "제거", reason: issue.reason, approval_status: "승인됨" });
      return;
    }
    if (issue.fixType === "convert-sleep") {
      const oldValue = row.value;
      const oldUnit = row.unit;
      row.value = String(Number(row.value) / 60);
      row.unit = "hour";
      log.push({ record_id: issue.recordId, field_name: "value, unit", old_value: `${oldValue} ${oldUnit}`, new_value: `${row.value} hour`, reason: issue.reason, approval_status: "승인됨" });
      return;
    }
    const oldValue = row[issue.field] ?? "";
    row[issue.field] = issue.newValue ?? oldValue;
    log.push({ record_id: issue.recordId, field_name: issue.field, old_value: oldValue, new_value: row[issue.field], reason: issue.reason, approval_status: "승인됨" });
  });

  return { rows: rows.filter((_, index) => !removed.has(index)), log };
}
