/* /sitemap.xml ও /robots.txt — টুর্নামেন্ট যোগ/বদল করলে সাইটম্যাপ নিজে থেকে আপডেট হয় */
const L = require("./_lib.js");
const x = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

module.exports = async (req, res) => {
  const f = (req.query || {}).f;
  let data = { tournaments: [], settings: {} };
  try { data = await L.loadAll(); } catch (e) {}
  const site = L.siteUrl(req, data.settings);

  if (f === "robots") {
    return L.send(res, 200, "text/plain",
      `User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api/\nDisallow: /pages/\n\nSitemap: ${site}/sitemap.xml\n`, "public, max-age=0, s-maxage=3600");
  }

  if (f === "gfile") {                    // সার্চ কনসোলের HTML ফাইল পদ্ধতি — শুধু অ্যাডমিনে সেভ করা ফাইলের নামেই সাড়া দেয়
    const want = String((data.settings || {}).gsc_file || "").trim().toLowerCase(), got = String((req.query || {}).file || "").trim().toLowerCase();
    if (want && got === want && /^google[a-z0-9]{10,40}\.html$/.test(got)) return L.send(res, 200, "text/html", "google-site-verification: " + got, "public, max-age=0, s-maxage=60");
    return L.send(res, 404, "text/plain", "Not found", "public, max-age=0, s-maxage=30");
  }
  const urls = [["/", "", "daily", "1.0", ""], ["/tournaments", "", "daily", "0.9", ""]];
  data.tournaments.forEach(t => {
    if (L.tSeo(data.settings, t.id).noindex) return;
    const lm = L.lastmod(t), img = L.safeUrl(t.image);
    const hasFx = t.fixtures.some(a => a && a.home), hasRes = t.fixtures.some(a => a && L.hasRes(a)) || t.results.length;
    const live = t.status !== "completed";
    urls.push([L.tPath(t.id), lm, live ? "daily" : "monthly", live ? "0.9" : "0.7", img]);
    if (hasFx) urls.push([L.tPath(t.id, "fixtures"), lm, live ? "daily" : "monthly", "0.8", ""]);
    if (hasRes) urls.push([L.tPath(t.id, "results"), lm, live ? "daily" : "monthly", "0.8", ""]);
    if (L.teamList(t.teams).length) urls.push([L.tPath(t.id, "teams"), lm, "weekly", "0.6", ""]);
    if (t.news.length) urls.push([L.tPath(t.id, "news"), lm, "weekly", "0.6", ""]);
    if (t.awards.length) urls.push([L.tPath(t.id, "awards"), lm, "monthly", "0.5", ""]);
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls.map(([p, lm, cf, pr, img]) => `<url><loc>${x(site + p)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}<changefreq>${cf}</changefreq><priority>${pr}</priority>${img ? `<image:image><image:loc>${x(img)}</image:loc></image:image>` : ""}</url>`).join("\n") + "\n</urlset>\n";
  L.send(res, 200, "application/xml", body, "public, max-age=0, s-maxage=600, stale-while-revalidate=3600");
};
