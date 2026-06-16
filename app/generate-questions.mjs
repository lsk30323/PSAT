// Deterministically generates ORIGINAL practice questions whose answers are
// guaranteed correct by construction (computed or logically derived).
// Output: app/data/generated-questions.json  (merged by build-questions.mjs)
//
// Everything here is synthetic — random numbers, fictional names, formal
// logic. No external or copyrighted text is involved.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(appDir, "data", "generated-questions.json");
const PER_SUBJECT = 250;

// ---- seeded RNG (mulberry32) — reproducible builds ----------------------
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260616);
const ri = (min, max) => Math.floor(rng() * (max - min + 1)) + min; // inclusive
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fmt = (n) => n.toLocaleString("en-US");
const CIRCLED = ["①", "②", "③", "④", "⑤"];

// Korean josa picker based on whether the last char has a final consonant.
function hasJong(word) {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
}
const eunNeun = (w) => w + (hasJong(w) ? "은" : "는");

// Build a 5-option MCQ from a correct string + distractor strings.
// Throws if a clean 1+4 distinct set can't be formed (keeps answers honest).
function mcq(correct, distractors) {
  const uniq = [];
  for (const d of distractors) {
    if (d !== correct && !uniq.includes(d)) uniq.push(d);
    if (uniq.length === 4) break;
  }
  if (uniq.length < 4) throw new Error("not enough distractors for: " + correct);
  const choices = shuffle([correct, ...uniq]);
  return { choices, answer: choices.indexOf(correct) + 1 };
}
// Numeric MCQ: distractor candidates are numbers; format with fmtFn.
function numMcq(correct, candidates, fmtFn) {
  const c = fmtFn(correct);
  return mcq(c, candidates.map(fmtFn));
}

