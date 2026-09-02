import { supabase } from '../supabase.js';
import { pb } from '../supabase.js';

function mapRecord(record) {
  const r = { ...record };
  if (r.sb_id) { r.id = r.sb_id; delete r.sb_id; }
  delete r.collectionId;
  delete r.collectionName;
  return r;
}

export const userService = {
  async updateProfile(userId, updates) {
    try {
      const existing = await pb.collection('profiles').getFirstListItem(`sb_id="${userId}"`);
      const record = await pb.collection('profiles').update(existing.id, { ...updates, updated_at: new Date().toISOString() });
      return mapRecord(record);
    } catch(e) {
      const record = await pb.collection('profiles').create({ id: userId, sb_id: userId, ...updates });
      return mapRecord(record);
    }
  },

  async updateEmail(newEmail) {
    const { data, error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },

  async getAllUsers() {
    const records = await pb.collection('profiles').getFullList({ sort: '-created_at' });
    return records.map(mapRecord);
  },

  async updateUserRole(userId, role) {
    const existing = await pb.collection('profiles').getFirstListItem(`sb_id="${userId}"`);
    const record = await pb.collection('profiles').update(existing.id, { role });
    return mapRecord(record);
  },

  async updateUserPermissions(userId, permissions) {
    const existing = await pb.collection('profiles').getFirstListItem(`sb_id="${userId}"`);
    const permStr = typeof permissions === 'object' ? JSON.stringify(permissions) : (permissions || '{}');
    const record = await pb.collection('profiles').update(existing.id, { permissions: permStr });
    return mapRecord(record);
  },
  async createUser(email, password, fullName, role, permissions) {
    // Uses signUp — works with anon key; Supabase will send confirmation email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;
    const userId = data.user?.id;
    if (userId) {
      try {
        await pb.collection('profiles').create({
          sb_id: userId,
          email,
          full_name: fullName,
          role: role || 'user',
          permissions: typeof permissions === 'object' ? JSON.stringify(permissions) : (permissions || '{}'),
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } catch(e) {
        console.error('Profile creation failed:', e);
      }
    }
    return data.user;
  },
  async resetUserPassword(email) {
    // Sends a password reset email — works with anon key
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/profile'
    });
    if (error) throw error;
    return data;
  },
  async deactivateUser(userId) {
    // Soft-delete: mark profile as inactive (cannot delete Supabase auth users without service role key)
    try {
      const existing = await pb.collection('profiles').getFirstListItem(`sb_id="${userId}"`);
      const record = await pb.collection('profiles').update(existing.id, { is_active: false });
      return mapRecord(record);
    } catch(e) { throw e; }
  }
};
