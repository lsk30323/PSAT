// PSAT 문제풀이 — quiz engine over content/questions.json.
// State machine: home → quiz → result. Wrong answers persist in localStorage.
(function () {
  "use strict";

  const CIRCLED = ["①", "②", "③", "④", "⑤"];
  const SUBJECTS = ["전체", "언어논리", "자료해석", "상황판단"];
  const WRONG_KEY = "psat.wrongIds.v1";

  const $ = (id) => document.getElementById(id);
  const views = { home: $("homeView"), quiz: $("quizView"), result: $("resultView") };
  function show(name) {
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    window.scrollTo(0, 0);
  }

  let bank = [];           // all questions
  let subject = "전체";
  let session = null;      // { items:[{q, picked}], idx, instant }

  const loadWrong = () => {
    try { return new Set(JSON.parse(localStorage.getItem(WRONG_KEY) || "[]")); }
    catch { return new Set(); }
  };
  const saveWrong = (set) => localStorage.setItem(WRONG_KEY, JSON.stringify([...set]));

  // ---- Home -------------------------------------------------------------
  function renderSubjectChips() {
    const box = $("subjectChips");
    box.innerHTML = "";
    SUBJECTS.forEach((s) => {
      const b = document.createElement("button");
      b.className = "chip" + (s === subject ? " active" : "");
      b.textContent = s;
      b.onclick = () => { subject = s; renderSubjectChips(); renderTypes(); updatePool(); };
      box.appendChild(b);
    });
  }

  function filtered() {
    return bank.filter((q) => subject === "전체" || q.subject === subject);
  }

  function renderTypes() {
    const sel = $("typeSelect");
    const types = [...new Set(filtered().map((q) => q.type))].sort();
    sel.innerHTML = '<option value="">전체 유형</option>';
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t; o.textContent = t;
      sel.appendChild(o);
    });
  }

  function poolForStart() {
    const type = $("typeSelect").value;
    return filtered().filter((q) => !type || q.type === type);
  }

  function updatePool() {
    $("poolInfo").textContent = `선택한 범위에 ${poolForStart().length}문항이 있습니다.`;
  }

  function renderWrongBox() {
    const wrong = loadWrong();
    const box = $("wrongNoteBox");
    if (!wrong.size) { box.hidden = true; return; }
    box.hidden = false;
    $("wrongCount").textContent = wrong.size;
  }

  // ---- Session ----------------------------------------------------------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startSession(pool, instant) {
    if (!pool.length) { alert("해당 범위에 문제가 없습니다."); return; }
    let qs = $("shuffleChk").checked ? shuffle(pool) : pool.slice();
    const n = parseInt($("countSelect").value, 10);
    if (n > 0) qs = qs.slice(0, n);
    session = { items: qs.map((q) => ({ q, picked: null })), idx: 0, instant };
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const { items, idx, instant } = session;
    const item = items[idx];
    const q = item.q;
    $("progress").textContent = `${idx + 1} / ${items.length}`;
    $("qSubject").textContent = q.subject;
    $("qType").textContent = q.type;
    $("qBody").innerHTML = marked.parse(q.body || "");

    const answered = item.picked !== null;
    const reveal = instant && answered;

    const box = $("choices");
    box.innerHTML = "";
    q.choices.forEach((text, i) => {
      const n = i + 1;
      const el = document.createElement("button");
      el.className = "choice";
      if (item.picked === n) el.classList.add("selected");
      if (reveal) {
        el.classList.add("disabled");
        if (n === q.answer) el.classList.add("correct");
        else if (n === item.picked) el.classList.add("wrong");
      }
      el.innerHTML = `<span class="num">${CIRCLED[i]}</span><span>${escapeHtml(text)}</span>`;
      el.onclick = () => pick(n);
      box.appendChild(el);
    });

    // Feedback (instant mode)
    const fb = $("feedback");
    if (reveal) {
      const ok = item.picked === q.answer;
      fb.hidden = false;
      fb.innerHTML =
        `<div class="verdict ${ok ? "o" : "x"}">${ok ? "정답입니다 ✓" : "오답입니다 ✗"} — 정답 ${CIRCLED[q.answer - 1]}</div>` +
        (q.explanation ? `<div class="expl">${escapeHtml(q.explanation)}</div>` : "");
    } else {
      fb.hidden = true;
    }

    $("prevBtn").disabled = idx === 0;
    const last = idx === items.length - 1;
    $("nextBtn").hidden = last;
    $("submitBtn").hidden = !last;
  }

  function pick(n) {
    const item = session.items[session.idx];
    if (session.instant && item.picked !== null) return; // lock after answer in instant mode
    item.picked = n;
    renderQuestion();
  }

  function finish() {
    const { items } = session;
    const wrong = loadWrong();
    let correct = 0;
    items.forEach(({ q, picked }) => {
      if (picked === q.answer) { correct++; wrong.delete(q.id); }
      else wrong.add(q.id);
    });
    saveWrong(wrong);
    renderResult(correct);
    show("result");
  }

  function renderResult(correct) {
    const { items } = session;
    const total = items.length;
    const pct = Math.round((correct / total) * 100);
    $("scoreCard").innerHTML =
      `<div class="pct">${pct}점</div><div class="detail">${total}문항 중 ${correct}문항 정답</div>`;

    const wrongItems = items.filter(({ q, picked }) => picked !== q.answer);
    const list = $("reviewList");
    list.innerHTML = wrongItems.length
      ? `<h3>틀린 문제 (${wrongItems.length})</h3>`
      : "<p>모두 맞혔습니다! 🎉</p>";
    wrongItems.forEach(({ q, picked }) => {
      const div = document.createElement("div");
      div.className = "review-item";
      const pickedTxt = picked ? `${CIRCLED[picked - 1]} ${q.choices[picked - 1]}` : "무응답";
      div.innerHTML =
        `<div class="r-head">${q.subject} · ${q.type}</div>` +
        `<div class="r-body">${marked.parse(q.body || "")}</div>` +
        `<div class="r-ans">내 답: <span class="no">${escapeHtml(pickedTxt)}</span> · ` +
        `정답: <span class="ok">${CIRCLED[q.answer - 1]} ${escapeHtml(q.choices[q.answer - 1])}</span></div>` +
        (q.explanation ? `<div class="r-expl">${escapeHtml(q.explanation)}</div>` : "");
      list.appendChild(div);
    });

    $("retryWrongBtn").hidden = wrongItems.length === 0;
    $("retryWrongBtn").onclick = () => startSession(wrongItems.map((x) => x.q), session.instant);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- Wire up ----------------------------------------------------------
  function bindEvents() {
    $("typeSelect").onchange = updatePool;
    $("startBtn").onclick = () => startSession(poolForStart(), $("instantChk").checked);
    $("prevBtn").onclick = () => { if (session.idx > 0) { session.idx--; renderQuestion(); } };
    $("nextBtn").onclick = () => { if (session.idx < session.items.length - 1) { session.idx++; renderQuestion(); } };
    $("submitBtn").onclick = finish;
    $("quitBtn").onclick = () => { if (confirm("그만두면 진행 상황이 사라집니다.")) goHome(); };
    $("homeBtn").onclick = goHome;
    $("reviewWrongBtn").onclick = () => {
      const wrong = loadWrong();
      const pool = bank.filter((q) => wrong.has(q.id));
      startSession(pool, true);
    };
    $("clearWrongBtn").onclick = () => {
      if (confirm("오답노트를 비울까요?")) { saveWrong(new Set()); renderWrongBox(); }
    };
  }

  function goHome() {
    session = null;
    renderSubjectChips();
    renderTypes();
    updatePool();
    renderWrongBox();
    show("home");
  }

  fetch("content/questions.json")
    .then((r) => r.json())
    .then((data) => {
      bank = data.questions || [];
      bindEvents();
      goHome();
    })
    .catch((err) => {
      $("homeView").innerHTML = `<p>문제 데이터를 불러오지 못했습니다: ${err}</p>`;
    });
})();
