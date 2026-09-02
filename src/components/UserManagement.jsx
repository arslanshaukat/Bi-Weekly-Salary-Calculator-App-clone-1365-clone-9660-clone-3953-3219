import React, { useState, useEffect } from 'react';
import { userService } from '../services/userService';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const {
  FiUsers, FiSearch, FiShield, FiSettings, FiX, FiLock,
  FiUserPlus, FiKey, FiToggleLeft, FiToggleRight, FiEye, FiEyeOff
} = FiIcons;

const SUPER_ADMINS = ['arslanshaukat@hotmail.com'];

// Page-level access controls — maps to nav permission keys
const PAGE_PERMISSIONS = [
  { key: 'manage_employees', label: 'Personnel', description: 'View & manage employee records' },
  { key: 'manage_attendance', label: 'Attendance', description: 'View & log attendance' },
  { key: 'manage_payroll', label: 'Payroll (All)', description: 'Process, Archives, Summary, Holidays, Payroll Sheet' },
];

// Action-level permissions
const ACTION_PERMISSIONS = [
  { key: 'delete_employees', label: 'Delete Employees', description: 'Permanently remove employee records' },
  { key: 'delete_payroll', label: 'Delete Payroll Records', description: 'Remove processed pay records' },
];

const ALL_PERMISSIONS = [...PAGE_PERMISSIONS, ...ACTION_PERMISSIONS];

const emptyForm = { full_name: '', email: '', password: '', role: 'user', permissions: {} };

