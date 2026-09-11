"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronRight, CircleHelp, Download, FileSpreadsheet, FileText, LoaderCircle, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { analyzeData, applyApproved } from "@/lib/analyzer";
import { downloadText, parseCsv, toCsv } from "@/lib/csv";
import type { Analysis, Issue, IssueCategory } from "@/lib/types";

const categories: IssueCategory[] = ["결측치", "중복값", "형식 오류", "이상값", "개인정보 의심값"];

export default function Home() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<IssueCategory | "전체">("전체");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [aiReview, setAiReview] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const csvInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  const visibleIssues = useMemo(() => analysis?.issues.filter((issue) => activeCategory === "전체" || issue.category === activeCategory) ?? [], [analysis, activeCategory]);
  const counts = useMemo(() => Object.fromEntries(categories.map((category) => [category, analysis?.issues.filter((issue) => issue.category === category).length ?? 0])), [analysis]);

  async function runAnalysis() {
    if (!csvFile) return;
    setStatus("loading");
    setMessage("");
    setAiReview("");
    try {
      const parsed = await parseCsv(csvFile);
      const result = analyzeData(parsed.headers, parsed.rows);
      setAnalysis(result);
      setApproved(new Set());
      setStatus("done");
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "파일을 확인할 수 없습니다.");
    }
  }

  function toggleIssue(issue: Issue) {
    if (!issue.fixable) return;
    setApproved((current) => {
      const next = new Set(current);
      next.has(issue.id) ? next.delete(issue.id) : next.add(issue.id);
      return next;
    });
  }

  async function requestAiReview() {
    if (!analysis) return;
    setAiLoading(true);
    setAiReview("");
    try {
      const target = analysis.issues.filter((issue) => !issue.fixable).slice(0, 20);
      const response = await fetch("/api/ai-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issues: target }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 검토를 불러오지 못했습니다.");
      setAiReview(data.review);
    } catch (error) {
      setAiReview(error instanceof Error ? error.message : "AI 검토를 불러오지 못했습니다.");
    } finally {
      setAiLoading(false);
    }
  }

  function downloadCleaned() {
    if (!analysis) return;
    const { rows } = applyApproved(analysis, approved);
    downloadText("cleaned_rwd.csv", toCsv(rows, analysis.headers));
  }

  function downloadLog() {
    if (!analysis) return;
    const { log } = applyApproved(analysis, approved);
    downloadText("change_log.csv", toCsv(log, ["record_id", "field_name", "old_value", "new_value", "reason", "approval_status"]));
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand"><div className="brandMark">R</div><div><strong>RWD Cleaner</strong><span>AI-assisted quality review</span></div></div>
        <div className="privacy"><ShieldCheck size={16} /> 원본은 브라우저 안에서 처리됩니다</div>
      </header>

      <section className="workspace">
        <div className="intro">
          <div>
            <p className="eyebrow">MOBILE HEALTH DATA QUALITY</p>
            <h1>분석 전에, 데이터부터<br/><em>믿을 수 있게.</em></h1>
          </div>
          <p className="introCopy">모바일 헬스케어 RWD의 결측·중복·형식·범위·개인정보 문제를 한 번에 점검하고, 승인한 수정만 정리본에 반영하세요.</p>
        </div>

        <div className="uploadGrid">
          <button className={`uploadCard ${csvFile ? "filled" : ""}`} onClick={() => csvInput.current?.click()}>
            <input ref={csvInput} type="file" accept=".csv,text/csv" hidden onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} />
            <span className="step">01 · 필수</span>
            <div className="uploadIcon"><FileSpreadsheet size={26} /></div>
            <div><strong>{csvFile ? csvFile.name : "RWD CSV 업로드"}</strong><p>{csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB · 선택 완료` : "이벤트 로그와 건강측정 레코드"}</p></div>
            <ChevronRight size={20} />
          </button>
          <button className={`uploadCard ${pdfFile ? "filled" : ""}`} onClick={() => pdfInput.current?.click()}>
            <input ref={pdfInput} type="file" accept=".pdf,application/pdf" hidden onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)} />
            <span className="step">02 · 권장</span>
            <div className="uploadIcon"><FileText size={26} /></div>
            <div><strong>{pdfFile ? pdfFile.name : "데이터 정의서 업로드"}</strong><p>{pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB · 내장 규칙과 함께 사용` : "미업로드 시 기본 정의서 적용"}</p></div>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="actionsRow">
          <div className="sampleLinks"><span>샘플로 시작</span><a href="/samples/mobile_health_rwd_test_data.csv" download>CSV</a><a href="/samples/mobile_health_rwd_data_dictionary.pdf" download>정의서</a></div>
          <button className="primary" disabled={!csvFile || status === "loading"} onClick={runAnalysis}>
            {status === "loading" ? <LoaderCircle className="spin" size={18}/> : <UploadCloud size={18}/>} 데이터 점검 시작
          </button>
        </div>
        {status === "error" && <div className="errorBox"><AlertTriangle size={18}/>{message}</div>}
      </section>

      {analysis && <section id="results" className="results">
        <div className="resultsHeader"><div><p className="eyebrow">QUALITY REPORT</p><h2>데이터 품질 진단</h2></div><div className="fileMeta"><FileSpreadsheet size={16}/>{csvFile?.name}<span>{analysis.rows.length.toLocaleString()}행 · {analysis.headers.length}열</span></div></div>

        <div className="scoreGrid">
          <article className="scoreCard"><span>품질 점수</span><div className="score"><strong>{analysis.qualityScore}</strong><small>/100</small></div><div className="meter"><i style={{width:`${analysis.qualityScore}%`}}/></div></article>
          <article className="statCard good"><Check size={20}/><div><strong>{analysis.normalRows}</strong><span>정상 행</span></div></article>
          <article className="statCard warn"><AlertTriangle size={20}/><div><strong>{analysis.reviewRows}</strong><span>검토 필요 행</span></div></article>
          <article className="statCard"><CircleHelp size={20}/><div><strong>{analysis.issues.length}</strong><span>발견된 문제</span></div></article>
        </div>

        <div className="categoryGrid">
          {categories.map((category) => <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(activeCategory === category ? "전체" : category)}><span>{category}</span><strong>{counts[category]}</strong></button>)}
        </div>

        <div className="panel">
          <div className="panelHeader"><div><h3>오류 상세 목록</h3><p>수정 가능한 항목만 승인할 수 있습니다. 원본은 변경되지 않습니다.</p></div><span className="approvedCount">{approved.size}건 승인</span></div>
          <div className="tableWrap"><table><thead><tr><th>승인</th><th>행 / ID</th><th>필드</th><th>기존 값</th><th>유형</th><th>판단 근거와 권장 처리</th></tr></thead><tbody>
            {visibleIssues.map((issue) => <tr key={issue.id}>
              <td><button aria-label="수정 승인" className={`checkButton ${approved.has(issue.id) ? "checked" : ""}`} disabled={!issue.fixable} onClick={() => toggleIssue(issue)}>{approved.has(issue.id) && <Check size={14}/>}</button></td>
              <td><span className="rowNo">{issue.rowIndex + 2}</span><small>{issue.recordId}</small></td>
              <td><code>{issue.field}</code></td><td><code className="value">{issue.value || "(공란)"}</code></td>
              <td><span className={`pill p${categories.indexOf(issue.category)}`}>{issue.category}</span></td>
              <td><strong>{issue.reason}</strong><p>{issue.recommendation}</p>{issue.fixable && <small className="auto">승인 후 적용 가능</small>}</td>
            </tr>)}
          </tbody></table></div>
        </div>

        <div className="bottomGrid">
          <article className="aiPanel"><div className="aiTitle"><div className="spark"><Sparkles size={20}/></div><div><h3>AI 보조 검토</h3><p>판단이 불확실한 항목만 가려서 전송합니다.</p></div></div>
            {aiReview ? <div className="aiText">{aiReview}</div> : <button className="secondary" onClick={requestAiReview} disabled={aiLoading}>{aiLoading ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} 애매한 항목 검토하기</button>}
          </article>
          <article className="downloadPanel"><h3>정리 결과 다운로드</h3><p>승인된 {approved.size}건만 반영한 별도 파일을 생성합니다.</p><div><button onClick={downloadCleaned}><Download size={17}/> 정리된 RWD</button><button onClick={downloadLog}><Download size={17}/> 변경 로그</button></div></article>
        </div>
      </section>}

      <footer>RWD Cleaner AI · 테스트용 프로토타입 <span>의료적 판단 및 실제 개인정보 처리 용도가 아닙니다.</span></footer>
    </main>
  );
}
