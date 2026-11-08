/* MTVBD Sports — সার্ভার-সাইড SEO লাইব্রেরি (Vercel Serverless)
   এখান থেকেই প্রতিটি পেইজের title, description, canonical, Open Graph, structured data (JSON-LD)
   ও গুগল অ্যানালিটিক্স/সার্চ কনসোল কোড তৈরি হয়, যাতে গুগল জাভাস্ক্রিপ্ট ছাড়াই সব তথ্য পায়। */
const fs = require("fs");
const path = require("path");
require("../js/shared.js");               // globalThis.MT (তারিখ/সময় পার্সার)
const MT = globalThis.MT;

const ROOT = path.join(__dirname, "..");
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; };
const bnNum = n => String(n).replace(/\d/g, d => MT.BN[d]);
const clip = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

const STATUS = { live: "লাইভ", upcoming: "আসন্ন", completed: "সম্পন্ন" };
const SPORT_ICON = { "ফুটবল": "⚽", "ক্রিকেট": "🏏", "কাবাডি": "🤼", "ভলিবল": "🏐", "ব্যাডমিন্টন": "🏸", "বাস্কেটবল": "🏀", "হ্যান্ডবল": "🤾" };
const SPORT_CLASS = { "ফুটবল": "football", "ক্রিকেট": "cricket", "কাবাডি": "kabaddi" };
const SPORT_EN = { "ফুটবল": "Football", "ক্রিকেট": "Cricket", "কাবাডি": "Kabaddi", "ভলিবল": "Volleyball", "ব্যাডমিন্টন": "Badminton", "বাস্কেটবল": "Basketball", "হ্যান্ডবল": "Handball" };
const TABS = [["overview", "সারসংক্ষেপ"], ["fixtures", "ফিক্সচার"], ["results", "ফলাফল"], ["teams", "দল"], ["news", "নিউজ"], ["awards", "পুরস্কার"]];
const DEFAULTS = {
  title: "MTVBD Sports — ময়মনসিংহ টিভি বিডি স্পোর্টস | লাইভ ক্রিকেট, ফুটবল ও টুর্নামেন্ট",
  description: "ময়মনসিংহ ও আশেপাশের ক্রিকেট, ফুটবল, কাবাডিসহ সব স্পোর্টস ইভেন্ট ও টুর্নামেন্টের লাইভ স্ট্রিমিং, ফিক্সচার, ফলাফল, দল ও নিউজ — MTVBD Sports (ময়মনসিংহ টিভি বিডি)।",
  keywords: "ময়মনসিংহ টিভি বিডি, MTVBD Sports, ময়মনসিংহ লাইভ খেলা, ক্রিকেট লাইভ, ফুটবল লাইভ, টুর্নামেন্ট ফিক্সচার, ম্যাচ ফলাফল, ময়মনসিংহ স্পোর্টস"
};