function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [tempPermissions, setTempPermissions] = useState({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const { user: currentUser } = useAuth();

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await userService.getAllUsers();
      setUsers(data || []);
    } catch (error) {
      toast.error(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId, currentRole, userEmail) => {
    if (userId === currentUser?.id) { toast.warning("You cannot change your own role."); return; }
    if (SUPER_ADMINS.includes(userEmail)) { toast.error("Super Admin cannot be demoted."); return; }
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await userService.updateUserRole(userId, newRole);
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`Role updated to ${newRole}`);
    } catch (e) { toast.error('Failed to update role'); }
  };

  const openPermissionModal = (u) => {
    setEditingUser(u);
    const perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '{}') : (u.permissions || {});
    setTempPermissions(perms);
  };

  const savePermissions = async () => {
    if (!editingUser) return;
    try {
      await userService.updateUserPermissions(editingUser.id, tempPermissions);
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, permissions: tempPermissions } : u));
      toast.success('Permissions saved');
      setEditingUser(null);
    } catch (e) { toast.error('Failed to save permissions'); }
  };

  const handleCreate = async () => {
    if (!createForm.full_name.trim()) { toast.error('Full name is required'); return; }
    if (!createForm.email.trim()) { toast.error('Email is required'); return; }
    if (!createForm.password.trim() || createForm.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setCreating(true);
    try {
      await userService.createUser(
        createForm.email.trim(),
        createForm.password,
        createForm.full_name.trim(),
        createForm.role,
        createForm.permissions
      );
      toast.success(`User ${createForm.full_name} created — they'll receive a confirmation email`);
      setShowCreateForm(false);
      setCreateForm(emptyForm);
      loadUsers();
    } catch (e) {
      toast.error(`Failed to create user: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (u) => {
    setResettingId(u.id);
    try {
      await userService.resetUserPassword(u.email);
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e) {
      toast.error(`Failed to send reset email: ${e.message}`);
    } finally {
      setResettingId(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const s = searchTerm.toLowerCase();
    return (u.email?.toLowerCase() || '').includes(s) || (u.full_name?.toLowerCase() || '').includes(s);
  });

  const getPermissions = (u) => {
    if (typeof u.permissions === 'string') { try { return JSON.parse(u.permissions || '{}'); } catch { return {}; } }
    return u.permissions || {};
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto p-8 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto"></div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Loading users...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="bg-gray-900 rounded-[2rem] p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-amber-500 p-3 rounded-2xl">
            <SafeIcon icon={FiUsers} className="text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white">User Management</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{users.length} users · {users.filter(u => u.role === 'admin').length} admins</p>
          </div>
        </div>
        <button
          onClick={() => { setShowCreateForm(true); setCreateForm({ ...emptyForm, password: genPassword() }); }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-black text-[10px] uppercase tracking-widest px-5 py-3 rounded-2xl transition-all"
        >
          <SafeIcon icon={FiUserPlus} /> Add User
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <SafeIcon icon={FiSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900 shadow-sm"
        />
      </div>

      {/* User Cards */}
      <div className="space-y-3">
        {filteredUsers.map(u => {
          const isSuperAdmin = SUPER_ADMINS.includes(u.email);
          const isSelf = u.id === currentUser?.id;
          const perms = getPermissions(u);
          const activePerms = ALL_PERMISSIONS.filter(p => perms[p.key]);

          return (
            <div key={u.id} className="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 flex-shrink-0 bg-gray-900 rounded-2xl flex items-center justify-center">
                    <span className="text-amber-400 font-black text-lg">
                      {u.full_name?.charAt(0) || u.email?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-gray-900 uppercase tracking-wide text-sm">{u.full_name || 'Unnamed'}</span>
                      {isSuperAdmin && <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-widest">Super Admin</span>}
                      {isSelf && <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-widest">You</span>}
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role || 'user'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-bold mt-0.5">{u.email}</p>
                    {u.role !== 'admin' && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {activePerms.length > 0 ? activePerms.map(p => (
                          <span key={p.key} className="text-[9px] font-black bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full uppercase tracking-widest">{p.label}</span>
                        )) : (
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">No page access</span>
                        )}
                      </div>
                    )}
                    {u.role === 'admin' && (
                      <div className="flex items-center gap-1 mt-2">
                        <SafeIcon icon={FiShield} className="text-green-500 text-xs" />
                        <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Full Access</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isSelf && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Reset Password */}
                    <button
                      onClick={() => handleResetPassword(u)}
                      disabled={resettingId === u.id}
                      className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Send password reset email"
                    >
                      <SafeIcon icon={FiKey} />
                    </button>

                    {/* Edit Permissions */}
                    {u.role !== 'admin' && !isSuperAdmin && (
                      <button
                        onClick={() => openPermissionModal(u)}
                        className="p-2.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Manage page access & permissions"
                      >
                        <SafeIcon icon={FiSettings} />
                      </button>
                    )}

                    {/* Toggle Role */}
                    {!isSuperAdmin ? (
                      <button
                        onClick={() => toggleRole(u.id, u.role, u.email)}
                        className={`p-2.5 rounded-xl transition-all ${u.role === 'admin' ? 'text-orange-500 hover:bg-orange-50' : 'text-purple-500 hover:bg-purple-50'}`}
                        title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      >
                        <SafeIcon icon={FiShield} />
                      </button>
                    ) : (
                      <span className="p-2.5 text-gray-200"><SafeIcon icon={FiLock} /></span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gray-900 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Add New User</h3>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-1">A confirmation email will be sent</p>
              </div>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-white transition-colors">
                <SafeIcon icon={FiX} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl font-bold text-sm focus:outline-none focus:border-gray-900"
                  placeholder="e.g. Juan Dela Cruz"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl font-bold text-sm focus:outline-none focus:border-gray-900"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Temporary Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl font-bold text-sm focus:outline-none focus:border-gray-900 pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button type="button" onClick={() => setShowPassword(s => !s)} className="p-2 text-gray-400 hover:text-gray-700 rounded-xl">
                      <SafeIcon icon={showPassword ? FiEyeOff : FiEye} />
                    </button>
                    <button type="button" onClick={() => setCreateForm(f => ({ ...f, password: genPassword() }))} className="text-[9px] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 px-2">
                      Gen
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 block">Role</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-100 rounded-2xl font-bold text-sm focus:outline-none focus:border-gray-900 bg-white"
                >
                  <option value="user">User (restricted by permissions)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </div>

              {createForm.role !== 'admin' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Page Access</label>
                  <div className="space-y-2">
                    {PAGE_PERMISSIONS.map(p => (
                      <label key={p.key} className="flex items-center gap-3 p-3 rounded-2xl border-2 border-gray-100 hover:border-gray-300 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={!!createForm.permissions[p.key]}
                          onChange={() => setCreateForm(f => ({ ...f, permissions: { ...f.permissions, [p.key]: !f.permissions[p.key] } }))}
                          className="w-4 h-4 text-amber-500 rounded"
                        />
                        <div>
                          <span className="font-black text-xs text-gray-800 uppercase tracking-wide">{p.label}</span>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateForm(false)} className="px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gray-900 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-white font-black uppercase tracking-widest text-sm">Page Access & Permissions</h3>
                <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mt-1">{editingUser.full_name || editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-white transition-colors">
                <SafeIcon icon={FiX} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Page Visibility</p>
                <div className="space-y-2">
                  {PAGE_PERMISSIONS.map(p => (
                    <label key={p.key} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${tempPermissions[p.key] ? 'border-gray-900 bg-gray-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={!!tempPermissions[p.key]}
                        onChange={() => setTempPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                        className="w-4 h-4 text-amber-500 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-black text-xs text-gray-800 uppercase tracking-wide">{p.label}</span>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.description}</p>
                      </div>
                      {tempPermissions[p.key] ? <SafeIcon icon={FiEye} className="text-green-500 text-xs" /> : <SafeIcon icon={FiEyeOff} className="text-gray-300 text-xs" />}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Action Permissions</p>
                <div className="space-y-2">
                  {ACTION_PERMISSIONS.map(p => (
                    <label key={p.key} className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${tempPermissions[p.key] ? 'border-red-200 bg-red-50' : 'border-gray-100 hover:border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={!!tempPermissions[p.key]}
                        onChange={() => setTempPermissions(prev => ({ ...prev, [p.key]: !prev[p.key] }))}
                        className="w-4 h-4 text-red-500 rounded"
                      />
                      <div className="flex-1">
                        <span className="font-black text-xs text-gray-800 uppercase tracking-wide">{p.label}</span>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{p.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditingUser(null)} className="px-5 py-3 text-gray-600 hover:bg-gray-100 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Cancel</button>
                <button onClick={savePermissions} className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Save Permissions</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
