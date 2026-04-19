import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const SUPABASE_URL = 'https://ihruwmkyoezpjvccxajn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocnV3bWt5b2V6cGp2Y2N4YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODY2MDEsImV4cCI6MjA4MTI2MjYwMX0.AFS9ObunyZF6orv7KwnbSDybvfbEB0J_EBlVTRQvf-Q'

// Ensure variables are present
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase variables are missing!');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Use a custom storage key prefix linked to app versioning if needed
    storageKey: 'gt-payroll-auth-token'
  }
})

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)