// =========================================================================
// 자료해석
// =========================================================================
const dataTemplates = [
  // 증가율
  () => {
    const base = ri(2, 40) * 100;
    const g = pick([5, 6, 8, 10, 12, 15, 18, 20, 24, 25, 30]);
    const after = base + Math.round((base * g) / 100);
    const unit = pick(["만 원", "건", "명", "톤"]);
    const subj = pick(["A사의 매출액", "B기관의 민원 처리 건수", "C시의 신규 가입자 수", "D공장의 생산량"]);
    const { choices, answer } = numMcq(
      g,
      [g + 5, g - 3, g + 10, g - 5, Math.round(((after - base) / after) * 100), g + 2],
      (x) => `${x}%`
    );
    return {
      subject: "자료해석", type: "비율증가율",
      body: `${subj}은 작년 ${fmt(base)}${unit}에서 올해 ${fmt(after)}${unit}로 변하였다.\n\n작년 대비 올해의 증가율은?`,
      choices, answer,
      explanation: `증가율 = (올해 − 작년) ÷ 작년 × 100 = (${fmt(after)} − ${fmt(base)}) ÷ ${fmt(base)} × 100 = ${g}%.`,
    };
  },
  // 비중 변화 (%p)
  () => {
    const t1 = pick([1000, 1500, 2000, 2500]);
    const p1 = pick([20, 25, 30, 35, 40]);
    const part1 = Math.round((t1 * p1) / 100);
    const t2 = pick([2000, 2500, 3000, 4000]);
    const p2 = pick([30, 35, 40, 45, 50].filter((x) => x !== p1));
    const part2 = Math.round((t2 * p2) / 100);
    const diff = p2 - p1;
    const dir = diff > 0 ? "증가" : "감소";
    const correct = `${p1}%에서 ${p2}%로 ${Math.abs(diff)}%p ${dir}했다.`;
    const distractors = [
      `${p1}%에서 ${p2}%로 ${Math.abs(diff)}% ${dir}했다.`,
      `${p2}%에서 ${p1}%로 ${Math.abs(diff)}%p ${diff > 0 ? "감소" : "증가"}했다.`,
      `${p1}%에서 ${p2}%로 변화가 없다.`,
      `${p1}%에서 ${p2}%로 ${Math.abs(diff) + 5}%p ${dir}했다.`,
      `비중은 ${p1}%로 변화가 없다.`,
    ];
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "자료해석", type: "비율증가율",
      body: `어느 지역의 전체 가구는 작년 ${fmt(t1)}가구(이 중 1인 가구 ${fmt(part1)}가구)에서 올해 ${fmt(t2)}가구(이 중 1인 가구 ${fmt(part2)}가구)로 변하였다.\n\n전체 가구 중 1인 가구가 차지하는 비중의 변화로 옳은 것은?`,
      choices, answer,
      explanation: `작년 비중 ${part1}/${t1}=${p1}%, 올해 ${part2}/${t2}=${p2}%. 비중 차이는 ${Math.abs(diff)}%p(퍼센트포인트) ${dir}. '%'가 아니라 '%p'로 표기해야 정확하다.`,
    };
  },
  // 원가 → 정가 → 할인
  () => {
    const cost = ri(8, 30) * 1000;
    const margin = pick([20, 25, 30, 40, 50]);
    const disc = pick([10, 15, 20, 25]);
    const list = cost * (1 + margin / 100);
    const final = Math.round(list * (1 - disc / 100));
    const { choices, answer } = numMcq(
      final,
      [Math.round(list), cost, Math.round(cost * (1 - disc / 100)), final + 1000, Math.round(list * (1 - (disc + 5) / 100))],
      (x) => `${fmt(x)}원`
    );
    return {
      subject: "자료해석", type: "단순계산",
      body: `어떤 상품의 원가는 ${fmt(cost)}원이다. 원가에 ${margin}%의 이윤을 붙여 정가를 정한 뒤, 정가에서 ${disc}%를 할인하여 판매하였다.\n\n실제 판매 가격은?`,
      choices, answer,
      explanation: `정가 = ${fmt(cost)} × ${(1 + margin / 100).toFixed(2)} = ${fmt(list)}원. 판매가 = ${fmt(list)} × ${(1 - disc / 100).toFixed(2)} = ${fmt(final)}원.`,
    };
  },
  // 배수 비교
  () => {
    const small = ri(12, 60);
    const mult = pick([2, 3, 4, 5]);
    const big = small * mult;
    const { choices, answer } = numMcq(
      mult,
      [mult + 1, mult - 1, mult + 2, big - small, Math.round((big / small) * 10) / 10 + 0.5],
      (x) => `${x}배`
    );
    return {
      subject: "자료해석", type: "단순계산",
      body: `갑 지역의 도서관 수는 ${small}개, 을 지역의 도서관 수는 ${big}개이다.\n\n을 지역의 도서관 수는 갑 지역의 몇 배인가?`,
      choices, answer,
      explanation: `${big} ÷ ${small} = ${mult}배.`,
    };
  },
  // 평균
  () => {
    const n = pick([4, 5]);
    const vals = Array.from({ length: n }, () => ri(60, 95));
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / n;
    const avgR = Math.round(avg * 10) / 10;
    const { choices, answer } = numMcq(
      avgR,
      [avgR + 1, avgR - 1, Math.round((sum / (n + 1)) * 10) / 10, avgR + 2.5, Math.max(...vals)],
      (x) => `${x}점`
    );
    return {
      subject: "자료해석", type: "단순계산",
      body: `어느 응시자의 ${n}개 과목 점수는 각각 ${vals.join(", ")}점이다.\n\n이 응시자의 평균 점수는? (소수 둘째 자리에서 반올림)`,
      choices, answer,
      explanation: `평균 = (${vals.join("+")}) ÷ ${n} = ${sum} ÷ ${n} ≈ ${avgR}점.`,
    };
  },
  // 가중평균 (집단 크기가 다른 두 평균의 전체 평균)
  () => {
    const n1 = pick([20, 25, 30, 40]);
    const n2 = pick([50, 60, 75, 80]);
    const a1 = ri(60, 74);
    const a2 = ri(80, 94);
    const overall = (n1 * a1 + n2 * a2) / (n1 + n2);
    const overallR = Math.round(overall * 10) / 10;
    const simpleMean = Math.round(((a1 + a2) / 2) * 10) / 10;
    const { choices, answer } = numMcq(
      overallR,
      [simpleMean, a1, a2, overallR + 2, overallR - 2.5],
      (x) => `${x}점`
    );
    return {
      subject: "자료해석", type: "가중평균",
      body: `A반 ${n1}명의 평균 점수는 ${a1}점, B반 ${n2}명의 평균 점수는 ${a2}점이다.\n\n두 반을 합한 전체 ${n1 + n2}명의 평균 점수는? (소수 둘째 자리에서 반올림)`,
      choices, answer,
      explanation: `전체 평균 = (${n1}×${a1} + ${n2}×${a2}) ÷ ${n1 + n2} = ${fmt(n1 * a1 + n2 * a2)} ÷ ${n1 + n2} ≈ ${overallR}점. 두 평균의 단순 평균(${simpleMean}점)이 아니라 인원수로 가중해야 한다.`,
    };
  },
];

