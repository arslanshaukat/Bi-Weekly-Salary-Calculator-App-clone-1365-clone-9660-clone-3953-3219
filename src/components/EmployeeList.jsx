import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { supabase } from '../supabase.js';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const { FiUsers, FiPlus, FiEdit, FiTrash2, FiSearch, FiCalendar, FiLock, FiArrowRight } = FiIcons;

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { checkPermission } = useAuth();
  const navigate = useNavigate();
  const reloadTimeout = useRef(null);

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

  const handleDeleteEmployee = async (id) => {
    if (!checkPermission('delete_employees')) return toast.error('Access denied');
    if (!window.confirm('Are you sure? This deletes ALL records for this employee.')) return;
    try {
      await employeeService.deleteEmployee(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
      toast.success('Employee removed');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const filteredEmployees = employees.filter(e => 
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amt) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amt || 0);

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
            <Link to="/calculate" state={{ createNew: true }} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest text-xs flex items-center">
              <SafeIcon icon={FiPlus} className="mr-2" /> Add Employee
            </Link>
          ) : (
            <div className="bg-gray-100 text-gray-400 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center opacity-50 cursor-not-allowed">
              <SafeIcon icon={FiLock} className="mr-2" /> Restricted
            </div>
          )}
        </div>
        <div className="relative">
          <SafeIcon icon={FiSearch} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
          <input type="text" placeholder="Search by name or employee ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4.5 bg-gray-50 border border-transparent focus:border-blue-200 focus:bg-white rounded-2xl font-bold text-gray-800 transition-all outline-none shadow-inner" />
        </div>
      </div>

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
                <Link to="/calculate" state={{ employee: emp, isEditEmployee: true }} className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                  <SafeIcon icon={FiEdit} />
                </Link>
                <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <SafeIcon icon={FiTrash2} />
                </button>
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
                <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">{emp.is_active ? 'Active' : 'Inactive'}</span>
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
    </div>
  );
};

export default EmployeeList;