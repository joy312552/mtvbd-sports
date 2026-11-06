/* MTVBD Sports — তারিখ/সময় ও ম্যাচ স্ট্যাটাসের শেয়ার্ড লজিক
   পাবলিক সাইট ও অ্যাডমিন প্যানেল দুই জায়গাতেই ব্যবহার হয়।
   সব সময় বাংলাদেশ সময় (UTC+6) ধরা হয়, ভিজিটরের ডিভাইসের টাইমজোন যা-ই হোক। */
(function (root) {
  const BN = "০১২৩৪৫৬৭৮৯";
  const OFF = 6 * 3600 * 1000;                       // বাংলাদেশ = UTC+৬ (কোনো ডেইলাইট সেভিং নেই)
  const MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
  const MONTH_ALT = { "জানুয়ারী": 0, "ফেব্রুয়ারী": 1, "আগষ্ট": 7 };
  const DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

  /* খেলা অনুযায়ী ম্যাচ চলার আনুমানিক সময় (মিনিট)। কোনো ম্যাচে আলাদা দরকার হলে ফিক্সচারের "সময়কাল" ঘরে দেওয়া যায়। */
  const DUR = { "ফুটবল": 120, "ক্রিকেট": 480, "কাবাডি": 90, "ভলিবল": 120, "হ্যান্ডবল": 90, "বাস্কেটবল": 120, "ব্যাডমিন্টন": 90 };

  const nfc = s => String(s ?? "").normalize("NFC");
  const toEn = s => nfc(s).replace(/[০-৯]/g, d => BN.indexOf(d));
  const toBn = n => String(n).replace(/\d/g, d => BN[d]);
  const pad = n => String(n).padStart(2, "0");
  const MON_NFC = MONTHS.map(nfc);
  const ALT_NFC = Object.fromEntries(Object.entries(MONTH_ALT).map(([k, v]) => [nfc(k), v]));

  function monthIndex(name) {
    const n = nfc(name);
    const i = MON_NFC.indexOf(n);
    return i >= 0 ? i : (n in ALT_NFC ? ALT_NFC[n] : -1);
  }
  const mk = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null);

  /* "৬ নভেম্বর, ২০২৬ (শুক্রবার)" | "০৬/১১/২০২৬" | "2026-11-06" → {y,m,d} বা null */
  function parseDate(str) {
    const t = toEn(str);
    let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return mk(+m[1], +m[2], +m[3]);
    m = t.match(/(\d{1,2})\s*([^\s,\d()\/.\-]+)\s*,?\s*(\d{4})/);
    if (m) { const mi = monthIndex(m[2]); if (mi >= 0) return mk(+m[3], mi + 1, +m[1]); }
    m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    return m ? mk(+m[3], +m[2], +m[1]) : null;
  }

  /* "দুপুর ২:৪৫ টা" | "সকাল ৯টা" | "বিকাল ৫টা" | "14:45" | "2:45 PM" → {h,mi} (২৪ ঘণ্টা) বা null */
  function parseTime(str) {
    const raw = nfc(str), t = toEn(raw);
    const m = t.match(/(\d{1,2})(?:\s*[:.]\s*(\d{2}))?/);
    if (!m) return null;
    let h = +m[1]; const mi = m[2] ? +m[2] : 0;
    if (h > 24 || mi > 59) return null;
    if (/pm/i.test(t)) { if (h < 12) h += 12; }
    else if (/am/i.test(t)) { if (h === 12) h = 0; }
    else if (/ভোর|সকাল/.test(raw)) { if (h === 12) h = 0; }
    else if (/দুপুর/.test(raw)) { if (h <= 5) h += 12; }
    else if (/বিকাল|বিকেল|সন্ধ্যা/.test(raw)) { if (h < 12) h += 12; }
    else if (/রাত/.test(raw)) { if (h === 12) h = 0; else if (h >= 6) h += 12; }
    if (h === 24) h = 0;
    return { h, mi };
  }

  function fmtDate(y, m, d) {
    const wd = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${toBn(d)} ${MONTHS[m - 1]}, ${toBn(y)} (${wd})`;
  }
  function fmtTime(h, mi) {
    const p = h >= 5 && h < 12 ? "সকাল" : h >= 12 && h < 16 ? "দুপুর" : h >= 16 && h < 18 ? "বিকাল" : h >= 18 && h < 20 ? "সন্ধ্যা" : "রাত";
    return `${p} ${toBn(h % 12 || 12)}${mi ? ":" + toBn(pad(mi)) + " টা" : "টা"}`;
  }

  /* অ্যাডমিনের তারিখ-সময় পিকারের জন্য: লেখা ↔ "YYYY-MM-DDTHH:mm" */
  function toPicker(dateStr, timeStr) {
    const d = parseDate(dateStr); if (!d) return "";
    const t = parseTime(timeStr);
    return `${d.y}-${pad(d.m)}-${pad(d.d)}T${t ? pad(t.h) + ":" + pad(t.mi) : "00:00"}`;
  }
  function fromPicker(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return m ? { date: fmtDate(+m[1], +m[2], +m[3]), time: fmtTime(+m[4], +m[5]) } : null;
  }

  function durationMin(f, sport) {
    const n = parseInt(toEn(f && f.dur), 10);
    return n > 0 ? n : (DUR[nfc(sport).trim()] || 120);
  }
  const hasResult = f => !!f && ["homeScore", "awayScore", "resultNote"].some(k => String(f[k] ?? "").trim() !== "");
  const scoreText = f => {
    const h = String(f.homeScore ?? "").trim(), a = String(f.awayScore ?? "").trim();
    return h !== "" && a !== "" ? `${h} - ${a}` : "শেষ";
  };

  /* একটি ম্যাচের অবস্থা: live | upcoming | completed
     • স্কোর/ফলাফল দেওয়া থাকলে সবসময় completed
     • "স্থগিত" চিহ্নিত হলে সময় পেরোলেও আসন্ন থাকে, "জোর করে লাইভ" হলে লাইভ
     • নাহলে শুরুর সময় থেকে (খেলাভেদে) নির্ধারিত সময় পর্যন্ত লাইভ, তারপর completed
     • তারিখ আছে কিন্তু সময় বোঝা যায় না → দিন শেষ না হওয়া পর্যন্ত আসন্ন (কখনো নিজে থেকে লাইভ হয় না) */
  function matchInfo(f, sport, now) {
    f = f || {}; now = now == null ? Date.now() : now;
    const d = parseDate(f.date), tm = parseTime(f.time);
    let start = null, end = null, dateOnly = false;
    if (d) {
      const day = Date.UTC(d.y, d.m - 1, d.d) - OFF;
      if (tm) { start = day + (tm.h * 60 + tm.mi) * 60000; end = start + durationMin(f, sport) * 60000; }
      else { dateOnly = true; start = day; end = day + 864e5; }
    }
    const res = hasResult(f);
    let status;
    if (res) status = "completed";
    else if (f.state === "postponed") status = "upcoming";
    else if (f.state === "live") status = "live";
    else if (start == null || now < start) status = "upcoming";
    else if (dateOnly) status = now < end ? "upcoming" : "completed";
    else status = now < end ? "live" : "completed";
    return { status, start, end, hasRes: res, dateOnly, postponed: f.state === "postponed" && !res, forced: f.state === "live" && !res };
  }

  root.MT = { BN, MONTHS, DAYS, DUR, toEn, toBn, parseDate, parseTime, fmtDate, fmtTime, toPicker, fromPicker, durationMin, hasResult, scoreText, matchInfo, OFFSET: OFF };
})(typeof window !== "undefined" ? window : globalThis);
