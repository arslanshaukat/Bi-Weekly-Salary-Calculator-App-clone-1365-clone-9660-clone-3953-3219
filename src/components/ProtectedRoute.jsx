import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiLoader, FiShield } = FiIcons;

const ProtectedRoute = ({ children, requireAdmin = false, requirePermission = null }) => {
  const { user, isAdmin, profile, loading, checkPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading secure session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check specific permission if required
  if (requirePermission && !checkPermission(requirePermission)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100">
          <div className="bg-red-50 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiShield} className="text-red-600 text-3xl" />
          </div>
          <h2 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">Access Denied</h2>
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Insufficient Clearance Level</p>
          <button 
            onClick={() => window.history.back()} 
            className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;