// =========================================================================
// 상황판단
// =========================================================================
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const d2 = (n) => String(n).padStart(2, "0");
function addDays(date, n) { return new Date(date.getTime() + n * 86400000); }
function fmtDate(dt) {
  return `${dt.getUTCFullYear()}년 ${dt.getUTCMonth() + 1}월 ${dt.getUTCDate()}일(${WD[dt.getUTCDay()]})`;
}

const sitTemplates = [
  // 기간 / 기산일 계산 (조문형)
  () => {
    const N = pick([7, 14, 30]);
    const start = new Date(Date.UTC(2026, ri(0, 9), ri(1, 20)));
    // 초일불산입: 말일 = 받은 날 + N. 말일이 토/일이면 다음 평일로.
    let due = addDays(start, N);
    while (due.getUTCDay() === 0 || due.getUTCDay() === 6) due = addDays(due, 1);
    const correct = fmtDate(due);
    // Off-by-N date errors around the correct deadline — always 4 distinct.
    const distractors = [-2, -1, 1, 2].map((o) => fmtDate(addDays(due, o)));
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "상황판단", type: "법조문",
      body: `제○조(신청기간) ① 처분의 통지를 받은 자는 통지를 받은 날부터 ${N}일 이내에 이의신청을 하여야 한다.\n② 기간을 계산할 때 초일은 산입하지 아니한다.\n③ 기간의 말일이 토요일 또는 일요일인 경우에는 그 다음 평일에 기간이 만료한다.\n\n〈상황〉 甲은 ${fmtDate(start)}에 처분의 통지를 받았다.\n\n위 규정에 따른 이의신청 기간의 말일은?`,
      choices, answer,
      explanation: `초일불산입이므로 말일은 받은 날 + ${N}일 = ${fmtDate(addDays(start, N))}. 이 날이 휴일이면 다음 평일로 옮겨 ${correct}이 말일이 된다.`,
    };
  },
  // 순서(키 큰 순) 논리
  () => {
    const names = shuffle(["민준", "서연", "지호", "하은", "도윤", "수아", "예준"]).slice(0, 5);
    const order = shuffle(names); // order[0] = 가장 큼
    const clues = [];
    for (let i = 0; i < order.length - 1; i++) clues.push(`${eunNeun(order[i])} ${order[i + 1]}보다 키가 크다.`);
    const rank = pick([0, 1, 2, 3, 4]);
    const label = ["가장 키가 큰", "두 번째로 키가 큰", "세 번째로 키가 큰", "네 번째로 키가 큰", "가장 키가 작은"][rank];
    const correct = order[rank];
    const { choices, answer } = mcq(correct, names.filter((n) => n !== correct));
    return {
      subject: "상황판단", type: "논리퍼즐",
      body: `다섯 사람 ${names.join(", ")}의 키에 대해 다음이 알려져 있다.\n\n${shuffle(clues).map((c) => "- " + c).join("\n")}\n\n${label} 사람은?`,
      choices, answer,
      explanation: `단서를 이어 키 순서를 정하면 ${order.join(" > ")}. 따라서 ${label} 사람은 ${correct}.`,
    };
  },
  // 가위바위보 (이행적)
  () => {
    const RPS = { 보: "바위", 바위: "가위", 가위: "보" }; // key beats value
    const A = pick(["보", "바위", "가위"]);
    const B = RPS[A]; // A가 B를 이김
    const C = Object.keys(RPS).find((k) => RPS[k] === B); // C가 B를 이김
    const correct = C;
    const { choices, answer } = mcq(correct, ["가위", "바위", "보", "가위 또는 바위", "알 수 없다"]);
    return {
      subject: "상황판단", type: "수리게임",
      body: `갑, 을, 병이 가위바위보를 한 번 했다(비긴 사람 없음).\n\n- 갑은 ${A}를 냈다.\n- 을은 갑에게 졌다.\n- 병은 을에게 이겼다.\n\n병이 낸 것은?`,
      choices, answer,
      explanation: `갑이 ${A} → 을은 ${A}에게 지는 ${B}. 병은 ${B}에게 이기므로 ${B}를 이기는 ${C}. 따라서 병은 ${C}.`,
    };
  },
  // 가중점수 의사결정
  () => {
    const opts = ["A안", "B안", "C안", "D안", "E안"];
    const w1 = pick([2, 3]), w2 = pick([1, 2]);
    let scored;
    do {
      scored = opts.map((o) => {
        const s1 = ri(4, 10), s2 = ri(4, 10);
        return { o, s1, s2, total: s1 * w1 + s2 * w2 };
      });
      var max = Math.max(...scored.map((x) => x.total));
    } while (scored.filter((x) => x.total === max).length !== 1);
    const best = scored.find((x) => x.total === max).o;
    const rows = scored.map((x) => `| ${x.o} | ${x.s1} | ${x.s2} |`).join("\n");
    const { choices, answer } = mcq(best, opts.filter((o) => o !== best));
    return {
      subject: "상황판단", type: "의사결정",
      body: `어떤 사업의 대안을 '효과'와 '비용절감' 두 기준으로 평가한다. 최종 점수 = 효과 × ${w1} + 비용절감 × ${w2} 이며, 점수가 가장 높은 대안을 선택한다.\n\n| 대안 | 효과 | 비용절감 |\n|---|---|---|\n${rows}\n\n선택되는 대안은?`,
      choices, answer,
      explanation: scored.map((x) => `${x.o}: ${x.s1}×${w1}+${x.s2}×${w2}=${x.total}`).join(", ") + `. 최고점은 ${best}.`,
    };
  },
  // 나이/연도 계산
  () => {
    const people = shuffle(["갑", "을", "병", "정"]).slice(0, 3);
    const births = {};
    people.forEach((p) => (births[p] = ri(1985, 2002)));
    const uniqYears = new Set(Object.values(births));
    if (uniqYears.size !== people.length) return sitTemplates[4](); // retry distinctness
    const kind = pick(["가장 나이가 많은", "가장 나이가 적은"]);
    const sorted = [...people].sort((a, b) => births[a] - births[b]); // oldest first
    const correct = kind.includes("많은") ? sorted[0] : sorted[sorted.length - 1];
    const facts = people.map((p) => `${p}은(는) ${births[p]}년생이다.`);
    const { choices, answer } = mcq(correct, people.filter((p) => p !== correct).concat(["모두 동갑이다", "알 수 없다"]));
    return {
      subject: "상황판단", type: "수리게임",
      body: `${facts.join(" ")} (나이는 출생 연도로만 비교한다.)\n\n세 사람 중 ${kind} 사람은?`,
      choices, answer,
      explanation: `출생 연도가 빠를수록 나이가 많다. ${sorted.map((p) => `${p}(${births[p]})`).join(" < ")} 순. 따라서 ${kind} 사람은 ${correct}.`,
    };
  },
  // 정보매칭 (조건 모두 충족하는 사람 찾기)
  () => {
    const minAge = pick([19, 20]);
    const minSteps = pick([10000, 12000]);
    const minStreak = pick([5, 7]);
    const desc = (a, s, k) => `만 ${a}세, 월 평균 ${fmt(s)}보, 연속 달성 ${k}일`;
    const correct = desc(minAge + ri(1, 30), minSteps + ri(500, 3000), minStreak + ri(0, 4));
    const distractors = [
      desc(minAge - ri(1, 2), minSteps + ri(500, 2000), minStreak + 2),   // 나이 미달
      desc(minAge + ri(2, 10), minSteps - ri(500, 2000), minStreak + 1),  // 걸음 미달
      desc(minAge + ri(2, 10), minSteps + ri(500, 2000), minStreak - ri(1, 3)), // 연속 미달
      desc(minAge - 2, minSteps - 1000, minStreak - 1),                   // 복합 미달
    ];
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "상황판단", type: "정보매칭",
      body: `○○시는 걷기 앱 가입자에게 「건강걸음 A등급」을 부여한다. A등급은 아래 세 조건을 **모두** 충족하는 사람에게만 부여한다.\n\n- 만 ${minAge}세 이상\n- 월 평균 걸음 수 ${fmt(minSteps)}보 이상\n- 하루 1만 보 이상을 연속으로 달성한 최장 기록이 ${minStreak}일 이상\n\n다음 중 A등급에 해당하는 사람은?`,
      choices, answer,
      explanation: `세 조건(나이 만 ${minAge}세 이상, 걸음 ${fmt(minSteps)}보 이상, 연속 ${minStreak}일 이상)을 모두 만족하는 사람은 '${correct}' 하나뿐이다. 나머지는 한 가지 이상에서 기준에 미달한다.`,
    };
  },
];