/* ---------- Supabase ---------- */
function cfg() {
  let url = process.env.SUPABASE_URL || "", key = process.env.SUPABASE_ANON_KEY || "";
  if (!url || !key) {
    try {
      const t = fs.readFileSync(path.join(ROOT, "js", "config.js"), "utf8");
      url = url || (t.match(/SUPABASE_URL\s*:\s*"([^"]+)"/) || [])[1] || "";
      key = key || (t.match(/SUPABASE_ANON_KEY\s*:\s*"([^"]+)"/) || [])[1] || "";
    } catch (e) {}
  }
  return { url: url.replace(/\/$/, ""), key };
}
async function sbGet(p) {
  const c = cfg(); if (!c.url || !c.key) throw new Error("no supabase config");
  const h = { apikey: c.key }; if (!c.key.startsWith("sb_")) h.Authorization = "Bearer " + c.key;
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(c.url + "/rest/v1/" + p, { headers: h, signal: ctl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(tm); }
}
function fromRow(r) {
  return {
    id: r.id, title: r.title || "", sport: r.sport || "", status: r.status || "upcoming", image: r.image || "", short: r.short || "",
    organizer: r.organizer || "", venue: r.venue || "", district: r.district || "", format: r.format || "",
    start: r.start_date || "", end: r.end_date || "", teamsCount: r.teams_count || "", updated: r.updated_at || r.created_at || "",
    overview: String(r.overview || "").split(/\n+/).map(x => x.trim()).filter(Boolean),
    fixtures: Array.isArray(r.fixtures) ? r.fixtures : [], results: Array.isArray(r.results) ? r.results : [],
    teams: Array.isArray(r.teams) ? r.teams : [], news: Array.isArray(r.news) ? r.news : [], awards: Array.isArray(r.awards) ? r.awards : []
  };
}
let _cache = null;
async function loadAll() {                // ৩০ সেকেন্ড মেমোরিতে রাখা হয়
  if (_cache && Date.now() - _cache.at < 30000) return _cache.data;
  const [rows, sets] = await Promise.all([sbGet("tournaments?select=*&order=created_at.desc"), sbGet("settings?select=*").catch(() => [])]);
  const settings = Object.fromEntries((sets || []).map(s => [s.key, s.value]));
  const data = { tournaments: rows.map(fromRow), settings };
  _cache = { at: Date.now(), data };
  return data;
}

/* ---------- সাইটের ঠিকানা ---------- */
function siteUrl(req, settings) {
  const s = safeUrl(settings && settings.site_url);
  if (s) return s.replace(/\/+$/, "");
  const h = (req.headers["x-forwarded-host"] || req.headers.host || "sports.mtvbd.com").split(",")[0].trim();
  return "https://" + h;
}
/* টুর্নামেন্ট অনুযায়ী আলাদা SEO (অ্যাডমিন থেকে দেওয়া): settings-এ seo_t_<id> */
function tSeo(S, id) { try { const o = JSON.parse((S || {})["seo_t_" + id] || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
const tPath = (id, tab) => "/tournament/" + encodeURIComponent(id) + (tab && tab !== "overview" ? "/" + tab : "");

/* ---------- তারিখ ---------- */
const pad = n => String(n).padStart(2, "0");
function isoDate(dateStr, timeStr) {
  const d = MT.parseDate(dateStr); if (!d) return "";
  const t = timeStr ? MT.parseTime(timeStr) : null;
  return t ? `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(t.h)}:${pad(t.mi)}:00+06:00` : `${d.y}-${pad(d.m)}-${pad(d.d)}`;
}
function tRange(t) {
  const ds = t.fixtures.map(f => isoDate(f.date, "")).filter(Boolean).sort();
  return { start: isoDate(t.start, "") || ds[0] || "", end: isoDate(t.end, "") || (ds.length ? ds[ds.length - 1] : "") };
}
const lastmod = t => { const d = new Date(t.updated); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };

/* ---------- দলের তালিকা (স্ট্রিং/অবজেক্ট) ---------- */
function teamList(list) {
  const out = [];
  (list || []).forEach(x => {
    if (typeof x === "string") { const n = x.trim(); if (n && !n.startsWith("#")) out.push({ name: n }); }
    else if (x && x.name) out.push(x);
  });
  return out;
}
const hasRes = f => MT.hasResult(f);

/* ---------- JSON-LD ---------- */
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
function orgLd(site, S) {
  const same = [safeUrl(S.facebook), safeUrl(S.youtube)].filter(Boolean);
  return [{
    "@context": "https://schema.org", "@type": "Organization", "@id": site + "/#org", name: "MTVBD Sports", alternateName: ["ময়মনসিংহ টিভি বিডি", "Mymensingh TV BD"],
    url: site + "/", logo: { "@type": "ImageObject", url: site + "/images/logo.png", width: 512, height: 512 }, sameAs: same
  }, {
    "@context": "https://schema.org", "@type": "WebSite", "@id": site + "/#website", url: site + "/", name: "MTVBD Sports", inLanguage: "bn-BD",
    publisher: { "@id": site + "/#org" }, description: DEFAULTS.description
  }];
}
function crumbLd(site, items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: site + u })) };
}
function placeLd(venue, t) {
  return { "@type": "Place", name: venue || t.venue || "ময়মনসিংহ", address: { "@type": "PostalAddress", addressLocality: t.district || "ময়মনসিংহ", addressCountry: "BD" } };
}
function tournamentLd(site, t, img) {
  const r = tRange(t), url = site + tPath(t.id);
  const matches = t.fixtures.filter(f => f && f.home && f.away && MT.parseDate(f.date)).slice(0, 60).map(f => {
    const post = f.state === "postponed";
    const o = {
      "@type": "SportsEvent", name: `${f.home} বনাম ${f.away}`, startDate: isoDate(f.date, f.time), location: placeLd(f.venue, t),
      eventStatus: "https://schema.org/" + (post ? "EventPostponed" : "EventScheduled"),
      homeTeam: { "@type": "SportsTeam", name: f.home }, awayTeam: { "@type": "SportsTeam", name: f.away },
      sport: SPORT_EN[t.sport] || t.sport, url: site + tPath(t.id, hasRes(f) ? "results" : "fixtures"), image: img
    };
    if (hasRes(f) && String(f.homeScore || "").trim() !== "") o.description = `ফলাফল: ${f.home} ${f.homeScore} - ${f.awayScore} ${f.away}`;
    return o;
  });
  const o = {
    "@context": "https://schema.org", "@type": "SportsEvent", "@id": url + "#event", name: t.title, url, image: [img], inLanguage: "bn-BD",
    description: clip(t.short || t.overview[0] || t.title, 300), sport: SPORT_EN[t.sport] || t.sport, isAccessibleForFree: true,
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode", eventStatus: "https://schema.org/EventScheduled",
    location: placeLd(t.venue, t), organizer: { "@type": "Organization", name: t.organizer || "MTVBD Sports", url: t.organizer ? undefined : site + "/" },
    performer: undefined
  };
  if (r.start) o.startDate = r.start; if (r.end) o.endDate = r.end;
  if (!o.startDate) { o.startDate = new Date().getFullYear() + "-01-01"; }
  const teams = teamList(t.teams).slice(0, 40).map(x => ({ "@type": "SportsTeam", name: x.name, sport: SPORT_EN[t.sport] || t.sport }));
  if (teams.length) o.competitor = teams;
  if (matches.length) o.subEvent = matches;
  return o;
}
function newsLd(site, t, img) {
  return t.news.filter(n => n && n.title).map(n => {
    const d = isoDate(n.date, "");
    const o = { "@context": "https://schema.org", "@type": "NewsArticle", headline: clip(n.title, 110), description: clip(n.text, 200), image: [img], inLanguage: "bn-BD",
      mainEntityOfPage: site + tPath(t.id, "news"), author: { "@type": "Organization", name: "MTVBD Sports" },
      publisher: { "@type": "Organization", name: "MTVBD Sports", logo: { "@type": "ImageObject", url: site + "/images/logo.png" } } };
    if (d) { o.datePublished = d; o.dateModified = d; }
    return o;
  });
}

