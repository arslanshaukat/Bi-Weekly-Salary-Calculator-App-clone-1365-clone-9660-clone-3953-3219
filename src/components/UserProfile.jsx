import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { toast } from 'react-toastify';

const { FiUser, FiLock, FiMail, FiSave, FiShield, FiAlertTriangle } = FiIcons;

const UserProfile = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  // Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Initialize form data
  useEffect(() => {
    // If profile exists, use it. Otherwise fall back to user object or defaults.
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || user?.email || '');
    } else if (user) {
      // Fallback if profile is missing (e.g. first login after broken signup)
      setEmail(user.email || '');
      setFullName(user.user_metadata?.full_name || '');
    }
  }, [profile, user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Update Profile Data
      // Safely check existing value
      const currentFullName = profile?.full_name || '';
      
      // Update if name changed OR if profile is missing (to create it)
      if (fullName !== currentFullName || !profile) {
        const updates = { 
          full_name: fullName,
          email: user.email // Ensure email is in sync
        };
        await userService.updateProfile(user.id, updates);
      }

      // 2. Update Email (if changed from auth user email)
      if (email !== user.email) {
        await userService.updateEmail(email);
        toast.info('Confirmation email sent to your new address.');
      } else {
        toast.success('Profile information updated successfully');
      }

      await refreshProfile();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update profile: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await userService.updatePassword(newPassword);
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
    } catch (error) {
      console.error('Password error:', error);
      toast.error('Failed to update password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center space-x-3 mb-6">
          <div className="bg-blue-600 p-3 rounded-lg">
            <SafeIcon icon={FiUser} className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
            <p className="text-gray-600">Manage your account settings and security</p>
          </div>
        </div>

        {/* Missing Profile Warning */}
        {!profile && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start space-x-3">
            <SafeIcon icon={FiAlertTriangle} className="text-yellow-600 mt-1" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">Profile Incomplete</p>
              <p className="text-xs text-yellow-700">
                Your user profile data is missing. Please click "Save Changes" below to initialize your profile.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'profile'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <SafeIcon icon={FiUser} />
              <span>Personal Info</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center space-x-2">
              <SafeIcon icon={FiLock} />
              <span>Security</span>
            </div>
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
              <div className="relative">
                <SafeIcon icon={FiUser} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative">
                <SafeIcon icon={FiMail} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Changing your email will require confirmation sent to the new address.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 px-3 py-1 rounded-full">
                <SafeIcon icon={FiShield} className={profile?.role === 'admin' ? 'text-orange-500' : 'text-blue-500'} />
                <span className="capitalize">Role: <strong>{profile?.role || 'User'}</strong></span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-70"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <SafeIcon icon={FiSave} />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-lg">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <SafeIcon icon={FiAlertTriangle} className="text-yellow-600 mt-1" />
                <p className="text-sm text-yellow-800">
                  Choose a strong password with at least 6 characters. You will need to log in again after changing your password.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
              <div className="relative">
                <SafeIcon icon={FiLock} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
              <div className="relative">
                <SafeIcon icon={FiLock} className="absolute left-3 top-3.5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-70"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <SafeIcon icon={FiSave} />
                )}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default UserProfile;