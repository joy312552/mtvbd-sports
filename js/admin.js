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
  let sb = null, user = null, tournaments = [], view = "settings";

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

  /* ---------- shell ---------- */
  function renderShell() {
    root.innerHTML = `
    <header class="adm-top"><div class="adm-brand">📡 MTVBD <b>SPORTS</b><small>অ্যাডমিন</small></div>
      <div class="adm-user"><span>${esc(user.email)}</span><button class="btn small ghost" id="logout">লগআউট</button></div></header>
    <nav class="adm-tabs">
      <button data-v="settings">📺 লাইভ ও সেটিংস</button>
      <button data-v="list">🏆 টুর্নামেন্ট</button>
      <button data-v="results">🏁 ফলাফল</button>
      <button data-v="seo">🔎 SEO ও গুগল</button>
      <a href="/" target="_blank" rel="noopener">🌐 ওয়েবসাইট দেখুন ↗</a>
    </nav>
    <main class="adm-main" id="view"></main>`;
    $("#logout").addEventListener("click", () => sb.auth.signOut());
    loadChannel();
    $$(".adm-tabs [data-v]").forEach(b => b.addEventListener("click", () => setView(b.dataset.v)));
    setView(view === "edit" ? "list" : view);
  }
  function setView(v) {
    view = v;
    $$(".adm-tabs [data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    if (v === "settings") renderSettings(); else if (v === "results") renderResults(); else if (v === "seo") renderSeo(); else renderList();
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
  async function renderSeo() {
    const el = $("#view");
    el.innerHTML = `<div class="boot">লোড হচ্ছে…</div>`;
    let S = {};
    try {
      const { data, error } = await sb.from("settings").select("*"); if (error) throw error;
      S = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      await loadTournaments();
    } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return; }
    const site = (S.site_url || "https://sports.mtvbd.com").replace(/\/+$/, "");
    const len = (v, a, b) => v.length >= a && v.length <= b;
    const audit = t => {
      const fx = (t.fixtures || []).filter(f => f && f.home);
      const checks = [
        ["নামের দৈর্ঘ্য ১০–৭০ অক্ষর", len(String(t.title || ""), 10, 70)],
        ["সংক্ষিপ্ত বর্ণনা ৭০–১৬০ অক্ষর (গুগলে যে লেখা দেখায়)", len(String(t.short || ""), 70, 160)],
        ["কভার ছবি আছে (শেয়ার ও গুগল ইমেজে দেখায়)", !!String(t.image || "").trim()],
        ["সারসংক্ষেপে কমপক্ষে ২ অনুচ্ছেদ", String(t.overview || "").split(/\n+/).filter(x => x.trim()).length >= 2],
        ["ভেন্যু দেওয়া আছে", !!String(t.venue || "").trim()],
        ["শুরুর তারিখ দেওয়া আছে ও বোঝা যায়", !!MT.parseDate(t.start_date)],
        ["সব ফিক্সচারের তারিখ-সময় বোঝা যায়", !fx.length || fx.every(f => MT.parseDate(f.date) && MT.parseTime(f.time))],
        ["দলের তালিকা আছে", (t.teams || []).length > 0],
        ["কমপক্ষে ১টি নিউজ আছে", (t.news || []).length > 0]
      ];
      return { checks, score: Math.round(checks.filter(c => c[1]).length / checks.length * 100) };
    };
    el.innerHTML = `
    <div class="box2"><h3>🔎 সাইটের SEO তথ্য</h3>
      <p class="hint">এই তথ্য গুগলে সাইটের নাম ও বর্ণনা হিসেবে দেখানো হয়। ফাঁকা রাখলে ভালো একটি ডিফল্ট ব্যবহার হবে। প্রতিটি টুর্নামেন্ট, ফিক্সচার, ফলাফল, দল ও নিউজের পেইজের টাইটেল/বর্ণনা নিজে থেকেই টুর্নামেন্টের তথ্য থেকে তৈরি হয়।</p>
      <label class="f"><span>সাইটের মূল ঠিকানা (ডোমেইন)</span><input id="s-url" value="${esc(S.site_url || "")}" placeholder="https://sports.mtvbd.com"></label>
      <label class="f"><span>হোমপেইজের টাইটেল (৬০ অক্ষরের মধ্যে ভালো) <b id="c-t" class="cnt"></b></span><input id="s-title" value="${esc(S.seo_title || "")}" placeholder="MTVBD Sports — ময়মনসিংহ টিভি বিডি স্পোর্টস | লাইভ টুর্নামেন্ট"></label>
      <label class="f"><span>হোমপেইজের বর্ণনা (১২০–১৬০ অক্ষর) <b id="c-d" class="cnt"></b></span><textarea id="s-desc" style="min-height:80px" placeholder="ময়মনসিংহ ও আশেপাশের ক্রিকেট, ফুটবল, কাবাডিসহ সব টুর্নামেন্টের লাইভ স্ট্রিমিং…">${esc(S.seo_description || "")}</textarea></label>
      <label class="f"><span>কিওয়ার্ড (কমা দিয়ে)</span><input id="s-kw" value="${esc(S.seo_keywords || "")}" placeholder="ময়মনসিংহ টিভি বিডি, ক্রিকেট লাইভ, ফুটবল ফিক্সচার"></label>
      <label class="f"><span>শেয়ার ছবি (ফেসবুকে লিংক শেয়ার করলে যে ছবি আসে; ১২০০×৬৩০ ভালো)</span><input id="s-og" value="${esc(S.og_image || "")}" placeholder="https://... (ফাঁকা থাকলে ডিফল্ট ছবি)"></label>
      <div class="actions"><button type="button" class="btn small ghost" id="og-pick">📷 ছবি আপলোড</button><input type="file" id="og-file" accept="image/jpeg,image/png,image/webp" hidden></div>
      <div class="err" id="s-err"></div>
      <button class="btn" id="seo-save">💾 সেভ করুন</button></div>

    <div class="box2"><h3>📈 গুগল অ্যানালিটিক্স ও সার্চ কনসোল</h3>
      <p class="hint">শুধু আইডি/কোড বসান, সাইটের সব পেইজে নিজে থেকে যুক্ত হয়ে যাবে (কোড কপি-পেস্টের দরকার নেই)। সেভ করার পর ১–২ মিনিটের মধ্যে কাজ করবে।</p>
      <label class="f"><span>গুগল অ্যানালিটিক্স মেজারমেন্ট আইডি (যেমন: G-ABCDE12345)</span><input id="s-ga" value="${esc(S.ga_id || "")}" placeholder="G-XXXXXXXXXX"></label>
      <label class="f"><span>গুগল সার্চ কনসোল ভেরিফিকেশন কোড (HTML ট্যাগের content="…" এর ভেতরের লেখা)</span><input id="s-gsc" value="${esc(S.gsc_verify || "")}" placeholder="abcDEF123..."></label>
      <label class="f"><span>Bing Webmaster ভেরিফিকেশন কোড (ঐচ্ছিক)</span><input id="s-bing" value="${esc(S.bing_verify || "")}" placeholder="ABCDEF1234..."></label>
      <div class="err" id="g-err"></div>
      <button class="btn" id="g-save">💾 সেভ করুন</button></div>

    <div class="box2"><h3>🚀 গুগলে সাইট যুক্ত করার ধাপ (একবারই করতে হবে)</h3>
      <ol class="seo-steps">
        <li><b>সার্চ কনসোলে যান:</b> <a href="https://search.google.com/search-console" target="_blank" rel="noopener">search.google.com/search-console</a> → "Add property" → <b>URL prefix</b> বেছে লিখুন <code>${esc(site)}/</code></li>
        <li><b>ভেরিফাই করুন:</b> "HTML tag" পদ্ধতি বেছে নিন। যে ট্যাগ দেখাবে তার <code>content="…"</code> এর ভেতরের লেখাটুকু ওপরের "সার্চ কনসোল ভেরিফিকেশন কোড" ঘরে বসিয়ে সেভ করুন, তারপর সার্চ কনসোলে <b>Verify</b> চাপুন। (২–৩ মিনিট অপেক্ষা করুন)</li>
        <li><b>সাইটম্যাপ জমা দিন:</b> সার্চ কনসোলের বাম মেনুতে <b>Sitemaps</b> → লিখুন <code>sitemap.xml</code> → Submit। সাইটম্যাপ নিজে থেকে আপডেট হয়, নতুন টুর্নামেন্ট যোগ করলে আর কিছু করতে হবে না।</li>
        <li><b>দ্রুত ইনডেক্স:</b> উপরের সার্চ বারে হোমপেইজ ও প্রধান টুর্নামেন্টের লিংক বসিয়ে <b>"Request indexing"</b> চাপুন।</li>
        <li><b>অ্যানালিটিক্স:</b> <a href="https://analytics.google.com" target="_blank" rel="noopener">analytics.google.com</a> → Admin → Create property → Web stream (${esc(site)}) → "G-" দিয়ে শুরু আইডি কপি করে ওপরে বসান।</li>
        <li><b>লিংক বাড়ান (র‍্যাংকের জন্য সবচেয়ে কার্যকর):</b> ফেসবুক পেইজের "About"-এ, ইউটিউব চ্যানেলের বিবরণে ও প্রতিটি ভিডিওর ডেসক্রিপশনে ${esc(site)} লিংক দিন। প্রতিটি ম্যাচের পর ফলাফল ও নিউজ নিয়মিত আপডেট করুন।</li>
      </ol>
      <div class="actions">
        <a class="btn small ghost" href="${esc(site)}/sitemap.xml" target="_blank" rel="noopener">🗺 সাইটম্যাপ দেখুন</a>
        <a class="btn small ghost" href="${esc(site)}/robots.txt" target="_blank" rel="noopener">🤖 robots.txt</a>
        <a class="btn small ghost" href="https://search.google.com/test/rich-results?url=${encodeURIComponent(site + "/")}" target="_blank" rel="noopener">🧪 Rich Results টেস্ট</a>
        <a class="btn small ghost" href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(site + "/")}" target="_blank" rel="noopener">⚡ PageSpeed</a>
        <a class="btn small ghost" href="https://www.google.com/search?q=${encodeURIComponent("site:" + site.replace(/^https?:\/\//, ""))}" target="_blank" rel="noopener">🔍 গুগলে ইনডেক্স দেখুন</a></div></div>

    <div class="box2"><h3>✅ টুর্নামেন্ট অনুযায়ী SEO চেকলিস্ট</h3>
      <p class="hint">যত বেশি ঘর সবুজ, গুগলে তত ভালো দেখাবে। লাল ঘরগুলো ঠিক করতে টুর্নামেন্ট এডিট করুন।</p>
      ${tournaments.length ? tournaments.map(t => { const a = audit(t); return `<details class="seo-t"><summary><span class="sc ${a.score >= 80 ? "g" : a.score >= 55 ? "y" : "r"}">${a.score}%</span><b>${esc(t.title)}</b><a class="btn small ghost" data-edit="${esc(t.id)}">✏️ এডিট</a></summary>
        <ul class="seo-chk">${a.checks.map(c => `<li class="${c[1] ? "ok" : "no"}">${c[1] ? "✔" : "✖"} ${c[0]}</li>`).join("")}</ul></details>`; }).join("") : `<div class="hint">এখনো কোনো টুর্নামেন্ট নেই।</div>`}</div>`;

    const cnt = () => { $("#c-t").textContent = `(${$("#s-title").value.length})`; $("#c-d").textContent = `(${$("#s-desc").value.length})`; };
    cnt(); $("#s-title").addEventListener("input", cnt); $("#s-desc").addEventListener("input", cnt);
    $$("[data-edit]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); renderEditor(tournaments.find(x => x.id === a.dataset.edit)); }));
    async function save(rows, btn, ok) {
      busy(btn, true, "সেভ হচ্ছে…");
      const { error } = await sb.from("settings").upsert(rows, { onConflict: "key" });
      busy(btn, false);
      error ? toast("সেভ হয়নি: " + errText(error), true) : toast(ok);
    }
    $("#seo-save").addEventListener("click", e => {
      const u = $("#s-url").value.trim().replace(/\/+$/, ""), og = $("#s-og").value.trim();
      if (u && !/^https:\/\/[^\s/]+$/i.test(u)) { $("#s-err").textContent = "ঠিকানা https:// দিয়ে শুরু হবে এবং শেষে / বা পেইজ নাম থাকবে না (যেমন: https://sports.mtvbd.com)।"; return; }
      if (og && !/^https?:\/\//i.test(og)) { $("#s-err").textContent = "শেয়ার ছবির লিংক http:// বা https:// দিয়ে শুরু হতে হবে।"; return; }
      $("#s-err").textContent = "";
      save([{ key: "site_url", value: u }, { key: "seo_title", value: $("#s-title").value.trim() }, { key: "seo_description", value: $("#s-desc").value.trim() },
        { key: "seo_keywords", value: $("#s-kw").value.trim() }, { key: "og_image", value: og }], e.target, "✅ SEO তথ্য সেভ হয়েছে (১–২ মিনিটে সাইটে আসবে)");
    });
    $("#g-save").addEventListener("click", e => {
      const ga = $("#s-ga").value.trim(), gsc = $("#s-gsc").value.trim(), bing = $("#s-bing").value.trim();
      if (ga && !/^(G|GT|AW)-[A-Za-z0-9]{4,20}$/.test(ga)) { $("#g-err").textContent = "অ্যানালিটিক্স আইডি G- দিয়ে শুরু হতে হবে (যেমন G-ABCDE12345)।"; return; }
      if ((gsc && !/^[\w-]{10,100}$/.test(gsc)) || (bing && !/^[\w-]{10,100}$/.test(bing))) { $("#g-err").textContent = "ভেরিফিকেশন কোডে শুধু অক্ষর, সংখ্যা, - ও _ থাকবে। শুধু content=\"…\" এর ভেতরের অংশ বসান, পুরো ট্যাগ নয়।"; return; }
      $("#g-err").textContent = "";
      save([{ key: "ga_id", value: ga }, { key: "gsc_verify", value: gsc }, { key: "bing_verify", value: bing }], e.target, "✅ সেভ হয়েছে (১–২ মিনিটে সাইটে চালু হবে)");
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

  /* ---------- list ---------- */
  async function loadTournaments() {
    const { data, error } = await sb.from("tournaments").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    tournaments = data || [];
  }
  async function renderList() {
    const el = $("#view");
    el.innerHTML = `<div class="boot">লোড হচ্ছে…</div>`;
    try { await loadTournaments(); } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return; }
    el.innerHTML = `
    <div class="list-head"><h2>টুর্নামেন্ট (${tournaments.length})</h2><button class="btn" id="add">+ নতুন টুর্নামেন্ট</button></div>
    ${tournaments.length ? tournaments.map(t => `
      <div class="t-row" data-id="${esc(t.id)}">
        <div class="thumb">${t.image ? `<img src="${esc(t.image)}" alt="">` : (ICON[t.sport] || "🏆")}</div>
        <div class="info"><b>${esc(t.title)}</b><small>${esc(t.sport)}${t.start_date ? " • " + esc(t.start_date) : ""}</small></div>
        <select data-status title="স্ট্যাটাস">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${t.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <div class="acts"><button class="btn small dark" data-edit>✏️ এডিট</button><button class="btn small danger" data-del>🗑</button></div>
      </div>`).join("") : `<div class="box2">এখনো কোনো টুর্নামেন্ট নেই। "+ নতুন টুর্নামেন্ট" চাপুন।</div>`}`;
    $("#add").addEventListener("click", () => renderEditor(null));
    $$(".t-row").forEach(row => {
      const id = row.dataset.id, t = tournaments.find(x => x.id === id);
      $("[data-edit]", row).addEventListener("click", () => renderEditor(t));
      $("[data-del]", row).addEventListener("click", () => removeTournament(t));
      $("[data-status]", row).addEventListener("change", async e => {
        const { error } = await sb.from("tournaments").update({ status: e.target.value }).eq("id", id);
        error ? toast(errText(error), true) : (t.status = e.target.value, toast("✅ স্ট্যাটাস বদলানো হয়েছে"));
      });
    });
  }
  async function removeTournament(t) {
    if (!confirm(`"${t.title}" টুর্নামেন্টটি স্থায়ীভাবে মুছে ফেলবেন?\nএটা আর ফেরত আনা যাবে না।`)) return;
    const { error } = await sb.from("tournaments").delete().eq("id", t.id);
    if (error) { toast(errText(error), true); return; }
    toast("টুর্নামেন্ট মুছে ফেলা হয়েছে"); renderList();
  }


  /* ---------- 🏁 দ্রুত ফলাফল ---------- */
  let resSel = "", resFilter = "pending", resQ = "";
  async function renderResults() {
    const el = $("#view");
    el.innerHTML = `<div class="boot">লোড হচ্ছে…</div>`;
    try { await loadTournaments(); } catch (e) { el.innerHTML = `<div class="warn">${esc(errText(e))}</div>`; return; }
    const list = tournaments.filter(t => Array.isArray(t.fixtures) && t.fixtures.length);
    if (!list.length) { el.innerHTML = `<div class="box2"><h3>🏁 ফলাফল</h3><p class="hint">কোনো টুর্নামেন্টে এখনো ফিক্সচার নেই। আগে "🏆 টুর্নামেন্ট" থেকে ফিক্সচার যোগ করুন।</p></div>`; return; }
    if (!list.some(t => t.id === resSel)) resSel = (list.find(t => t.status !== "completed") || list[0]).id;
    const t = list.find(x => x.id === resSel);
    const fx = JSON.parse(JSON.stringify(t.fixtures));
    const orig = JSON.stringify(fx);
    el.innerHTML = `
    <div class="list-head"><h2>🏁 ম্যাচের ফলাফল</h2></div>
    <div class="box2"><p class="hint">ম্যাচ শেষে দুই দলের গোল/রান লিখে সেভ করুন — ফলাফল ওই টুর্নামেন্টের "ফলাফল" ট্যাবে আর হোমপেইজের "সম্পন্ন" তালিকায় চলে যাবে। শুধু নোট লিখলেও (যেমন "ম্যাচ ড্র") ম্যাচ সম্পন্ন হয়। স্কোর মুছে দিলে ম্যাচ আবার সময় অনুযায়ী চলবে।</p>
      <div class="grid2"><label class="f"><span>টুর্নামেন্ট</span><select id="rs-t">${list.map(x => `<option value="${esc(x.id)}" ${x.id === resSel ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label>
        <label class="f"><span>দেখান</span><select id="rs-f"><option value="pending" ${resFilter === "pending" ? "selected" : ""}>ফলাফল বাকি</option><option value="done" ${resFilter === "done" ? "selected" : ""}>ফলাফল দেওয়া হয়েছে</option><option value="all" ${resFilter === "all" ? "selected" : ""}>সব ম্যাচ</option></select></label></div>
      <label class="f"><span>খুঁজুন (দলের নাম, রাউন্ড, তারিখ)</span><input id="rs-q" value="${esc(resQ)}" placeholder="যেমন: আল হেলাল"></label></div>
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
    draw();
    $("#rs-list").addEventListener("input", e => { const k = e.target.dataset.k, c = e.target.closest(".rc"); if (k && c) fx[+c.dataset.i][k] = e.target.value; });
    $("#rs-t").addEventListener("change", e => { resSel = e.target.value; renderResults(); });
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
        toast(`✅ ${n}টি ম্যাচের ফলাফল সেভ হয়েছে`);
        renderResults();
      } catch (e) { toast("সেভ হয়নি: " + errText(e), true); }
      busy(b, false);
    });
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

  /* ---------- editor ---------- */
  function renderEditor(t) {
    const isNew = !t;
    const d = isNew
      ? { id: "t-" + Date.now().toString(36), title: "", sport: "ফুটবল", status: "upcoming", image: "", short: "", organizer: "", venue: "", district: "ময়মনসিংহ", format: "", start_date: "", end_date: "", teams_count: "", overview: "", fixtures: [], results: [], teams: [], news: [], awards: [] }
      : JSON.parse(JSON.stringify(t));
    const el = $("#view");
    const fld = (label, name, val, cls = "", ph = "") => `<label class="f ${cls}"><span>${label}</span><input name="${name}" value="${esc(val)}" placeholder="${esc(ph)}"></label>`;
    el.innerHTML = `
    <form id="ed" autocomplete="off">
      <div class="ed-head"><button type="button" class="btn small ghost" id="back">← ফিরে যান</button><h2>${isNew ? "নতুন টুর্নামেন্ট" : "টুর্নামেন্ট এডিট"}</h2></div>

      <div class="box2"><h3>মূল তথ্য</h3><div class="grid2" style="margin-top:12px">
        ${fld("টুর্নামেন্টের নাম *", "title", d.title, "full", "ময়মনসিংহ প্রিমিয়ার ডিভিশন ফুটবল লীগ ২০২৬")}
        <label class="f"><span>খেলার ধরন</span><input name="sport" list="sports" value="${esc(d.sport)}"><datalist id="sports"><option>ফুটবল</option><option>ক্রিকেট</option><option>কাবাডি</option><option>ভলিবল</option><option>হ্যান্ডবল</option></datalist></label>
        <label class="f"><span>স্ট্যাটাস</span><select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${d.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="f full"><span>সংক্ষিপ্ত বিবরণ (কার্ড ও পেইজের ওপরে দেখাবে)</span><textarea name="short" style="min-height:70px">${esc(d.short)}</textarea></label>
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

      <div class="box2"><h3>সারসংক্ষেপ — "প্রতিযোগিতা সম্পর্কে"</h3><p class="hint">প্রতিটি অনুচ্ছেদ আলাদা লাইনে লিখুন।</p>
        <label class="f"><textarea name="overview" style="min-height:150px">${esc(d.overview)}</textarea></label></div>

      <div class="box2"><h3>ফিক্সচার</h3><p class="hint">আসন্ন ম্যাচের তালিকা। তারিখ-সময় দিলে হোমপেইজের "ম্যাচ" অংশে ম্যাচটি নিজে থেকে আসন্ন → 🔴 লাইভ (শুরুর সময় হলে) → সম্পন্ন হয়ে যাবে। ফলাফল দিতে ওপরের "🏁 ফলাফল" ট্যাব ব্যবহার করুন। রাউন্ড/গ্রুপের নাম একই হলে ম্যাচগুলো একসাথে দেখাবে।</p><div id="fx"></div></div>
      <div class="box2"><h3>ফলাফল</h3><p class="hint">নতুন ফলাফল সহজে দিতে ওপরের "🏁 ফলাফল" ট্যাব ব্যবহার করুন (ফিক্সচারের ম্যাচেই স্কোর বসে)। এই বক্সটি শুধু আলাদা/পুরোনো ফলাফলের জন্য। ম্যাচ শেষ হলে এখানে ফলাফল যোগ করা যায়। "লাইভ ম্যাচ লিংক" দিলে দর্শক ফলাফলের নিচের "▶ ম্যাচ দেখুন" বাটনে ক্লিক করে ম্যাচটি দেখতে পারবে।</p><div id="rs"></div></div>
      <div class="box2"><h3>দল</h3><p class="hint">দল যোগ করুন, তারপর যেকোনো দলে ক্লিক করে ভেতরে ঢুকলে কোচ, সংক্ষিপ্ত পরিচিতি, যোগাযোগ (ফোন/ফেসবুক) ও প্লেয়ার তালিকা (নামের সাথে ছবি) দিতে পারবেন — সবই ঐচ্ছিক। ফাঁকা রাখলে দর্শক শুধু দলের নাম দেখবে।</p><div id="tm"></div></div>
      <div class="box2"><h3>নিউজ</h3><div id="nw"></div></div>
      <div class="box2"><h3>পুরস্কার</h3><div id="aw"></div></div>

      <div class="savebar"><button type="button" class="btn ghost" id="cancel">বাতিল</button><button class="btn" id="save">💾 সেভ করুন</button>
        ${isNew ? "" : `<button type="button" class="btn danger" id="del">🗑 মুছুন</button>`}</div>
    </form>`;

    listEditor($("#fx"), d.fixtures, SCHEMAS.fixtures, "ম্যাচ যোগ করুন");
    listEditor($("#rs"), d.results, SCHEMAS.results, "ফলাফল যোগ করুন");
    const tmArr = teamsToEditor(d.teams);
    teamEditor($("#tm"), tmArr);
    listEditor($("#nw"), d.news, SCHEMAS.news, "নিউজ যোগ করুন");
    listEditor($("#aw"), d.awards, SCHEMAS.awards, "পুরস্কার যোগ করুন");

    const back = () => setView("list");
    $("#back").addEventListener("click", back); $("#cancel").addEventListener("click", back);
    if (!isNew) $("#del").addEventListener("click", () => removeTournament(t));

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
      const bad = [["video", d.fixtures, "ফিক্সচারের ভিডিও"], ["watch", d.results, "ফলাফলের লাইভ ম্যাচ"], ["link", d.news, "নিউজের"]]
        .find(([k, rows]) => rows.some(r => String(r[k] || "").trim() && !/^https?:\/\//i.test(String(r[k]).trim())));
      if (bad) { toast(`${bad[2]} লিংক http:// বা https:// দিয়ে শুরু হতে হবে`, true); return; }
      const badFb = tmArr.find(t => String(t.facebook || "").trim() && !/^https?:\/\//i.test(String(t.facebook).trim()));
      if (badFb) { toast(`"${badFb.name}" দলের ফেসবুক লিংক http:// বা https:// দিয়ে শুরু হতে হবে`, true); return; }
      const row = {
        id: d.id, title: g("title"), sport: g("sport") || "ফুটবল", status: g("status"), image: g("image"), short: g("short"),
        organizer: g("organizer"), venue: g("venue"), district: g("district"), format: g("format"),
        start_date: g("start_date"), end_date: g("end_date"), teams_count: g("teams_count"), overview: g("overview"),
        fixtures: cleanRows(d.fixtures, SCHEMAS.fixtures), results: cleanRows(d.results, SCHEMAS.results),
        news: cleanRows(d.news, SCHEMAS.news), awards: cleanRows(d.awards, SCHEMAS.awards),
        teams: teamsFromEditor(tmArr)
      };
      const b = $("#save"); busy(b, true, "সেভ হচ্ছে…");
      const { error } = await sb.from("tournaments").upsert(row, { onConflict: "id" });
      busy(b, false);
      if (error) { toast("সেভ হয়নি: " + errText(error), true); return; }
      toast("✅ সেভ হয়েছে"); setView("list");
    });
    window.scrollTo({ top: 0 });
  }

  boot();
})();
