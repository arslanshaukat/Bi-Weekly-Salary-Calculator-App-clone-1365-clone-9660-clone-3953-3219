import { supabase } from '../supabase.js';

export const systemService = {
  /**
   * Sends a heartbeat to Supabase
   */
  async sendHeartbeat(type = 'heartbeat') {
    try {
      const clientInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        origin: window.location.origin
      };

      const { data, error } = await supabase
        .from('system_activity_1767442700392')
        .insert([{ 
          activity_type: type,
          client_info: clientInfo
        }])
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      throw error;
    }
  },

  /**
   * Public health check that performs a light DB operation
   * Used for external pingers like UptimeRobot
   */
  async publicPulse() {
    const { data, error } = await supabase
      .from('system_activity_1767442700392')
      .insert([{ 
        activity_type: 'external_ping',
        client_info: { source: 'external_monitor' }
      }])
      .select('created_at')
      .single();

    if (error) throw error;
    return data;
  },

  async getLastActivity() {
    const { data, error } = await supabase
      .from('system_activity_1767442700392')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
};