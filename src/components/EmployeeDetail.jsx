import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';

const { 
  FiUser, FiArrowLeft, FiCalculator, FiCalendar, FiTrendingDown, 
  FiShield, FiGift, FiList, FiEye, FiTrash2, FiClock, 
  FiEdit2, FiPlus, FiInfo, FiX, FiCheckCircle, FiActivity, FiUnlock 
} = FiIcons;

const EmployeeDetail = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { checkPermission } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [payRecords, setPayRecords] = useState([]);
  const [deductionHistory, setDeductionHistory] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activeTab, setActiveTab] = useState('payslips');
  const [loading, setLoading] = useState(true);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [newDeduction, setNewDeduction] = useState({
    category: 'Cash Advance',
    amount: '',
    notes: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (employeeId) loadData();
  }, [employeeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      const [emp, records, history, logs] = await Promise.all([
        employeeService.getEmployeeById(employeeId),
        employeeService.getPayRecords(employeeId, 1000),
        employeeService.getDeductionHistory(employeeId),
        employeeService.getAttendance(employeeId, start, end)
      ]);
      setEmployee(emp);
      setPayRecords(records);
      setDeductionHistory(history);
      setAttendance(logs);
    } catch (error) {
      console.error('Data loading error:', error);
      toast.error('Error synchronizing personnel history');
    } finally {
      setLoading(false);
    }
  };

  const financialSummary = useMemo(() => {
    return payRecords.reduce((acc, rec) => {
      acc.sss += Number(rec.sss_contribution || 0);
      acc.philhealth += Number(rec.philhealth_contribution || 0);
      acc.pagibig += Number(rec.pagibig_contribution || 0);
      acc.thirteenth += Number(rec.thirteenth_month || 0);
      return acc;
    }, { sss: 0, philhealth: 0, pagibig: 0, thirteenth: 0 });
  }, [payRecords]);

  // Updated: Sum only UNPROCESSED deductions to show active liability
  const pendingTotal = useMemo(() => {
    return deductionHistory
      .filter(d => !d.is_processed)
      .reduce((s, d) => s + Number(d.amount), 0);
  }, [deductionHistory]);

  const handleAddDeduction = async (e) => {
    e.preventDefault();
    if (!checkPermission('manage_payroll')) return toast.error('Access denied');
    try {
      await employeeService.createDeduction({
        employee_id: employeeId,
        ...newDeduction,
        amount: Number(newDeduction.amount)
      });
      toast.success('Liability logged successfully');
      setNewDeduction({ ...newDeduction, amount: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });
      setShowAddDeduction(false);
      loadData();
    } catch (error) {
      toast.error('Failed to commit entry');
    }
  };

  const handleToggleStatus = async (item) => {
    if (!checkPermission('manage_payroll')) return toast.error('Access denied');
    const newStatus = !item.is_processed;
    try {
      await employeeService.updateDeductionStatus(item.id, newStatus);
      toast.success(`Audit status updated to ${newStatus ? 'Processed' : 'Pending'}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update audit status');
    }
  };

  const handleDeleteDeduction = async (id) => {
    if (!checkPermission('manage_payroll')) return toast.error('Access denied');
    const password = window.prompt('Security Protocol: Enter Authorization Password to purge this record:');
    if (password === null) return;
    if (password !== 'Subic@123') {
      toast.error('Incorrect authorization credentials');
      return;
    }
    try {
      await employeeService.deleteDeduction(id);
      setDeductionHistory(prev => prev.filter(d => d.id !== id));
      toast.success('Record purged from ledger');
    } catch (err) {
      toast.error('Deletion protocol failed');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  };

  if (loading) return (
    <div className="py-20 text-center flex flex-col items-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Accessing Personnel Archives...</p>
    </div>
  );

  if (!employee) return (
    <div className="py-20 text-center">
      <SafeIcon icon={FiX} className="text-4xl text-red-500 mx-auto mb-4" />
      <p className="text-gray-800 font-black uppercase tracking-widest text-sm">Personnel Record Not Found</p>
      <button onClick={() => navigate('/')} className="mt-6 text-blue-600 font-black uppercase tracking-widest text-[10px] underline">Return To Roster</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 text-left">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <SafeIcon icon={FiShield} className="text-[15rem]" />
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
          <div className="flex items-center space-x-8">
            <button onClick={() => navigate('/')} className="p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all group">
              <SafeIcon icon={FiArrowLeft} className="text-2xl text-gray-400 group-hover:text-blue-600" />
            </button>
            <div className="flex items-center space-x-6">
              <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-blue-100">
                <SafeIcon icon={FiUser} className="text-5xl" />
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-black text-gray-800 tracking-tighter leading-none mb-3 uppercase">{employee.name}</h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{employee.position}</span>
                  <span className="bg-gray-100 text-gray-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">ID: {employee.employee_id || 'N/A'}</span>
                  <span className="flex items-center text-[10px] font-black text-green-500 uppercase tracking-widest ml-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                    {employee.is_active ? 'Active Roster' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link to="/calculate" state={{ employee, isEditEmployee: true }} className="bg-white border-2 border-gray-100 text-gray-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all shadow-sm">Edit Profile</Link>
            <Link to="/calculate" state={{ employee }} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all">Process Payroll</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
          <div className="bg-gray-50/80 p-8 rounded-[2rem] border border-gray-100">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Daily Pay Rate</p>
            <p className="text-3xl font-black text-gray-800 tracking-tighter">{formatCurrency(employee.daily_salary)}</p>
          </div>
          <div className="bg-purple-50/50 p-8 rounded-[2rem] border border-purple-100">
            <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-3">Liability Balance</p>
            <p className="text-3xl font-black text-purple-900 tracking-tighter">{formatCurrency(pendingTotal)}</p>
          </div>
          <div className="bg-green-50/50 p-8 rounded-[2rem] border border-green-100">
            <p className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-3">13th Month Accrued</p>
            <p className="text-3xl font-black text-green-900 tracking-tighter">{formatCurrency(financialSummary.thirteenth)}</p>
          </div>
          <div className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">Total Stat. Remitted</p>
            <p className="text-3xl font-black text-blue-900 tracking-tighter">{formatCurrency(financialSummary.sss + financialSummary.philhealth + financialSummary.pagibig)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden min-h-[500px] border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar bg-gray-50/30">
          {[
            { id: 'payslips', label: 'Cycle History', icon: FiList },
            { id: 'attendance', label: 'Activity Logs', icon: FiActivity },
            { id: 'deductions', label: 'Liabilities', icon: FiTrendingDown },
            { id: 'statutory', label: 'Contributions', icon: FiShield },
            { id: 'thirteenth', label: '13th Month', icon: FiGift },
            { id: 'info', label: 'Personnel Info', icon: FiInfo }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-8 py-7 text-[10px] font-black uppercase tracking-[0.2em] border-b-4 whitespace-nowrap transition-all flex items-center space-x-3 ${activeTab === tab.id ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <SafeIcon icon={tab.icon} className="text-sm" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-10">
          {activeTab === 'deductions' && (
            <div className="space-y-8 text-left">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Liability Checklist</h3>
                <button onClick={() => setShowAddDeduction(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all">+ Log New Debt</button>
              </div>

              {showAddDeduction && (
                <div className="bg-blue-50/50 p-10 rounded-[2.5rem] border-2 border-blue-100 shadow-inner mb-10">
                  <form onSubmit={handleAddDeduction} className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="md:col-span-1 text-left">
                      <label className="block text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">Category</label>
                      <select value={newDeduction.category} onChange={e => setNewDeduction(p => ({ ...p, category: e.target.value }))} className="w-full p-4 border-2 border-white rounded-2xl font-black bg-white outline-none focus:border-blue-500 transition-all">
                        <option>Cash Advance</option><option>Loan</option><option>Food</option><option>Others</option>
                      </select>
                    </div>
                    <div className="text-left">
                      <label className="block text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">Date</label>
                      <input type="date" value={newDeduction.date} onChange={e => setNewDeduction(p => ({ ...p, date: e.target.value }))} className="w-full p-4 border-2 border-white rounded-2xl font-black outline-none focus:border-blue-500" required />
                    </div>
                    <div className="text-left">
                      <label className="block text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">Amount (PHP)</label>
                      <input type="number" value={newDeduction.amount} onChange={e => setNewDeduction(p => ({ ...p, amount: e.target.value }))} className="w-full p-4 border-2 border-white rounded-2xl font-black outline-none focus:border-blue-500" required />
                    </div>
                    <div className="md:col-span-1 text-left">
                      <label className="block text-[10px] font-black text-blue-600 uppercase mb-3 tracking-widest">Notes</label>
                      <input type="text" value={newDeduction.notes} onChange={e => setNewDeduction(p => ({ ...p, notes: e.target.value }))} className="w-full p-4 border-2 border-white rounded-2xl font-black outline-none focus:border-blue-500" placeholder="Optional notes..." />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Commit Entry</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="overflow-hidden border border-gray-100 rounded-[2.5rem]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Registered Amount</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Audit Status</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-black">
                    {deductionHistory.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-10 py-6 font-black text-gray-600 text-sm font-mono">{format(parseISO(item.date), 'MMM dd, yyyy')}</td>
                        <td className="px-10 py-6 font-black text-xs uppercase tracking-tight text-gray-800">{item.category}</td>
                        <td className={`px-10 py-6 text-right font-mono font-black ${item.is_processed ? 'text-gray-400' : 'text-red-600'}`}>{formatCurrency(item.amount)}</td>
                        <td className="px-10 py-6 text-center">
                          <button onClick={() => handleToggleStatus(item)} className={`inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${item.is_processed ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'}`} >
                            <SafeIcon icon={item.is_processed ? FiCheckCircle : FiUnlock} className="mr-1.5" />
                            {item.is_processed ? 'Processed' : 'Mark as Processed'}
                          </button>
                        </td>
                        <td className="px-10 py-6 text-center">
                          <button onClick={() => handleDeleteDeduction(item.id)} className="p-3 text-red-400 hover:bg-red-50 rounded-2xl transition-all"><SafeIcon icon={FiTrash2} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'payslips' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Payroll Archives</h3>
                <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-5 py-2.5 rounded-full border border-gray-100 tracking-widest">Records: {payRecords.length}</span>
              </div>
              <div className="space-y-4">
                {payRecords.map(record => (
                  <div key={record.id} className="p-7 border border-gray-100 rounded-[2rem] hover:shadow-2xl hover:border-blue-100 transition-all flex justify-between items-center bg-gray-50/30 group">
                    <div className="flex items-center space-x-6 text-left">
                      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all"><SafeIcon icon={FiCalendar} className="text-xl" /></div>
                      <div>
                        <p className="font-black text-gray-800 text-xl tracking-tight">{record.pay_period}</p>
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Released: {format(parseISO(record.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-8">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Payout</p>
                        <p className={`text-xl font-black ${record.net_pay < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(record.net_pay)}</p>
                      </div>
                      <Link to={`/results/${record.id}`} state={{ employee, record }} className="px-8 py-4 bg-white text-gray-600 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest text-[9px] border shadow-sm">View Payslip</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Operational Logs</h3>
                <Link to="/attendance" className="bg-blue-50 text-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all">Full Monitor</Link>
              </div>
              <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Log Date</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Stamp</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Clock In / Out</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Lost Minutes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-black">
                    {attendance.map(log => (
                      <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-10 py-6 text-gray-800 text-sm tracking-tight font-mono">{format(parseISO(log.date), 'MMMM dd, yyyy')}</td>
                        <td className="px-10 py-6">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${log.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : log.status === 'absent' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-10 py-6 text-center font-mono text-xs text-gray-400 tracking-widest">{log.check_in_time?.slice(0, 5) || '--:--'} — {log.check_out_time?.slice(0, 5) || '--:--'}</td>
                        <td className={`px-10 py-6 text-right font-mono text-sm ${log.late_minutes + log.undertime_minutes > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                          {log.late_minutes + log.undertime_minutes}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'statutory' && (
            <div className="p-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Statutory Contributions</h3>
                <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-5 py-2.5 rounded-full border border-gray-100 tracking-widest">Records: {payRecords.length}</span>
              </div>
              <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pay Period</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">SSS</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">PhilHealth</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Pag-IBIG</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-black">
                    {payRecords.map((rec, i) => {
                      const sss = Number(rec.sss_contribution || 0);
                      const ph = Number(rec.philhealth_contribution || 0);
                      const pi = Number(rec.pagibig_contribution || 0);
                      const total = sss + ph + pi;
                      return (
                        <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                          <td className="px-10 py-6 text-gray-800 text-sm tracking-tight font-mono uppercase">{rec.pay_period}</td>
                          <td className="px-10 py-6 text-right font-mono text-sm text-gray-500">{formatCurrency(sss)}</td>
                          <td className="px-10 py-6 text-right font-mono text-sm text-gray-500">{formatCurrency(ph)}</td>
                          <td className="px-10 py-6 text-right font-mono text-sm text-gray-500">{formatCurrency(pi)}</td>
                          <td className={`px-10 py-6 text-right font-mono text-sm ${total > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{formatCurrency(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                    <tr>
                      <td className="px-10 py-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Total Contributions</td>
                      <td className="px-10 py-6 text-right font-black font-mono text-sm text-gray-700">{formatCurrency(financialSummary.sss)}</td>
                      <td className="px-10 py-6 text-right font-black font-mono text-sm text-gray-700">{formatCurrency(financialSummary.philhealth)}</td>
                      <td className="px-10 py-6 text-right font-black font-mono text-sm text-gray-700">{formatCurrency(financialSummary.pagibig)}</td>
                      <td className="px-10 py-6 text-right font-black font-mono text-sm text-blue-700">{formatCurrency(financialSummary.sss + financialSummary.philhealth + financialSummary.pagibig)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'thirteenth' && (
            <div className="p-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">13th Month Accrual</h3>
                <span className="text-[10px] font-black text-green-600 uppercase bg-green-50 px-5 py-2.5 rounded-full border border-green-100 tracking-widest">{formatCurrency(financialSummary.thirteenth)} Accrued</span>
              </div>
              <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pay Period</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Days Counted</th>
                      <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-black">
                    {payRecords.filter(rec => Number(rec.thirteenth_month || 0) > 0).map((rec, i) => (
                      <tr key={i} className="hover:bg-green-50/20 transition-colors">
                        <td className="px-10 py-6 text-gray-800 text-sm tracking-tight font-mono uppercase">{rec.pay_period}</td>
                        <td className="px-10 py-6 text-center font-mono text-sm text-gray-500">{rec.thirteenth_month_days || 0}</td>
                        <td className="px-10 py-6 text-right font-mono text-sm text-green-600">{formatCurrency(Number(rec.thirteenth_month || 0))}</td>
                      </tr>
                    ))}
                    {payRecords.filter(rec => Number(rec.thirteenth_month || 0) > 0).length === 0 && (
                      <tr><td colSpan="3" className="px-10 py-10 text-center text-gray-400 text-sm font-black uppercase tracking-widest">No 13th month records yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="p-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Personnel Information</h3>
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${employee?.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{employee?.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-gray-50 font-black">
                    {[
                      { label: 'Employee ID', value: employee?.employee_id },
                      { label: 'Full Name', value: employee?.name },
                      { label: 'Department', value: employee?.department },
                      { label: 'Position', value: employee?.position },
                      { label: 'Employee Type', value: employee?.employee_type },
                      { label: 'Daily Salary', value: employee?.daily_salary ? formatCurrency(employee.daily_salary) : '—' },
                      { label: 'TIN Number', value: employee?.tin_number || '—' },
                      { label: 'SSS Number', value: employee?.sss_number || '—' },
                      { label: 'PhilHealth Number', value: employee?.philhealth_number || '—' },
                      { label: 'Pag-IBIG Number', value: employee?.pagibig_number || '—' },
                      { label: 'Bank Account', value: employee?.bank_account || '—' },
                      { label: 'Notes', value: employee?.notes || '—' },
                    ].map((item, i) => (
                      <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                        <td className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/3">{item.label}</td>
                        <td className="px-10 py-6 text-gray-800 text-sm font-black tracking-tight">{item.value || '—'}</td>
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