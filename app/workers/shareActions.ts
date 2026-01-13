"use server";

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function resolveUserKey(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;

  const adminString = process.env.ADMIN_EMAILS || "";
  const adminEmails = adminString.split(",").map((e) => e.trim().toLowerCase());

  if (adminEmails.includes(email.toLowerCase())) return "house_help_admin_sync";
  return email;
}

const makeToken = (): string => crypto.randomUUID().replace(/-/g, "");

type ShareRow = {
  token: string;
  expires_at: string | null;
  revoked: boolean;
};

const isExpired = (expires_at: string | null): boolean => {
  if (!expires_at) return false;
  return new Date(expires_at).getTime() < Date.now();
};

export async function createWorkerShareLink(
  workerId: string,
  daysValid = 30
): Promise<
  ActionResult<{ url: string; token: string; expires_at: string | null }>
> {
  const owner_key = await resolveUserKey();
  if (!owner_key) return { ok: false, error: "Unauthorized" };

  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) {
    return {
      ok: false,
      error:
        "Missing NEXT_PUBLIC_APP_URL in .env (e.g. https://yourdomain.com)",
    };
  }

  // 1) If an active link already exists, return it (do NOT create a new one)
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("worker_share_links")
    .select("token, expires_at, revoked")
    .eq("owner_key", owner_key)
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (existingErr) return { ok: false, error: existingErr.message };

  const active = (existing as ShareRow[] | null)?.find(
    (r) => !r.revoked && !isExpired(r.expires_at)
  );

  if (active) {
    return {
      ok: true,
      data: {
        token: active.token,
        expires_at: active.expires_at,
        url: `${base}/share/${active.token}`,
      },
    };
  }

  // 2) Otherwise create a new link
  const token = makeToken();

  const expires_at =
    daysValid > 0
      ? new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { data, error } = await supabaseAdmin
    .from("worker_share_links")
    .insert({ token, owner_key, worker_id: workerId, expires_at })
    .select("token, expires_at")
    .single();

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    data: {
      token: data.token as string,
      expires_at: (data.expires_at as string | null) ?? null,
      url: `${base}/share/${data.token}`,
    },
  };
}

export async function revokeWorkerShareLink(
  token: string
): Promise<ActionResult<true>> {
  const owner_key = await resolveUserKey();
  if (!owner_key) return { ok: false, error: "Unauthorized" };

  const { error } = await supabaseAdmin
    .from("worker_share_links")
    .update({ revoked: true })
    .eq("owner_key", owner_key)
    .eq("token", token);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: true };
}