/* ---------- <head> ---------- */
function gaSnippet(id) {
  id = String(id || "").trim();
  if (!/^(G|GT|AW)-[A-Z0-9]{4,20}$/i.test(id)) return "";
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`;
}
function headHTML(o, S, site) {
  const url = site + o.path, img = o.image || safeUrl(S.og_image) || site + "/images/og-cover.png";
  const robots = o.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const out = [
    `<title>${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.description)}">`,
    o.keywords ? `<meta name="keywords" content="${esc(o.keywords)}">` : "",
    `<meta name="robots" content="${robots}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<link rel="alternate" hreflang="bn-BD" href="${esc(url)}">`,
    `<link rel="alternate" hreflang="x-default" href="${esc(url)}">`,
    `<meta property="og:site_name" content="MTVBD Sports">`,
    `<meta property="og:locale" content="bn_BD">`,
    `<meta property="og:type" content="${o.ogType || "website"}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(img)}">`,
    `<meta property="og:image:alt" content="${esc(o.imageAlt || o.title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(o.title)}">`,
    `<meta name="twitter:description" content="${esc(o.description)}">`,
    `<meta name="twitter:image" content="${esc(img)}">`,
    `<meta name="geo.region" content="BD-34"><meta name="geo.placename" content="ময়মনসিংহ">`,
    /^[\w-]{10,100}$/.test(S.gsc_verify || "") ? `<meta name="google-site-verification" content="${esc(S.gsc_verify)}">` : "",
    /^[\w-]{10,100}$/.test(S.bing_verify || "") ? `<meta name="msvalidate.01" content="${esc(S.bing_verify)}">` : "",
    (o.ld || []).map(ld).join("\n"),
    gaSnippet(S.ga_id),
    cfg().url ? `<link rel="preconnect" href="${esc(cfg().url)}" crossorigin>` : ""
  ];
  return out.filter(Boolean).join("\n");
}

