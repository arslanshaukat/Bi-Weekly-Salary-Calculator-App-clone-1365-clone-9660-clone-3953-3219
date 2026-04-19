import { pb } from '../supabase.js';

export const systemService = {
  async sendHeartbeat(type = 'heartbeat') {
    try {
      const clientInfo = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        origin: typeof window !== 'undefined' ? window.location.origin : 'server'
      };
      const record = await pb.collection('system_activity_1767442700392').create({
        activity_type: type,
        client_info: clientInfo
      });
      return record;
    } catch (error) {
      console.error('Heartbeat failed:', error);
      throw error;
    }
  },

  async publicPulse() {
    const record = await pb.collection('system_activity_1767442700392').create({
      activity_type: 'external_ping',
      client_info: { source: 'external_monitor' }
    });
    return record;
  },

  async getLastActivity() {
    try {
      const record = await pb.collection('system_activity_1767442700392').getFirstListItem('', {
        sort: '-created_at'
      });
      return record;
    } catch(e) {
      return null;
    }
  }
};
