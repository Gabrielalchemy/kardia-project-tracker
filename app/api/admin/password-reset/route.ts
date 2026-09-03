import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  const sessionClient = createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  const { data: profile } = await sessionClient.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Only administrators can reset passwords." }, { status: 403 });
  const body = await request.json().catch(() => null) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "A user is required." }, { status: 400 });
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !url) return NextResponse.json({ error: "Password reset requires SUPABASE_SERVICE_ROLE_KEY on the server." }, { status: 503 });
  const admin = createSupabaseClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: target } = await admin.auth.admin.getUserById(userId);
  if (!target.user?.email) return NextResponse.json({ error: "User email not found." }, { status: 404 });
  const { error } = await admin.auth.resetPasswordForEmail(target.user.email);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
