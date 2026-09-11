export type DataRow = Record<string, string>;

export type IssueCategory = "결측치" | "중복값" | "형식 오류" | "이상값" | "개인정보 의심값";

export type Issue = {
  id: string;
  rowIndex: number;
  recordId: string;
  field: string;
  value: string;
  category: IssueCategory;
  reason: string;
  recommendation: string;
  fixable: boolean;
  fixType?: "replace" | "mask" | "remove-row" | "convert-sleep";
  newValue?: string;
};

export type Analysis = {
  headers: string[];
  rows: DataRow[];
  issues: Issue[];
  qualityScore: number;
  normalRows: number;
  reviewRows: number;
};

export type ChangeLog = {
  record_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  approval_status: string;
};
