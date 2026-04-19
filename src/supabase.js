import { createClient } from '@supabase/supabase-js'
import PocketBase from 'pocketbase'

// ============================================================
// Supabase — AUTH ONLY (login, sessions, passwords)
// ============================================================
const SUPABASE_URL = 'https://ihruwmkyoezpjvccxajn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlocnV3bWt5b2V6cGp2Y2N4YWpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2ODY2MDEsImV4cCI6MjA4MTI2MjYwMX0.AFS9ObunyZF6orv7KwnbSDybvfbEB0J_EBlVTRQvf-Q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'gt-payroll-auth-token'
  }
})

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

// ============================================================
// PocketBase — ALL DATA OPERATIONS
// ============================================================
export const pb = new PocketBase('https://pb.gtintl.com.ph')
pb.autoCancellation(false)

export async function initPocketBase() {
  try {
    const res = await fetch('https://pb.gtintl.com.ph/api/admins/auth-with-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({identity: 'arslanshaukat@hotmail.com', password: 'Taylors@12'})
    });
    const authData = await res.json();
    if (authData.token) pb.authStore.save(authData.token, authData.admin)
    console.log('✅ PocketBase ready')
  } catch (e) {
    console.error('PocketBase init failed:', e)
  }
}

export const isPocketBaseConfigured = true