/* ---------- সার্ভার-রেন্ডার করা বডি (ক্রলার/শেয়ার প্রিভিউয়ের জন্য; ব্রাউজারে JS এটি বদলে দেয়) ---------- */
function cardHTML(t) {
  const cls = SPORT_CLASS[t.sport] || "other", icon = SPORT_ICON[t.sport] || "🏆";
  const cover = t.image ? `<img src="${esc(t.image)}" alt="${esc(t.title)}" loading="lazy">` : `<div class="pattern"></div><div class="big">${icon}</div>`;
  return `<article class="card"><div class="cover ${cls}">${cover}<span class="status ${t.status}">${STATUS[t.status] || ""}</span><span class="sport-tag">${esc(t.sport)}</span></div>
<div class="card-body"><h3>${esc(t.title)}</h3><p>${esc(t.short)}</p><div class="card-meta">${t.start ? `<span>🗓 ${esc(t.start)}</span>` : ""}${t.venue ? `<span>📍 ${esc(t.venue)}</span>` : ""}</div>
<a class="btn" href="${tPath(t.id)}">বিস্তারিত দেখুন →</a></div></article>`;
}
const ORD = { live: 0, upcoming: 1, completed: 2 };
const sortT = list => [...list].sort((a, b) => (ORD[a.status] ?? 3) - (ORD[b.status] ?? 3));
function relatedHTML(all, t) {
  const rel = all.filter(x => x.id !== t.id && x.title).sort((a, b) => (b.sport === t.sport) - (a.sport === t.sport)).slice(0, 5);
  return rel.length ? `<h2>আরও টুর্নামেন্ট</h2><ul>${rel.map(x => `<li><a href="${tPath(x.id)}">${esc(x.title)}</a></li>`).join("")}</ul>` : "";
}
function detailHTML(t, tab, all) {
  const nav = `<nav class="seo-tabs" aria-label="${esc(t.title)}">${TABS.map(([k, l]) => `<a href="${tPath(t.id, k)}"${k === tab ? ' aria-current="page"' : ""}>${l}</a>`).join(" • ")}</nav>`;
  const head = `<div class="container ssr-seo"><p><a href="/">হোম</a> / <a href="/tournaments">টুর্নামেন্ট</a> / ${esc(t.title)}</p><h1>${esc(t.title)}</h1><p>${esc(t.short)}</p>${nav}`;
  let body = "";
  if (tab === "overview") body = `<h2>প্রতিযোগিতা সম্পর্কে</h2>${t.overview.map(p => `<p>${esc(p)}</p>`).join("")}<ul>${[["আয়োজক", t.organizer], ["ভেন্যু", t.venue], ["জেলা", t.district], ["ফরমেট", t.format], ["শুরু", t.start], ["শেষ", t.end], ["দল", t.teamsCount]].filter(x => x[1]).map(x => `<li>${x[0]}: ${esc(x[1])}</li>`).join("")}</ul>`;
  if (tab === "fixtures") body = `<h2>${esc(t.title)} — ফিক্সচার</h2><ul>${t.fixtures.filter(f => f && f.home).map(f => `<li>${esc([f.round, f.no].filter(Boolean).join(" • "))}: ${esc(f.home)} বনাম ${esc(f.away)} — ${esc([f.date, f.time, f.venue].filter(Boolean).join(", "))}</li>`).join("")}</ul>`;
  if (tab === "results") {
    const done = t.fixtures.filter(f => f && f.home && hasRes(f)).map(f => `${f.home} ${MT.scoreText(f)} ${f.away}${f.resultNote ? " (" + f.resultNote + ")" : ""}`)
      .concat(t.results.filter(r => r && r.home).map(r => `${r.home} ${r.homeScore} - ${r.awayScore} ${r.away}`));
    body = `<h2>${esc(t.title)} — ফলাফল</h2><ul>${done.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }
  if (tab === "teams") body = `<h2>অংশগ্রহণকারী দল</h2><ul>${teamList(t.teams).map(x => `<li>${esc(x.name)}${x.coach ? " — কোচ: " + esc(x.coach) : ""}${x.info ? " — " + esc(clip(x.info, 160)) : ""}</li>`).join("")}</ul>`;
  if (tab === "news") body = `<h2>নিউজ</h2>${t.news.map(n => `<article><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></article>`).join("")}`;
  if (tab === "awards") body = `<h2>পুরস্কার</h2><ul>${t.awards.map(a => `<li>${esc(a.title)}: ${esc(a.winner)}</li>`).join("")}</ul>`;
  return head + body + relatedHTML(all || [], t) + "</div>";
}

/* ---------- টেমপ্লেট ---------- */
async function template(req, name) {
  try { return fs.readFileSync(path.join(ROOT, "pages", name + ".html"), "utf8"); }
  catch (e) {
    const h = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
    const r = await fetch(`https://${h}/pages/${name}.html`); if (!r.ok) throw new Error("template missing");
    return await r.text();
  }
}
function inject(html, head, extras) {
  html = html.replace(/<title>[\s\S]*?<\/title>\s*/i, "").replace(/<meta name="description"[^>]*>\s*/i, "");
  html = html.replace("<!--SEO-->", head);
  Object.entries(extras || {}).forEach(([k, v]) => { html = html.replace(`<!--${k}-->`, v); });
  return html;
}
function send(res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", type + "; charset=utf-8");
  res.setHeader("Cache-Control", cache || "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
  res.end(body);
}

module.exports = { MT, esc, clip, safeUrl, bnNum, loadAll, siteUrl, tPath, isoDate, tRange, lastmod, teamList, hasRes, orgLd, crumbLd, tournamentLd, newsLd,
  tSeo, headHTML, cardHTML, sortT, detailHTML, template, inject, send, DEFAULTS, TABS, SPORT_EN, STATUS };
