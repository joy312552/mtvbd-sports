/* পেইজ রেন্ডার: /  /tournaments  /tournament/:id  /tournament/:id/:tab
   যেকোনো সমস্যা হলে সাধারণ টেমপ্লেট দেখানো হয়, যাতে সাইট কখনো বন্ধ না হয়। */
const L = require("./_lib.js");

async function raw(req, res, name, status) {
  const html = await L.template(req, name);
  L.send(res, status || 200, "text/html", html, "public, max-age=0, s-maxage=10");
}

module.exports = async (req, res) => {
  const q = req.query || {}, p = q.p || "home";
  const tpl = p === "tournament" ? "tournament" : p === "tournaments" ? "tournaments" : "home";
  let data;
  try { data = await L.loadAll(); }
  catch (e) { try { return await raw(req, res, tpl); } catch (e2) { res.statusCode = 500; return res.end("Service unavailable"); } }
  try {
    const S = Object.assign({ facebook: "", youtube: "" }, data.settings), site = L.siteUrl(req, S), D = L.DEFAULTS;
    const T = L.sortT(data.tournaments);
    let html = await L.template(req, tpl), status = 200, head;

    if (p === "home") {
      const title = (S.seo_title || D.title), desc = S.seo_description || D.description;
      head = L.headHTML({ path: "/", title, description: desc, keywords: S.seo_keywords || D.keywords, ld: L.orgLd(site, S).concat([{
        "@context": "https://schema.org", "@type": "ItemList", name: "টুর্নামেন্ট", itemListElement: T.slice(0, 20).map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.title, url: site + L.tPath(t.id) }))
      }]) }, S, site);
      html = L.inject(html, head, { SSR_GRID: T.slice(0, 6).map(L.cardHTML).join("") });
    } else if (p === "tournaments") {
      head = L.headHTML({ path: "/tournaments", title: "সকল টুর্নামেন্ট — লাইভ, আসন্ন ও সম্পন্ন | MTVBD Sports",
        description: `ময়মনসিংহের ${T.length}টি টুর্নামেন্টের ফিক্সচার, ফলাফল, দল ও লাইভ সম্প্রচার — ক্রিকেট, ফুটবল, কাবাডিসহ সব খেলা এক জায়গায়।`, keywords: S.seo_keywords || D.keywords,
        ld: [L.crumbLd(site, [["হোম", "/"], ["টুর্নামেন্ট", "/tournaments"]])] }, S, site);
      html = L.inject(html, head, { SSR_GRID: T.map(L.cardHTML).join("") });
    } else {
      const id = String(q.id || ""), tab = L.TABS.some(x => x[0] === q.tab) ? q.tab : "overview";
      const t = data.tournaments.find(x => x.id === id);
      if (!t) {
        head = L.headHTML({ path: L.tPath(id), title: "টুর্নামেন্ট পাওয়া যায়নি | MTVBD Sports", description: D.description, noindex: true }, S, site);
        html = L.inject(html, head, {}); status = 404;
      } else {
        const ov = L.tSeo(S, t.id), tt = ov.title || t.title;
        const label = (L.TABS.find(x => x[0] === tab) || [])[1];
        const nF = t.fixtures.filter(f => f && f.home).length, nR = t.fixtures.filter(f => f && L.hasRes(f)).length + t.results.length;
        const base = t.short || t.overview[0] || t.title;
        const DESC = {
          overview: ov.description ? L.clip(ov.description, 160) : L.clip(base + (t.venue ? ` ভেন্যু: ${t.venue}।` : "") + (t.start ? ` শুরু: ${t.start}।` : ""), 158),
          fixtures: L.clip(`${t.title}-এর সম্পূর্ণ ফিক্সচার — ${L.bnNum(nF)}টি ম্যাচের তারিখ, সময়, ভেন্যু ও লাইভ ভিডিও লিংক।`, 158),
          results: L.clip(`${t.title}-এর সর্বশেষ ম্যাচের ফলাফল ও স্কোর — ${L.bnNum(nR)}টি ম্যাচের ফলাফল ও ম্যাচ দেখার লিংক।`, 158),
          teams: L.clip(`${t.title}-এ অংশগ্রহণকারী দল, কোচ ও প্লেয়ার তালিকা।`, 158),
          news: L.clip(`${t.title}-এর সর্বশেষ খবর ও আপডেট।`, 158),
          awards: L.clip(`${t.title}-এর চ্যাম্পিয়ন, রানার্সআপ ও পুরস্কার বিজয়ীদের তালিকা।`, 158)
        }[tab];
        const img = L.safeUrl(t.image) || L.safeUrl(S.og_image) || site + "/images/og-cover.png";
        const ldList = [L.tournamentLd(site, t, img), L.crumbLd(site, [["হোম", "/"], ["টুর্নামেন্ট", "/tournaments"], [t.title, L.tPath(t.id)]].concat(tab !== "overview" ? [[label, L.tPath(t.id, tab)]] : []))];
        if (tab === "news") ldList.push(...L.newsLd(site, t, img));
        const kw = [ov.keywords, t.title, t.sport && t.sport + " টুর্নামেন্ট", t.venue, t.district, label && tab !== "overview" ? t.title + " " + label : "", S.seo_keywords || D.keywords].filter(Boolean).join(", ");
        head = L.headHTML({ path: L.tPath(t.id, tab), title: tab === "overview" ? (ov.title ? ov.title : `${t.title} | MTVBD Sports`) : `${tt} — ${label} | MTVBD Sports`, description: DESC, keywords: kw, noindex: !!ov.noindex, image: L.safeUrl(t.image), imageAlt: t.title, ld: ldList }, S, site);
        html = L.inject(html, head, { SSR_DETAIL: L.detailHTML(t, tab, data.tournaments) });
      }
    }
    L.send(res, status, "text/html", html, status === 404 ? "public, max-age=0, s-maxage=30" : undefined);
  } catch (e) {
    try { await raw(req, res, tpl); } catch (e2) { res.statusCode = 500; res.end("Service unavailable"); }
  }
};
