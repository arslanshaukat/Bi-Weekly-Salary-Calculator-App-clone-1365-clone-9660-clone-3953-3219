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
    const record = await pb.collection('profiles').update(existing.id, { permissions });
    return mapRecord(record);
  }
};
