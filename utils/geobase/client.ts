import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_Geobase_URL!,
    process.env.NEXT_PUBLIC_Geobase_ANON_KEY!
  )
}