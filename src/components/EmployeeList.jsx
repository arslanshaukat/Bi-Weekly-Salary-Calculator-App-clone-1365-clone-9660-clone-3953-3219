import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { supabase } from '../supabase.js';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

const { FiUsers, FiPlus, FiEdit, FiTrash2, FiSearch, FiCalendar, FiLock, FiArrowRight, FiX, FiShield, FiAlertTriangle } = FiIcons;

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [showArchive, setShowArchive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { checkPermission } = useAuth();
  const navigate = useNavigate();
  const reloadTimeout = useRef(null);

  // Security Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEmployees = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const data = await employeeService.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees(true);
    const subscription = supabase
      .channel('employees-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        if (reloadTimeout.current) clearTimeout(reloadTimeout.current);
        reloadTimeout.current = setTimeout(() => loadEmployees(false), 1000);
      })
      .subscribe();

    return () => {
      if (reloadTimeout.current) clearTimeout(reloadTimeout.current);
      supabase.removeChannel(subscription);
    };
  }, [loadEmployees]);

  const initiateDelete = (employee) => {
    if (!checkPermission('delete_employees')) return toast.error('Access denied');
    setEmployeeToDelete(employee);
    setDeletePassword('');
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    
    if (deletePassword !== 'Subic@123') {
      toast.error('Incorrect authorization password');
      return;
    }

    if (!employeeToDelete) return;

    setIsDeleting(true);
    try {
      await employeeService.deleteEmployee(employeeToDelete.id);
      setEmployees(prev => prev.filter(e => e.id !== employeeToDelete.id));
      toast.success(`${employeeToDelete.name} has been removed from registry`);
      setIsDeleteModalOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      toast.error('System failed to execute deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredEmployees = employees.filter(e => {
    const matchSearch = e.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.employee_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchArchive = showArchive ? !e.is_active : e.is_active !== false;
    return matchSearch && matchArchive;
  });

  const formatCurrency = (amt) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amt || 0);

  const reinstateEmployee = async (emp) => {
    if (!window.confirm(`Reinstate ${emp.name}? They will be set back to Active.`)) return;
    try {
      await employeeService.updateEmployee(emp.id, { is_active: true });
      toast.success(`${emp.name} reinstated successfully`);
      loadEmployees();
    } catch (e) { toast.error('Failed to reinstate employee'); }
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto py-20 text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Personnel...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-[2rem] shadow-xl p-8 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center space-x-4 text-left">
            <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 text-white">
              <SafeIcon icon={FiUsers} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight">Personnel Hall</h1>
              <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">GT International Registry</p>
            </div>
          </div>
          {checkPermission('manage_employees') ? (
            <Link to="/employees" className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center">
              <SafeIcon icon={FiPlus} className="mr-2" /> Add Employee
            </Link>
          ) : (
            <div className="bg-gray-100 text-gray-400 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center opacity-50 cursor-not-allowed">
              <SafeIcon icon={FiLock} className="mr-2" /> Restricted
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setShowArchive(false)}
            className={`px-5 py-2.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${!showArchive ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            Active
          </button>
          <button onClick={() => setShowArchive(true)}
            className={`px-5 py-2.5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${showArchive ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            🗂 Archive
          </button>
        </div>
      <div className="relative">
          <SafeIcon icon={FiSearch} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input 
            type="text" 
            placeholder="Search by name or employee ID..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full pl-14 pr-6 py-4.5 bg-gray-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-2xl font-bold text-gray-800 transition-all outline-none shadow-inner" 
          />
        </div>
      </div>

      {showArchive && (
        <div className="mb-6 bg-red-50 border border-red-100 rounded-2xl px-6 py-4 flex items-center gap-3">
          <span className="text-red-500 text-lg">🗂</span>
          <div>
            <p className="text-sm font-black text-red-700 uppercase tracking-tight">Viewing Archived Employees</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Inactive / Terminated records</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredEmployees.map((emp) => (
          <div key={emp.id} className="bg-white p-6 rounded-[2rem] shadow-lg border border-gray-100 hover:shadow-2xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {emp.name.charAt(0)}
                </div>
                <div className="text-left">
                  <Link to={`/employee/${emp.id}`} className="block group/name">
                    <h3 className="font-black text-gray-800 text-lg tracking-tight hover:text-blue-600 transition-colors cursor-pointer">{emp.name}</h3>
                  </Link>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{emp.position}</p>
                </div>
              </div>
              <div className="flex space-x-1">
                {emp.is_active !== false ? (
                  <>
                    <Link to="/calculate" state={{ employee: emp, isEditEmployee: true }} className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                      <SafeIcon icon={FiEdit} />
                    </Link>
                    <button onClick={() => initiateDelete(emp)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <SafeIcon icon={FiTrash2} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => reinstateEmployee(emp)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:bg-green-700 transition-all shadow-sm shadow-green-100">
                    ↩ Reinstate
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 text-left">
              <div className="bg-gray-50 p-3.5 rounded-2xl">
                <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Daily Rate</p>
                <p className="font-black text-gray-800 text-sm">{formatCurrency(emp.daily_salary)}</p>
              </div>
              <div className="bg-gray-50 p-3.5 rounded-2xl">
                <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest">Employee ID</p>
                <p className="font-black text-gray-800 text-sm">{emp.employee_id || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-50">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${emp.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{emp.is_active ? 'Active' : 'Terminated'}</span>
              </div>
              <Link to={`/employee/${emp.id}`} className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:translate-x-1 transition-transform flex items-center group-hover:font-black">
                View History <FiArrowRight className="ml-1" />
              </Link>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2rem] border-2 border-dashed border-gray-100 text-gray-300 font-black uppercase tracking-widest text-center italic">
            No matching personnel found
          </div>
        )}
      </div>

      {/* Security Deletion Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsDeleteModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-red-600 p-8 text-white text-center">
                <div className="bg-white/20 w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <SafeIcon icon={FiShield} className="text-3xl" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Security Authorization</h3>
                <p className="text-red-100 text-[10px] font-black uppercase tracking-widest mt-1">High-Level Data Integrity Protocol</p>
              </div>

              <div className="p-8">
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100 flex items-start space-x-3 mb-6">
                  <SafeIcon icon={FiAlertTriangle} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-red-800 uppercase leading-tight mb-1">Permanent Deletion</p>
                    <p className="text-[10px] text-red-600 font-bold leading-relaxed">
                      You are about to purge <strong>{employeeToDelete?.name}</strong>. This will also erase all attendance logs and payroll history.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleConfirmDelete} className="space-y-4 text-left">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Admin Password Required</label>
                    <input 
                      type="password" 
                      value={deletePassword} 
                      onChange={(e) => setDeletePassword(e.target.value)} 
                      placeholder="••••••••" 
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-2xl font-black transition-all outline-none"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsDeleteModalOpen(false)} 
                      className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isDeleting}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-100 uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 active:scale-95 transition-all"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <SafeIcon icon={FiTrash2} />
                          <span>Authorize Purge</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeList;