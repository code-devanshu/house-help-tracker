"use server";

import { getServerSession } from "next-auth/next";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { AppData } from "@/lib/storage/schema";
import { authOptions } from "@/auth";

export type SyncRow = {
  key: string;
  data: AppData;
  updated_at: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * PRIVATE HELPER: Determines the DB key securely
 * Logic: Checks session -> Checks .env for Admin list -> Returns Key
 */
async function resolveUserKey(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) return null;

  // Get secret admins from .env (comma-separated list)
  const adminString = process.env.ADMIN_EMAILS || "";
  const adminEmails = adminString.split(",").map((e) => e.trim().toLowerCase());

  // Use a shared key for admins, or the user's email for individuals
  if (adminEmails.includes(email.toLowerCase())) {
    return "house_help_admin_sync";
  }

  return email;
}

/**
 * FETCH LOGIC
 */
export async function getAppData(): Promise<SyncRow | null> {
  const key = await resolveUserKey();
  if (!key) return null;

  const { data, error } = await supabaseAdmin
    .from("app_blobs")
    .select("key,data,updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error("Fetch error:", error.message);
    return null;
  }
  return data;
}

/**
 * SERVER ACTION (Save/Sync)
 */
export async function syncAppData(
  data: AppData
): Promise<ActionResult<SyncRow>> {
  const key = await resolveUserKey();
  if (!key) return { ok: false, error: "Unauthorized: Please log in" };

  const nowIso = new Date().toISOString();

  const { data: result, error } = await supabaseAdmin
    .from("app_blobs")
    .upsert({ key, data, updated_at: nowIso }, { onConflict: "key" })
    .select("key,data,updated_at")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  return { ok: true, data: result };
}
