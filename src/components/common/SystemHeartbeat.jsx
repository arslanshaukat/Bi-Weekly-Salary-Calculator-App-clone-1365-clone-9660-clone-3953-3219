import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/systemService';
import { toast } from 'react-toastify';

const SystemHeartbeat = () => {
  const [lastPing, setLastPing] = useState(null);
  const [status, setStatus] = useState('initializing'); // initializing, active, error

  const performHeartbeat = async (isInitial = false) => {
    try {
      await systemService.sendHeartbeat();
      const now = new Date();
      setLastPing(now);
      setStatus('active');
      
      if (isInitial) {
        console.log('Supabase session established and keep-alive active.');
      }
    } catch (error) {
      console.error('Keep-alive failed:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    // Initial heartbeat on mount
    performHeartbeat(true);

    // Set up interval - ping every 5 minutes (300,000 ms)
    // This is frequent enough to keep the project "active" in Supabase's eyes
    const interval = setInterval(() => {
      performHeartbeat();
    }, 300000); 

    return () => clearInterval(interval);
  }, []);

  // This component doesn't render anything visible directly
  // It acts as a background worker
  return null;
};

export default SystemHeartbeat;