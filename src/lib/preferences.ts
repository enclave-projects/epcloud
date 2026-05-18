import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database"

export type Preferences =
  Database["public"]["Tables"]["user_preferences"]["Row"]

export async function getPreferences(userId: string): Promise<Preferences> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single()
  if (error) {
    // The trigger creates a row on signup; if missing, insert defaults.
    if (error.code === "PGRST116") {
      const { data: inserted, error: insertErr } = await supabase
        .from("user_preferences")
        .insert({ user_id: userId })
        .select("*")
        .single()
      if (insertErr) throw insertErr
      return inserted
    }
    throw error
  }
  return data
}

export async function updatePreferences(
  userId: string,
  patch: Partial<
    Pick<
      Preferences,
      "notify_share_activity" | "notify_storage_warnings" | "notify_product_updates"
    >
  >
): Promise<Preferences> {
  // notify_security is intentionally not patchable — security mail is
  // mandatory and the UI marks it as Required.
  const { data, error } = await supabase
    .from("user_preferences")
    .update(patch)
    .eq("user_id", userId)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function updateProfileName(
  userId: string,
  fullName: string
): Promise<void> {
  const trimmed = fullName.trim()
  if (trimmed.length === 0 || trimmed.length > 100) {
    throw new Error("Full name must be 1-100 characters")
  }
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", userId)
  if (profileErr) throw profileErr

  // Mirror to auth user_metadata so the topbar avatar/name updates immediately.
  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: trimmed },
  })
  if (authErr) throw authErr
}
