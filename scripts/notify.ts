// PrzepisFK — powiadomienia po przebiegu skryptu: Discord (webhook) i e-mail (Resend)
// Uruchamiane z fetch-news.ts albo osobno: npm run fetch -- --powiadomienia

import type { SupabaseClient } from "@supabase/supabase-js";

const SITE = process.env.SITE_URL ?? "https://przepis-fk.vercel.app";
const DISCORD_PER_RUN = 10;
const FRESH_HOURS = 48; // starszych wpisów nie publikujemy na Discordzie (np. po uzupełnieniu wstecznym)

type Row = {
  id: number;
  url: string;
  title: string;
  summary: string | null;
  impact: string | null;
  stage: string;
  created_at: string;
  categories: { name: string }[];
};

const STAGE = { news: "", act: "📜 Akt prawny · ", draft: "🗂️ Projekt · " } as Record<string, string>;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------- Discord ----------

async function notifyDiscord(db: SupabaseClient) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return console.log("Discord: brak DISCORD_WEBHOOK_URL — pomijam");

  // stare, niewysłane wpisy oznaczamy jako wysłane, żeby nie zalać kanału
  await db
    .from("articles")
    .update({ discord_sent_at: new Date().toISOString() })
    .eq("status", "done")
    .is("discord_sent_at", null)
    .lt("created_at", hoursAgo(FRESH_HOURS));

  const { data, error } = await db
    .from("articles")
    .select("id, url, title, summary, impact, stage, created_at, categories(name)")
    .eq("status", "done")
    .is("discord_sent_at", null)
    .order("created_at")
    .limit(DISCORD_PER_RUN);
  if (error) return console.error(`Discord: ${error.message}`);

  let sent = 0;
  for (const a of data as Row[]) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "PrzepisFK",
        embeds: [
          {
            title: `${STAGE[a.stage] ?? ""}${a.title}`.slice(0, 256),
            url: a.url,
            description: [a.summary, a.impact && `**Co to zmienia:** ${a.impact}`].filter(Boolean).join("\n\n").slice(0, 3500),
            color: 0xc2410c,
            footer: { text: a.categories.map((c) => c.name).join(" · ") || "PrzepisFK" },
          },
        ],
      }),
    });
    if (res.status === 429) {
      console.error("Discord: limit wiadomości — reszta pójdzie w następnym przebiegu");
      break;
    }
    if (!res.ok) {
      console.error(`Discord: HTTP ${res.status} ${await res.text()}`);
      break;
    }
    await db.from("articles").update({ discord_sent_at: new Date().toISOString() }).eq("id", a.id);
    sent++;
    await new Promise((r) => setTimeout(r, 1200)); // Discord: ok. 1 wiadomość/s na webhook
  }
  console.log(`Discord: wysłano ${sent}`);
}

// ---------- e-mail ----------

function emailHtml(articles: Row[], frequency: string) {
  const items = articles
    .map(
      (a) => `
      <tr><td style="padding:16px 0;border-bottom:1px solid #dde1ea">
        <div style="font-size:12px;color:#c2410c;font-weight:600">${esc(STAGE[a.stage] ?? "")}${esc(a.categories.map((c) => c.name).join(" · "))}</div>
        <a href="${esc(a.url)}" style="display:block;margin-top:4px;font-size:17px;font-weight:700;color:#14213d;text-decoration:none">${esc(a.title)}</a>
        ${a.summary ? `<p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:#14213d">${esc(a.summary)}</p>` : ""}
        ${a.impact ? `<p style="margin:6px 0 0;padding:6px 10px;border-left:3px solid #c2410c;background:#fdeee4;font-size:13px;color:#14213d"><b>Co to zmienia:</b> ${esc(a.impact)}</p>` : ""}
      </td></tr>`,
    )
    .join("");

  return `<!doctype html><html lang="pl"><body style="margin:0;background:#e9ecf2;font-family:Segoe UI,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden">
      <tr><td style="background:#14213d;color:#fff;padding:20px 24px">
        <div style="font-size:26px;font-weight:800">PrzepisFK</div>
        <div style="opacity:.85;font-size:14px">${frequency === "weekly" ? "Przegląd tygodnia" : "Nowe wpisy"} z Twoich obszarów · ${articles.length}</div>
      </td></tr>
      <tr><td style="padding:0 24px"><table width="100%" cellpadding="0" cellspacing="0">${items}</table></td></tr>
      <tr><td style="padding:20px 24px;font-size:12px;color:#5b6478">
        Streszczenia przygotowuje AI — decyzje opieraj na treści przepisu.<br>
        <a href="${SITE}/moj-feed" style="color:#c2410c">Mój PrzepisFK</a> ·
        <a href="${SITE}/ustawienia" style="color:#5b6478">Zmień obszary lub wypisz się z e-maili</a>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function notifyEmail(db: SupabaseClient) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return console.log("E-mail: brak RESEND_API_KEY — pomijam");

  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, email, email_frequency, last_email_at, created_at")
    .neq("email_frequency", "none");
  if (error) return console.error(`E-mail: ${error.message}`);

  let sent = 0;
  for (const p of profiles) {
    const everyHours = p.email_frequency === "weekly" ? 7 * 24 - 2 : 24 - 2; // mały zapas na porę uruchomienia
    const last = p.last_email_at ?? hoursAgo(p.email_frequency === "weekly" ? 7 * 24 : 24);
    if (p.last_email_at && p.last_email_at > hoursAgo(everyHours)) continue; // jeszcze nie czas

    const { data: chosen } = await db.from("user_categories").select("category_id").eq("user_id", p.id);
    const categoryIds = (chosen ?? []).map((c) => c.category_id);
    if (!categoryIds.length || !p.email) continue;

    const { data: links } = await db.from("article_categories").select("article_id").in("category_id", categoryIds);
    const ids = [...new Set((links ?? []).map((l) => l.article_id))];
    if (!ids.length) continue;

    const { data: articles } = await db
      .from("articles")
      .select("id, url, title, summary, impact, stage, created_at, categories(name)")
      .eq("status", "done")
      .gt("created_at", last)
      .in("id", ids.slice(-500))
      .order("created_at", { ascending: false })
      .limit(30);
    if (!articles?.length) continue;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "PrzepisFK <onboarding@resend.dev>",
        to: [p.email],
        subject: `PrzepisFK: ${articles.length} ${articles.length === 1 ? "nowy wpis" : "nowe wpisy"} z Twoich obszarów`,
        html: emailHtml(articles as Row[], p.email_frequency),
      }),
    });
    if (!res.ok) {
      // konto Resend bez własnej domeny wysyła tylko na adres właściciela konta
      console.error(`E-mail do ${p.email}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    await db.from("profiles").update({ last_email_at: new Date().toISOString() }).eq("id", p.id);
    sent++;
  }
  console.log(`E-mail: wysłano ${sent}`);
}

export async function notify(db: SupabaseClient) {
  await notifyDiscord(db);
  await notifyEmail(db);
}
