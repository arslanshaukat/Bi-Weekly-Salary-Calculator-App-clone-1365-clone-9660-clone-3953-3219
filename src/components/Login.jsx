import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { toast } from 'react-toastify';

const { FiLock, FiMail, FiArrowRight, FiInfo } = FiIcons;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(false);
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Invalid credentials. Please attempt again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="bg-blue-600 p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          <div className="bg-white/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner">
            <SafeIcon icon={FiLock} className="text-white text-3xl" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">GT Payroll Vault</h1>
          <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Secure Personnel Access</p>
        </div>

        {/* Form */}
        <div className="p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-left">
              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest ml-1">Identity (Email)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SafeIcon icon={FiMail} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-600 font-bold text-gray-800 transition-all outline-none shadow-sm" 
                  placeholder="admin@gtintl.com.ph" 
                  required 
                />
              </div>
            </div>

            <div className="text-left">
              <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest ml-1">Security Key (Password)</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <SafeIcon icon={FiLock} className="text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-600 font-bold text-gray-800 transition-all outline-none shadow-sm" 
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 disabled:opacity-70 disabled:pointer-events-none uppercase tracking-widest text-xs"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <span>Authenticate Session</span>
                  <SafeIcon icon={FiArrowRight} />
                </>
              )}
            </button>
          </form>

          {/* Admin Request Notice */}
          <div className="mt-10 p-5 bg-gray-50 rounded-2xl border border-gray-100 flex items-start space-x-3">
            <SafeIcon icon={FiInfo} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="text-[10px] font-black text-gray-800 uppercase tracking-tight mb-1">Access Restricted</p>
              <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
                Self-registration is disabled. To request a new account or reset your credentials, please contact the 
                <span className="text-blue-600 ml-1">System Administrator</span>.
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-50 text-center">
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.3em]">GT International Ledger v1.0.9</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;