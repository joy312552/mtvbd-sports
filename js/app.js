/* MTVBD Sports — সাইটের মূল স্ক্রিপ্ট */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS = { live: "লাইভ", upcoming: "আসন্ন", completed: "সম্পন্ন" };
const SPORT_ICON = { "ফুটবল": "⚽", "ক্রিকেট": "🏏", "কাবাডি": "🤼" };
const SPORT_CLASS = { "ফুটবল": "football", "ক্রিকেট": "cricket", "কাবাডি": "kabaddi" };

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
        <a href="index.html#contact">যোগাযোগ</a>
      </nav>
      <button class="menu-btn" id="menu-btn" aria-label="মেনু">${ICONS.menu}</button>
    </div>
  </header>`;
  $("#site-footer").outerHTML = `
  <footer class="site-footer">
    <div class="container footer-in">
      <div>© ${new Date().getFullYear()} ${esc(S.name)} — ${esc(S.tagline)}। সর্বস্বত্ব সংরক্ষিত।</div>
      <div><a href="${esc(S.facebook)}" target="_blank" rel="noopener">Facebook</a> &nbsp;•&nbsp; <a href="tel:${esc(S.phoneIntl)}">${esc(S.phone)}</a></div>
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

function initPlayer() {
  const box = $("#player");
  if (!box) return;
  const input = $("#live-input"), msg = $("#player-msg"), badge = $("#live-badge");
  const empty = box.innerHTML;
  function play(url, save) {
    const id = ytId(url);
    if (!id) { msg.textContent = "সঠিক ইউটিউব লিংক দিন (যেমন: https://www.youtube.com/watch?v=...)"; return false; }
    msg.textContent = "";
    box.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="MTVBD Sports Live" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    badge.style.display = "inline-flex";
    if (save) { try { localStorage.setItem("mtvbd_live", url); } catch (e) {} }
    return true;
  }
  const qp = new URLSearchParams(location.search).get("live");
  let saved = ""; try { saved = localStorage.getItem("mtvbd_live") || ""; } catch (e) {}
  const start = qp || window.SITE.liveUrl || saved;
  if (start) { input.value = start; play(start, false); } else { badge.style.display = "none"; }
  $("#play-btn").addEventListener("click", () => play(input.value, true));
  input.addEventListener("keydown", e => { if (e.key === "Enter") play(input.value, true); });
  $("#clear-btn").addEventListener("click", () => {
    input.value = ""; box.innerHTML = empty; badge.style.display = "none"; msg.textContent = "";
    try { localStorage.removeItem("mtvbd_live"); } catch (e) {}
  });
}

