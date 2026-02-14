import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/systemService';
import SafeIcon from '../../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiActivity, FiCheckCircle, FiAlertCircle } = FiIcons;

const PublicPulse = () => {
  const [status, setStatus] = useState('pinging');
  const [timestamp, setTimestamp] = useState(null);

  useEffect(() => {
    const triggerPulse = async () => {
      try {
        const result = await systemService.publicPulse();
        setTimestamp(result.created_at);
        setStatus('success');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    };
    triggerPulse();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-gray-700">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          status === 'success' ? 'bg-green-500/20 text-green-500' : 
          status === 'error' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
        }`}>
          <SafeIcon 
            icon={status === 'success' ? FiCheckCircle : status === 'error' ? FiAlertCircle : FiActivity} 
            className={`text-4xl ${status === 'pinging' ? 'animate-pulse' : ''}`} 
          />
        </div>
        
        <h1 className="text-white text-xl font-bold mb-2">System Pulse</h1>
        <p className="text-gray-400 text-sm mb-6">
          {status === 'success' ? 'Database activity recorded successfully.' : 
           status === 'error' ? 'Failed to reach database.' : 'Pinging database...'}
        </p>

        {timestamp && (
          <div className="text-xs font-mono text-gray-500 bg-black/30 p-2 rounded">
            Last Activity: {new Date(timestamp).toLocaleString()}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-700">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Keep-Alive Endpoint
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicPulse;