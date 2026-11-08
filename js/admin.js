/* MTVBD Sports — অ্যাডমিন প্যানেল */
(() => {
  const C = window.CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const root = $("#app");
  const STATUS = { live: "লাইভ", upcoming: "আসন্ন", completed: "সম্পন্ন" };
  const ICON = { "ফুটবল": "⚽", "ক্রিকেট": "🏏", "কাবাডি": "🤼" };

  const configured = C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !/YOUR_/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY);
  let sb = null, user = null, tournaments = [], view = "dash";

  /* ইউটিউব চ্যানেলের লিংক — নতুন ফিক্সচার/ফলাফল সারিতে ডিফল্ট হিসেবে বসে (সেটিংস থেকে বদলানো যায়) */
  const DEFAULT_YT = "https://www.youtube.com/@mymensinghtvbd24";
  let ytChannel = DEFAULT_YT;
  async function loadChannel() {
    try {
      const { data } = await sb.from("settings").select("value").eq("key", "youtube").maybeSingle();
      if (data && /^https?:\/\//i.test(data.value || "")) ytChannel = data.value.trim();
    } catch (e) {}
  }

  /* ---------- helpers ---------- */
  let toastTimer;
  function toast(msg, bad) {
    const t = $("#toast");
    t.textContent = msg; t.className = "show" + (bad ? " bad" : "");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.className = ""), 3500);
  }
  function ytId(u) {
    if (!u) return null; u = u.trim();
    if (/^[\w-]{11}$/.test(u)) return u;
    try {
      const x = new URL(u), h = x.hostname.replace(/^(www|m)\./, "");
      if (h === "youtu.be") return x.pathname.slice(1, 12);
      if (h.endsWith("youtube.com")) {
        const v = x.searchParams.get("v"); if (v) return v;
        const m = x.pathname.match(/\/(live|embed|shorts)\/([\w-]{11})/); if (m) return m[2];
      }
    } catch (e) {}
    return null;
  }
  const errText = e => {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return "ইমেইল বা পাসওয়ার্ড ভুল।";
    if (/Failed to fetch|NetworkError/i.test(m)) return "ইন্টারনেট সংযোগ বা Supabase URL ঠিক নেই।";
    if (/row-level security|permission denied/i.test(m)) return "অনুমতি নেই — সেটআপ SQL চালানো হয়েছে কি না এবং লগইন আছে কি না দেখুন।";
    if (/relation .* does not exist|schema cache/i.test(m)) return "টেবিল পাওয়া যায়নি — supabase-setup.sql চালানো হয়নি।";
    return m;
  };
  const busy = (btn, on, txt) => { if (!btn) return; if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || "অপেক্ষা করুন…"; btn.disabled = true; } else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; } };

  /* ---------- boot ---------- */
  async function boot() {
    if (!configured) {
      root.innerHTML = `<div class="login-wrap"><div class="login-card"><div class="logo">⚙️</div><h1>সেটআপ বাকি</h1><div class="warn"><b>js/config.js</b> ফাইলে Supabase-এর <b>URL</b> ও <b>Publishable (anon) key</b> এখনো বসানো হয়নি। গাইডের ধাপ অনুযায়ী বসিয়ে আবার আপলোড করুন।</div></div></div>`;
      return;
    }
    if (!window.supabase) { root.innerHTML = `<div class="boot">Supabase লাইব্রেরি লোড হয়নি। ইন্টারনেট সংযোগ দেখুন।</div>`; return; }
    sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
    const { data } = await sb.auth.getSession();
    if (data.session) { user = data.session.user; renderShell(); } else renderLogin();
    sb.auth.onAuthStateChange((ev, session) => { if (ev === "SIGNED_OUT") { user = null; renderLogin(); } });
  }

  /* ---------- login ---------- */
  function renderLogin(msg) {
    root.innerHTML = `<div class="login-wrap"><form class="login-card" id="lf">
      <div class="logo">📡</div><h1>MTVBD Sports</h1><p class="sub">অ্যাডমিন লগইন</p>
      <label class="f"><span>ইমেইল</span><input type="email" id="em" required autocomplete="username"></label>
      <label class="f"><span>পাসওয়ার্ড</span><input type="password" id="pw" required autocomplete="current-password"></label>
      <div class="err" id="err">${esc(msg || "")}</div>
      <button class="btn" style="width:100%">লগইন করুন</button></form></div>`;
    $("#lf").addEventListener("submit", async e => {
      e.preventDefault();
      const b = $("#lf button"); busy(b, true, "লগইন হচ্ছে…");
      const { data, error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
      busy(b, false);
      if (error) { $("#err").textContent = errText(error); return; }
      user = data.user; renderShell();
    });
  }

  /* ---------- shell (সাইডবার + কনটেন্ট) ---------- */
  const NAV = [
    ["dash", "🏠", "ড্যাশবোর্ড"], ["list", "🏆", "টুর্নামেন্ট"], ["fixtures", "📅", "ম্যাচ ও ফিক্সচার"], ["results", "🏁", "ফলাফল"],
    ["teams", "👥", "দল ও খেলোয়াড়"], ["news", "📰", "নিউজ"], ["seo", "🔎", "SEO ও গুগল"], ["settings", "⚙️", "লাইভ ও সেটিংস"]
  ];
  let dirty = false;
  function renderShell() {
    root.innerHTML = `
    <div class="adm-layout">
      <aside class="adm-side">
        <div class="adm-brand">📡 MTVBD <b>SPORTS</b><small>অ্যাডমিন</small></div>
        <nav class="adm-nav" aria-label="অ্যাডমিন মেনু">
          ${NAV.map(([k, ic, l]) => `<button data-v="${k}"><span class="ic">${ic}</span><span class="lb">${l}</span></button>`).join("")}
          <a href="/" target="_blank" rel="noopener"><span class="ic">🌐</span><span class="lb">ওয়েবসাইট ↗</span></a>
        </nav>
        <div class="adm-user"><span>${esc(user.email)}</span><button class="btn small ghost" id="logout">লগআউট</button></div>
      </aside>
      <div class="adm-content"><main class="adm-main" id="view"></main></div>
    </div>`;
    $("#logout").addEventListener("click", () => sb.auth.signOut());
    loadChannel();
    $$(".adm-nav [data-v]").forEach(b => b.addEventListener("click", () => setView(b.dataset.v)));
    setView(view === "edit" || !view ? "dash" : view);
  }
  function setView(v, force) {
    if (dirty && !force && !confirm("সেভ না করা পরিবর্তন আছে। না সেভ করেই ছেড়ে যাবেন?")) return;
    dirty = false; closeModal();
    const el = $("#view"); if (el) { el.oninput = null; el.onchange = null; }
    view = v;
    $$(".adm-nav [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    const map = { dash: renderDash, list: renderList, fixtures: renderFixtures, results: renderResults, teams: renderTeams, news: renderNews, seo: renderSeo, settings: renderSettings };
    (map[v] || renderDash)();
    window.scrollTo({ top: 0 });
  }
  const watchDirty = () => { const el = $("#view"); el.oninput = el.onchange = () => { dirty = true; }; };

  /* ---------- মোডাল ---------- */
  let modalEl = null;
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; document.body.classList.remove("no-scroll"); } }
  function openModal({ title, body, buttons = [], wide }) {
    closeModal();
    const wrap = document.createElement("div"); wrap.className = "am";
    wrap.innerHTML = `<div class="am-box ${wide ? "wide" : ""}" role="dialog" aria-modal="true"><div class="am-h"><h3>${title}</h3><button type="button" class="am-x" aria-label="বন্ধ">✕</button></div>
      <div class="am-b">${body}</div><div class="am-f">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ""}" data-bi="${i}">${b.label}</button>`).join("")}</div></div>`;
    document.body.appendChild(wrap); document.body.classList.add("no-scroll"); modalEl = wrap;
    const ctx = { el: wrap, q: s => $(s, wrap), close: closeModal };
    wrap.addEventListener("mousedown", e => { if (e.target === wrap) closeModal(); });
    $(".am-x", wrap).addEventListener("click", closeModal);
    wrap.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    $$("[data-bi]", wrap).forEach(b => b.addEventListener("click", async () => {
      const bt = buttons[+b.dataset.bi]; busy(b, true, "সেভ হচ্ছে…");
      try { await bt.onClick(ctx, b); } catch (err) { toast("সেভ হয়নি: " + errText(err), true); }
      if (b.isConnected) busy(b, false);
    }));
    const first = $("input:not([type=hidden]),select,textarea", $(".am-b", wrap)); if (first) first.focus();
    return ctx;
  }

  /* ---------- টুর্নামেন্ট বাছাই (ম্যাচ/ফলাফল/দল/নিউজ ট্যাবে এক) ---------- */
  let selT = "";
  const curT = () => { if (!tournaments.some(t => t.id === selT)) { const t = tournaments.find(x => x.status !== "completed") || tournaments[0]; selT = t ? t.id : ""; } return tournaments.find(t => t.id === selT); };
  const tSel = (extra = "") => `<div class="tsel"><label for="tsel">🏆 টুর্নামেন্ট বেছে নিন</label>
    <select id="tsel">${tournaments.map(t => `<option value="${esc(t.id)}" ${t.id === selT ? "selected" : ""}>${(ICON[t.sport] || "🏆")} ${esc(t.title)}</option>`).join("")}</select>${extra}</div>`;
  const bindTSel = fn => $("#tsel").addEventListener("change", e => {
    if (dirty && !confirm("সেভ না করা পরিবর্তন আছে। না সেভ করেই অন্য টুর্নামেন্টে যাবেন?")) { e.target.value = selT; return; }
    dirty = false; selT = e.target.value; fn();
  });
  const noT = el => { el.innerHTML = `<div class="box2 empty-box"><div class="big">🏆</div><h3>এখনো কোনো টুর্নামেন্ট নেই</h3><p class="hint">আগে একটি টুর্নামেন্ট যোগ করুন।</p><button class="btn" id="mk">+ নতুন টুর্নামেন্ট</button></div>`; $("#mk").addEventListener("click", () => renderEditor(null)); };
  async function loadOrFail(el) {
    el.innerHTML = skel();
    try { await loadTournaments(); return true; } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return false; }
  }
  const skel = () => `<div class="sk-box"><i></i><i></i><i></i></div><div class="sk-box"><i></i><i></i></div>`;
  async function saveCol(t, col, val) {
    const { error } = await sb.from("tournaments").update({ [col]: val }).eq("id", t.id);
    if (error) throw error; t[col] = val;
  }
  const bnToday = () => { const d = new Date(Date.now() + MT.OFFSET); return MT.fmtDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
  const arr = x => (Array.isArray(x) ? x : []);
  const dayTxt = f => [f.date && String(f.date).replace(/\s*\(.*\)/, ""), f.time].filter(Boolean).join(" • ");
  const statTag = (f, sport) => {
    const i = MT.matchInfo(f, sport, Date.now());
    return i.status === "live" ? `<span class="rtag live">🔴 লাইভ</span>` : i.hasRes ? `<span class="rtag done">✅ শেষ</span>` : i.status === "completed" ? `<span class="rtag warn">⏱ ফলাফল বাকি</span>` : i.postponed ? `<span class="rtag">⏸ স্থগিত</span>` : `<span class="rtag">আসন্ন</span>`;
  };

  /* ---------- 🏠 ড্যাশবোর্ড ---------- */
  async function renderDash() {
    const el = $("#view");
    el.innerHTML = skel();
    let S = {};
    try {
      await loadTournaments();
      const { data } = await sb.from("settings").select("*"); S = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return; }
    const now = Date.now(), all = [];
    tournaments.forEach(t => arr(t.fixtures).forEach((f, i) => { if (f && f.home) all.push(Object.assign({ t, f, i }, MT.matchInfo(f, t.sport, now))); }));
    const live = all.filter(m => m.status === "live");
    const pending = all.filter(m => m.status === "completed" && !m.hasRes).sort((a, b) => (b.start || 0) - (a.start || 0));
    const upcoming = all.filter(m => m.status === "upcoming" && !m.postponed).sort((a, b) => (a.start ?? 9e15) - (b.start ?? 9e15));
    const dd = ms => Math.floor((ms + MT.OFFSET) / 864e5), today = all.filter(m => m.start != null && dd(m.start) === dd(now));
    const rowM = (m, withScore) => `<div class="dm" data-t="${esc(m.t.id)}" data-i="${m.i}">
      <div class="dm-main"><b>${esc(m.f.home)} <em>বনাম</em> ${esc(m.f.away)}</b><small>${ICON[m.t.sport] || "🏆"} ${esc(m.t.title)} • ${esc(dayTxt(m.f))}</small></div>
      ${withScore ? `<div class="dm-score"><input data-s="h" inputmode="numeric" placeholder="০" aria-label="${esc(m.f.home)}"><span>-</span><input data-s="a" inputmode="numeric" placeholder="০" aria-label="${esc(m.f.away)}"><button class="btn small" data-sv>✔ সেভ</button></div>` : statTag(m.f, m.t.sport)}</div>`;
    el.innerHTML = `
    <div class="page-h"><h2>🏠 ড্যাশবোর্ড</h2><span class="muted">${esc(bnToday())}</span></div>
    <div class="stats">
      <div class="stat"><b>${MT.toBn(tournaments.length)}</b><span>টুর্নামেন্ট</span></div>
      <div class="stat ${live.length ? "hot" : ""}"><b>${MT.toBn(live.length)}</b><span>🔴 এখন লাইভ ম্যাচ</span></div>
      <div class="stat"><b>${MT.toBn(today.length)}</b><span>আজকের ম্যাচ</span></div>
      <div class="stat ${pending.length ? "warn" : ""}"><b>${MT.toBn(pending.length)}</b><span>ফলাফল বাকি</span></div>
      <div class="stat"><b>${MT.toBn(upcoming.length)}</b><span>আসন্ন ম্যাচ</span></div>
    </div>
    <div class="dash-grid">
      <div class="box2"><h3>📺 লাইভ টিভির লিংক</h3><p class="hint">ইউটিউব লাইভ লিংক বসিয়ে চালু করুন; ১ মিনিটের মধ্যে ওয়েবসাইটে চালু হবে।</p>
        <div class="inline-form"><input id="d-live" value="${esc(S.live_url || "")}" placeholder="https://www.youtube.com/watch?v=..."><button class="btn" id="d-on">▶ চালু</button><button class="btn danger" id="d-off">⏹ বন্ধ</button></div>
        <div class="err" id="d-err"></div>
        <div class="muted">${S.live_url ? "🟢 এখন লাইভ চালু আছে" : "⚪ এখন লাইভ বন্ধ"}</div></div>
      <div class="box2"><h3>⚡ দ্রুত কাজ</h3><div class="qa">
        <button class="btn dark" data-go="newt">+ নতুন টুর্নামেন্ট</button>
        <button class="btn ghost" data-go="fixtures">📅 ম্যাচ যোগ/এডিট</button>
        <button class="btn ghost" data-go="results">🏁 ফলাফল দিন</button>
        <button class="btn ghost" data-go="teams">👥 দল ও খেলোয়াড়</button>
        <button class="btn ghost" data-go="news">📰 নিউজ দিন</button>
        <button class="btn ghost" data-go="seo">🔎 SEO ও গুগল</button></div></div>
    </div>
    ${live.length ? `<div class="box2"><h3>🔴 এখন লাইভ</h3>${live.map(m => rowM(m, true)).join("")}<p class="hint" style="margin:8px 0 0">ম্যাচ শেষ হলে স্কোর লিখে ✔ সেভ চাপলে ম্যাচ সম্পন্ন হয়ে যাবে।</p></div>` : ""}
    <div class="box2"><h3>⏱ ফলাফল বাকি (${MT.toBn(pending.length)})</h3>${pending.length ? pending.slice(0, 8).map(m => rowM(m, true)).join("") + (pending.length > 8 ? `<p class="hint" style="margin:8px 0 0">আরও ${MT.toBn(pending.length - 8)}টি আছে — "🏁 ফলাফল" ট্যাবে দেখুন।</p>` : "") : `<p class="hint">সব ম্যাচের ফলাফল দেওয়া আছে। 👏</p>`}</div>
    <div class="box2"><h3>📅 পরের ম্যাচগুলো</h3>${upcoming.length ? upcoming.slice(0, 6).map(m => rowM(m, false)).join("") : `<p class="hint">কোনো আসন্ন ম্যাচ নেই। "ম্যাচ ও ফিক্সচার" থেকে যোগ করুন।</p>`}</div>`;
    const go = k => k === "newt" ? renderEditor(null) : setView(k);
    $$("[data-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
    const setLive = async (v, btn, msg) => {
      if (v && !ytId(v)) { $("#d-err").textContent = "সঠিক ইউটিউব লিংক দিন।"; return; }
      $("#d-err").textContent = ""; busy(btn, true, "…");
      const { error } = await sb.from("settings").upsert([{ key: "live_url", value: v }], { onConflict: "key" });
      busy(btn, false); error ? toast(errText(error), true) : (toast(msg), renderDash());
    };
    $("#d-on").addEventListener("click", e => setLive($("#d-live").value.trim(), e.target, "✅ লাইভ চালু হয়েছে"));
    $("#d-off").addEventListener("click", e => { $("#d-live").value = ""; setLive("", e.target, "লাইভ বন্ধ করা হয়েছে"); });
    $$(".dm [data-sv]").forEach(b => b.addEventListener("click", async () => {
      const row = b.closest(".dm"), h = $('[data-s="h"]', row).value.trim(), a = $('[data-s="a"]', row).value.trim();
      if (h === "" || a === "") { toast("দুই দলের স্কোরই লিখুন", true); return; }
      busy(b, true, "…");
      try { await patchFixture(row.dataset.t, +row.dataset.i, { homeScore: h, awayScore: a }); toast("✅ ফলাফল সেভ হয়েছে"); renderDash(); }
      catch (err) { toast("সেভ হয়নি: " + errText(err), true); busy(b, false); }
    }));
  }
  /* একটি ম্যাচের কিছু ঘর বদলায় — সর্বশেষ ফিক্সচার এনে, যাতে অন্য তথ্য নষ্ট না হয় */
  async function patchFixture(tid, idx, patch) {
    const { data, error } = await sb.from("tournaments").select("fixtures").eq("id", tid).single();
    if (error) throw error;
    const fx = arr(data.fixtures); if (!fx[idx]) throw new Error("ম্যাচটি পাওয়া যায়নি, পেইজ রিফ্রেশ করুন।");
    Object.entries(patch).forEach(([k, v]) => { const s = String(v ?? "").trim(); if (s) fx[idx][k] = s; else delete fx[idx][k]; });
    const up = await sb.from("tournaments").update({ fixtures: fx }).eq("id", tid);
    if (up.error) throw up.error;
  }

  /* ---------- settings ---------- */
  async function renderSettings() {
    const el = $("#view");
    el.innerHTML = `<div class="boot">লোড হচ্ছে…</div>`;
    const { data, error } = await sb.from("settings").select("*");
    if (error) { el.innerHTML = `<div class="warn">${esc(errText(error))}</div>`; return; }
    const S = Object.fromEntries((data || []).map(r => [r.key, r.value]));
    el.innerHTML = `
    <div class="box2"><h3>📺 হোমপেইজের লাইভ টিভি</h3>
      <p class="hint">ইউটিউব লাইভের লিংক বসিয়ে সেভ করুন। ওয়েবসাইটে খোলা থাকা দর্শকদের কাছে ১ মিনিটের মধ্যে নিজে থেকেই লাইভ চালু হয়ে যাবে। (ইউটিউবে "Allow embedding" চালু থাকতে হবে)</p>
      <div class="preview16" id="lv-prev"></div>
      <label class="f"><span>ইউটিউব লাইভ লিংক</span><input id="live" value="${esc(S.live_url || "")}" placeholder="https://www.youtube.com/watch?v=..."></label>
      <div class="err" id="live-err"></div>
      <div class="actions">
        <button class="btn" id="live-save">💾 লাইভ চালু / সেভ করুন</button>
        <button class="btn danger" id="live-off">⏹ লাইভ বন্ধ করুন</button>
      </div></div>
    <div class="box2"><h3>📞 যোগাযোগ ও সোশ্যাল লিংক</h3>
      <p class="hint">হোমপেইজের ইউটিউব সেকশন, "আপনার টুর্নামেন্ট লাইভ স্ট্রিমিং করতে চান?" সেকশন ও ফুটারে এই তথ্য ব্যবহার হবে। মোবাইল নম্বর সাইটে সরাসরি দেখানো হয় না — শুধু "📞 কল করুন" বাটনে চাপলে ডায়াল হয়। ইউটিউব চ্যানেলের লিংক ফিক্সচারের "ভিডিও" ও ফলাফলের "ম্যাচ দেখুন" বাটনের ডিফল্ট লিংকও।</p>
      <label class="f"><span>ইউটিউব চ্যানেলের লিংক</span><input id="yt" value="${esc(S.youtube || DEFAULT_YT)}" placeholder="${DEFAULT_YT}"></label>
      <div class="err" id="yt-err"></div>
      <label class="f"><span>ফেসবুক পেইজের লিংক</span><input id="fb" value="${esc(S.facebook || "")}"></label>
      <label class="f"><span>মোবাইল নম্বর</span><input id="ph" value="${esc(S.phone || "")}" inputmode="tel"></label>
      <button class="btn" id="contact-save">💾 সেভ করুন</button></div>
    <div class="box2"><h3>🔐 পাসওয়ার্ড বদলান</h3>
      <label class="f"><span>নতুন পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)</span><input id="np" type="password" autocomplete="new-password"></label>
      <button class="btn dark" id="pw-save">পাসওয়ার্ড আপডেট করুন</button></div>`;

    const prev = () => {
      const id = ytId($("#live").value), box = $("#lv-prev");
      box.innerHTML = id
        ? `<iframe src="https://www.youtube.com/embed/${id}" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>`
        : `<div class="prev-empty">লিংক দিলে এখানে প্রিভিউ দেখাবে</div>`;
    };
    prev();
    $("#live").addEventListener("change", prev);
    async function saveSettings(rows, btn, okMsg) {
      busy(btn, true, "সেভ হচ্ছে…");
      const { error } = await sb.from("settings").upsert(rows, { onConflict: "key" });
      busy(btn, false);
      error ? toast("সেভ হয়নি: " + errText(error), true) : toast(okMsg);
    }
    $("#live-save").addEventListener("click", e => {
      const v = $("#live").value.trim();
      if (v && !ytId(v)) { $("#live-err").textContent = "সঠিক ইউটিউব লিংক দিন।"; return; }
      $("#live-err").textContent = ""; prev();
      saveSettings([{ key: "live_url", value: v }], e.target, v ? "✅ লাইভ চালু হয়েছে" : "লাইভ বন্ধ করা হয়েছে");
    });
    $("#live-off").addEventListener("click", e => {
      $("#live").value = ""; prev(); $("#live-err").textContent = "";
      saveSettings([{ key: "live_url", value: "" }], e.target, "লাইভ বন্ধ করা হয়েছে");
    });
    $("#contact-save").addEventListener("click", async e => {
      const y = $("#yt").value.trim() || DEFAULT_YT;
      if (!/^https?:\/\//i.test(y)) { $("#yt-err").textContent = "ইউটিউব লিংক http:// বা https:// দিয়ে শুরু হতে হবে।"; return; }
      $("#yt-err").textContent = "";
      await saveSettings([{ key: "youtube", value: y }, { key: "facebook", value: $("#fb").value.trim() }, { key: "phone", value: $("#ph").value.trim() }], e.target, "✅ তথ্য সেভ হয়েছে");
      ytChannel = y; $("#yt").value = y;
    });
    $("#pw-save").addEventListener("click", async e => {
      const p = $("#np").value;
      if (p.length < 8) { toast("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে", true); return; }
      busy(e.target, true);
      const { error } = await sb.auth.updateUser({ password: p });
      busy(e.target, false);
      error ? toast(errText(error), true) : (toast("✅ পাসওয়ার্ড বদলানো হয়েছে"), ($("#np").value = ""));
    });
  }


  /* ---------- 🔎 SEO ও গুগল ---------- */
  const clipTxt = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
  const tagContent = v => { v = String(v || "").trim(); const m = v.match(/content\s*=\s*["']([^"']+)["']/i); return m ? m[1] : v; };
  async function seoHealth(S, box) {
    const get = async p => { try { const r = await fetch(p + (p.includes("?") ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" }); return { ok: r.ok, status: r.status, text: await r.text() }; } catch (e) { return { ok: false, status: 0, text: "" }; } };
    box.innerHTML = `<div class="muted">পরীক্ষা চলছে…</div>`;
    const [home, sm, rb] = await Promise.all([get("/"), get("/sitemap.xml"), get("/robots.txt")]);
    const out = [], add = (st, t, hint) => out.push([st, t, hint]);
    const ssr = /rel="canonical"/.test(home.text) && /property="og:title"/.test(home.text);
    ssr ? add("ok", "হোমপেইজে SEO ট্যাগ (টাইটেল, canonical, শেয়ার প্রিভিউ) চালু আছে")
      : add("no", "হোমপেইজে SEO ট্যাগ পাওয়া যায়নি", "গিটহাবে পুরোনো index.html মুছে দিন এবং api ফোল্ডার, pages ফোল্ডার ও vercel.json আপলোড হয়েছে কি না দেখুন। তারপর Vercel-এ নতুন ডিপ্লয় শেষ হওয়ার পর আবার পরীক্ষা করুন।");
    /<script type="application\/ld\+json">/.test(home.text) ? add("ok", "Structured data (JSON-LD) আছে") : add("no", "Structured data নেই", "ওপরের পয়েন্টের মতোই api/pages ঠিকমতো ডিপ্লয় হয়েছে কি না দেখুন।");
    const m = home.text.match(/name="google-site-verification" content="([^"]+)"/), want = tagContent(S.gsc_verify);
    if (m) add(want && m[1] !== want ? "warn" : "ok", "সার্চ কনসোল ভেরিফিকেশন ট্যাগ হোমপেইজে আছে" + (want && m[1] !== want ? " (কিন্তু সেভ করা কোডের সাথে মেলে না)" : ""));
    else add(want ? "no" : "warn", want ? "সেভ করা সার্চ কনসোল কোড হোমপেইজে আসেনি" : "সার্চ কনসোল ভেরিফিকেশন কোড দেওয়া হয়নি", want ? "সেভ করার পর ২–৩ মিনিট অপেক্ষা করে আবার পরীক্ষা করুন। না হলে নিচের \"HTML ফাইল\" পদ্ধতিতে ভেরিফাই করুন।" : "");
    if (S.gsc_file) { const f = await get("/" + S.gsc_file); f.ok && /google-site-verification/.test(f.text) ? add("ok", "সার্চ কনসোলের HTML ফাইল পদ্ধতি চালু আছে (" + S.gsc_file + ")") : add("no", "HTML ফাইল পদ্ধতি কাজ করছে না: /" + S.gsc_file, "ফাইলের নাম ঠিক আছে কি না দেখুন; সেভ করে ২–৩ মিনিট অপেক্ষা করুন।"); }
    const ga = home.text.match(/googletagmanager\.com\/gtag\/js\?id=([\w-]+)/);
    ga ? add("ok", "গুগল অ্যানালিটিক্স চালু আছে (" + ga[1] + ")") : add("warn", "গুগল অ্যানালিটিক্স আইডি দেওয়া হয়নি", "ঐচ্ছিক, তবে কত দর্শক আসছে দেখতে দরকার।");
    const n = (sm.text.match(/<loc>/g) || []).length;
    sm.ok && n ? add("ok", `সাইটম্যাপ চালু আছে (${MT.toBn(n)}টি লিংক)`) : add("no", "sitemap.xml খুলছে না", "vercel.json ও api ফোল্ডার আপলোড হয়েছে কি না দেখুন।");
    rb.ok && /Sitemap:/i.test(rb.text) ? add("ok", "robots.txt ঠিক আছে (সাইটম্যাপের লিংকসহ)") : add("no", "robots.txt ঠিক নেই", "vercel.json আপলোড হয়েছে কি না দেখুন।");
    box.innerHTML = out.map(([s, t, h]) => `<div class="hc ${s}"><span>${s === "ok" ? "✔" : s === "no" ? "✖" : "⚠"}</span><div><b>${esc(t)}</b>${h ? `<small>${esc(h)}</small>` : ""}</div></div>`).join("");
  }
  async function renderSeo() {
    const el = $("#view");
    el.innerHTML = skel();
    let S = {};
    try {
      const { data, error } = await sb.from("settings").select("*"); if (error) throw error;
      S = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      await loadTournaments();
    } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return; }
    const site = (S.site_url || "https://sports.mtvbd.com").replace(/\/+$/, ""), host = site.replace(/^https?:\/\//, "");
    const ov = t => { try { return JSON.parse(S["seo_t_" + t.id] || "{}") || {}; } catch (e) { return {}; } };
    const len = (v, a, b) => v.length >= a && v.length <= b;
    const audit = t => {
      const o = ov(t), fx = arr(t.fixtures).filter(f => f && f.home);
      const checks = [
        ["টুর্নামেন্টের নাম ১০–৭০ অক্ষরের", len(String(t.title || ""), 10, 70)],
        ["বর্ণনা ৭০–১৬০ অক্ষরের (গুগলে যে লেখা দেখায়)", len(String(o.description || t.short || ""), 70, 160)],
        ["কভার ছবি আছে (শেয়ার ও ইমেজ সার্চে দেখায়)", !!String(t.image || "").trim()],
        ["সারসংক্ষেপে কমপক্ষে ২ অনুচ্ছেদ", String(t.overview || "").split(/\n+/).filter(x => x.trim()).length >= 2],
        ["ভেন্যু দেওয়া আছে", !!String(t.venue || "").trim()],
        ["শুরুর তারিখ দেওয়া আছে ও বোঝা যায়", !!MT.parseDate(t.start_date)],
        ["সব ম্যাচের তারিখ-সময় বোঝা যায়", !fx.length || fx.every(f => MT.parseDate(f.date) && MT.parseTime(f.time))],
        ["ম্যাচ ফিক্সচার আছে", fx.length > 0],
        ["দলের তালিকা আছে", arr(t.teams).length > 0],
        ["কমপক্ষে ১টি নিউজ আছে", arr(t.news).length > 0]
      ];
      return { checks, score: Math.round(checks.filter(c => c[1]).length / checks.length * 100) };
    };
    const links = [
      ["🔎 Google Search Console", "https://search.google.com/search-console"], ["📈 Google Analytics", "https://analytics.google.com"],
      ["🗺 sitemap.xml", site + "/sitemap.xml"], ["🤖 robots.txt", site + "/robots.txt"],
      ["🧪 Rich Results টেস্ট", "https://search.google.com/test/rich-results?url=" + encodeURIComponent(site + "/")],
      ["⚡ PageSpeed", "https://pagespeed.web.dev/analysis?url=" + encodeURIComponent(site + "/")],
      ["📱 Mobile-Friendly টেস্ট", "https://search.google.com/test/mobile-friendly?url=" + encodeURIComponent(site + "/")],
      ["🔍 গুগলে ইনডেক্স দেখুন (site:)", "https://www.google.com/search?q=" + encodeURIComponent("site:" + host)],
      ["🅱 Bing Webmaster", "https://www.bing.com/webmasters"], ["📣 Facebook শেয়ার ডিবাগার", "https://developers.facebook.com/tools/debug/?q=" + encodeURIComponent(site + "/")]
    ];
    el.innerHTML = `
    <div class="page-h"><h2>🔎 SEO ও গুগল</h2></div>
    <div class="box2"><div class="bh"><h3>🩺 সাইট স্বাস্থ্য পরীক্ষা</h3><button class="btn small dark" id="hc-run">▶ এখনই পরীক্ষা করুন</button></div>
      <p class="hint">সাইটম্যাপ, robots, সার্চ কনসোল কোড ও অ্যানালিটিক্স ঠিকমতো চালু আছে কি না যাচাই করে।</p><div id="hc"></div></div>

    <div class="box2"><h3>🔗 প্রয়োজনীয় লিংক</h3><div class="linkgrid">${links.map(([l, u]) => `<a class="btn small ghost" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>`).join("")}</div></div>

    <div class="box2"><h3>🔎 সাইটের SEO তথ্য</h3>
      <p class="hint">ফাঁকা রাখলে ভালো ডিফল্ট ব্যবহার হবে। টুর্নামেন্ট, ম্যাচ, ফলাফল, দল ও নিউজের প্রতিটি পেইজের টাইটেল/বর্ণনা নিজে থেকেই তৈরি হয়।</p>
      <label class="f"><span>সাইটের মূল ঠিকানা (ডোমেইন)</span><input id="s-url" value="${esc(S.site_url || "")}" placeholder="https://sports.mtvbd.com"></label>
      <label class="f"><span>হোমপেইজের টাইটেল (৬০ অক্ষরের মধ্যে ভালো) <b id="c-t" class="cnt"></b></span><input id="s-title" value="${esc(S.seo_title || "")}" placeholder="MTVBD Sports — ময়মনসিংহ টিভি বিডি স্পোর্টস | লাইভ টুর্নামেন্ট"></label>
      <label class="f"><span>হোমপেইজের বর্ণনা (১২০–১৬০ অক্ষর) <b id="c-d" class="cnt"></b></span><textarea id="s-desc" style="min-height:80px" placeholder="ময়মনসিংহ ও আশেপাশের ক্রিকেট, ফুটবল, কাবাডিসহ সব টুর্নামেন্টের লাইভ স্ট্রিমিং…">${esc(S.seo_description || "")}</textarea></label>
      <label class="f"><span>কিওয়ার্ড (কমা দিয়ে)</span><input id="s-kw" value="${esc(S.seo_keywords || "")}" placeholder="ময়মনসিংহ টিভি বিডি, ক্রিকেট লাইভ, ফুটবল ফিক্সচার"></label>
      <label class="f"><span>শেয়ার ছবি (ফেসবুকে লিংক শেয়ার করলে যে ছবি আসে; ১২০০×৬৩০ ভালো)</span><input id="s-og" value="${esc(S.og_image || "")}" placeholder="https://... (ফাঁকা থাকলে ডিফল্ট ছবি)"></label>
      <div class="actions"><button type="button" class="btn small ghost" id="og-pick">📷 ছবি আপলোড</button><input type="file" id="og-file" accept="image/jpeg,image/png,image/webp" hidden></div>
      <div class="err" id="s-err"></div>
      <button class="btn" id="seo-save">💾 সেভ করুন</button></div>

    <div class="box2"><h3>📈 গুগল অ্যানালিটিক্স ও সার্চ কনসোল</h3>
      <p class="hint">শুধু আইডি/কোড বসান — সাইটের সব পেইজে নিজে থেকে যুক্ত হবে। সেভের পর ১–২ মিনিটে কাজ করবে।</p>
      <label class="f"><span>গুগল অ্যানালিটিক্স আইডি (যেমন: G-ABCDE12345)</span><input id="s-ga" value="${esc(S.ga_id || "")}" placeholder="G-XXXXXXXXXX"></label>
      <label class="f"><span>সার্চ কনসোল HTML ট্যাগের কোড (পুরো ট্যাগ পেস্ট করলেও চলবে)</span><input id="s-gsc" value="${esc(S.gsc_verify || "")}" placeholder='<meta name="google-site-verification" content="..." />'></label>
      <label class="f"><span>অথবা সার্চ কনসোল HTML ফাইলের নাম (যেমন: google1a2b3c4d5e6f7a8b.html) — ট্যাগে না হলে এটা ব্যবহার করুন</span><input id="s-gfile" value="${esc(S.gsc_file || "")}" placeholder="google1a2b3c4d5e6f7a8b.html"></label>
      <label class="f"><span>Bing Webmaster কোড (ঐচ্ছিক)</span><input id="s-bing" value="${esc(S.bing_verify || "")}" placeholder="ABCDEF1234..."></label>
      <div class="err" id="g-err"></div>
      <button class="btn" id="g-save">💾 সেভ করুন</button></div>

    <div class="box2"><h3>✅ টুর্নামেন্ট অনুযায়ী SEO</h3>
      <p class="hint">প্রতিটি টুর্নামেন্টের গুগল টাইটেল/বর্ণনা নিজের মতো করে দিতে পারেন (ফাঁকা রাখলে নিজে থেকে তৈরি হবে)। সবুজ ঘর বাড়ালে স্কোর বাড়ে।</p>
      ${tournaments.length ? tournaments.map(t => { const a = audit(t), o = ov(t); return `<details class="seo-t" data-id="${esc(t.id)}"><summary><span class="sc ${a.score >= 80 ? "g" : a.score >= 55 ? "y" : "r"}">${MT.toBn(a.score)}%</span><b>${esc(t.title)}</b></summary>
        <div class="seo-body">
          <div class="serp"><div class="serp-u">${esc(host)} › tournament › …</div><div class="serp-t" data-p="t"></div><div class="serp-d" data-p="d"></div></div>
          <label class="f"><span>গুগল টাইটেল (ফাঁকা = "নাম | MTVBD Sports") <b class="cnt" data-c="t"></b></span><input data-k="title" value="${esc(o.title || "")}" placeholder="${esc(t.title)}"></label>
          <label class="f"><span>গুগল বর্ণনা (ফাঁকা = সংক্ষিপ্ত বিবরণ) <b class="cnt" data-c="d"></b></span><textarea data-k="description" style="min-height:70px" placeholder="${esc(clipTxt(t.short, 160))}">${esc(o.description || "")}</textarea></label>
          <label class="f"><span>অতিরিক্ত কিওয়ার্ড (কমা দিয়ে)</span><input data-k="keywords" value="${esc(o.keywords || "")}" placeholder="লাইভ স্কোর, ফিক্সচার"></label>
          <label class="chk"><input type="checkbox" data-k="noindex" ${o.noindex ? "checked" : ""}> এই টুর্নামেন্ট গুগলে দেখাবেন না (noindex)</label>
          <ul class="seo-chk">${a.checks.map(c => `<li class="${c[1] ? "ok" : "no"}">${c[1] ? "✔" : "✖"} ${c[0]}</li>`).join("")}</ul>
          <div class="actions"><button class="btn small" data-tsave>💾 সেভ</button><button class="btn small ghost" data-edit>✏️ তথ্য এডিট করুন</button><a class="btn small ghost" href="${esc(site)}/tournament/${encodeURIComponent(t.id)}" target="_blank" rel="noopener">🌐 পেইজ দেখুন ↗</a></div>
        </div></details>`; }).join("") : `<div class="hint">এখনো কোনো টুর্নামেন্ট নেই।</div>`}</div>`;

    const cnt = () => { $("#c-t").textContent = `(${$("#s-title").value.length})`; $("#c-d").textContent = `(${$("#s-desc").value.length})`; };
    cnt(); $("#s-title").addEventListener("input", cnt); $("#s-desc").addEventListener("input", cnt);
    $("#hc-run").addEventListener("click", async e => { busy(e.target, true, "পরীক্ষা চলছে…"); await seoHealth(S, $("#hc")); busy(e.target, false); });
    async function save(rows, btn, ok) {
      busy(btn, true, "সেভ হচ্ছে…");
      const { error } = await sb.from("settings").upsert(rows, { onConflict: "key" });
      busy(btn, false);
      error ? toast("সেভ হয়নি: " + errText(error), true) : (rows.forEach(r => (S[r.key] = r.value)), toast(ok));
      return !error;
    }
    $$(".seo-t").forEach(d => {
      const t = tournaments.find(x => x.id === d.dataset.id), g = k => $(`[data-k="${k}"]`, d);
      const upd = () => {
        const ti = g("title").value.trim() || `${t.title} | MTVBD Sports`, de = g("description").value.trim() || clipTxt(t.short || arr(String(t.overview || "").split(/\n+/))[0], 160);
        $('[data-p="t"]', d).textContent = clipTxt(ti, 62); $('[data-p="d"]', d).textContent = clipTxt(de, 160) || "বর্ণনা নেই";
        $('[data-c="t"]', d).textContent = `(${g("title").value.length})`; $('[data-c="d"]', d).textContent = `(${g("description").value.length})`;
      };
      upd(); d.addEventListener("input", upd);
      $("[data-edit]", d).addEventListener("click", () => renderEditor(t));
      $("[data-tsave]", d).addEventListener("click", e => {
        const v = { title: g("title").value.trim(), description: g("description").value.trim(), keywords: g("keywords").value.trim(), noindex: g("noindex").checked };
        Object.keys(v).forEach(k => { if (!v[k]) delete v[k]; });
        save([{ key: "seo_t_" + t.id, value: JSON.stringify(v) }], e.target, "✅ সেভ হয়েছে (১–২ মিনিটে গুগল-পেইজে আসবে)");
      });
    });
    $("#seo-save").addEventListener("click", e => {
      const u = $("#s-url").value.trim().replace(/\/+$/, ""), og = $("#s-og").value.trim();
      if (u && !/^https:\/\/[^\s/]+$/i.test(u)) { $("#s-err").textContent = "ঠিকানা https:// দিয়ে শুরু হবে এবং শেষে / বা পেইজ নাম থাকবে না (যেমন: https://sports.mtvbd.com)।"; return; }
      if (og && !/^https?:\/\//i.test(og)) { $("#s-err").textContent = "শেয়ার ছবির লিংক http:// বা https:// দিয়ে শুরু হতে হবে।"; return; }
      $("#s-err").textContent = "";
      save([{ key: "site_url", value: u }, { key: "seo_title", value: $("#s-title").value.trim() }, { key: "seo_description", value: $("#s-desc").value.trim() },
        { key: "seo_keywords", value: $("#s-kw").value.trim() }, { key: "og_image", value: og }], e.target, "✅ SEO তথ্য সেভ হয়েছে (১–২ মিনিটে সাইটে আসবে)");
    });
    $("#g-save").addEventListener("click", async e => {
      const ga = $("#s-ga").value.trim(), gsc = tagContent($("#s-gsc").value), bing = tagContent($("#s-bing").value), gf = $("#s-gfile").value.trim().replace(/^\/+/, "");
      if (ga && !/^(G|GT|AW)-[A-Za-z0-9]{4,20}$/.test(ga)) { $("#g-err").textContent = "অ্যানালিটিক্স আইডি G- দিয়ে শুরু হতে হবে (যেমন G-ABCDE12345)।"; return; }
      if ((gsc && !/^[\w-]{10,100}$/.test(gsc)) || (bing && !/^[\w-]{10,100}$/.test(bing))) { $("#g-err").textContent = "ভেরিফিকেশন কোডটি বোঝা যায়নি। সার্চ কনসোলের দেখানো ট্যাগটি পুরো কপি করে পেস্ট করুন।"; return; }
      if (gf && !/^google[a-z0-9]{10,40}\.html$/i.test(gf)) { $("#g-err").textContent = "ফাইলের নাম google দিয়ে শুরু হয়ে .html দিয়ে শেষ হবে (যেমন google1a2b3c4d5e6f7a8b.html)।"; return; }
      $("#g-err").textContent = "";
      const ok = await save([{ key: "ga_id", value: ga }, { key: "gsc_verify", value: gsc }, { key: "gsc_file", value: gf }, { key: "bing_verify", value: bing }], e.target, "✅ সেভ হয়েছে (১–২ মিনিটে সাইটে চালু হবে)");
      if (ok) { $("#s-gsc").value = gsc; $("#s-bing").value = bing; $("#s-gfile").value = gf; }
    });
    $("#og-pick").addEventListener("click", () => $("#og-file").click());
    $("#og-file").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return; const b = $("#og-pick"); busy(b, true, "আপলোড হচ্ছে…");
      try {
        const blob = await shrink(f, 1600), path = `seo/${Date.now()}.jpg`;
        const up = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        $("#s-og").value = sb.storage.from("images").getPublicUrl(path).data.publicUrl; toast("✅ ছবি আপলোড হয়েছে (সেভ করতে ভুলবেন না)");
      } catch (err) { toast("ছবি আপলোড হয়নি: " + errText(err), true); }
      busy(b, false); e.target.value = "";
    });
  }

  /* ---------- 🏆 টুর্নামেন্ট ---------- */
  async function loadTournaments() {
    const { data, error } = await sb.from("tournaments").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    tournaments = data || [];
  }
  let tQ = "";
  async function renderList() {
    const el = $("#view");
    if (!(await loadOrFail(el))) return;
    el.innerHTML = `
    <div class="page-h"><h2>🏆 টুর্নামেন্ট (${MT.toBn(tournaments.length)})</h2><div class="ph-acts"><button class="btn" id="add">+ নতুন টুর্নামেন্ট</button></div></div>
    <div class="filters"><input id="t-q" type="search" placeholder="🔍 টুর্নামেন্ট খুঁজুন" value="${esc(tQ)}"></div>
    <div id="t-list"></div>`;
    const draw = () => {
      const q = tQ.trim().toLowerCase(), rows = tournaments.filter(t => !q || (t.title + " " + t.sport).toLowerCase().includes(q));
      $("#t-list").innerHTML = rows.length ? rows.map(t => `
      <div class="t-row" data-id="${esc(t.id)}">
        <div class="thumb">${t.image ? `<img src="${esc(t.image)}" alt="">` : (ICON[t.sport] || "🏆")}</div>
        <div class="info"><b>${esc(t.title)}</b><small>${esc(t.sport)}${t.start_date ? " • " + esc(t.start_date) : ""}</small>
          <div class="chips"><button data-go="fixtures">📅 ${MT.toBn(arr(t.fixtures).length)} ম্যাচ</button><button data-go="teams">👥 ${MT.toBn(arr(t.teams).filter(x => typeof x !== "string" || !x.startsWith("#")).length)} দল</button><button data-go="news">📰 ${MT.toBn(arr(t.news).length)} নিউজ</button><button data-go="results">🏁 ফলাফল</button></div></div>
        <select data-status title="স্ট্যাটাস">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <div class="acts"><button class="btn small dark" data-edit>✏️ তথ্য</button><button class="btn small danger" data-del>🗑</button></div>
      </div>`).join("") : `<div class="box2 empty-box"><div class="big">🏆</div><p class="hint">${tournaments.length ? "কিছু পাওয়া যায়নি।" : "এখনো কোনো টুর্নামেন্ট নেই। \"+ নতুন টুর্নামেন্ট\" চাপুন।"}</p></div>`;
      $$(".t-row").forEach(row => {
        const id = row.dataset.id, t = tournaments.find(x => x.id === id);
        $("[data-edit]", row).addEventListener("click", () => renderEditor(t));
        $("[data-del]", row).addEventListener("click", () => removeTournament(t));
        $$("[data-go]", row).forEach(b => b.addEventListener("click", () => { selT = id; setView(b.dataset.go); }));
        $("[data-status]", row).addEventListener("change", async e => {
          const { error } = await sb.from("tournaments").update({ status: e.target.value }).eq("id", id);
          error ? toast(errText(error), true) : (t.status = e.target.value, toast("✅ স্ট্যাটাস বদলানো হয়েছে"));
        });
      });
    };
    draw();
    $("#t-q").addEventListener("input", e => { tQ = e.target.value; draw(); });
    $("#add").addEventListener("click", () => renderEditor(null));
  }
  async function removeTournament(t) {
    if (!confirm(`"${t.title}" টুর্নামেন্টটি স্থায়ীভাবে মুছে ফেলবেন?\nএর সব ম্যাচ, দল ও নিউজসহ মুছে যাবে। এটা আর ফেরত আনা যাবে না।`)) return;
    const { error } = await sb.from("tournaments").delete().eq("id", t.id);
    if (error) { toast(errText(error), true); return; }
    toast("টুর্নামেন্ট মুছে ফেলা হয়েছে"); dirty = false; setView("list", true);
  }

  /* ---------- 🏁 দ্রুত ফলাফল ---------- */
  let resFilter = "pending", resQ = "";
  async function renderResults() {
    const el = $("#view");
    if (!(await loadOrFail(el))) return;
    if (!tournaments.length) return noT(el);
    const t = curT();
    if (!arr(t.fixtures).length) { el.innerHTML = `<div class="page-h"><h2>🏁 ম্যাচের ফলাফল</h2></div>${tSel()}<div class="box2 empty-box"><div class="big">📅</div><p class="hint">এই টুর্নামেন্টে এখনো কোনো ম্যাচ নেই। আগে "📅 ম্যাচ ও ফিক্সচার" থেকে ম্যাচ যোগ করুন।</p></div>`; bindTSel(renderResults); return; }
    const fx = JSON.parse(JSON.stringify(t.fixtures));
    const orig = JSON.stringify(fx);
    el.innerHTML = `
    <div class="page-h"><h2>🏁 ম্যাচের ফলাফল</h2></div>
    ${tSel(`<span class="muted">${MT.toBn(arr(t.fixtures).length)}টি ম্যাচ</span>`)}
    <div class="box2"><p class="hint">ম্যাচ শেষে দুই দলের গোল/রান লিখে সেভ করুন — ফলাফল ওই টুর্নামেন্টের "ফলাফল" ট্যাবে আর হোমপেইজের "সম্পন্ন" তালিকায় চলে যাবে। শুধু নোট লিখলেও (যেমন "ম্যাচ ড্র") ম্যাচ সম্পন্ন হয়। স্কোর মুছে দিলে ম্যাচ আবার সময় অনুযায়ী চলবে।</p>
      <div class="grid2"><label class="f"><span>দেখান</span><select id="rs-f"><option value="pending" ${resFilter === "pending" ? "selected" : ""}>ফলাফল বাকি</option><option value="done" ${resFilter === "done" ? "selected" : ""}>ফলাফল দেওয়া হয়েছে</option><option value="all" ${resFilter === "all" ? "selected" : ""}>সব ম্যাচ</option></select></label></div>
      <label class="f"><span>খুঁজুন (দলের নাম, রাউন্ড, তারিখ)</span><input id="rs-q" value="${esc(resQ)}" placeholder="যেমন: আল হেলাল"></label></div></div>
    <div id="rs-list"></div>
    <div class="savebar"><button class="btn" id="rs-save">💾 ফলাফল সেভ করুন</button></div>`;
    const draw = () => {
      const q = resQ.trim().toLowerCase();
      const rows = fx.map((f, i) => ({ f, i })).filter(({ f }) => {
        const has = MT.hasResult(f);
        if (resFilter === "pending" && has) return false;
        if (resFilter === "done" && !has) return false;
        return !q || [f.home, f.away, f.round, f.no, f.date].join(" ").toLowerCase().includes(q);
      });
      $("#rs-list").innerHTML = rows.length ? rows.map(({ f, i }) => {
        const info = MT.matchInfo(f, t.sport, Date.now());
        const tag = info.status === "live" ? `<span class="rtag live">🔴 লাইভ</span>` : info.status === "completed" ? `<span class="rtag done">${info.hasRes ? "✅ ফলাফল আছে" : "⏱ সময় শেষ, ফলাফল বাকি"}</span>` : `<span class="rtag">আসন্ন</span>`;
        return `<div class="row-card rc" data-i="${i}">
          <div class="rc-head"><b>${esc([f.round, f.no].filter(Boolean).join(" • "))}</b> ${tag}<small>${esc([f.date && f.date.replace(/\s*\(.*\)/, ""), f.time].filter(Boolean).join(" • "))}</small></div>
          <div class="rc-score"><span class="rc-team">${esc(f.home)}</span>
            <input data-k="homeScore" value="${esc(f.homeScore ?? "")}" placeholder="০" inputmode="numeric" aria-label="${esc(f.home)} স্কোর">
            <em>-</em>
            <input data-k="awayScore" value="${esc(f.awayScore ?? "")}" placeholder="০" inputmode="numeric" aria-label="${esc(f.away)} স্কোর">
            <span class="rc-team r">${esc(f.away)}</span></div>
          <div class="row-grid"><label class="f w3"><span>নোট (ঐচ্ছিক)</span><input data-k="resultNote" value="${esc(f.resultNote ?? "")}" placeholder="টাইব্রেকারে জয় / ম্যাচ সেরা: ..."></label>
            <label class="f w3"><span>▶ ম্যাচ দেখার লিংক (ঐচ্ছিক)</span><input data-k="watch" value="${esc(f.watch ?? "")}" placeholder="https://www.youtube.com/watch?v=..."></label></div></div>`;
      }).join("") : `<div class="box2">এই তালিকায় কোনো ম্যাচ নেই।</div>`;
    };
    draw(); watchDirty();
    $("#rs-list").addEventListener("input", e => { const k = e.target.dataset.k, c = e.target.closest(".rc"); if (k && c) fx[+c.dataset.i][k] = e.target.value; });
    bindTSel(renderResults);
    $("#rs-f").addEventListener("change", e => { resFilter = e.target.value; draw(); });
    $("#rs-q").addEventListener("input", e => { resQ = e.target.value; draw(); });
    $("#rs-save").addEventListener("click", async () => {
      const KEYS = ["homeScore", "awayScore", "resultNote", "watch"];
      const bad = fx.find(f => f.watch && !/^https?:\/\//i.test(String(f.watch).trim()));
      if (bad) { toast("ম্যাচ দেখার লিংক http:// বা https:// দিয়ে শুরু হতে হবে", true); return; }
      const changed = fx.map((f, i) => i).filter(i => KEYS.some(k => String(fx[i][k] ?? "").trim() !== String((JSON.parse(orig)[i] || {})[k] ?? "").trim()));
      if (!changed.length) { toast("কোনো পরিবর্তন নেই"); return; }
      const b = $("#rs-save"); busy(b, true, "সেভ হচ্ছে…");
      try {
        // সর্বশেষ ফিক্সচার নতুন করে এনে শুধু ফলাফলের ঘরগুলো বসানো হয়, যাতে অন্য কোনো তথ্য নষ্ট না হয়
        const { data, error } = await sb.from("tournaments").select("fixtures").eq("id", t.id).single();
        if (error) throw error;
        const fresh = Array.isArray(data.fixtures) ? data.fixtures : [];
        let n = 0;
        changed.forEach(i => {
          const a = fx[i], f = fresh[i];
          if (!f || f.home !== a.home || f.away !== a.away) return;
          KEYS.forEach(k => { const v = String(a[k] ?? "").trim(); if (v) f[k] = v; else delete f[k]; });
          n++;
        });
        if (n !== changed.length) throw new Error("ফিক্সচার ইতিমধ্যে বদলে গেছে। পেইজ রিফ্রেশ করে আবার চেষ্টা করুন।");
        const up = await sb.from("tournaments").update({ fixtures: fresh }).eq("id", t.id);
        if (up.error) throw up.error;
        toast(`✅ ${n}টি ম্যাচের ফলাফল সেভ হয়েছে`); dirty = false;
        renderResults();
      } catch (e) { toast("সেভ হয়নি: " + errText(e), true); }
      busy(b, false);
    });
  }


  /* ---------- 📅 ম্যাচ ও ফিক্সচার ---------- */
  let fxQ = "", fxRound = "", fxSt = "", fxLimit = 30;
  async function renderFixtures() {
    const el = $("#view");
    if (!(await loadOrFail(el))) return;
    if (!tournaments.length) return noT(el);
    const t = curT(), fx = arr(t.fixtures);
    const rounds = [...new Set(fx.map(f => f.round || "").filter(Boolean))];
    el.innerHTML = `
    <div class="page-h"><h2>📅 ম্যাচ ও ফিক্সচার</h2><div class="ph-acts"><button class="btn ghost small" id="fx-sort" title="তারিখ-সময় অনুযায়ী সাজান">↕ সময় অনুযায়ী সাজান</button><button class="btn" id="fx-add">+ নতুন ম্যাচ</button></div></div>
    ${tSel(`<span class="muted">${MT.toBn(fx.length)}টি ম্যাচ</span>`)}
    <div class="filters">
      <input id="fx-q" type="search" placeholder="🔍 দলের নাম বা রাউন্ড খুঁজুন" value="${esc(fxQ)}">
      <select id="fx-r"><option value="">সব রাউন্ড/গ্রুপ</option>${rounds.map(r => `<option ${r === fxRound ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select id="fx-s"><option value="">সব অবস্থা</option><option value="upcoming" ${fxSt === "upcoming" ? "selected" : ""}>আসন্ন</option><option value="live" ${fxSt === "live" ? "selected" : ""}>লাইভ</option><option value="completed" ${fxSt === "completed" ? "selected" : ""}>সম্পন্ন</option><option value="pending" ${fxSt === "pending" ? "selected" : ""}>ফলাফল বাকি</option></select>
    </div>
    <div id="fx-list"></div>`;
    bindTSel(renderFixtures);
    const draw = () => {
      const q = fxQ.trim().toLowerCase(), now = Date.now();
      const rows = fx.map((f, i) => ({ f, i, info: MT.matchInfo(f, t.sport, now) })).filter(({ f, info }) => {
        if (fxRound && (f.round || "") !== fxRound) return false;
        if (fxSt === "pending") { if (!(info.status === "completed" && !info.hasRes)) return false; }
        else if (fxSt && info.status !== fxSt) return false;
        return !q || [f.home, f.away, f.round, f.no, f.venue, f.date].join(" ").toLowerCase().includes(q);
      });
      const shown = rows.slice(0, fxLimit); let last = null, html = "";
      shown.forEach(({ f, i, info }) => {
        const r = f.round || "";
        if (r !== last) { html += `<div class="fx-round">${esc(r || "রাউন্ড ছাড়া")}</div>`; last = r; }
        html += `<div class="fx-row" data-i="${i}">
          <div class="fx-no">${esc(f.no || MT.toBn(i + 1))}</div>
          <div class="fx-main"><b>${esc(f.home)} <em>${MT.hasResult(f) && f.homeScore !== undefined ? esc(MT.scoreText(f)) : "বনাম"}</em> ${esc(f.away)}</b>
            <small>📅 ${esc(dayTxt(f) || "তারিখ নেই")}${f.venue ? " • 📍 " + esc(f.venue) : ""}</small></div>
          ${statTag(f, t.sport)}
          <div class="fx-acts"><button data-ed title="এডিট">✏️</button><button data-dup title="কপি করে নতুন">⧉</button><button data-rm title="মুছুন">🗑</button></div></div>`;
      });
      $("#fx-list").innerHTML = rows.length ? html + (rows.length > shown.length ? `<button class="btn ghost more" id="fx-more">আরও ${MT.toBn(rows.length - shown.length)}টি দেখান ↓</button>` : "")
        : `<div class="box2 empty-box"><div class="big">📅</div><p class="hint">${fx.length ? "এই ফিল্টারে কোনো ম্যাচ নেই।" : "এখনো কোনো ম্যাচ নেই। \"+ নতুন ম্যাচ\" চাপুন।"}</p></div>`;
    };
    draw();
    $("#fx-q").addEventListener("input", e => { fxQ = e.target.value; fxLimit = 30; draw(); });
    $("#fx-r").addEventListener("change", e => { fxRound = e.target.value; fxLimit = 30; draw(); });
    $("#fx-s").addEventListener("change", e => { fxSt = e.target.value; fxLimit = 30; draw(); });
    $("#fx-add").addEventListener("click", () => matchModal(t, null, {}, renderFixtures));
    $("#fx-sort").addEventListener("click", async e => {
      if (!confirm("সব ম্যাচ তারিখ-সময় অনুযায়ী সাজানো হবে। ঠিক আছে?")) return;
      const key = f => { const i = MT.matchInfo(f, t.sport, 0); return i.start == null ? 9e15 : i.start; };
      const sorted = fx.map((f, i) => [f, i]).sort((a, b) => key(a[0]) - key(b[0]) || a[1] - b[1]).map(x => x[0]);
      busy(e.target, true, "…");
      try { await saveCol(t, "fixtures", sorted); toast("✅ সাজানো হয়েছে"); renderFixtures(); } catch (err) { toast(errText(err), true); busy(e.target, false); }
    });
    $("#fx-list").addEventListener("click", async e => {
      if (e.target.closest("#fx-more")) { fxLimit += 40; draw(); return; }
      const row = e.target.closest(".fx-row"), b = e.target.closest("button"); if (!row) return;
      const i = +row.dataset.i;
      if (b && b.hasAttribute("data-rm")) {
        if (!confirm(`"${fx[i].home} বনাম ${fx[i].away}" ম্যাচটি মুছে ফেলবেন?`)) return;
        const next = fx.filter((_, k) => k !== i);
        try { await saveCol(t, "fixtures", next); toast("ম্যাচ মুছে ফেলা হয়েছে"); renderFixtures(); } catch (err) { toast(errText(err), true); }
      } else if (b && b.hasAttribute("data-dup")) {
        const c = JSON.parse(JSON.stringify(fx[i])); ["homeScore", "awayScore", "resultNote", "watch", "state"].forEach(k => delete c[k]); delete c.no; delete c.home; delete c.away;
        matchModal(t, null, c, renderFixtures);
      } else matchModal(t, i, {}, renderFixtures);
    });
  }
  /* ম্যাচ যোগ/এডিট পপআপ। idx == null হলে নতুন (preset: আগের ম্যাচের রাউন্ড/তারিখ/ভেন্যু ইত্যাদি) */
  function matchModal(t, idx, preset, done) {
    const fx = arr(t.fixtures), isNew = idx == null;
    const f = isNew ? Object.assign({ venue: t.venue || "", video: ytChannel }, preset) : JSON.parse(JSON.stringify(fx[idx]));
    const teamNames = [...new Set(fx.flatMap(x => [x.home, x.away]).concat((t.teams || []).map(x => (typeof x === "string" ? (x.startsWith("#") ? "" : x) : x && x.name))).filter(Boolean))];
    const rounds = [...new Set(fx.map(x => x.round).filter(Boolean))];
    const fld = (l, n, v, cls = "", ph = "", extra = "") => `<label class="f ${cls}"><span>${l}</span><input name="${n}" value="${esc(v ?? "")}" placeholder="${esc(ph)}" ${extra}></label>`;
    const body = `<datalist id="dl-teams">${teamNames.map(n => `<option value="${esc(n)}">`).join("")}</datalist><datalist id="dl-rounds">${rounds.map(n => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="row-grid">
        ${fld("প্রথম দল *", "home", f.home, "w3", "আল হেলাল এসি", 'list="dl-teams"')}
        ${fld("দ্বিতীয় দল *", "away", f.away, "w3", "পাঁচবাগ স্পোর্টিং ক্লাব", 'list="dl-teams"')}
        <label class="f w3"><span>📅 তারিখ ও সময় (বেছে নিন)</span><input type="datetime-local" name="_pick" value="${MT.toPicker(f.date, f.time)}"></label>
        ${fld("রাউন্ড / গ্রুপ", "round", f.round, "w3", "প্রথম রাউন্ড / গ্রুপ ‘এ’", 'list="dl-rounds"')}
        ${fld("তারিখ (লেখা)", "date", f.date, "w3", "৬ নভেম্বর, ২০২৬ (শুক্রবার)")}
        ${fld("সময় (লেখা)", "time", f.time, "w3", "দুপুর ২:৪৫ টা")}
        <div class="w6 dt-note" id="m-warn"></div>
        ${fld("ম্যাচ নং", "no", f.no, "w3", "ম্যাচ ০১")}
        ${fld("ভেন্যু / মাঠ", "venue", f.venue, "w3", "ময়মনসিংহ জেলা স্টেডিয়াম")}
        ${fld("▶ ভিডিও বাটনের লিংক (ম্যাচের লাইভ/ভিডিও লিংক; না বদলালে চ্যানেলে যাবে)", "video", f.video, "w6", "https://www.youtube.com/watch?v=...")}
        <label class="f w3"><span>ম্যাচের অবস্থা</span><select name="state"><option value="">স্বয়ংক্রিয় (সময় দেখে)</option><option value="live" ${f.state === "live" ? "selected" : ""}>🔴 এখনই লাইভ দেখান</option><option value="postponed" ${f.state === "postponed" ? "selected" : ""}>⏸ স্থগিত</option></select></label>
        ${fld("ম্যাচ চলার সময় (মিনিট, ঐচ্ছিক)", "dur", f.dur, "w3", "ফুটবল ১২০, ক্রিকেট ৪৮০")}
        ${fld("রাউন্ডের নোট (ঐচ্ছিক)", "note", f.note, "w6", "যেমন: এই রাউন্ডে অফ: ...")}
      </div>`;
    const warn = () => { const c = ctx.el, d = $('[name="date"]', c).value, tm = $('[name="time"]', c).value; $("#m-warn", c).innerHTML = (d || tm) && !(MT.parseDate(d) && MT.parseTime(tm)) ? `<small class="dt-warn">⚠ তারিখ/সময় বোঝা যায়নি — ম্যাচ নিজে থেকে লাইভ হবে না। ওপরের পিকার ব্যবহার করুন।</small>` : ""; };
    async function save(c, again) {
      const g = n => $(`[name="${n}"]`, c.el).value.trim();
      if (!g("home") || !g("away")) { toast("দুই দলের নামই দিন", true); return; }
      if (g("video") && !/^https?:\/\//i.test(g("video"))) { toast("ভিডিও লিংক http:// বা https:// দিয়ে শুরু হতে হবে", true); return; }
      const o = isNew ? {} : JSON.parse(JSON.stringify(fx[idx]));
      ["home", "away", "round", "date", "time", "no", "venue", "video", "state", "dur", "note"].forEach(k => { const v = g(k); if (v) o[k] = v; else delete o[k]; });
      const next = fx.slice(); if (isNew) next.push(o); else next[idx] = o;
      await saveCol(t, "fixtures", next);
      toast(isNew ? "✅ ম্যাচ যোগ হয়েছে" : "✅ সেভ হয়েছে");
      if (again) { const p = { round: o.round, date: o.date, time: o.time, venue: o.venue, video: o.video }; c.close(); done(); matchModal(t, null, p, done); }
      else { c.close(); done(); }
    }
    const ctx = openModal({ title: isNew ? "+ নতুন ম্যাচ" : "✏️ ম্যাচ এডিট", body, wide: true,
      buttons: [{ label: "বাতিল", cls: "ghost", onClick: c => c.close() }].concat(isNew ? [{ label: "💾 সেভ করে আরেকটি", cls: "dark", onClick: c => save(c, true) }] : [])
        .concat([{ label: "💾 সেভ করুন", onClick: c => save(c, false) }]) });
    ctx.el.addEventListener("input", e => {
      if (e.target.name === "_pick") { const r = MT.fromPicker(e.target.value); if (r) { $('[name="date"]', ctx.el).value = r.date; $('[name="time"]', ctx.el).value = r.time; } }
      warn();
    });
    warn();
  }

  /* ---------- repeatable rows ---------- */
  const warnHTML = it => (it.date || it.time) && !(MT.parseDate(it.date) && MT.parseTime(it.time))
    ? `<small class="dt-warn">⚠ তারিখ/সময় বোঝা যায়নি — ম্যাচ নিজে থেকে লাইভ হবে না। ওপরের পিকার ব্যবহার করুন।</small>` : "";
  function listEditor(host, items, schema, addLabel) {
    function draw() {
      host.innerHTML = items.map((it, i) => `<div class="row-card">
        <div class="row-actions"><button type="button" data-up="${i}">↑</button><button type="button" data-down="${i}">↓</button><button type="button" data-del="${i}">🗑 মুছুন</button></div>
        <div class="row-grid">${schema.map(f => `<label class="f ${f.w || ""}"><span>${f.label}</span>${f.type === "textarea"
          ? `<textarea data-i="${i}" data-k="${f.k}" placeholder="${esc(f.ph || "")}">${esc(it[f.k] ?? "")}</textarea>`
          : f.type === "select"
          ? `<select data-i="${i}" data-k="${f.k}">${f.opts.map(([v, l]) => `<option value="${v}" ${(it[f.k] || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`
          : f.type === "picker"
          ? `<input type="datetime-local" data-i="${i}" data-k="_pick" value="${MT.toPicker(it.date, it.time)}">${warnHTML(it)}`
          : `<input data-i="${i}" data-k="${f.k}" value="${esc(it[f.k] ?? "")}" placeholder="${esc(f.ph || "")}">`}</label>`).join("")}</div></div>`).join("")
        + `<button type="button" class="btn small ghost" data-add>+ ${addLabel}</button>`;
    }
    host.addEventListener("input", e => {
      const d = e.target.dataset; if (d.k == null) return;
      const it = items[+d.i];
      if (d.k === "_pick") {                       // পিকার থেকে বাংলা তারিখ-সময় নিজে বসে যায়
        const r = MT.fromPicker(e.target.value); if (!r) return;
        it.date = r.date; it.time = r.time;
        const card = e.target.closest(".row-card");
        $('[data-k="date"]', card).value = r.date; $('[data-k="time"]', card).value = r.time;
        const w = $(".dt-warn", card); if (w) w.remove();
        return;
      }
      it[d.k] = e.target.value;
      if (d.k === "date" || d.k === "time") {       // হাতে লিখলে বোঝা না গেলে সতর্কবার্তা
        const lab = e.target.closest(".row-card").querySelector('[data-k="_pick"]').parentNode, old = $(".dt-warn", lab);
        if (old) old.remove();
        lab.insertAdjacentHTML("beforeend", warnHTML(it));
      }
    });
    host.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-add")) items.push(Object.fromEntries(schema.filter(f => f.def).map(f => [f.k, f.def()])));
      else if (b.dataset.del != null) items.splice(+b.dataset.del, 1);
      else if (b.dataset.up != null) { const i = +b.dataset.up; if (i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]]; }
      else if (b.dataset.down != null) { const i = +b.dataset.down; if (i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]]; }
      else return;
      draw();
    });
    draw();
  }
  /* খালি সারি বাদ দেয়। ডিফল্ট লিংক (def) আগে থেকে বসানো থাকে, তাই শুধু সেটা থাকলে সারিটিকে খালি ধরা হয়। */
  const cleanRows = (arr, schema) => arr
    .map(o => Object.fromEntries(Object.entries(o).filter(([k]) => k[0] !== "_").map(([k, v]) => [k, String(v ?? "").trim()]).filter(([, v]) => v !== "")))
    .filter(o => schema.some(f => !f.def && o[f.k]));

  const SCHEMAS = {
    fixtures: [
      { k: "round", label: "রাউন্ড / গ্রুপ (একই নামের ম্যাচ একসাথে দেখাবে)", ph: "প্রথম রাউন্ড / গ্রুপ ‘এ’", w: "w3" },
      { k: "no", label: "ম্যাচ নং", ph: "ম্যাচ ০১", w: "w3" },
      { k: "_pick", type: "picker", label: "📅 তারিখ ও সময় বেছে নিন (সহজ উপায় — নিচের তারিখ/সময় নিজে বসে যাবে)", w: "w6" },
      { k: "date", label: "তারিখ", ph: "৬ নভেম্বর, ২০২৬ (শুক্রবার)", w: "w3" },
      { k: "time", label: "সময়", ph: "দুপুর ২:৪৫ টা", w: "w3" },
      { k: "home", label: "প্রথম দল", ph: "আল হেলাল এসি", w: "w3" },
      { k: "away", label: "দ্বিতীয় দল", ph: "পাঁচবাগ স্পোর্টিং ক্লাব", w: "w3" },
      { k: "venue", label: "ভেন্যু / মাঠ", ph: "ময়মনসিংহ জেলা স্টেডিয়াম", w: "w6" },
      { k: "video", label: "▶ ভিডিও বাটনের লিংক (ম্যাচের লাইভ/ভিডিও লিংক বসান; না বদলালে চ্যানেলে যাবে)", ph: "https://www.youtube.com/watch?v=...", w: "w6", def: () => ytChannel },
      { k: "state", type: "select", label: "ম্যাচের অবস্থা", opts: [["", "স্বয়ংক্রিয় (সময় দেখে)"], ["live", "🔴 এখনই লাইভ দেখান"], ["postponed", "⏸ স্থগিত"]], w: "w3" },
      { k: "dur", label: "ম্যাচ চলার সময় (মিনিট, ঐচ্ছিক)", ph: "ফুটবল ১২০, ক্রিকেট ৪৮০", w: "w3" },
      { k: "note", label: "রাউন্ডের নোট (ঐচ্ছিক, যেমন: এই রাউন্ডে অফ: ...)", w: "w6" }
    ],
    results: [
      { k: "round", label: "রাউন্ড / ম্যাচের নাম", ph: "উদ্বোধনী ম্যাচ", w: "w3" },
      { k: "date", label: "তারিখ", ph: "৬ নভেম্বর, ২০২৬", w: "w3" },
      { k: "home", label: "প্রথম দল", w: "w2" },
      { k: "homeScore", label: "গোল/রান", ph: "২", w: "w1 w1h" },
      { k: "awayScore", label: "গোল/রান", ph: "১", w: "w1 w1h" },
      { k: "away", label: "দ্বিতীয় দল", w: "w2" },
      { k: "note", label: "নোট (ঐচ্ছিক)", ph: "টাইব্রেকারে জয় / ম্যাচ সেরা: ...", w: "w6" },
      { k: "watch", label: "▶ লাইভ ম্যাচ লিংক (দর্শক \"ম্যাচ দেখুন\" চাপলে এখানে যাবে; না বদলালে চ্যানেলে যাবে)", ph: "https://www.youtube.com/watch?v=...", w: "w6", def: () => ytChannel }
    ],
    news: [
      { k: "title", label: "শিরোনাম", w: "w6" },
      { k: "date", label: "তারিখ", ph: "৩ নভেম্বর, ২০২৬", w: "w3" },
      { k: "text", label: "বিস্তারিত", type: "textarea", w: "w6" },
      { k: "link", label: "বিস্তারিত নিউজের লিংক (ঐচ্ছিক — দিলে \"আরও পড়ুন\" বাটন আসবে ও নতুন ট্যাবে খুলবে)", ph: "https://...", w: "w6" }
    ],
    awards: [
      { k: "title", label: "পুরস্কারের নাম", ph: "চ্যাম্পিয়ন / ম্যান অব দ্য ম্যাচ", w: "w3" },
      { k: "winner", label: "বিজয়ী", ph: "দল বা খেলোয়াড়ের নাম", w: "w3" }
    ]
  };

  /* ---------- image ---------- */
  async function shrink(file, max = 1600) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("শুধু JPG, PNG বা WEBP ছবি দিন।");
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("ছবি প্রসেস করা যায়নি।");
    return blob;
  }

  /* ---------- দল সম্পাদনা (দলের তথ্য, কোচ, যোগাযোগ, প্লেয়ার ও ছবি) ---------- */
  /* ডেটাবেসে teams তালিকায় থাকে: "নাম" (সাধারণ), "# গ্রুপের নাম" (শিরোনাম) অথবা দলের পূর্ণ তথ্যসহ অবজেক্ট */
  function teamsToEditor(list) {
    let group = "";
    const out = [];
    (list || []).forEach(x => {
      if (typeof x === "string") {
        const n = x.trim(); if (!n) return;
        if (n.startsWith("#")) group = n.replace(/^#+\s*/, ""); else out.push({ name: n, group, players: [] });
      } else if (x && typeof x === "object" && x.name) {
        const o = JSON.parse(JSON.stringify(x)); o.group = o.group != null ? o.group : group;
        if (o.group) group = o.group;
        o.players = Array.isArray(o.players) ? o.players : []; out.push(o);
      }
    });
    return out;
  }
  function teamsFromEditor(arr) {
    const res = []; let cur = "";
    arr.forEach(t => {
      const name = String(t.name || "").trim(); if (!name) return;
      const g = String(t.group || "").trim();
      if (g !== cur && (g || cur)) { res.push("# " + (g || "অন্যান্য")); cur = g || "অন্যান্য"; }
      const o = { name };
      ["info", "coach", "phone", "facebook"].forEach(k => { const v = String(t[k] || "").trim(); if (v) o[k] = v; });
      const pl = (t.players || []).map(p => {
        const q = { name: String(p.name || "").trim() };
        ["role", "no", "photo"].forEach(k => { const v = String(p[k] || "").trim(); if (v) q[k] = v; });
        return q;
      }).filter(p => p.name);
      if (pl.length) o.players = pl;
      res.push(Object.keys(o).length > 1 ? o : name);
    });
    return res;
  }
  function teamEditor(host, teams) {
    const pcount = t => (t.players || []).filter(p => String(p.name || "").trim()).length;
    function playerRow(p, ti, pi) {
      return `<div class="pl-row" data-p="${pi}">
        <div class="pl-photo">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : "👤"}</div>
        <div class="pl-fields">
          <input data-pk="name" value="${esc(p.name || "")}" placeholder="খেলোয়াড়ের নাম">
          <input data-pk="role" value="${esc(p.role || "")}" placeholder="পজিশন (ঐচ্ছিক)">
          <input data-pk="no" value="${esc(p.no || "")}" placeholder="জার্সি নং" inputmode="numeric">
        </div>
        <div class="pl-acts"><button type="button" data-ppick title="ছবি দিন">📷</button>${p.photo ? `<button type="button" data-prm title="ছবি সরান">✖</button>` : ""}<button type="button" data-pup>↑</button><button type="button" data-pdel title="মুছুন">🗑</button></div>
      </div>`;
    }
    function draw() {
      host.innerHTML = `<div class="tm-bulk"><label class="f"><span>একসাথে অনেক দল যোগ করুন (প্রতি লাইনে একটি দল; গ্রুপ থাকলে <b># গ্রুপ ‘এ’</b> লিখে নিচে সেই গ্রুপের দল দিন)</span>
          <textarea id="tm-bulk" placeholder="# গ্রুপ ‘এ’&#10;আল হেলাল এসি&#10;পাঁচবাগ স্পোর্টিং ক্লাব"></textarea></label>
          <button type="button" class="btn small ghost" data-bulk>+ তালিকা থেকে যোগ করুন</button></div>`
        + (teams.length ? "" : `<div class="tm-empty">এখনো কোনো দল নেই।</div>`)
        + teams.map((t, i) => `<details class="tm-card" data-t="${i}" ${t._open ? "open" : ""}>
          <summary><span class="tm-name">${esc(t.name || "নতুন দল")}</span><small>${t.group ? esc(t.group) + " • " : ""}${pcount(t)} জন প্লেয়ার</small>
            <span class="tm-acts"><button type="button" data-tup="${i}">↑</button><button type="button" data-tdown="${i}">↓</button><button type="button" data-tdel="${i}">🗑</button></span></summary>
          <div class="tm-body">
            <div class="row-grid">
              <label class="f w3"><span>দলের নাম</span><input data-tk="name" value="${esc(t.name || "")}"></label>
              <label class="f w3"><span>গ্রুপ (ঐচ্ছিক)</span><input data-tk="group" value="${esc(t.group || "")}" placeholder="গ্রুপ ‘এ’"></label>
              <label class="f w3"><span>কোচ / ম্যানেজার (ঐচ্ছিক)</span><input data-tk="coach" value="${esc(t.coach || "")}"></label>
              <label class="f w3"><span>ফোন নম্বর (ঐচ্ছিক — দর্শক "কল করুন" বাটনে পাবে)</span><input data-tk="phone" value="${esc(t.phone || "")}" inputmode="tel" placeholder="01XXXXXXXXX"></label>
              <label class="f w6"><span>ফেসবুক পেইজ / গ্রুপের লিংক (ঐচ্ছিক)</span><input data-tk="facebook" value="${esc(t.facebook || "")}" placeholder="https://facebook.com/..."></label>
              <label class="f w6"><span>দলের সংক্ষিপ্ত পরিচিতি (ঐচ্ছিক)</span><textarea data-tk="info" style="min-height:70px">${esc(t.info || "")}</textarea></label>
            </div>
            <h4 class="pl-h">🏃 প্লেয়ার তালিকা</h4>
            <div class="pl-list">${(t.players || []).map((p, pi) => playerRow(p, i, pi)).join("")}</div>
            <div class="pl-add"><button type="button" class="btn small ghost" data-padd>+ প্লেয়ার যোগ করুন</button>
              <label class="f" style="margin:8px 0 0"><span>অথবা একসাথে অনেকের নাম (প্রতি লাইনে একজন)</span><textarea data-pbulk style="min-height:64px"></textarea></label>
              <button type="button" class="btn small ghost" data-pbulkgo>+ নামগুলো যোগ করুন</button></div>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden data-pfile>
          </div></details>`).join("");
    }
    host.addEventListener("toggle", e => { const c = e.target.closest && e.target.closest(".tm-card"); if (c && teams[+c.dataset.t]) teams[+c.dataset.t]._open = c.open; }, true);
    host.addEventListener("input", e => {
      const c = e.target.closest(".tm-card"); if (!c) return;
      const t = teams[+c.dataset.t];
      if (e.target.dataset.tk) {
        t[e.target.dataset.tk] = e.target.value;
        if (["name", "group"].includes(e.target.dataset.tk)) { $(".tm-name", c).textContent = t.name || "নতুন দল"; $("small", c).textContent = (t.group ? t.group + " • " : "") + pcount(t) + " জন প্লেয়ার"; }
      } else if (e.target.dataset.pk) {
        const r = e.target.closest(".pl-row"); t.players[+r.dataset.p][e.target.dataset.pk] = e.target.value;
        if (e.target.dataset.pk === "name") $("small", c).textContent = (t.group ? t.group + " • " : "") + pcount(t) + " জন প্লেয়ার";
      }
    });
    let pend = null;
    host.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-bulk")) {
        let g = "";
        $("#tm-bulk", host).value.split(/\n/).map(x => x.trim()).filter(Boolean).forEach(n => { if (n.startsWith("#")) g = n.replace(/^#+\s*/, ""); else teams.push({ name: n, group: g, players: [] }); });
        draw(); return;
      }
      if (b.dataset.tup != null || b.dataset.tdown != null || b.dataset.tdel != null) {
        e.preventDefault(); e.stopPropagation();
        if (b.dataset.tdel != null) { const t = teams[+b.dataset.tdel]; if (!confirm(`"${t.name || "এই দল"}" মুছে ফেলবেন?`)) return; teams.splice(+b.dataset.tdel, 1); }
        else if (b.dataset.tup != null) { const i = +b.dataset.tup; if (i > 0) [teams[i - 1], teams[i]] = [teams[i], teams[i - 1]]; }
        else { const i = +b.dataset.tdown; if (i < teams.length - 1) [teams[i + 1], teams[i]] = [teams[i], teams[i + 1]]; }
        draw(); return;
      }
      const c = b.closest(".tm-card"); if (!c) return;
      const t = teams[+c.dataset.t], r = b.closest(".pl-row"), pi = r ? +r.dataset.p : -1;
      if (b.hasAttribute("data-padd")) { t.players.push({ name: "" }); draw(); const ins = $$(".tm-card", host)[+c.dataset.t].querySelectorAll('.pl-row [data-pk="name"]'); ins[ins.length - 1].focus(); }
      else if (b.hasAttribute("data-pbulkgo")) { $("[data-pbulk]", c).value.split(/\n/).map(x => x.trim()).filter(Boolean).forEach(n => t.players.push({ name: n })); draw(); }
      else if (b.hasAttribute("data-pdel")) { t.players.splice(pi, 1); draw(); }
      else if (b.hasAttribute("data-pup")) { if (pi > 0) { [t.players[pi - 1], t.players[pi]] = [t.players[pi], t.players[pi - 1]]; draw(); } }
      else if (b.hasAttribute("data-prm")) { delete t.players[pi].photo; draw(); }
      else if (b.hasAttribute("data-ppick")) { pend = { t, pi, r }; $("[data-pfile]", c).click(); }
    });
    host.addEventListener("change", async e => {
      if (!e.target.hasAttribute("data-pfile")) return;
      const f = e.target.files[0]; if (!f || !pend) return;
      const { t, pi, r } = pend, btn = $("[data-ppick]", r); busy(btn, true, "…");
      try {
        const blob = await shrink(f, 600);
        const path = `players/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const up = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (up.error) throw up.error;
        t.players[pi].photo = sb.storage.from("images").getPublicUrl(path).data.publicUrl;
        draw(); toast("✅ ছবি আপলোড হয়েছে (সেভ করতে ভুলবেন না)");
      } catch (err) { toast("ছবি আপলোড হয়নি: " + errText(err), true); busy(btn, false); }
      e.target.value = "";
    });
    draw();
  }


  /* ---------- 👥 দল ও খেলোয়াড় ---------- */
  async function renderTeams() {
    const el = $("#view");
    if (!(await loadOrFail(el))) return;
    if (!tournaments.length) return noT(el);
    const t = curT(), tmArr = teamsToEditor(t.teams);
    el.innerHTML = `
    <div class="page-h"><h2>👥 দল ও খেলোয়াড়</h2></div>
    ${tSel(`<span class="muted">${MT.toBn(tmArr.length)}টি দল</span>`)}
    <div class="box2"><p class="hint">দল যোগ করুন। যেকোনো দলে ক্লিক করে ভেতরে ঢুকলে কোচ, পরিচিতি, ফোন/ফেসবুক ও খেলোয়াড়দের তালিকা (ছবিসহ) দিতে পারবেন — সবই ঐচ্ছিক।</p><div id="tm"></div></div>
    <div class="savebar"><span class="sb-note" id="sb-note"></span><button class="btn" id="tm-save">💾 দল ও খেলোয়াড় সেভ করুন</button></div>`;
    bindTSel(renderTeams);
    teamEditor($("#tm"), tmArr); watchDirty();
    $("#tm").addEventListener("click", e => { if (e.target.closest("button")) dirty = true; });
    $("#tm").addEventListener("change", () => { dirty = true; });
    $("#tm-save").addEventListener("click", async e => {
      const badFb = tmArr.find(x => String(x.facebook || "").trim() && !/^https?:\/\//i.test(String(x.facebook).trim()));
      if (badFb) { toast(`"${badFb.name}" দলের ফেসবুক লিংক http:// বা https:// দিয়ে শুরু হতে হবে`, true); return; }
      busy(e.target, true, "সেভ হচ্ছে…");
      try { await saveCol(t, "teams", teamsFromEditor(tmArr)); dirty = false; toast("✅ দল ও খেলোয়াড় সেভ হয়েছে"); renderTeams(); }
      catch (err) { toast("সেভ হয়নি: " + errText(err), true); busy(e.target, false); }
    });
  }

  /* ---------- 📰 নিউজ ---------- */
  async function renderNews() {
    const el = $("#view");
    if (!(await loadOrFail(el))) return;
    if (!tournaments.length) return noT(el);
    const t = curT(), list = arr(t.news);
    el.innerHTML = `
    <div class="page-h"><h2>📰 নিউজ</h2><div class="ph-acts"><button class="btn" id="nw-add">+ নতুন নিউজ</button></div></div>
    ${tSel(`<span class="muted">${MT.toBn(list.length)}টি নিউজ</span>`)}
    <div id="nw-list">${list.length ? list.map((n, i) => `<div class="nw-row" data-i="${i}">
        <div class="fx-main"><b>${esc(n.title || "শিরোনাম নেই")}</b><small>${esc(n.date || "")}${n.link ? " • 🔗 লিংক আছে" : ""}</small><p>${esc(String(n.text || "").slice(0, 140))}${String(n.text || "").length > 140 ? "…" : ""}</p></div>
        <div class="fx-acts"><button data-ed title="এডিট">✏️</button><button data-up title="ওপরে">↑</button><button data-rm title="মুছুন">🗑</button></div></div>`).join("")
      : `<div class="box2 empty-box"><div class="big">📰</div><p class="hint">এই টুর্নামেন্টে এখনো কোনো নিউজ নেই।</p></div>`}</div>`;
    bindTSel(renderNews);
    const modal = idx => {
      const isNew = idx == null, n = isNew ? { date: bnToday() } : JSON.parse(JSON.stringify(list[idx]));
      openModal({ title: isNew ? "+ নতুন নিউজ" : "✏️ নিউজ এডিট", wide: true,
        body: `<label class="f"><span>শিরোনাম *</span><input name="title" value="${esc(n.title || "")}"></label>
          <label class="f"><span>তারিখ</span><input name="date" value="${esc(n.date || "")}" placeholder="৩ নভেম্বর, ২০২৬"></label>
          <label class="f"><span>বিস্তারিত</span><textarea name="text" style="min-height:130px">${esc(n.text || "")}</textarea></label>
          <label class="f"><span>বিস্তারিত নিউজের লিংক (ঐচ্ছিক — দিলে "আরও পড়ুন" বাটন আসবে ও নতুন ট্যাবে খুলবে)</span><input name="link" value="${esc(n.link || "")}" placeholder="https://..."></label>`,
        buttons: [{ label: "বাতিল", cls: "ghost", onClick: c => c.close() }, { label: "💾 সেভ করুন", onClick: async c => {
          const g = k => $(`[name="${k}"]`, c.el).value.trim();
          if (!g("title")) { toast("শিরোনাম দিন", true); return; }
          if (g("link") && !/^https?:\/\//i.test(g("link"))) { toast("লিংক http:// বা https:// দিয়ে শুরু হতে হবে", true); return; }
          const o = {}; ["title", "date", "text", "link"].forEach(k => { if (g(k)) o[k] = g(k); });
          const next = list.slice(); if (isNew) next.unshift(o); else next[idx] = o;
          await saveCol(t, "news", next); toast("✅ নিউজ সেভ হয়েছে"); c.close(); renderNews();
        } }] });
    };
    $("#nw-add").addEventListener("click", () => modal(null));
    $("#nw-list").addEventListener("click", async e => {
      const row = e.target.closest(".nw-row"), b = e.target.closest("button"); if (!row || !b) return;
      const i = +row.dataset.i;
      if (b.hasAttribute("data-ed")) modal(i);
      else if (b.hasAttribute("data-up")) { if (i > 0) { const n = list.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; try { await saveCol(t, "news", n); renderNews(); } catch (err) { toast(errText(err), true); } } }
      else if (b.hasAttribute("data-rm")) { if (!confirm("এই নিউজটি মুছে ফেলবেন?")) return; try { await saveCol(t, "news", list.filter((_, k) => k !== i)); toast("মুছে ফেলা হয়েছে"); renderNews(); } catch (err) { toast(errText(err), true); } }
    });
  }

  /* ---------- টুর্নামেন্টের মূল তথ্য (ম্যাচ/দল/নিউজ আলাদা ট্যাবে) ---------- */
  function renderEditor(t) {
    const isNew = !t;
    const d = isNew
      ? { id: "t-" + Date.now().toString(36), title: "", sport: "ফুটবল", status: "upcoming", image: "", short: "", organizer: "", venue: "", district: "ময়মনসিংহ", format: "", start_date: "", end_date: "", teams_count: "", overview: "", results: [], awards: [] }
      : JSON.parse(JSON.stringify(t));
    d.results = arr(d.results); d.awards = arr(d.awards);
    $$(".adm-nav [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === "list"));
    const el = $("#view");
    const fld = (label, name, val, cls = "", ph = "") => `<label class="f ${cls}"><span>${label}</span><input name="${name}" value="${esc(val)}" placeholder="${esc(ph)}"></label>`;
    el.innerHTML = `
    <form id="ed" autocomplete="off">
      <div class="page-h"><div class="ph-l"><button type="button" class="btn small ghost" id="back">← ফিরে যান</button><h2>${isNew ? "নতুন টুর্নামেন্ট" : "টুর্নামেন্টের তথ্য"}</h2></div></div>
      ${isNew ? `<div class="box2 note-box">💡 টুর্নামেন্ট সেভ করার পর ম্যাচ, দল ও নিউজ যোগ করতে বাম মেনুর <b>📅 ম্যাচ</b>, <b>👥 দল</b> ও <b>📰 নিউজ</b> ট্যাব ব্যবহার করুন।</div>` : `
      <div class="box2 shortcuts"><b>এই টুর্নামেন্টের:</b>
        <button type="button" class="btn small ghost" data-sc="fixtures">📅 ম্যাচ (${MT.toBn(arr(t.fixtures).length)})</button>
        <button type="button" class="btn small ghost" data-sc="results">🏁 ফলাফল</button>
        <button type="button" class="btn small ghost" data-sc="teams">👥 দল ও খেলোয়াড়</button>
        <button type="button" class="btn small ghost" data-sc="news">📰 নিউজ (${MT.toBn(arr(t.news).length)})</button></div>`}

      <div class="box2"><h3>মূল তথ্য</h3><div class="grid2" style="margin-top:12px">
        ${fld("টুর্নামেন্টের নাম *", "title", d.title, "full", "ময়মনসিংহ প্রিমিয়ার ডিভিশন ফুটবল লীগ ২০২৬")}
        <label class="f"><span>খেলার ধরন</span><input name="sport" list="sports" value="${esc(d.sport)}"><datalist id="sports"><option>ফুটবল</option><option>ক্রিকেট</option><option>কাবাডি</option><option>ভলিবল</option><option>হ্যান্ডবল</option></datalist></label>
        <label class="f"><span>স্ট্যাটাস</span><select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f full"><span>সংক্ষিপ্ত বিবরণ (কার্ড, পেইজের ওপরে ও গুগলে দেখাবে — ৭০–১৬০ অক্ষর ভালো)</span><textarea name="short" style="min-height:70px">${esc(d.short)}</textarea></label>
        ${fld("আয়োজক", "organizer", d.organizer)}
        ${fld("ভেন্যু", "venue", d.venue, "", "ময়মনসিংহ জেলা স্টেডিয়াম")}
        ${fld("জেলা", "district", d.district)}
        ${fld("ফরমেট", "format", d.format, "", "লীগ / নকআউট")}
        ${fld("শুরুর তারিখ", "start_date", d.start_date, "", "৬ নভেম্বর, ২০২৬")}
        ${fld("শেষ তারিখ", "end_date", d.end_date, "", "নির্ধারিত হয়নি")}
        ${fld("অংশগ্রহণকারী দলের সংখ্যা", "teams_count", d.teams_count, "", "৯")}
      </div></div>

      <div class="box2"><h3>🖼 ছবি</h3><p class="hint">কার্ডের কভার ছবি। ছবি না দিলে সুন্দর ডিফল্ট কভার দেখাবে। বড় ছবি নিজে থেকেই ছোট করে আপলোড হয়।</p>
        <div class="img-prev" id="img-prev">${d.image ? `<img src="${esc(d.image)}" alt="">` : "ছবি নেই"}</div>
        <div class="actions" style="margin-bottom:12px"><input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden>
          <button type="button" class="btn small dark" id="pick">📤 ছবি আপলোড করুন</button>
          <button type="button" class="btn small danger" id="rm-img">ছবি সরান</button></div>
        <label class="f"><span>অথবা ছবির লিংক (আপলোড করলে নিজে বসে যাবে)</span><input name="image" id="img-url" value="${esc(d.image)}" placeholder="https://..."></label></div>

      <div class="box2"><h3>সারসংক্ষেপ — "প্রতিযোগিতা সম্পর্কে"</h3><p class="hint">প্রতিটি অনুচ্ছেদ আলাদা লাইনে লিখুন (কমপক্ষে ২ অনুচ্ছেদ দিলে গুগলে ভালো)।</p>
        <label class="f"><textarea name="overview" style="min-height:150px">${esc(d.overview)}</textarea></label></div>

      <div class="box2"><h3>🏅 পুরস্কার</h3><div id="aw"></div></div>
      ${d.results.length ? `<div class="box2"><h3>পুরোনো ফলাফল তালিকা</h3><p class="hint">নতুন ফলাফল "🏁 ফলাফল" ট্যাব থেকে দিন। এই তালিকা শুধু আগে আলাদাভাবে দেওয়া ফলাফলের জন্য।</p><div id="rs"></div></div>` : ""}

      <div class="savebar"><button type="button" class="btn ghost" id="cancel">বাতিল</button><button class="btn" id="save">💾 সেভ করুন</button>
        ${isNew ? "" : `<button type="button" class="btn danger" id="del">🗑 মুছুন</button>`}</div>
    </form>`;

    listEditor($("#aw"), d.awards, SCHEMAS.awards, "পুরস্কার যোগ করুন");
    if (d.results.length) listEditor($("#rs"), d.results, SCHEMAS.results, "ফলাফল যোগ করুন");
    watchDirty();
    const back = () => setView("list");
    $("#back").addEventListener("click", back); $("#cancel").addEventListener("click", back);
    if (!isNew) { $("#del").addEventListener("click", () => removeTournament(t)); $$("[data-sc]").forEach(b => b.addEventListener("click", () => { selT = t.id; setView(b.dataset.sc); })); }

    const setImg = url => { $("#img-url").value = url; $("#img-prev").innerHTML = url ? `<img src="${esc(url)}" alt="">` : "ছবি নেই"; };
    $("#img-url").addEventListener("change", e => setImg(e.target.value.trim()));
    $("#rm-img").addEventListener("click", () => setImg(""));
    $("#pick").addEventListener("click", () => $("#file").click());
    $("#file").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      const b = $("#pick"); busy(b, true, "আপলোড হচ্ছে…");
      try {
        const blob = await shrink(f);
        const path = `tournaments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await sb.storage.from("images").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
        if (error) throw error;
        setImg(sb.storage.from("images").getPublicUrl(path).data.publicUrl);
        toast("✅ ছবি আপলোড হয়েছে (সেভ করতে ভুলবেন না)");
      } catch (err) { toast("ছবি আপলোড হয়নি: " + errText(err), true); }
      busy(b, false); e.target.value = "";
    });

    $("#ed").addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(e.target), g = k => (fd.get(k) || "").toString().trim();
      if (!g("title")) { toast("টুর্নামেন্টের নাম দিন", true); return; }
      if (d.results.some(r => String(r.watch || "").trim() && !/^https?:\/\//i.test(String(r.watch).trim()))) { toast("ফলাফলের লাইভ ম্যাচ লিংক http:// বা https:// দিয়ে শুরু হতে হবে", true); return; }
      const row = {
        title: g("title"), sport: g("sport") || "ফুটবল", status: g("status"), image: g("image"), short: g("short"),
        organizer: g("organizer"), venue: g("venue"), district: g("district"), format: g("format"),
        start_date: g("start_date"), end_date: g("end_date"), teams_count: g("teams_count"), overview: g("overview"),
        results: cleanRows(d.results, SCHEMAS.results), awards: cleanRows(d.awards, SCHEMAS.awards)
      };
      const b = $("#save"); busy(b, true, "সেভ হচ্ছে…");
      /* নতুন হলে খালি ম্যাচ/দল/নিউজসহ তৈরি; পুরোনো হলে শুধু এই ফর্মের ঘরগুলো বদলায় (ম্যাচ/দল/নিউজ অক্ষত থাকে) */
      const { error } = isNew
        ? await sb.from("tournaments").insert(Object.assign({ id: d.id, fixtures: [], teams: [], news: [] }, row))
        : await sb.from("tournaments").update(row).eq("id", d.id);
      busy(b, false);
      if (error) { toast("সেভ হয়নি: " + errText(error), true); return; }
      toast("✅ সেভ হয়েছে"); dirty = false;
      if (isNew) { await loadTournaments(); selT = d.id; }
      setView("list", true);
    });
    window.scrollTo({ top: 0 });
  }

  boot();
})();
