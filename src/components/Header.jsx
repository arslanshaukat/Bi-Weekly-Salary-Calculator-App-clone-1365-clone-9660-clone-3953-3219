import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { systemService } from '../services/systemService';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const { FiCalculator, FiUsers, FiCalendar, FiUser, FiLogOut, FiSettings, FiArchive, FiMenu, FiX, FiPieChart, FiGift } = FiIcons;

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(true);
  const userMenuRef = useRef(null);
  const { user, profile, isAdmin, logout } = useAuth();

  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        await systemService.getLastActivity();
        setIsSystemActive(true);
      } catch (e) {
        setIsSystemActive(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 300000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate('/login');
    } catch (e) {}
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/', label: 'Personnel', icon: FiUsers, permission: 'manage_employees' },
    { path: '/attendance', label: 'Attendance', icon: FiCalendar, permission: 'manage_attendance' },
    { path: '/calculate', label: 'Process', icon: FiCalculator, permission: 'manage_payroll' },
    { path: '/results', label: 'Archives', icon: FiArchive, permission: 'manage_payroll' },
    { path: '/summary', label: 'Summary', icon: FiPieChart, permission: 'manage_payroll' },
    { path: '/holidays', label: 'Holidays', icon: FiGift, permission: 'manage_payroll' },
  ].filter(link => {
    if (user?.email === 'gtsubic@gmail.com') {
      return link.path === '/attendance';
    }
    if (isAdmin) return true;
    return !!profile?.permissions?.[link.permission];
  });

  if (!user && location.pathname === '/login') return null;

  return (
    <header className="bg-white shadow-xl border-b-4 border-blue-600 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            {navLinks.length > 0 && (
              <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <SafeIcon icon={FiMenu} className="text-2xl" />
              </button>
            )}
            <Link to={user?.email === 'gtsubic@gmail.com' ? '/attendance' : '/'} className="flex items-center space-x-3 outline-none">
              <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-100">
                <SafeIcon icon={FiCalculator} className="text-white text-xl md:text-2xl" />
              </div>
              <div className="text-left hidden xs:block">
                <h1 className="text-lg md:text-xl font-black text-gray-800 tracking-tight leading-none mb-1 uppercase">GT Payroll</h1>
                <div className="flex items-center space-x-1.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${isSystemActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[7px] md:text-[8px] font-black text-gray-400 uppercase tracking-widest">Active System</span>
                </div>
              </div>
            </Link>
          </div>

          {user && (
            <div className="flex items-center space-x-2">
              <nav className="hidden lg:flex items-center space-x-1">
                {navLinks.map((link) => (
                  <Link key={link.path} to={link.path} className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all ${isActive(link.path) ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 font-bold'}`} >
                    <SafeIcon icon={link.icon} />
                    <span className="text-[11px] uppercase tracking-widest">{link.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="h-8 w-px bg-gray-100 mx-3 hidden lg:block"></div>
              <div className="relative" ref={userMenuRef}>
                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center space-x-2 md:space-x-3 bg-gray-50 hover:bg-gray-100 p-1.5 md:p-2 rounded-2xl border border-gray-100 transition-all">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] font-black text-gray-800 leading-none mb-0.5 max-w-[100px] truncate">{profile?.full_name || user.email.split('@')[0]}</p>
                    <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{profile?.role || 'User'}</p>
                  </div>
                  <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <SafeIcon icon={FiUser} />
                  </div>
                </button>
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute top-full right-0 mt-3 w-64 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden ring-4 ring-black/5" >
                      <div className="p-6 bg-gray-50 text-left">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Authenticated As</p>
                        <p className="text-sm font-black text-gray-800 truncate">{user.email}</p>
                      </div>
                      <Link to="/profile" className="flex items-center space-x-3 p-4 hover:bg-blue-50 text-gray-700 transition-all font-bold text-sm">
                        <SafeIcon icon={FiUser} /> <span>Profile Vault</span>
                      </Link>
                      {isAdmin && (
                        <Link to="/users" className="flex items-center space-x-3 p-4 hover:bg-blue-50 text-gray-700 transition-all font-bold text-sm">
                          <SafeIcon icon={FiSettings} /> <span>Admin Control</span>
                        </Link>
                      )}
                      <button onClick={handleLogout} className="w-full flex items-center space-x-3 p-4 text-red-600 hover:bg-red-50 border-t border-gray-50 font-black text-xs uppercase tracking-widest transition-all">
                        <SafeIcon icon={FiLogOut} /> <span>Terminate Session</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;