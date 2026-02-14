import { supabase } from '../supabase.js';

export const userService = {
  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates, updated_at: new Date() })
      .select()
      .single();
    if (error) throw error;
    return data;
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

  // Optimized: Select only necessary columns for the table view
  async getAllUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, permissions, created_at')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async updateUserRole(userId, role) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateUserPermissions(userId, permissions) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ permissions })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};