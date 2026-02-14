import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const { FiUsers, FiSearch, FiShield, FiSettings, FiX, FiLock } = FiIcons;

const PERMISSION_KEYS = [
  { key: 'manage_employees', label: 'Create/Edit Employees' },
  { key: 'delete_employees', label: 'Delete Employees' },
  { key: 'manage_payroll', label: 'Calculate/Edit Payroll' },
  { key: 'delete_payroll', label: 'Delete Payroll Records' },
  { key: 'manage_attendance', label: 'Manage Attendance' },
];

// List of Super Admins who cannot be demoted or modified
const SUPER_ADMINS = ['info@gtintl.com.ph', 'arslanshaukat@hotmail.com'];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [errorDetails, setErrorDetails] = useState('');

  // For modal
  const [tempPermissions, setTempPermissions] = useState({});

  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setErrorDetails('');
    try {
      const data = await userService.getAllUsers();
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      setErrorDetails(error.message || JSON.stringify(error));
      toast.error(`Failed to load user list: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId, currentRole, userEmail) => {
    if (userId === currentUser?.id) {
      toast.warning("You cannot change your own role.");
      return;
    }
    
    if (SUPER_ADMINS.includes(userEmail)) {
      toast.error("This Super Admin cannot be demoted.");
      return;
    }

    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await userService.updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update user role');
    }
  };

  const openPermissionModal = (user) => {
    setEditingUser(user);
    setTempPermissions(user.permissions || {});
  };

  const handlePermissionChange = (key) => {
    setTempPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    try {
      await userService.updateUserPermissions(editingUser.id, tempPermissions);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, permissions: tempPermissions } : u));
      toast.success('Permissions updated successfully');
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
    }
  };

  const filteredUsers = users.filter(u => {
    const email = u.email?.toLowerCase() || '';
    const name = u.full_name?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return email.includes(search) || name.includes(search);
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    );
  }

  // Error State Display
  if (errorDetails && users.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <SafeIcon icon={FiIcons.FiAlertTriangle} className="text-red-500 text-4xl mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-800 mb-2">Failed to Load Users</h3>
          <p className="text-red-600 mb-4">{errorDetails}</p>
          <button 
            onClick={loadUsers}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-600 p-3 rounded-lg">
              <SafeIcon icon={FiUsers} className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
              <p className="text-gray-600">Manage access roles and specific limitations</p>
            </div>
          </div>
        </div>

        <div className="relative mb-6">
          <SafeIcon icon={FiSearch} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Limitations / Permissions</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const isSuperAdmin = SUPER_ADMINS.includes(user.email);
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-purple-600 font-semibold text-lg">
                            {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                            {user.full_name || 'Unnamed User'}
                            {isSuperAdmin && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-800 border border-yellow-200">
                                SUPER ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role ? user.role.toUpperCase() : 'USER'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'admin' ? (
                        <span className="text-xs text-green-600 font-medium flex items-center">
                          <SafeIcon icon={FiShield} className="mr-1" />
                          Full Access
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(user.permissions || {}).filter(([k, v]) => v).length > 0 ? (
                            Object.entries(user.permissions || {}).filter(([k, v]) => v).map(([key, val]) => (
                                <span key={key} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                  {key.replace(/_/g, ' ')}
                                </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">Restricted User</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {user.id !== currentUser?.id && (
                        <div className="flex items-center justify-end space-x-2">
                          {/* Toggle Role */}
                          {!isSuperAdmin ? (
                            <button
                              onClick={() => toggleRole(user.id, user.role, user.email)}
                              className={`p-2 rounded-md transition-colors ${
                                user.role === 'admin' ? 'text-orange-600 hover:bg-orange-50' : 'text-purple-600 hover:bg-purple-50'
                              }`}
                              title={user.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                            >
                              <SafeIcon icon={FiShield} />
                            </button>
                          ) : (
                            <span className="p-2 text-gray-300" title="Super Admin Protected">
                              <SafeIcon icon={FiLock} />
                            </span>
                          )}
                          
                          {/* Edit Permissions (Only for non-admins) */}
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => openPermissionModal(user)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Manage Limitations"
                            >
                              <SafeIcon icon={FiSettings} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-600 p-4 flex justify-between items-center">
              <h3 className="text-white font-bold text-lg">Manage Permissions</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-blue-100 hover:text-white transition-colors"
              >
                <SafeIcon icon={FiX} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Select privileges for <strong>{editingUser.full_name || editingUser.email}</strong>. 
                Unchecked items will be limited/restricted.
              </p>
              
              <div className="space-y-3">
                {PERMISSION_KEYS.map((perm) => (
                  <label key={perm.key} className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={!!tempPermissions[perm.key]}
                      onChange={() => handlePermissionChange(perm.key)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="ml-3 text-sm font-medium text-gray-700">{perm.label}</span>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={savePermissions}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;