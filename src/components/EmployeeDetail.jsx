import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';

const { 
  FiUser, 
  FiArrowLeft, 
  FiEdit, 
  FiCalculator, 
  FiCalendar, 
  FiTrendingDown, 
  FiShield, 
  FiGift, 
  FiList, 
  FiEye, 
  FiTrash2, 
  FiClock, 
  FiEdit2, 
  FiBriefcase,
  FiPlus,
  FiHash
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

  // Quick Deduction Form State
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
    if (!window.confirm('Remove this pending deduction?')) return;
    try {
      await employeeService.deleteDeduction(id);
      setPendingDeductions( prev => prev.filter(d => d.id !== id));
      toast.success('Deduction removed');
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleDeleteRecord = async (id) => {
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

  const tabs = [
    { id: 'payslips', label: 'History', icon: FiList },
    { id: 'deductions', label: 'Deductions', icon: FiTrendingDown },
    { id: 'contributions', label: 'Statutory', icon: FiShield },
    ...(isFullTime ? [{ id: '13thmonth', label: '13th Month', icon: FiGift }] : []),
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 text-left">
      {/* Profile Header */}
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
              <SafeIcon icon={FiEdit} />
              <span>Edit Profile</span>
            </Link>
            <Link to="/calculate" state={{ employee }} className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase tracking-widest text-[10px]">
              <SafeIcon icon={FiCalculator} />
              <span>Calculate Pay</span>
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

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-3 px-10 py-6 text-xs font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap border-b-4 ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600 bg-blue-50/30' 
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <SafeIcon icon={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-8">
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

          {activeTab === 'deductions' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Pending Deductions Ledger</h3>
                <button 
                  onClick={() => setShowAddDeduction(!showAddDeduction)}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-blue-700 transition-all"
                >
                  <SafeIcon icon={showAddDeduction ? FiIcons.FiX : FiPlus} />
                  <span>{showAddDeduction ? 'Close Form' : 'Add Deduction'}</span>
                </button>
              </div>

              {showAddDeduction && (
                <form onSubmit={handleAddDeduction} className="bg-gray-50 p-6 rounded-3xl border-2 border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-4">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Category</label>
                    <select 
                      value={newDeduction.category} 
                      onChange={e => setNewDeduction({...newDeduction, category: e.target.value})}
                      className="w-full p-2.5 border rounded-xl font-black text-xs uppercase"
                    >
                      <option value="Cash Advance">Cash Advance</option>
                      <option value="Loan">Loan</option>
                      <option value="Food">Food (Ednas)</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Amount (₱)</label>
                    <input 
                      type="number" 
                      value={newDeduction.amount} 
                      onChange={e => setNewDeduction({...newDeduction, amount: e.target.value})}
                      className="w-full p-2.5 border rounded-xl font-black text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-1">Notes / Remarks</label>
                    <input 
                      type="text" 
                      value={newDeduction.notes} 
                      onChange={e => setNewDeduction({...newDeduction, notes: e.target.value})}
                      className="w-full p-2.5 border rounded-xl font-bold text-xs"
                      placeholder="e.g. SSS Loan Pmt"
                    />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-blue-100">
                      Commit Entry
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Entry Date</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pendingDeductions.map(ded => (
                      <tr key={ded.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-6 py-4 font-black text-xs text-gray-800">{format(parseISO(ded.date), 'MMM dd, yyyy')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${
                            ded.category === 'Food' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {ded.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-500 italic">{ded.notes || '—'}</td>
                        <td className="px-6 py-4 text-right font-black text-red-600">{formatCurrency(ded.amount)}</td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => handleDeleteDeduction(ded.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
                            <SafeIcon icon={FiTrash2} />
                          </button>
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

          {activeTab === 'contributions' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-blue-600 p-2 rounded-lg text-white"><SafeIcon icon={FiHash} /></div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">SSS Number</p>
                  </div>
                  <p className="text-xl font-black text-gray-800 font-mono tracking-tighter">{employee.sss_number || 'NOT SET'}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-600 p-2 rounded-lg text-white"><SafeIcon icon={FiHash} /></div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PhilHealth ID</p>
                  </div>
                  <p className="text-xl font-black text-gray-800 font-mono tracking-tighter">{employee.philhealth_number || 'NOT SET'}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-orange-600 p-2 rounded-lg text-white"><SafeIcon icon={FiHash} /></div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pag-IBIG Number</p>
                  </div>
                  <p className="text-xl font-black text-gray-800 font-mono tracking-tighter">{employee.pagibig_number || 'NOT SET'}</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                <div className="p-6 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest">Contribution History Ledger</h3>
                  <div className="bg-blue-600 text-white px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Total: {formatCurrency(payRecords.reduce((s, r) => s + (r.sss_contribution || 0) + (r.philhealth_contribution || 0) + (r.pagibig_contribution || 0), 0))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Pay Period</th>
                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">SSS</th>
                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">PhilHealth</th>
                        <th className="px-8 py-5 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Pag-IBIG</th>
                        <th className="px-8 py-5 text-[9px] font-black text-gray-800 uppercase tracking-widest text-right">Total Stat.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-black">
                      {payRecords.map(record => {
                        const sss = record.sss_contribution || 0;
                        const ph = record.philhealth_contribution || 0;
                        const pi = record.pagibig_contribution || 0;
                        if (sss + ph + pi === 0) return null;
                        return (
                          <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-8 py-5 text-xs text-gray-800">{record.pay_period}</td>
                            <td className="px-8 py-5 text-right text-gray-500 font-mono text-xs">{formatCurrency(sss)}</td>
                            <td className="px-8 py-5 text-right text-gray-500 font-mono text-xs">{formatCurrency(ph)}</td>
                            <td className="px-8 py-5 text-right text-gray-500 font-mono text-xs">{formatCurrency(pi)}</td>
                            <td className="px-8 py-5 text-right text-blue-800 font-mono text-xs bg-blue-50/20">{formatCurrency(sss + ph + pi)}</td>
                          </tr>
                        );
                      })}
                      {payRecords.filter(r => (r.sss_contribution || 0) + (r.philhealth_contribution || 0) + (r.pagibig_contribution || 0) > 0).length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-20 text-center text-gray-300 font-black uppercase tracking-widest italic">No statutory contributions recorded yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                    {payRecords.map(record => (
                      <tr key={record.id} className="hover:bg-white transition-colors">
                        <td className="px-8 py-5">
                          <p className="font-black text-gray-800 leading-tight">{record.pay_period}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 tracking-tighter flex items-center">
                            <SafeIcon icon={FiClock} className="mr-1 text-[8px]" /> {format(parseISO(record.created_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                        </td>
                        <td className="px-8 py-5 font-black text-gray-600 font-mono text-center">
                          {Math.floor(record.days_present)} Full Days
                        </td>
                        <td className="px-8 py-5 font-black text-right text-green-600 text-lg font-mono">
                          +{formatCurrency(record.thirteenth_month)}
                        </td>
                      </tr>
                    ))}
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