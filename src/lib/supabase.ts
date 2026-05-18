import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/types/database"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file."
  )
}

/**
 * Single shared, typed Supabase browser client.
 *
 * Security notes:
 * - Uses `@supabase/ssr` `createBrowserClient` which stores the session in
 *   cookies with `SameSite=Lax` by default, mitigating CSRF on the cookie
 *   surface. Supabase's REST/Auth API additionally requires the bearer token
 *   in the `Authorization` header, so a stolen session cookie alone cannot
 *   be replayed cross-site.
 * - Auto-refresh is enabled so short-lived JWTs rotate seamlessly.
 * - PKCE flow is used by default for OAuth redirects.
 */
export const supabase = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)
