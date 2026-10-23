import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase-server";

// Tu wraca użytkownik z linku w e-mailu (potwierdzenie konta, reset hasła)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("dalej") ?? "/moj-feed";
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/moj-feed";

  if (code) {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }

  return NextResponse.redirect(`${origin}/logowanie?blad=link`);
}