function nextMatch() {
  for (const t of window.TOURNAMENTS) {
    if (t.status === "completed") continue;
    if (t.fixtures && t.fixtures.length) return { t, f: t.fixtures[0] };
  }
  return null;
}
function renderNextMatch() {
  const el = $("#next-match"); if (!el) return;
  const n = nextMatch();
  if (!n) { el.innerHTML = `<h3>📅 পরবর্তী ম্যাচ</h3><p style="color:#c5cbe4">শীঘ্রই ম্যাচসূচি প্রকাশ করা হবে।</p>`; return; }
  const { t, f } = n;
  el.innerHTML = `<h3>📅 পরবর্তী ম্যাচ</h3>
    <div style="font-size:13px;color:#c5cbe4">${esc(t.title)}</div>
    <div class="vs"><div class="t">${esc(f.home)}</div><div class="x">VS</div><div class="t">${esc(f.away)}</div></div>
    <div class="meta-line">🗓 ${esc(f.date)}</div>
    <div class="meta-line">⏰ ${esc(f.time)}</div>
    <div class="meta-line">📍 ${esc(f.venue)}</div>
    <a class="btn" style="width:100%;margin-top:16px" href="tournament.html?id=${encodeURIComponent(t.id)}">টুর্নামেন্ট দেখুন →</a>`;
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

function matchHTML(m, withScore) {
  const mid = withScore ? `${esc(m.homeScore)} - ${esc(m.awayScore)}` : "VS";
  const foot = [m.date && `🗓 ${esc(m.date)}`, m.time && `⏰ ${esc(m.time)}`, m.venue && `📍 ${esc(m.venue)}`, m.note && esc(m.note)].filter(Boolean).join("</span><span>");
  return `<div class="match">${m.round ? `<div class="round">${esc(m.round)}</div>` : ""}
    <div class="row"><div class="team">${esc(m.home)}</div><div class="mid">${mid}</div><div class="team">${esc(m.away)}</div></div>
    <div class="foot"><span>${foot}</span></div></div>`;
}
const soon = txt => `<div class="empty">${txt}</div>`;

function initDetail() {
  const id = new URLSearchParams(location.search).get("id");
  const t = window.TOURNAMENTS.find(x => x.id === id);
  const root = $("#detail");
  if (!t) { root.innerHTML = `<div class="container" style="padding:80px 18px;text-align:center"><h2>টুর্নামেন্টটি খুঁজে পাওয়া যায়নি</h2><p style="margin:12px 0 20px;color:#6b7392">লিংকটি সঠিক নয় অথবা টুর্নামেন্টটি সরানো হয়েছে।</p><a class="btn" href="tournaments.html">সব টুর্নামেন্ট দেখুন</a></div>`; return; }
  document.title = t.title + " | MTVBD Sports";
  const liveHref = "index.html" + (t.liveUrl ? "?live=" + encodeURIComponent(t.liveUrl) : "") + "#live";
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
    <div class="panel" id="p-fixtures"><h2>ফিক্সচার</h2>${t.fixtures.length ? t.fixtures.map(m => matchHTML(m, false)).join("") : soon("ফিক্সচার শীঘ্রই প্রকাশ করা হবে।")}</div>
    <div class="panel" id="p-results"><h2>ফলাফল</h2>${t.results.length ? t.results.map(m => matchHTML(m, true)).join("") : soon("এখনো কোনো ফলাফল নেই।")}</div>
    <div class="panel" id="p-teams"><h2>অংশগ্রহণকারী দল</h2>${t.teams.length ? `<div class="teams-grid">${t.teams.map(n => `<div class="team-card"><div class="badge">${esc(n.trim().charAt(0))}</div>${esc(n)}</div>`).join("")}</div>` : soon("দলের তালিকা শীঘ্রই প্রকাশ করা হবে।")}</div>
    <div class="panel" id="p-news"><h2>নিউজ</h2>${t.news.length ? t.news.map(n => `<div class="news-item"><small>${esc(n.date)}</small><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div>`).join("") : soon("এই টুর্নামেন্টের কোনো নিউজ এখনো নেই।")}</div>
    <div class="panel" id="p-awards"><h2>পুরস্কার</h2>${t.awards.length ? t.awards.map(a => `<div class="award"><div class="trophy">🏆</div><div><b>${esc(a.title)}</b><div style="color:#6b7392">${esc(a.winner || "")}</div></div></div>`).join("") : soon("পুরস্কারের তথ্য শীঘ্রই প্রকাশ করা হবে।")}</div>
  </div>`;

  function go(name) {
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $$(".panel").forEach(p => p.classList.toggle("active", p.id === "p-" + name));
    const active = $(".tab.active"); if (active) active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    const bar = $(".tabs-bar"); window.scrollTo({ top: bar.offsetTop - 68, behavior: "smooth" });
  }
  $$(".tab").forEach(b => b.addEventListener("click", () => go(b.dataset.tab)));
  $$("[data-go]").forEach(a => a.addEventListener("click", () => go(a.dataset.go)));
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  renderChrome(page);
  if (page === "home") { initPlayer(); renderNextMatch(); initTournamentList(6); }
  if (page === "tournaments") initTournamentList(0);
  if (page === "detail") initDetail();
});
