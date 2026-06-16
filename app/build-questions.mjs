// Builds www/content/questions.json — the quiz app's question bank.
//
// Sources (all original, learning-purpose content already in this repo):
//   1. 모의고사/모의고사-문제지.md   (+ 정답해설)  → 60 questions w/ explanations
//   2. 문제집/유형별/*.md                          → 90 questions w/ explanations
//   3. app/data/original-questions.json            → hand-authored extras
//
// No third-party / copyrighted past-exam text is fetched or bundled.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..");
const outFile = path.join(appDir, "www", "content", "questions.json");

const CIRCLED = ["①", "②", "③", "④", "⑤"];
const circledToInt = (c) => CIRCLED.indexOf(c) + 1; // 1-based, 0 if not found

const SUBJECT_CODE = { 언어논리: "lang", 자료해석: "data", 상황판단: "sit" };
const TOKEN_SUBJECT = { 언어: "언어논리", 자료: "자료해석", 상황: "상황판단" };

const read = (p) => fs.readFile(p, "utf8");

// Split a block of text into { body, choices[] }. `body` is everything before
// the first ①; each choice runs until the next circled marker.
function splitBodyChoices(text) {
  const lines = text.split("\n");
  // Choices may be bare ("① ...") or bullet-prefixed ("- ① ...").
  // Anchor on the LAST line starting with ① — legal-clause questions use
  // ①②③ as clause markers inside the passage, so the real choice block is
  // the final ①–⑤ run, not the first ① encountered.
  const startMarker = /^\s*(?:[-*>]\s*)?①/;
  let firstChoice = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startMarker.test(lines[i])) firstChoice = i;
  }
  if (firstChoice === -1) return { body: text.trim(), choices: [] };

  const body = lines.slice(0, firstChoice).join("\n").trim();
  const choices = [];
  let cur = null;
  for (const line of lines.slice(firstChoice)) {
    const m = line.match(/^\s*(?:[-*>]\s*)?([①②③④⑤])\s*(.*)$/);
    if (m) {
      if (cur !== null) choices.push(cur.trim());
      cur = m[2];
    } else if (cur !== null) {
      if (/^\s*-{3,}\s*$/.test(line)) continue; // skip horizontal-rule separators
      cur += "\n" + line;
    }
  }
  if (cur !== null) choices.push(cur.trim());
  return { body, choices };
}

