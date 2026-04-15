import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';

const { 
  FiUser, FiArrowLeft, FiEdit, FiCalculator, FiCalendar, FiTrendingDown, 
  FiShield, FiGift, FiList, FiEye, FiTrash2, FiClock, FiEdit2, 
  FiBriefcase, FiPlus, FiHash, FiTag, FiInfo, FiX 
} = FiIcons;

const EmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { checkPermission } = useAuth();
  
  const [employee, setEmployee] = useState(null);
  const [payRecords, setPayRecords] = useState([]);
  const [pendingDeductions, setPendingDeductions] = useState([]);
  const [activeTab, setActiveTab] = useState('payslips');
  const [loading, setLoading] = useState(true);
  
  // New Deduction Form State
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [newDeduction, setNewDeduction] = useState({
    category: 'Cash Advance',
    amount: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [emp, records, pending] = await Promise.all([
        employeeService.getEmployeeById(employeeId),
        employeeService.getPayRecords(employeeId),
        employeeService.getPendingDeductions(employeeId)
      ]);
      setEmployee(emp);
      setPayRecords(records);
      setPendingDeductions(pending);
    } catch (error) {
      toast.error('Error loading employee data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDeduction = async (e) => {
    e.preventDefault();
    if (!checkPermission('manage_payroll')) return toast.error('Access denied');
    try {
      await employeeService.createDeduction({
        employee_id: employeeId,
        ...newDeduction,
        amount: Number(newDeduction.amount)
      });
      toast.success('Deduction added to pending list');
      setNewDeduction({ ...newDeduction, amount: '', notes: '' });
      setShowAddDeduction(false);
      loadData();
    } catch (error) {
      toast.error('Failed to add deduction');
    }
  };

  const handleDeleteDeduction = async (id) => {
    if (!checkPermission('manage_payroll')) return toast.error('Access denied');
    if (!window.confirm('Remove this pending deduction?')) return;
    try {
      await employeeService.deleteDeduction(id);
      setPendingDeductions(prev => prev.filter(d => d.id !== id));
      toast.success('Deduction removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!checkPermission('delete_payroll')) return toast.error('Access denied');
    if (!window.confirm('Delete this payroll record?')) return;
    try {
      await employeeService.deletePayRecord(id);
      setPayRecords(prev => prev.filter(r => r.id !== id));
      toast.success('Record removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  if (loading || !employee) return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 text-left">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Loading Profile...</p>
    </div>
  );

  const isFullTime = employee.employee_type === 'Full Time';
  const total13thMonth = payRecords.reduce((sum, r) => sum + (r.thirteenth_month || 0), 0);
  
  const statsTotal = payRecords.reduce((acc, curr) => ({
    sss: acc.sss + (Number(curr.sss_contribution) || 0),
    ph: acc.ph + (Number(curr.philhealth_contribution) || 0),
    pi: acc.pi + (Number(curr.pagibig_contribution) || 0)
  }), { sss: 0, ph: 0, pi: 0 });

  const tabs = [
    { id: 'payslips', label: 'History', icon: FiList },
    { id: 'deductions', label: 'Deductions', icon: FiTrendingDown },
    { id: 'contributions', label: 'Statutory', icon: FiShield },
    ...(isFullTime ? [{ id: '13thmonth', label: '13th Month', icon: FiGift }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 text-left">
      {/* Profile Header Card */}
      <div className="bg-white rounded-3xl shadow-xl p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-gray-100 pb-8">
          <div className="flex items-center space-x-6">
            <button onClick={() => navigate('/')} className="p-3 hover:bg-gray-100 rounded-2xl transition-all">
              <SafeIcon icon={FiArrowLeft} className="text-xl text-gray-600" />
            </button>
            <div className="flex items-center space-x-5">
              <div className="bg-blue-600 p-5 rounded-[2rem] text-white shadow-2xl shadow-blue-200">
                <SafeIcon icon={FiUser} className="text-4xl" />
              </div>
              <div className="text-left">
                <h1 className="text-4xl font-black text-gray-800 tracking-tight leading-none mb-2">{employee.name}</h1>
                <div className="flex items-center space-x-3">
                  <p className="text-gray-400 font-black uppercase text-xs tracking-[0.2em]">
                    {employee.position || 'No Position'} • {employee.department || 'No Dept'}
                  </p>
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isFullTime ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    <SafeIcon icon={FiBriefcase} className="inline mr-1" /> {employee.employee_type}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link to="/calculate" state={{ employee, isEditEmployee: true }} className="flex items-center space-x-2 bg-white border-2 border-orange-100 text-orange-600 px-6 py-3 rounded-2xl font-black hover:bg-orange-50 transition-all uppercase tracking-widest text-[10px]">
              <SafeIcon icon={FiEdit} /> <span>Edit Profile</span>
            </Link>
            <Link to="/calculate" state={{ employee }} className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-[10px]">
              <SafeIcon icon={FiCalculator} /> <span>Calculate Pay</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">Daily Salary</p>
            <p className="text-3xl font-black text-gray-800 tracking-tighter">{formatCurrency(employee.daily_salary)}</p>
          </div>
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Internal ID</p>
            <p className="text-xl font-black text-blue-900 font-mono">{employee.employee_id || 'N/A'}</p>
          </div>
          <div className="bg-green-50/50 p-6 rounded-3xl border border-green-100">
            <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] mb-2">Status</p>
            <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${employee.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="bg-purple-50/50 p-6 rounded-3xl border border-purple-100">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] mb-2">Liability</p>
            <p className="text-xl font-black text-purple-900 font-mono">{formatCurrency(pendingDeductions.reduce((s, d) => s + d.amount, 0))}</p>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-3 px-10 py-6 text-xs font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border-b-4 ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              <SafeIcon icon={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-8">
          {/* History Tab */}
          {activeTab === 'payslips' && (
            <div className="space-y-4">
              {payRecords.map(record => (
                <div key={record.id} className="p-6 border border-gray-100 rounded-3xl hover:shadow-lg transition-all flex flex-col md:flex-row justify-between items-center bg-gray-50/30 group">
                  <div className="flex items-center space-x-6 mb-4 md:mb-0">
                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                      <SafeIcon icon={FiCalendar} className="text-xl" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-800 text-xl tracking-tight">{record.pay_period}</p>
                      <div className="flex items-center space-x-1.5 text-gray-400 mt-1">
                        <SafeIcon icon={FiClock} className="text-[10px]" />
                        <span className="text-[9px] font-black uppercase tracking-wider">Processed: {format(parseISO(record.created_at), 'MMM dd, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link to={`/results/${record.id}`} state={{ employee, record }} className="px-5 py-3 bg-white text-gray-600 rounded-xl font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest text-[9px] border shadow-sm">
                      <SafeIcon icon={FiEye} className="inline mr-2" /> View
                    </Link>
                    <button onClick={() => navigate('/calculate', { state: { employee, payRecord: record, isEdit: true } })} className="px-5 py-3 bg-white text-orange-600 rounded-xl font-black hover:bg-orange-600 hover:text-white transition-all uppercase tracking-widest text-[9px] border shadow-sm">
                      <SafeIcon icon={FiEdit2} className="inline mr-2" /> Edit
                    </button>
                    <button onClick={() => handleDeleteRecord(record.id)} className="px-5 py-3 bg-white text-red-600 rounded-xl font-black hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest text-[9px] border shadow-sm">
                      <SafeIcon icon={FiTrash2} className="inline mr-2" /> Delete
                    </button>
                  </div>
                </div>
              ))}
              {payRecords.length === 0 && (
                <div className="text-center py-20 text-gray-300 font-black uppercase tracking-widest italic border-2 border-dashed rounded-[2rem]">No payroll history found</div>
              )}
            </div>
          )}

          {/* Deductions Tab */}
          {activeTab === 'deductions' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div className="text-left">
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Pending Deductions</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unprocessed Liabilities</p>
                </div>
                {!showAddDeduction && (
                  <button onClick={() => setShowAddDeduction(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px] flex items-center">
                    <SafeIcon icon={FiPlus} className="mr-2" /> Add New
                  </button>
                )}
              </div>

              {showAddDeduction && (
                <div className="bg-blue-50/50 p-8 rounded-[2rem] border-2 border-blue-100 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest">Log New Liability</h4>
                    <button onClick={() => setShowAddDeduction(false)} className="text-gray-400 hover:text-red-500"><SafeIcon icon={FiX} /></button>
                  </div>
                  <form onSubmit={handleAddDeduction} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                    <div>
                      <label className="block text-[8px] font-black text-blue-600 uppercase mb-2">Category</label>
                      <select value={newDeduction.category} onChange={e => setNewDeduction(p => ({ ...p, category: e.target.value }))} className="w-full p-3 border rounded-xl font-bold bg-white outline-none focus:ring-2 focus:ring-blue-500">
                        <option>Cash Advance</option>
                        <option>Loan</option>
                        <option>Food</option>
                        <option>Others</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-blue-600 uppercase mb-2">Amount (₱)</label>
                      <input type="number" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({ ...p, amount: e.target.value }))} className="w-full p-3 border rounded-xl font-bold bg-white" required />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-blue-600 uppercase mb-2">Notes / Reason</label>
                      <input type="text" value={newDeduction.notes} onChange={e => setNewDeduction(p => ({ ...p, notes: e.target.value }))} className="w-full p-3 border rounded-xl font-bold bg-white" placeholder="Optional..." />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:shadow-blue-200 transition-all">Commit Entry</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-hidden border border-gray-100 rounded-[2rem]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Reported</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Notes</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount Due</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingDeductions.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5 text-sm font-bold text-gray-600">{item.date}</td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${item.category === 'Food' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-xs text-gray-400 font-bold italic">{item.notes || '—'}</td>
                        <td className="px-8 py-5 text-right font-black text-red-600 font-mono">-{formatCurrency(item.amount)}</td>
                        <td className="px-8 py-5 text-center">
                          <button onClick={() => handleDeleteDeduction(item.id)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"><SafeIcon icon={FiTrash2} /></button>
                        </td>
                      </tr>
                    ))}
                    {pendingDeductions.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-20 text-center text-gray-300 font-black uppercase tracking-widest italic">No pending liabilities found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Statutory Tab */}
          {activeTab === 'contributions' && (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-gray-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><SafeIcon icon={FiShield} className="text-6xl" /></div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">SSS Network</p>
                  <p className="text-2xl font-black font-mono tracking-widest mb-2">{employee.sss_number || 'NOT LOGGED'}</p>
                  <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-4">
                    <span className="text-[9px] font-black uppercase opacity-60">Total Remitted:</span>
                    <span className="font-black text-blue-300">{formatCurrency(statsTotal.sss)}</span>
                  </div>
                </div>

                <div className="bg-gray-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><SafeIcon icon={FiTag} className="text-6xl" /></div>
                  <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.2em] mb-4">PhilHealth Hub</p>
                  <p className="text-2xl font-black font-mono tracking-widest mb-2">{employee.philhealth_number || 'NOT LOGGED'}</p>
                  <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-4">
                    <span className="text-[9px] font-black uppercase opacity-60">Total Remitted:</span>
                    <span className="font-black text-green-300">{formatCurrency(statsTotal.ph)}</span>
                  </div>
                </div>

                <div className="bg-gray-900 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform"><SafeIcon icon={FiBriefcase} className="text-6xl" /></div>
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-4">Pag-IBIG Fund</p>
                  <p className="text-2xl font-black font-mono tracking-widest mb-2">{employee.pagibig_number || 'NOT LOGGED'}</p>
                  <div className="flex justify-between items-center border-t border-white/10 pt-4 mt-4">
                    <span className="text-[9px] font-black uppercase opacity-60">Total Remitted:</span>
                    <span className="font-black text-orange-300">{formatCurrency(statsTotal.pi)}</span>
                  </div>
                </div>
              </div>

              {!isFullTime && (
                <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100 flex items-center justify-center space-x-3 text-orange-700">
                  <SafeIcon icon={FiInfo} className="text-xl" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Statutory Benefits are currently restricted for Temporary Personnel.</p>
                </div>
              )}

              <div className="text-left">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight mb-6">Contribution History</h3>
                <div className="overflow-hidden border border-gray-100 rounded-[2.5rem]">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pay Cycle</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">SSS</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">PhilHealth</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Pag-IBIG</th>
                        <th className="px-8 py-5 text-[10px] font-black text-gray-800 uppercase tracking-widest text-right bg-blue-50/50">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payRecords.map(record => {
                        const total = (Number(record.sss_contribution) || 0) + (Number(record.philhealth_contribution) || 0) + (Number(record.pagibig_contribution) || 0);
                        return (
                          <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-8 py-5 font-black text-gray-700 text-xs">{record.pay_period}</td>
                            <td className="px-8 py-5 text-right font-mono text-xs text-gray-500">{formatCurrency(record.sss_contribution)}</td>
                            <td className="px-8 py-5 text-right font-mono text-xs text-gray-500">{formatCurrency(record.philhealth_contribution)}</td>
                            <td className="px-8 py-5 text-right font-mono text-xs text-gray-500">{formatCurrency(record.pagibig_contribution)}</td>
                            <td className="px-8 py-5 text-right font-black text-blue-600 font-mono bg-blue-50/20">{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                      {payRecords.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-20 text-center text-gray-300 font-black uppercase tracking-widest italic">No contribution records found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 13th Month Tab */}
          {activeTab === '13thmonth' && (
            <div className="space-y-6">
              <div className="bg-green-600 p-8 rounded-[2.5rem] text-white flex justify-between items-center shadow-2xl shadow-green-100 mb-8">
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-[0.3em] opacity-80 mb-2">Total Earned to Date</p>
                  <h2 className="text-5xl font-black tracking-tighter">{formatCurrency(total13thMonth)}</h2>
                  <p className="mt-2 text-[9px] font-black uppercase tracking-widest opacity-60">* Includes Lates • Excludes Half-Days (Check-ins ≥ 12:00 PM)</p>
                </div>
                <div className="bg-white/20 p-6 rounded-3xl backdrop-blur-md">
                  <SafeIcon icon={FiGift} className="text-5xl" />
                </div>
              </div>

              <div className="bg-gray-50/50 rounded-3xl border border-gray-100 overflow-hidden text-left">
                <table className="w-full text-left">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pay Cycle & Timestamp</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Eligible Days</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Fund Accrual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payRecords.map(record => {
                      const dailyRate = employee.daily_salary || 1;
                      const eligibleDays = record.thirteenth_month_days !== undefined && record.thirteenth_month_days !== null 
                        ? Number(record.thirteenth_month_days) 
                        : Math.round((Number(record.thirteenth_month) * 12) / dailyRate);
                      return (
                        <tr key={record.id} className="hover:bg-white transition-colors">
                          <td className="px-8 py-5">
                            <p className="font-black text-gray-800 leading-tight">{record.pay_period}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-tighter flex items-center">
                              <SafeIcon icon={FiClock} className="mr-1 text-[8px]" /> {format(parseISO(record.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </td>
                          <td className="px-8 py-5 font-black text-gray-600 font-mono text-center">
                            {eligibleDays} Full Days
                          </td>
                          <td className="px-8 py-5 font-black text-right text-green-600 text-lg font-mono">
                            +{formatCurrency(record.thirteenth_month)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetail;