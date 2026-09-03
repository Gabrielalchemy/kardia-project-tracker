import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { data: profile } = await createClient().from("users").select("is_active").eq("id", user.id).maybeSingle();
  if (profile?.is_active === false) {
    await createClient().auth.signOut();
    redirect("/login?error=account_disabled");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const supabase = createClient();
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");
  return { user, profile };
}