// =========================================================================
// 언어논리
// =========================================================================
const langTemplates = [
  // 형식논리 — 반드시 참
  () => {
    const labels = shuffle(["A", "B", "C", "D", "E", "F"]).slice(0, 5);
    const verb = pick([["도입", "도입하지 않는다", "도입한다"], ["채택", "채택하지 않는다", "채택한다"], ["시행", "시행하지 않는다", "시행한다"]]);
    const litText = (label, sign) => `${label} 정책을 ${sign ? verb[2] : verb[1]}`;
    // chain: v0(+) → v1(s1) → ... fully fires; all forced.
    const signs = [true];
    for (let i = 1; i < labels.length; i++) signs.push(rng() < 0.5);
    const rules = [];
    for (let i = 0; i < labels.length - 1; i++) {
      rules.push(`${litText(labels[i], signs[i])}면 ${litText(labels[i + 1], signs[i + 1])}.`);
    }
    const correct = litText(labels[labels.length - 1], signs[labels.length - 1]) + ".";
    const distractors = [];
    for (let i = 0; i < labels.length - 1; i++) distractors.push(litText(labels[i], !signs[i]) + ".");
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "언어논리", type: "논리명제",
      body: `다음 진술이 모두 참이라고 하자.\n\n${shuffle(rules).map((r) => "- " + r).join("\n")}\n\n${labels[0]} 정책을 ${verb[0]}하기로 확정되었을 때, 반드시 참인 것은?`,
      choices, answer,
      explanation: `전제로부터 차례로 따라가면 ${labels.map((l, i) => litText(l, signs[i])).join(" → ")}가 모두 도출된다. 보기 중 이와 일치하는 '${correct}'만 반드시 참이고, 나머지는 도출된 결론과 어긋난다.`,
    };
  },
  // 일치부합 — 합성 지문 (지자체 제도)
  () => {
    const city = pick(["가람시", "노을시", "벼리시", "다온시", "마루시"]);
    const prog = pick(["걷기지원금", "건강마일리지", "이웃돌봄수당", "푸른교통비"]);
    const age = pick([19, 18, 20, 65]);
    const amount = pick([3, 5, 10]);
    const cap = pick([6, 12]);
    const except = pick(["타 지자체에서 동일 지원을 받는 사람", "신청일 기준 전입 1개월 미만인 사람"]);
    const passage = `${city}는 주민 건강을 위해 「${prog}」을 운영한다. 이 제도는 만 ${age}세 이상 주민에게만 신청 자격을 부여하며, 매달 조건을 충족한 주민에게 ${amount}만 원을 지급한다. 다만 지급은 1년에 최대 ${cap}회로 제한되고, ${except}은 지급 대상에서 제외된다.`;
    const correct = `${prog}의 월 지급액은 ${amount}만 원이다.`;
    const distractors = [
      `${prog}은 만 ${age}세 미만 주민에게도 신청 자격을 준다.`,
      `${prog}의 지급에는 연간 횟수 제한이 없다.`,
      `${except}도 ${prog}을 받을 수 있다.`,
      `${prog}의 월 지급액은 ${amount + 2}만 원이다.`,
      `${prog}은 ${city} 외부 주민도 신청할 수 있다.`,
    ];
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "언어논리", type: "일치부합",
      body: `${passage}\n\n윗글의 내용과 일치하는 것은?`,
      choices, answer,
      explanation: `지문은 월 ${amount}만 원 지급을 명시하므로 '${correct}'이 일치한다. 나머지는 자격 연령·횟수 제한·제외 대상·금액을 지문과 다르게 바꾼 진술이다.`,
    };
  },
  // 일치부합 — 합성 지문 (가상 생물)
  () => {
    const animal = pick(["쿠르카", "발레돈", "시라모", "넵투리아"]);
    const habitat = pick(["고산 침엽수림", "건조한 초원", "심해의 열수구 주변", "맹그로브 습지"]);
    const food = pick(["야간에 곤충", "주로 해조류", "작은 갑각류"]);
    const trait = pick(["체온을 스스로 조절하지 못해 외부 온도에 의존한다", "한 번에 알을 하나만 낳는다", "낮에는 굴에서 휴식한다"]);
    const passage = `${animal}는 ${habitat}에 서식하는 동물이다. 이 동물은 ${food}을(를) 먹으며, ${trait}. 번식기에만 무리를 이루고 평소에는 단독으로 생활한다.`;
    const correct = `${animal}는 ${habitat}에 산다.`;
    const distractors = [
      `${animal}는 항상 무리를 지어 생활한다.`,
      `${animal}는 번식기에도 단독으로만 생활한다.`,
      `${animal}는 ${habitat}이(가) 아닌 곳에 서식한다.`,
      `${animal}는 식물만 먹는다.`,
      `${animal}는 알을 낳지 않는다.`,
    ];
    const { choices, answer } = mcq(correct, distractors);
    return {
      subject: "언어논리", type: "일치부합",
      body: `${passage}\n\n윗글에서 알 수 있는 것은?`,
      choices, answer,
      explanation: `지문은 ${animal}의 서식지가 ${habitat}이라고 명시한다('${correct}'). 나머지는 무리 생활 여부·서식지·식성 등을 지문과 다르게 진술한 것이다.`,
    };
  },
  // 강화·약화 — 인과 주장에 대한 평가 (무작위 배정 실험이 정답)
  () => {
    const cases = [
      {
        claim: "규칙적인 걷기 운동은 불면증을 완화한다",
        rct: "걷기 시간을 무작위로 배정한 별도 실험에서, 걷기를 늘린 집단의 불면증 발생률이 대조군보다 유의하게 낮았다",
        reverse: "원래 불면 증상이 없어 밤에 잘 자는 사람일수록 낮 동안 더 활발히 걸어 걸음 수가 많았다",
        confound: "걸음 수가 많은 집단은 평균적으로 침실의 소음·조도 환경이 더 좋았다",
        irrelevant: "조사 대상 지역의 연평균 기온이 전국 평균보다 높았다",
        third: "걷기 여부와 무관하게 카페인 섭취량이 많은 사람일수록 불면증 진단 비율이 높았다",
      },
      {
        claim: "독서량을 늘리면 어휘력이 향상된다",
        rct: "참가자에게 독서량을 무작위로 배정한 실험에서, 독서를 늘린 집단의 어휘 시험 점수가 대조군보다 유의하게 높았다",
        reverse: "원래 어휘력이 높은 사람일수록 책을 더 쉽고 재미있게 읽어 독서량이 많았다",
        confound: "독서량이 많은 집단은 부모의 평균 학력이 더 높았다",
        irrelevant: "조사에 참여한 사람들의 평균 키가 전국 평균과 비슷했다",
        third: "독서량과 무관하게 수면 시간이 긴 사람일수록 어휘 점수가 높았다",
      },
      {
        claim: "아침 식사를 하면 학업 집중도가 높아진다",
        rct: "아침 식사 여부를 무작위로 배정한 실험에서, 아침을 먹은 집단의 오전 수업 집중도 점수가 대조군보다 유의하게 높았다",
        reverse: "원래 집중을 잘하는 규칙적인 학생일수록 아침을 거르지 않고 챙겨 먹는 경향이 있었다",
        confound: "아침을 먹은 학생들은 평균 수면 시간이 더 길었다",
        irrelevant: "조사 대상 학교의 운동장 면적이 평균보다 넓었다",
        third: "아침 식사와 무관하게 사교육 시간이 많은 학생일수록 집중도가 높았다",
      },
      {
        claim: "재택근무를 도입하면 직원의 업무 생산성이 높아진다",
        rct: "직원을 재택근무 집단과 사무실 근무 집단에 무작위로 배정한 실험에서, 재택 집단의 생산성 지표가 유의하게 높았다",
        reverse: "원래 성과가 높아 신뢰받는 직원일수록 재택근무를 더 자주 허가받았다",
        confound: "재택근무를 한 직원들은 평균적으로 더 최신의 업무용 장비를 지급받았다",
        irrelevant: "조사에 참여한 회사들의 평균 설립 연도가 비슷했다",
        third: "재택 여부와 무관하게 담당 업무 난이도가 낮은 직원일수록 생산성이 높았다",
      },
      {
        claim: "녹지 공간이 늘어나면 주민의 우울감이 줄어든다",
        rct: "거주 지역의 소규모 녹지 조성 여부를 무작위로 배정한 실험에서, 녹지가 조성된 지역 주민의 우울 척도 점수가 대조군보다 유의하게 낮았다",
        reverse: "원래 정서가 안정된 주민일수록 공원이 많은 동네를 골라 이사하는 경향이 있었다",
        confound: "녹지가 많은 지역은 평균 소득과 의료 접근성이 더 높았다",
        irrelevant: "조사 대상 도시의 연간 강수량이 전국 평균과 비슷했다",
        third: "녹지와 무관하게 이웃 교류가 잦은 주민일수록 우울감이 낮았다",
      },
      {
        claim: "수면 시간을 늘리면 기억력 시험 성적이 향상된다",
        rct: "참가자의 수면 시간을 무작위로 배정한 실험에서, 수면을 늘린 집단의 기억력 시험 성적이 대조군보다 유의하게 높았다",
        reverse: "원래 기억력이 좋아 공부를 빨리 끝낸 사람일수록 잠을 더 오래 잘 수 있었다",
        confound: "수면 시간이 긴 집단은 평균적으로 스트레스 수준이 더 낮았다",
        irrelevant: "조사에 참여한 사람들의 평균 통근 거리가 비슷했다",
        third: "수면과 무관하게 평소 운동량이 많은 사람일수록 기억력 점수가 높았다",
      },
    ];
    const c = pick(cases);
    const { choices, answer } = mcq(c.rct, [c.reverse, c.confound, c.irrelevant, c.third]);
    return {
      subject: "언어논리", type: "강화약화",
      body: `연구자 K는 관찰 자료에서 두 변수의 상관관계를 확인한 뒤 "${c.claim}"라고 주장하였다.\n\nK의 논증을 가장 강화하는 것은?`,
      choices, answer,
      explanation: `무작위 배정 실험(${"RCT"})은 역인과·교란변수를 통제하므로 인과 주장을 직접 뒷받침한다 → 정답. 역인과(원래 ~한 사람일수록), 교란변수(제3의 공통 원인), 무관한 사실, 다른 원인 제시는 강화하지 못하거나 오히려 약화한다.`,
    };
  },
];

