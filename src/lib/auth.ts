import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "./supabase";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function canViewEmails(): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_subscribed")
    .eq("id", user.id)
    .single();

  return profile?.is_subscribed === true;
}

export async function getUserSubscription() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, isSubscribed: false, email: null };
  }

  const admin = getSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_subscribed, subscribed_at, plan")
    .eq("id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email },
    isSubscribed: profile?.is_subscribed === true,
    subscribedAt: profile?.subscribed_at ?? null,
    plan: profile?.plan ?? "free",
  };
}

export async function activateSubscription(userId: string, plan = "pro") {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("profiles")
    .update({
      is_subscribed: true,
      subscribed_at: new Date().toISOString(),
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return !error;
}