// ---- 1. Mock exam --------------------------------------------------------
async function parseMock() {
  const paper = await read(path.join(repoRoot, "모의고사", "모의고사-문제지.md"));
  const key = await read(path.join(repoRoot, "모의고사", "모의고사-정답해설.md"));

  // Answers: parse "정답 일람" tables (문번 row + 정답 row), scoped per subject.
  const answers = {}; // subject -> {num -> int}
  const explan = {}; // subject -> {num -> text}
  const ansSection = key.split(/^##\s+.*해설/m)[0];
  const subjMarkers = [...ansSection.matchAll(/\*\*(언어논리|상황판단|자료해석)\*\*/g)];
  for (let i = 0; i < subjMarkers.length; i++) {
    const subj = subjMarkers[i][1];
    const start = subjMarkers[i].index;
    const end = i + 1 < subjMarkers.length ? subjMarkers[i + 1].index : ansSection.length;
    const block = ansSection.slice(start, end);
    answers[subj] = answers[subj] || {};
    const numRows = [...block.matchAll(/^\|\s*문번\s*\|(.+)\|\s*$/gm)];
    const ansRows = [...block.matchAll(/^\|\s*정답\s*\|(.+)\|\s*$/gm)];
    for (let r = 0; r < Math.min(numRows.length, ansRows.length); r++) {
      const nums = numRows[r][1].split("|").map((s) => s.trim()).filter(Boolean);
      const ans = ansRows[r][1].split("|").map((s) => s.trim()).filter(Boolean);
      nums.forEach((n, idx) => {
        if (ans[idx]) answers[subj][n] = circledToInt(ans[idx]);
      });
    }
  }

  // Explanations: "## <subject> 해설" → "**N. 정답 X**" blocks.
  for (const subj of Object.keys(SUBJECT_CODE)) {
    const m = key.match(new RegExp(`##\\s+${subj}\\s+해설([\\s\\S]*?)(?=\\n##\\s|$)`));
    if (!m) continue;
    explan[subj] = {};
    const blocks = [...m[1].matchAll(/\*\*(\d+)\.\s*정답\s*([①②③④⑤])\*\*([\s\S]*?)(?=\*\*\d+\.\s*정답|$)/g)];
    for (const b of blocks) {
      explan[subj][b[1]] = b[3].trim();
      answers[subj] = answers[subj] || {};
      if (!answers[subj][b[1]]) answers[subj][b[1]] = circledToInt(b[2]);
    }
  }

  // Questions: split paper into subject sections, then by **N.**
  const questions = [];
  const sections = [...paper.matchAll(/^##\s+〔[^〕]+〕\s*(\S+)\s*\(([^)]*)\)\s*$/gm)];
  for (let s = 0; s < sections.length; s++) {
    const subj = sections[s][1];
    if (!SUBJECT_CODE[subj]) continue;
    const start = sections[s].index;
    const end = s + 1 < sections.length ? sections[s + 1].index : paper.length;
    const block = paper.slice(start, end);
    const qMatches = [...block.matchAll(/^\*\*(\d+)\.\*\*\s*([\s\S]*?)(?=^\*\*\d+\.\*\*|^---|$(?![\r\n]))/gm)];
    for (const qm of qMatches) {
      const num = qm[1];
      const { body, choices } = splitBodyChoices(qm[2]);
      if (choices.length < 2) continue;
      questions.push({
        id: `mock-${SUBJECT_CODE[subj]}-${num}`,
        subject: subj,
        type: "모의고사",
        source: "모의고사",
        body,
        choices,
        answer: (answers[subj] && answers[subj][num]) || null,
        explanation: (explan[subj] && explan[subj][num]) || "",
      });
    }
  }
  return questions;
}

// ---- 2. Type-based workbook ---------------------------------------------
async function parseWorkbook() {
  const dir = path.join(repoRoot, "문제집", "유형별");
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  const questions = [];
  for (const file of files) {
    const text = await read(path.join(dir, file));
    const parts = file.replace(/\.md$/, "").split("-");
    const code = parts[0];
    const subject = TOKEN_SUBJECT[parts[1]] || parts[1];
    const type = parts.slice(2).join("-");

    const problemSection = (text.split(/^##\s+(?:\d+\.\s*)?실전\s*문제/m)[1] || "")
      .split(/^##\s+(?:\d+\.\s*)?정답/m)[0];
    // Problem heading: number may be followed by "." or a dash + label.
    const qMatches = [...problemSection.matchAll(/^###\s+문제\s+(\d+)\s*[.–—-]?\s*(.*)\n([\s\S]*?)(?=^###\s+문제\s+\d+|$(?![\r\n]))/gm)];

    // Answers/explanations from the "## 해설" section (bounded to that section).
    const explSection = (text.split(/^##\s+(?:\d+\.\s*)?해설/m)[1] || "").split(/^##\s/m)[0];
    // Each explanation block starts with "### 문제 N ...". The correct answer
    // may sit in the heading ("정답 ③") or in the body ("→ 정답 ④"); take the
    // first "정답 ⟨①–⑤⟩" in the block ("오답 ②" markers don't match).
    const ansMap = {};
    for (const e of explSection.matchAll(/^###\s+문제\s+(\d+)\b([\s\S]*?)(?=^###\s+문제\s+\d+|$(?![\r\n]))/gm)) {
      const m = e[2].match(/정답\s*([①②③④⑤])/);
      if (m) ansMap[e[1]] = { answer: circledToInt(m[1]), explanation: e[2].trim() };
    }

    for (const qm of qMatches) {
      const num = qm[1];
      const prompt = qm[2].trim();
      const { body, choices } = splitBodyChoices(qm[3]);
      if (choices.length < 2) continue;
      const fullBody = prompt ? `${prompt}\n\n${body}` : body;
      questions.push({
        id: `wb-${code}-${num}`,
        subject,
        type,
        source: "문제집",
        body: fullBody.trim(),
        choices,
        answer: ansMap[num] ? ansMap[num].answer : null,
        explanation: ansMap[num] ? ansMap[num].explanation : "",
      });
    }
  }
  return questions;
}

// ---- 3. Hand-authored + generated originals (all data/*.json) -----------
async function parseOriginals() {
  const dir = path.join(appDir, "data");
  let files = [];
  try { files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort(); } catch { return []; }
  const out = [];
  for (const file of files) {
    let raw;
    try { raw = JSON.parse(await read(path.join(dir, file))); } catch { continue; }
    (raw.questions || []).forEach((q, i) => {
      out.push({
        id: q.id || `${file.replace(/\.json$/, "")}-${i + 1}`,
        subject: q.subject,
        type: q.type || "오리지널",
        source: q.source || "오리지널",
        body: q.body,
        choices: q.choices,
        answer: q.answer,
        explanation: q.explanation || "",
      });
    });
  }
  return out;
}

async function main() {
  const [mock, workbook, originals] = await Promise.all([
    parseMock(),
    parseWorkbook(),
    parseOriginals(),
  ]);
  const raw = [...mock, ...workbook, ...originals];

  // Deduplicate by id (first wins).
  const seen = new Set();
  const deduped = raw.filter((q) => (seen.has(q.id) ? false : seen.add(q.id)));

  // Ship only complete, answerable questions (valid answer + 4–5 choices).
  const valid = (q) =>
    q.answer >= 1 && q.answer <= q.choices.length &&
    q.choices.length >= 4 && q.choices.length <= 5 && q.body;
  const questions = deduped.filter(valid);
  const excluded = deduped.filter((q) => !valid(q));

  const bySubject = {};
  questions.forEach((q) => (bySubject[q.subject] = (bySubject[q.subject] || 0) + 1));

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(
    outFile,
    JSON.stringify(
      { version: 1, generatedAt: new Date().toISOString().slice(0, 10), count: questions.length, questions },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Parsed ${deduped.length} (mock ${mock.length}, workbook ${workbook.length}, original ${originals.length})`);
  console.log(`Shipped ${questions.length} valid questions. By subject:`, bySubject);
  if (excluded.length)
    console.warn(`Excluded ${excluded.length} incomplete (graph-choice / unmatched answer):`, excluded.map((q) => q.id).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
