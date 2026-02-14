import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase.js';
import { toast } from 'react-toastify';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const initialized = useRef(false);

  const SUPER_ADMINS = ['arslanshaukat@hotmail.com', 'info@gtintl.com.ph'];

  const fetchProfile = useCallback(async (userId, userEmail) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, permissions')
        .eq('id', userId)
        .single();
      
      if (error) {
        if (userEmail && SUPER_ADMINS.includes(userEmail)) {
          setIsAdmin(true);
        }
        return null;
      }
      
      if (data) {
        setProfile(data);
        const isSuperAdmin = userEmail && SUPER_ADMINS.includes(userEmail);
        setIsAdmin(data.role === 'admin' || isSuperAdmin);
        return data;
      }
    } catch (e) {
      console.error('Profile sync failed:', e);
    }
    return null;
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (initialized.current) return;
      
      try {
        // Step 1: Check session - this is extremely fast
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            // Step 2: Release UI IMMEDIATELY
            setLoading(false);
            initialized.current = true;
            
            // Step 3: Fetch profile data quietly in background
            fetchProfile(session.user.id, session.user.email);
          } else {
            setLoading(false);
            initialized.current = true;
          }
        }
      } catch (err) {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user);
        if (!profile || profile.id !== session.user.id) {
          fetchProfile(session.user.id, session.user.email);
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      localStorage.removeItem('gt-payroll-auth-token');
      // No toast here to avoid spamming on auto-logout
    }
  };

  const checkPermission = useCallback((key) => {
    if (isAdmin) return true;
    return !!(profile?.permissions?.[key]);
  }, [isAdmin, profile]);

  const value = {
    user,
    profile,
    isAdmin,
    login,
    logout,
    loading,
    checkPermission,
    refreshProfile: () => user && fetchProfile(user.id, user.email)
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};