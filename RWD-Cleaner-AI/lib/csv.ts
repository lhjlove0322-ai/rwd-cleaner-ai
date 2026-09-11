import Papa from "papaparse";
import type { DataRow } from "./types";

export function parseCsv(file: File): Promise<{ headers: string[]; rows: DataRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, ""),
      complete: (result) => {
        if (result.errors.length) {
          reject(new Error(`CSV 파싱 오류: ${result.errors[0].message}`));
          return;
        }
        const headers = result.meta.fields ?? [];
        resolve({ headers, rows: result.data });
      },
      error: (error) => reject(error),
    });
  });
}

export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  return Papa.unparse(rows, { columns, newline: "\r\n" });
}

export function downloadText(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