// ---- difficulty (하/중/상) by subject·type ------------------------------
const DIFFICULTY = {
  "자료해석/단순계산": "하", "자료해석/비율증가율": "중", "자료해석/가중평균": "상",
  "상황판단/수리게임": "하", "상황판단/법조문": "중", "상황판단/논리퍼즐": "중",
  "상황판단/의사결정": "중", "상황판단/정보매칭": "상",
  "언어논리/일치부합": "중", "언어논리/논리명제": "상", "언어논리/강화약화": "상",
};

// ---- assemble -----------------------------------------------------------
function generate(templates, subjectLabel, n, prefix) {
  const out = [];
  const seenBodies = new Set();
  let guard = 0;
  while (out.length < n && guard < n * 60) {
    guard++;
    const tpl = templates[guard % templates.length];
    let q;
    try { q = tpl(); } catch { continue; }
    if (!q || q.subject !== subjectLabel) continue;
    if (q.answer < 1 || q.answer > q.choices.length) continue;
    if (new Set(q.choices).size !== q.choices.length) continue;
    if (seenBodies.has(q.body)) continue;
    seenBodies.add(q.body);
    q.id = `${prefix}-${out.length + 1}`;
    q.source = "오리지널(생성)";
    q.difficulty = DIFFICULTY[`${q.subject}/${q.type}`] || "중";
    out.push(q);
  }
  if (out.length < n) throw new Error(`${subjectLabel}: only generated ${out.length}/${n}`);
  return out;
}

async function main() {
  const questions = [
    ...generate(dataTemplates, "자료해석", PER_SUBJECT, "gen-data"),
    ...generate(sitTemplates, "상황판단", PER_SUBJECT, "gen-sit"),
    ...generate(langTemplates, "언어논리", PER_SUBJECT, "gen-lang"),
  ];
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify({ note: "Auto-generated original questions — do not edit by hand; run `npm run build:generate`.", questions }, null, 2), "utf8");
  const by = {};
  questions.forEach((q) => (by[q.subject] = (by[q.subject] || 0) + 1));
  console.log(`Generated ${questions.length} questions:`, by);
}
main().catch((e) => { console.error(e); process.exit(1); });
