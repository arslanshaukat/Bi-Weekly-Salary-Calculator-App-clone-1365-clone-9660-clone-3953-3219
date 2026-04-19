import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const ActivityWatcher = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  
  // 2 Minutes = 120,000ms
  const INACTIVITY_LIMIT = 1800000; // 30 Minutes 

  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    if (user) {
      timeoutRef.current = setTimeout(() => {
        handleAutoLogout();
      }, INACTIVITY_LIMIT);
    }
  };

  const handleAutoLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.info('Session ended due to inactivity', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error('Auto-logout failed', error);
    }
  };

  useEffect(() => {
    if (!user) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    // Events to monitor for "activity"
    const events = [
      'mousedown', 
      'mousemove', 
      'keypress', 
      'scroll', 
      'touchstart',
      'click'
    ];

    // Throttled reset to prevent performance overhead
    let lastReset = 0;
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 1000) { // Only reset once per second
        lastReset = now;
        resetTimer();
      }
    };

    // Initialize timer
    resetTimer();

    // Add listeners
    events.forEach(event => {
      window.addEventListener(event, throttledReset);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => {
        window.removeEventListener(event, throttledReset);
      });
    };
  }, [user]);

  return null; // Background worker component
};

export default ActivityWatcher;