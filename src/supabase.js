import { createClient } from '@supabase/supabase-js'
import PocketBase from 'pocketbase'

// ============================================================
// Supabase — AUTH ONLY (login, sessions, passwords)
// ============================================================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
