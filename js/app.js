/* MTVBD Sports — সাইটের মূল স্ক্রিপ্ট */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS = { live: "লাইভ", upcoming: "আসন্ন", completed: "সম্পন্ন" };
const SPORT_ICON = { "ফুটবল": "⚽", "ক্রিকেট": "🏏", "কাবাডি": "🤼", "ভলিবল": "🏐", "ব্যাডমিন্টন": "🏸", "বাস্কেটবল": "🏀", "হ্যান্ডবল": "🤾" };
const SPORT_CLASS = { "ফুটবল": "football", "ক্রিকেট": "cricket", "কাবাডি": "kabaddi" };

/* ---------- ছোট সহায়ক ফাংশন ---------- */
const DEFAULT_YT = "https://www.youtube.com/@mymensinghtvbd24";
const safeUrl = u => { u = String(u ?? "").trim(); return /^https?:\/\//i.test(u) ? u : ""; };   // শুধু http/https লিংক গ্রহণযোগ্য
const ytChannel = () => safeUrl(window.SITE && window.SITE.youtube) || DEFAULT_YT;
const subUrl = () => { const u = ytChannel(); return u + (u.includes("?") ? "&" : "?") + "sub_confirmation=1"; };
const BN_DIG = "০১২৩৪৫৬৭৮৯";
const bnNum = n => String(n).replace(/\d/g, d => BN_DIG[d]);

const ICONS = {
  signal: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
};

/* ---------- Header / Footer ---------- */
function renderChrome(active) {
  const S = window.SITE;
  $("#site-header").outerHTML = `
  <header class="site-header" id="site-header">
    <div class="container nav">
      <a class="brand" href="index.html">
        <div class="brand-logo">${ICONS.signal}</div>
        <div><div class="brand-name">MTVBD <span>SPORTS</span></div><div class="brand-sub">${esc(S.tagline)}</div></div>
      </a>
      <nav class="nav-links" id="nav-links">
        <a href="index.html" class="${active === "home" ? "active" : ""}">হোম</a>
        <a href="index.html#live">লাইভ টিভি</a>
        <a href="tournaments.html" class="${active === "tournaments" ? "active" : ""}">টুর্নামেন্ট</a>
        <a href="index.html#youtube">ইউটিউব</a>
        <a href="index.html#contact">যোগাযোগ</a>
      </nav>
      <button class="menu-btn" id="menu-btn" aria-label="মেনু">${ICONS.menu}</button>
    </div>
  </header>`;
  $("#site-footer").outerHTML = `
  <footer class="site-footer">
    <div class="container footer-in">
      <div>© ${new Date().getFullYear()} ${esc(S.name)} — ${esc(S.tagline)}। সর্বস্বত্ব সংরক্ষিত।</div>
      <div><a href="${esc(S.facebook)}" target="_blank" rel="noopener">Facebook</a> &nbsp;•&nbsp; <a href="${esc(ytChannel())}" target="_blank" rel="noopener">YouTube</a> &nbsp;•&nbsp; <a href="tel:${esc(S.phoneIntl)}">${esc(S.phone)}</a></div>
    </div>
  </footer>`;
  $("#menu-btn").addEventListener("click", () => $("#nav-links").classList.toggle("open"));
  $$("#nav-links a").forEach(a => a.addEventListener("click", () => $("#nav-links").classList.remove("open")));
}

/* ---------- YouTube ---------- */
function ytId(u) {
  if (!u) return null;
  u = u.trim();
  if (/^[\w-]{11}$/.test(u)) return u;
  try {
    const x = new URL(u);
    const h = x.hostname.replace(/^(www|m)\./, "");
    if (h === "youtu.be") return x.pathname.slice(1, 12);
    if (h.endsWith("youtube.com")) {
      const v = x.searchParams.get("v");
      if (v) return v;
      const m = x.pathname.match(/\/(live|embed|shorts)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch (e) {}
  return null;
}

/* লাইভ লিংক শুধু অ্যাডমিন প্যানেল (বা data.js) থেকে আসে; দর্শক কোনো লিংক দিতে পারে না */
let _playerEmpty = null, _playerId;
function initPlayer() {
  const box = $("#player");
  if (!box) return;
  const badge = $("#live-badge");
  if (_playerEmpty === null) _playerEmpty = box.innerHTML;
  const id = ytId(window.SITE.liveUrl);
  if (id === _playerId) return;
  _playerId = id;
  if (id) {
    box.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="MTVBD Sports Live" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    badge.style.display = "inline-flex";
  } else {
    box.innerHTML = _playerEmpty;
    badge.style.display = "none";
  }
}

/* ---------- ম্যাচের অবস্থা (লাইভ / আসন্ন / সম্পন্ন) — তারিখ-সময় দেখে নিজে থেকে নির্ধারিত হয় ---------- */
const cmp = (x, y) => (x === y ? 0 : x < y ? -1 : 1);

/* একটি টুর্নামেন্টের সব ম্যাচ। ফিক্সচারে স্কোর দেওয়া থাকলে সেটাই ফলাফল;
   আগে আলাদা "ফলাফল" তালিকায় দেওয়া ফলাফলও (একই দলের ম্যাচ হলে) ফিক্সচারের সাথে মিলিয়ে নেওয়া হয়। */
function tMatches(t, now) {
  const legacy = (t.results || []).map((r, i) => ({ r, i, used: false }));
  const list = [];
  (t.fixtures || []).forEach((f, i) => {
    if (!f || (!f.home && !f.away)) return;
    let g = f;
    if (!MT.hasResult(f)) {
      const x = legacy.find(l => !l.used && l.r.home === f.home && l.r.away === f.away);
      if (x) { x.used = true; g = Object.assign({}, f, { homeScore: x.r.homeScore, awayScore: x.r.awayScore, resultNote: x.r.note, watch: x.r.watch }); }
    }
    list.push(Object.assign({ t, f: g, id: "f" + i }, MT.matchInfo(g, t.sport, now)));
  });
  legacy.forEach(({ r, i, used }) => {
    if (used || !r || (!r.home && !r.away)) return;
    const d = MT.parseDate(r.date);
    list.push({ t, f: Object.assign({}, r, { resultNote: r.note, note: "" }), id: "r" + i, status: "completed", hasRes: true, legacy: true, start: d ? Date.UTC(d.y, d.m - 1, d.d) - MT.OFFSET : null });
  });
  return list;
}
const allMatches = now => (window.TOURNAMENTS || []).flatMap(t => tMatches(t, now));
const dhakaDay = ms => Math.floor((ms + MT.OFFSET) / 864e5);
const stripDay = d => String(d || "").replace(/\s*\(.*\)\s*$/, "");
function dayLabel(m, now) {
  const dd = dhakaDay(m.start) - dhakaDay(now);
  return dd === 0 ? "আজ" : dd === 1 ? "আগামীকাল" : stripDay(m.f.date);
}
function countdown(ms) {
  const mins = Math.max(1, Math.ceil(ms / 60000));
  if (mins < 60) return `${bnNum(mins)} মিনিট পর`;
  const h = Math.floor(mins / 60), r = mins % 60;
  return `${bnNum(h)} ঘণ্টা${r ? " " + bnNum(r) + " মিনিট" : ""} পর`;
}

/* ---------- হোমপেইজের "ম্যাচ" প্যানেল ---------- */
let _mTab = null, _mUser = false;     // _mUser: দর্শক নিজে ট্যাব বেছে নিলে আর নিজে থেকে বদলায় না
function mpItem(m, now) {
  const t = m.t, f = m.f, done = m.status === "completed";
  const href = `tournament.html?id=${encodeURIComponent(t.id)}&tab=${done && m.hasRes ? "results" : "fixtures"}&m=${m.id}`;
  let badge, meta;
  if (m.status === "live") {
    badge = `<span class="mp-badge live"><i></i>লাইভ</span>`;
    meta = [f.time && `⏰ ${esc(f.time)}`, f.venue && `📍 ${esc(f.venue)}`];
  } else if (done) {
    badge = `<span class="mp-badge">✅ শেষ</span>`;
    meta = [f.date && `🗓 ${esc(stripDay(f.date))}`, f.venue && `📍 ${esc(f.venue)}`];
  } else {
    badge = m.postponed ? `<span class="mp-badge hold">⏸ স্থগিত</span>`
      : (m.start != null && !m.dateOnly && m.start - now < 6 * 3600e3) ? `<span class="mp-badge soon">⏳ ${countdown(m.start - now)}</span>`
      : `<span class="mp-badge">আসন্ন</span>`;
    const when = m.start != null ? dayLabel(m, now) : stripDay(f.date);
    meta = [(when || f.time) && `🗓 ${esc([when, f.time].filter(Boolean).join(" • "))}`, f.venue && `📍 ${esc(f.venue)}`];
  }
  return `<a class="mp-item ${m.status}" href="${href}">
    <div class="mp-top"><span class="mp-t">${SPORT_ICON[t.sport] || "🏆"} ${esc(t.title)}</span>${badge}</div>
    <div class="mp-row"><span class="mp-team">${esc(f.home)}</span><span class="mp-mid">${done ? esc(MT.scoreText(f)) : "VS"}</span><span class="mp-team">${esc(f.away)}</span></div>
    <div class="mp-meta">${meta.filter(Boolean).map(x => `<span>${x}</span>`).join("")}</div>
    ${m.status === "live" && window.SITE.liveUrl ? `<div class="mp-watch">▶ ওপরের প্লেয়ারে সরাসরি দেখুন</div>` : ""}</a>`;
}
function renderMatchesPanel() {
  const el = $("#matches"); if (!el) return;
  const now = Date.now(), g = { live: [], upcoming: [], completed: [] };
  allMatches(now).forEach(m => g[m.status].push(m));
  g.live.sort((a, b) => cmp(a.start ?? Infinity, b.start ?? Infinity));
  g.upcoming.sort((a, b) => cmp(a.start ?? Infinity, b.start ?? Infinity));
  g.completed.sort((a, b) => cmp(b.start ?? -Infinity, a.start ?? -Infinity));
  if (!_mUser) _mTab = g.live.length ? "live" : g.upcoming.length ? "upcoming" : "completed";
  const old = $(".mp-list", el), top = old && old.dataset.tab === _mTab ? old.scrollTop : 0;
  const EMPTY = { live: "এই মুহূর্তে কোনো ম্যাচ লাইভ নেই।", upcoming: "এখন কোনো আসন্ন ম্যাচ নেই।", completed: "এখনো কোনো ম্যাচ শেষ হয়নি।" };
  const tabs = [["live", "🔴 লাইভ"], ["upcoming", "আসন্ন"], ["completed", "সম্পন্ন"]]
    .map(([k, l]) => `<button type="button" class="mp-tab ${k === _mTab ? "on" : ""} ${k === "live" && g.live.length ? "has" : ""}" data-mt="${k}">${l}<b>${bnNum(g[k].length)}</b></button>`).join("");
  const list = g[_mTab].slice(0, 40);
  el.innerHTML = `<div class="mp-head"><h3>🏟 ম্যাচ</h3><span class="mp-sub">সময় অনুযায়ী নিজে থেকে আপডেট হয়</span></div>
    <div class="mp-tabs">${tabs}</div>
    <div class="mp-list" data-tab="${_mTab}">${list.length ? list.map(m => mpItem(m, now)).join("")
      : `<div class="mp-empty">${EMPTY[_mTab]}${_mTab === "live" && g.upcoming.length ? `<br><button type="button" data-mt="upcoming">আসন্ন ম্যাচ দেখুন →</button>` : ""}</div>`}</div>
    <div class="mp-foot"><a href="tournaments.html">সব টুর্নামেন্ট দেখুন →</a></div>`;
  const nl = $(".mp-list", el); if (nl && top) nl.scrollTop = top;
}
function initMatchesPanel() {
  const el = $("#matches"); if (!el) return;
  el.addEventListener("click", e => {
    const b = e.target.closest("[data-mt]"); if (!b) return;
    _mTab = b.dataset.mt; _mUser = true; renderMatchesPanel();
  });
  renderMatchesPanel();
}

/* ---------- Tournament cards ---------- */
function cardHTML(t) {
  const cls = SPORT_CLASS[t.sport] || "other";
  const icon = SPORT_ICON[t.sport] || "🏆";
  const cover = t.image ? `<img src="${esc(t.image)}" alt="${esc(t.title)}" loading="lazy">` : `<div class="pattern"></div><div class="big">${icon}</div>`;
  const dot = t.status === "live" ? "<i></i>" : "";
  return `<article class="card">
    <div class="cover ${cls}">${cover}
      <span class="status ${t.status}">${dot}${STATUS[t.status] || ""}</span>
      <span class="sport-tag">${esc(t.sport)}</span>
    </div>
    <div class="card-body">
      <h3>${esc(t.title)}</h3>
      <p>${esc(t.short)}</p>
      <div class="card-meta">${t.start ? `<span>🗓 ${esc(t.start)}</span>` : ""}${t.venue ? `<span>📍 ${esc(t.venue)}</span>` : ""}</div>
      <a class="btn" href="tournament.html?id=${encodeURIComponent(t.id)}">বিস্তারিত দেখুন →</a>
    </div></article>`;
}

function initTournamentList(limit) {
  const grid = $("#t-grid"); if (!grid) return;
  const order = { live: 0, upcoming: 1, completed: 2 };
  const all = [...window.TOURNAMENTS].sort((a, b) => order[a.status] - order[b.status]);
  let filter = "all";
  function draw() {
    let list = all.filter(t => filter === "all" || t.status === filter);
    if (limit) list = list.slice(0, limit);
    grid.innerHTML = list.length ? list.map(cardHTML).join("") : `<div class="empty">এই ক্যাটাগরিতে এখন কোনো টুর্নামেন্ট নেই।</div>`;
  }
  $$(".chip").forEach(c => c.addEventListener("click", () => {
    $$(".chip").forEach(x => x.classList.remove("active")); c.classList.add("active");
    filter = c.dataset.filter; draw();
  }));
  draw();
}

/* ---------- Tournament detail ---------- */
function infoRow(label, val) { return val ? `<div class="info-row"><span>${label}</span><b>${esc(val)}</b></div>` : ""; }

/* ম্যাচ কার্ড। ctx = "fixtures" | "results"।
   ফিক্সচারে "▶ ভিডিও"/"▶ লাইভ দেখুন" (f.video), শেষ ম্যাচে "▶ ম্যাচ দেখুন" (f.watch, না থাকলে f.video)। কোনো লিংক না থাকলে ইউটিউব চ্যানেল। */
function matchHTML(m, ctx) {
  const f = m.f, res = ctx === "results", done = m.status === "completed", live = m.status === "live";
  const mid = res || done ? esc(MT.scoreText(f)) : "VS";
  const foot = [f.date && `🗓 ${esc(f.date)}`, f.time && `⏰ ${esc(f.time)}`, f.venue && `📍 ${esc(f.venue)}`, res && f.resultNote && esc(f.resultNote)].filter(Boolean).join("</span><span>");
  const head = [res ? f.round : "", f.no].filter(Boolean).map(esc).join(" • ");
  const pill = live ? `<span class="mpill live"><i></i>লাইভ</span>` : m.postponed ? `<span class="mpill hold">⏸ স্থগিত</span>` : (done && !res ? `<span class="mpill done">✅ শেষ</span>` : "");
  const link = done ? (safeUrl(f.watch) || safeUrl(f.video) || ytChannel()) : (safeUrl(f.video) || ytChannel());
  return `<div class="match ${m.status}" data-mid="${esc(m.id)}"><div class="mtop"><div class="round">${head}</div>${pill}</div>
    <div class="row"><div class="team">${esc(f.home)}</div><div class="mid">${mid}</div><div class="team">${esc(f.away)}</div></div>
    <div class="foot"><span>${foot}</span></div>
    <div class="match-act"><a class="vbtn ${live ? "livebtn" : ""}" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${live ? "▶ লাইভ দেখুন" : done ? "▶ ম্যাচ দেখুন" : "▶ ভিডিও"}</a></div></div>`;
}
function fixturesHTML(list) {          // রাউন্ড/গ্রুপ অনুযায়ী ভাগ করে দেখায়
  const groups = [], idx = {};
  list.forEach(m => { const k = m.f.round || ""; if (!(k in idx)) { idx[k] = groups.length; groups.push({ k, items: [] }); } groups[idx[k]].items.push(m); });
  return groups.map(g => {
    const notes = [...new Set(g.items.map(m => m.f.note).filter(Boolean))];
    return `<div class="round-group">${g.k ? `<div class="round-head"><h3>${esc(g.k)}</h3><span class="rcount">${bnNum(g.items.length)}টি ম্যাচ</span></div>` : ""}${notes.length ? `<div class="round-note">ℹ️ ${notes.map(esc).join(" • ")}</div>` : ""}${g.items.map(m => matchHTML(m, "fixtures")).join("")}</div>`;
  }).join("");
}
/* ফিক্সচার ও ফলাফল ট্যাব (সময় বদলালে নিজে থেকে নতুন করে আঁকা হয়) */
function drawMatchPanels(t) {
  const M = tMatches(t, Date.now());
  const fx = M.filter(m => !m.legacy);
  const rs = M.filter(m => m.hasRes).sort((a, b) => cmp(b.start ?? -Infinity, a.start ?? -Infinity));
  const pf = $("#p-fixtures"), pr = $("#p-results");
  if (pf) pf.innerHTML = `<h2>ফিক্সচার</h2>${fx.length ? fixturesHTML(fx) : soon("ফিক্সচার শীঘ্রই প্রকাশ করা হবে।")}`;
  if (pr) pr.innerHTML = `<h2>ফলাফল</h2>${rs.length ? rs.map(m => matchHTML(m, "results")).join("") : soon("এখনো কোনো ফলাফল নেই।")}`;
}
function teamsHTML(list) {             // "# গ্রুপ ‘এ’" লিখলে সেটা শিরোনাম হয়
  const secs = [{ h: "", items: [] }];
  list.forEach(n => { n = String(n).trim(); if (!n) return; if (n.startsWith("#")) secs.push({ h: n.replace(/^#+\s*/, ""), items: [] }); else secs[secs.length - 1].items.push(n); });
  return secs.filter(s => s.items.length).map(s => `${s.h ? `<h3 class="team-group">${esc(s.h)}</h3>` : ""}<div class="teams-grid">${s.items.map(n => `<div class="team-card"><div class="badge">${esc(n.charAt(0))}</div>${esc(n)}</div>`).join("")}</div>`).join("");
}
function newsHTML(n) {
  const l = safeUrl(n.link);
  return `<div class="news-item">${n.date ? `<small>${esc(n.date)}</small>` : ""}<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p>${l ? `<a class="more" href="${esc(l)}" target="_blank" rel="noopener noreferrer">আরও পড়ুন →</a>` : ""}</div>`;
}
const soon = txt => `<div class="empty">${txt}</div>`;

function initDetail() {
  const id = new URLSearchParams(location.search).get("id");
  let t = window.TOURNAMENTS.find(x => x.id === id);
  const root = $("#detail");
  if (!t) { root.innerHTML = `<div class="container" style="padding:80px 18px;text-align:center"><h2>টুর্নামেন্টটি খুঁজে পাওয়া যায়নি</h2><p style="margin:12px 0 20px;color:#6b7392">লিংকটি সঠিক নয় অথবা টুর্নামেন্টটি সরানো হয়েছে।</p><a class="btn" href="tournaments.html">সব টুর্নামেন্ট দেখুন</a></div>`; return; }
  document.title = t.title + " | MTVBD Sports";
  const liveHref = "index.html#live";
  const glance = [t.start && `<span>🗓 ${esc(t.start)}</span>`, t.venue && `<span>📍 ${esc(t.venue)}</span>`, t.teamsCount && `<span>👥 ${esc(t.teamsCount)} দল</span>`].filter(Boolean).join("");

  const tabs = [
    ["overview", "সারসংক্ষেপ"], ["fixtures", "ফিক্সচার"], ["results", "ফলাফল"],
    ["teams", "দল"], ["news", "নিউজ"], ["awards", "পুরস্কার"]
  ];

  root.innerHTML = `
  <div class="page-hero"><div class="container">
    <div class="crumbs"><a href="index.html">হোম</a> / <a href="tournaments.html">টুর্নামেন্ট</a> / <span>${esc(t.title)}</span></div>
    <div class="sport-label">${esc(t.sport)}</div>
    <span class="status ${t.status} hero-status" style="position:static">${t.status === "live" ? "<i></i>" : ""}${STATUS[t.status]}</span>
    <h1>${esc(t.title)}</h1>
    <p class="lead">${esc(t.short)}</p>
    <div class="glance">${glance}</div>
  </div></div>

  <div class="tabs-bar"><div class="container"><div class="tabs" id="tabs">
    ${tabs.map((x, i) => `<button class="tab ${i ? "" : "active"}" data-tab="${x[0]}">${x[1]}</button>`).join("")}
  </div></div></div>

  <div class="container">
    <div class="panel active" id="p-overview"><div class="two-col">
      <div><h2>প্রতিযোগিতা সম্পর্কে</h2>${(t.overview || []).map(p => `<p>${esc(p)}</p>`).join("") || soon("বিস্তারিত শীঘ্রই যুক্ত করা হবে।")}</div>
      <aside>
        <div class="box"><h4>তথ্য</h4>
          ${infoRow("আয়োজক", t.organizer)}${infoRow("ভেন্যু", t.venue)}${infoRow("জেলা", t.district)}${infoRow("ফরমেট", t.format)}${infoRow("শুরুর তারিখ", t.start)}${infoRow("শেষ তারিখ", t.end)}${infoRow("অংশগ্রহণকারী দল", t.teamsCount ? t.teamsCount + "টি" : "")}
        </div>
        <div class="box quick"><h4>দ্রুত লিংক</h4>
          <a data-go="fixtures">ফিক্সচার দেখুন →</a><a data-go="results">ফলাফল দেখুন →</a><a href="${liveHref}">লাইভ সম্প্রচার →</a>
        </div>
      </aside></div></div>
    <div class="panel" id="p-fixtures"></div>
    <div class="panel" id="p-results"></div>
    <div class="panel" id="p-teams"><h2>অংশগ্রহণকারী দল</h2>${t.teams.length ? teamsHTML(t.teams) : soon("দলের তালিকা শীঘ্রই প্রকাশ করা হবে।")}</div>
    <div class="panel" id="p-news"><h2>নিউজ</h2>${t.news.length ? t.news.map(newsHTML).join("") : soon("এই টুর্নামেন্টের কোনো নিউজ এখনো নেই।")}</div>
    <div class="panel" id="p-awards"><h2>পুরস্কার</h2>${t.awards.length ? t.awards.map(a => `<div class="award"><div class="trophy">🏆</div><div><b>${esc(a.title)}</b><div style="color:#6b7392">${esc(a.winner || "")}</div></div></div>`).join("") : soon("পুরস্কারের তথ্য শীঘ্রই প্রকাশ করা হবে।")}</div>
  </div>`;

  drawMatchPanels(t);

  function go(name, quiet) {
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $$(".panel").forEach(p => p.classList.toggle("active", p.id === "p-" + name));
    const active = $(".tab.active"); if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: quiet ? "auto" : "smooth" });
    if (!quiet) { const bar = $(".tabs-bar"); window.scrollTo({ top: bar.offsetTop - 68, behavior: "smooth" }); }
  }
  $$(".tab").forEach(b => b.addEventListener("click", () => go(b.dataset.tab)));
  $$("[data-go]").forEach(a => a.addEventListener("click", () => go(a.dataset.go)));

  /* হোমপেইজের ম্যাচে ক্লিক করলে সরাসরি ফলাফল/ফিক্সচার ট্যাবে গিয়ে ওই ম্যাচটি হাইলাইট হয় (?tab=results&m=f3) */
  const qs = new URLSearchParams(location.search), want = qs.get("tab");
  if (want && want !== "overview" && tabs.some(x => x[0] === want)) {
    go(want, true);
    const mid = qs.get("m");
    const card = mid && $(`#p-${want} [data-mid="${CSS.escape(mid)}"]`);
    if (card) { card.classList.add("hl"); setTimeout(() => card.scrollIntoView({ block: "center" }), 120); }
    else window.scrollTo({ top: $(".tabs-bar").offsetTop - 68 });
  }

  /* সময় গড়ালে লাইভ/শেষ চিহ্ন, আর অ্যাডমিন নতুন ফলাফল দিলে সেটা নিজে থেকে আসে */
  const refresh = async () => { if (await reloadData()) t = window.TOURNAMENTS.find(x => x.id === id) || t; drawMatchPanels(t); };
  setInterval(refresh, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

/* ---------- ডেটা লোড (Supabase থেকে; না পেলে data.js-এর ডিফল্ট ডেটা) ---------- */
const ARR = ["overview", "fixtures", "results", "teams", "news", "awards"];
function normalize(t) {
  const o = Object.assign({ title: "", sport: "", status: "upcoming", image: "", short: "", organizer: "", venue: "", district: "", format: "", start: "", end: "", teamsCount: "", liveUrl: "" }, t);
  ARR.forEach(k => { if (!Array.isArray(o[k])) o[k] = []; });
  return o;
}

/* ---------- ডেটা লোড (Supabase) ---------- */
const bn2en = s => String(s || "").replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d));
function toIntl(phone) {
  const d = bn2en(phone).replace(/\D/g, "");
  if (!d) return "";
  return d.startsWith("88") ? "+" + d : "+88" + d;
}
function cfgOK() {
  const c = window.CONFIG;
  return !!(c && c.SUPABASE_URL && c.SUPABASE_ANON_KEY && !/YOUR_/.test(c.SUPABASE_URL + c.SUPABASE_ANON_KEY));
}
async function sbGet(path) {
  const c = window.CONFIG;
  const headers = { apikey: c.SUPABASE_ANON_KEY };
  if (!c.SUPABASE_ANON_KEY.startsWith("sb_")) headers.Authorization = "Bearer " + c.SUPABASE_ANON_KEY;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(c.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + path, { headers, signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}
function fromRow(r) {
  return {
    id: r.id, title: r.title, sport: r.sport, status: r.status, image: r.image, short: r.short,
    organizer: r.organizer, venue: r.venue, district: r.district, format: r.format,
    start: r.start_date, end: r.end_date, teamsCount: r.teams_count,
    overview: String(r.overview || "").split(/\n+/).map(x => x.trim()).filter(Boolean),
    fixtures: r.fixtures || [], results: r.results || [], teams: r.teams || [], news: r.news || [], awards: r.awards || []
  };
}
function applySettings(rows) {
  rows.forEach(s => {
    if (s.key === "live_url") window.SITE.liveUrl = s.value || "";
    if (s.key === "facebook" && s.value) window.SITE.facebook = s.value;
    if (s.key === "youtube" && safeUrl(s.value)) window.SITE.youtube = s.value.trim();
    if (s.key === "phone" && s.value) { window.SITE.phone = s.value; window.SITE.phoneIntl = toIntl(s.value); }
  });
}
async function reloadData() {         // Supabase থেকে সর্বশেষ ডেটা আনে; সফল হলে true
  if (!cfgOK()) return false;
  try {
    const [rows, sets] = await Promise.all([sbGet("tournaments?select=*&order=created_at.desc"), sbGet("settings?select=*")]);
    window.TOURNAMENTS = rows.map(fromRow).map(normalize);
    applySettings(sets);
    return true;
  } catch (e) { return false; }
}
async function loadData() {
  window.TOURNAMENTS = (window.TOURNAMENTS || []).map(normalize);
  if (!cfgOK()) return;               // কনফিগ না থাকলে data.js-এর ডেটা চলবে
  if (!(await reloadData())) console.warn("ডেটাবেস থেকে ডেটা আনা যায়নি, লোকাল ডেটা ব্যবহার হচ্ছে");
}
async function refreshHome() {
  if (await reloadData()) initPlayer();
  renderMatchesPanel();
}
function applyContact() {
  const S = window.SITE;
  const fb = $("#cta-fb"), call = $("#cta-call");
  if (fb) fb.href = S.facebook;
  if (call) { call.href = "tel:" + S.phoneIntl; call.textContent = "📞 " + S.phone; }
  const sub = $("#yt-sub"), visit = $("#yt-visit"), handle = $("#yt-handle"), screen = $("#yt-screen");
  if (sub) sub.href = subUrl();
  if (visit) visit.href = ytChannel();
  if (screen) screen.href = ytChannel();
  if (handle) { const h = ytChannel().match(/youtube\.com\/(@[^/?#]+)/); handle.textContent = h ? h[1] : "MTVBD Sports"; }
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  const page = document.body.dataset.page;
  await loadData();
  renderChrome(page);
  if (page === "home") {
    applyContact(); initPlayer(); initMatchesPanel(); initTournamentList(6);
    setInterval(renderMatchesPanel, 30000);   // লাইভ/আসন্ন/সম্পন্ন প্রতি ৩০ সেকেন্ডে সময় দেখে নিজে থেকে বদলায়
    setInterval(refreshHome, 60000);          // নতুন ফলাফল বা লাইভ লিংক ১ মিনিটের মধ্যে নিজে থেকে আসে
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshHome(); });
  }
  if (page === "tournaments") initTournamentList(0);
  if (page === "detail") initDetail();
});
