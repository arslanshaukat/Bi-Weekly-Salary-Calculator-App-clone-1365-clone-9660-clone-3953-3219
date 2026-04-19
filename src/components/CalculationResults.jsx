import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isSunday } from 'date-fns';

const { FiFilter, FiCheckSquare, FiSquare, FiPrinter, FiSearch, FiEye, FiTrash2, FiEdit2, FiClock, FiShield, FiSun, FiSunrise, FiAlertTriangle } = FiIcons;

const CalculationResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { checkPermission } = useAuth();
  const [allRecords, setAllRecords] = useState([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const recordData = await employeeService.getPayRecordsWithEmployees(200);
      setAllRecords(recordData);
      if (location.state?.employee?.id) {
        setSelectedEmpIds([location.state.employee.id]);
      }
    } catch (error) {
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return allRecords.filter(record => {
      const matchEmployee = selectedEmpIds.length === 0 || selectedEmpIds.includes(record.employee_id);
      const employeeName = record.employees?.name || '';
      const matchSearch = !searchTerm || record.pay_period.toLowerCase().includes(searchTerm.toLowerCase()) || employeeName.toLowerCase().includes(searchTerm.toLowerCase());
      let matchDate = true;
      if (startDate && endDate) {
        const recordDate = parseISO(record.start_date);
        matchDate = isWithinInterval(recordDate, { start: startOfDay(parseISO(startDate)), end: endOfDay(parseISO(endDate)) });
      }
      return matchEmployee && matchSearch && matchDate;
    });
  }, [allRecords, selectedEmpIds, searchTerm, startDate, endDate]);

  const toggleRecordSelection = (id) => {
    setSelectedRecordIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAllFiltered = () => {
    if (selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(filteredRecords.map(r => r.id));
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!checkPermission('delete_payroll')) return toast.error('Access denied');
    if (!window.confirm('Are you sure you want to delete this payroll record?')) return;
    try {
      await employeeService.deletePayRecord(id);
      setAllRecords(prev => prev.filter(r => r.id !== id));
      setSelectedRecordIds(prev => prev.filter(i => i !== id));
      toast.success('Record deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleBulkDelete = async () => {
    if (!checkPermission('delete_payroll')) return toast.error('Access denied');
    const password = window.prompt(`Security Alert: You are about to purge ${selectedRecordIds.length} records. Please enter authorization password:`);
    if (password !== 'Subic@123') return toast.error('Unauthorized bulk deletion attempt');

    setLoading(true);
    try {
      await Promise.all(selectedRecordIds.map(id => employeeService.deletePayRecord(id)));
      setAllRecords(prev => prev.filter(r => !selectedRecordIds.includes(r.id)));
      setSelectedRecordIds([]);
      toast.success(`Successfully purged ${selectedRecordIds.length} records`);
    } catch (error) {
      toast.error('Bulk deletion failed partially');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  };

  // SYNCED CALCULATION LOGIC: Earnings - Deductions
  const calculateNetPay = (record) => {
    const totalEarnings = 
      Number(record.basic_salary || 0) + 
      Number(record.overtime_pay || 0) + 
      Number(record.reg_holiday_pay || 0) + 
      Number(record.spec_holiday_pay || 0) + 
      Number(record.allowances || 0);

    const totalDeductions = 
      Number(record.late_deduction || 0) + 
      Number(record.undertime_deduction || 0) + 
      Number(record.sss_contribution || 0) + 
      Number(record.philhealth_contribution || 0) + 
      Number(record.pagibig_contribution || 0) + 
      (record.applied_deductions || []).reduce((sum, d) => sum + Number(d.amount), 0) + 
      Number(record.other_deductions || 0);

    return totalEarnings - totalDeductions;
  };

  const renderPayslipContent = (record, copyType) => {
    const dailyRate = record.employees?.daily_salary || 0;
    const isFullTime = record.employees?.employee_type === 'Full Time';
    const start = parseISO(record.start_date);
    const end = parseISO(record.end_date);
    const expectedDays = eachDayOfInterval({ start, end }).filter(day => !isSunday(day)).length;
    const expectedSalary = expectedDays * dailyRate;

    const daysPresent = Number(record.days_present || 0);
    const missedDays = Math.max(0, expectedDays - Math.ceil(daysPresent));
    const absenceDeduction = missedDays * dailyRate;

    const halfDays = (Math.ceil(daysPresent) - daysPresent) / 0.5;
    const fullDays = Math.floor(daysPresent);
    
    const appliedItems = record.applied_deductions || [];
    
    // Forensic Sync for Print
    const totalEarnings = Number(record.basic_salary || 0) + Number(record.overtime_pay || 0) + Number(record.reg_holiday_pay || 0) + Number(record.spec_holiday_pay || 0) + Number(record.allowances || 0);
    const totalDeductions = Number(record.late_deduction || 0) + Number(record.undertime_deduction || 0) + Number(record.sss_contribution || 0) + Number(record.philhealth_contribution || 0) + Number(record.pagibig_contribution || 0) + appliedItems.reduce((s, d) => s + d.amount, 0) + Number(record.other_deductions || 0);
    const finalNetPay = totalEarnings - totalDeductions;

    return (
      <div className="payslip-print-block">
        <div className="copy-label">{copyType}</div>
        <div className="text-center mb-1.5 border-b-2 border-black pb-1">
          <h1 className="text-xl font-black uppercase tracking-tight">GT International</h1>
          <p className="text-[8px] font-bold tracking-[0.2em] uppercase">Official Payroll Ledger • Cycle Audit</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2 pb-1 border-b border-gray-300 text-left">
          <div>
            <p className="text-[9px] font-black uppercase text-gray-500">Personnel</p>
            <p className="text-sm font-black uppercase leading-tight">{record.employees?.name}</p>
            <p className="text-[8px] font-bold text-gray-600 uppercase italic leading-tight">
              {record.employees?.position} • ₱{dailyRate}/day
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase text-gray-500">Pay Period</p>
            <p className="text-xs font-black text-blue-800 leading-tight">{record.pay_period}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-[10px] mb-2 flex-grow">
          <div className="space-y-0.5 text-left">
            <h4 className="font-black border-b-2 border-gray-800 pb-0.5 uppercase text-blue-800 text-[10px] mb-1">Earnings Blueprint</h4>
            <div className="flex justify-between font-black text-gray-800 bg-gray-50 px-1 py-0.5 mb-1">
              <span>Expected Period Pay:</span>
              <span>{formatCurrency(expectedSalary)}</span>
            </div>
            {missedDays > 0 && (
              <div className="flex justify-between text-red-600 font-bold border-b border-red-50 pb-0.5">
                <span>Absence Deduction ({missedDays}d):</span>
                <span>-{formatCurrency(absenceDeduction)}</span>
              </div>
            )}
            
            <div className="opacity-60 italic text-[9px] border-b border-gray-100 mb-1">
              <div className="flex justify-between"><span>Full Days Weight:</span><span>{fullDays}</span></div>
              <div className="flex justify-between"><span>Half Days Weight:</span><span>{halfDays}</span></div>
            </div>

            <div className="flex justify-between pt-1 font-black">
              <span>Basic Salary Earned:</span>
              <span>{formatCurrency(record.basic_salary)}</span>
            </div>
            {record.overtime_pay > 0 && <div className="flex justify-between text-blue-600"><span>Overtime Pay:</span><span>+{formatCurrency(record.overtime_pay)}</span></div>}
            {record.allowances > 0 && <div className="flex justify-between text-green-700"><span>Allowances:</span><span>+{formatCurrency(record.allowances)}</span></div>}
            
            <div className="flex justify-between border-t-2 border-black pt-1 font-black text-[11px] mt-2 bg-gray-50 px-1">
              <span>GROSS TOTAL</span>
              <span>{formatCurrency(totalEarnings)}</span>
            </div>
          </div>

          <div className="space-y-0.5 text-left">
            <h4 className="font-black border-b-2 border-gray-800 pb-0.5 uppercase text-red-800 text-[10px] mb-1">Deductions Audit</h4>
            {record.late_deduction > 0 && <div className="flex justify-between text-orange-600"><span>Attendance Penalties:</span><span>-{formatCurrency(Number(record.late_deduction) + Number(record.undertime_deduction))}</span></div>}
            {isFullTime && (
              <div className="space-y-0.5">
                {record.sss_contribution > 0 && <div className="flex justify-between"><span>SSS:</span><span>-{formatCurrency(record.sss_contribution)}</span></div>}
                {record.philhealth_contribution > 0 && <div className="flex justify-between"><span>PhilHealth:</span><span>-{formatCurrency(record.philhealth_contribution)}</span></div>}
                {record.pagibig_contribution > 0 && <div className="flex justify-between"><span>Pag-IBIG:</span><span>-{formatCurrency(record.pagibig_contribution)}</span></div>}
              </div>
            )}
            {appliedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-red-600 italic">
                <span>Debt: {item.category}:</span>
                <span>-{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {record.other_deductions > 0 && <div className="flex justify-between"><span>Misc:</span><span>-{formatCurrency(record.other_deductions)}</span></div>}
            <div className="flex justify-between border-t-2 border-black pt-1 font-black text-[11px] mt-auto uppercase bg-gray-50 px-1">
              <span>DEDUCTIONS TOTAL</span>
              <span>{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        <div className={`bg-gray-900 text-white border border-black p-2 mt-auto text-center ${finalNetPay < 0 ? 'bg-red-900' : ''}`}>
          <div className="flex justify-between items-center px-4">
            <span className="text-[10px] font-black uppercase text-left tracking-widest">{finalNetPay < 0 ? 'Balance / Debt:' : 'Net Take Home:'}</span>
            <span className="text-xl font-black">{formatCurrency(finalNetPay)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mt-6 mb-1">
          <div className="border-t border-black pt-1 text-center text-[7px] font-black uppercase">Employee Signature</div>
          <div className="border-t border-black pt-1 text-center text-[7px] font-black uppercase tracking-widest">Authorized Auditor</div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Archives...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 text-left">
      <div className="bg-white rounded-3xl shadow-xl p-8 no-print border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg"><SafeIcon icon={FiPrinter} className="text-white text-2xl" /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 uppercase">Payroll Archive</h1>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Bulk Print & Cycle History</p>
            </div>
          </div>
          <div className="flex space-x-3">
            {selectedRecordIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black shadow-sm hover:bg-red-100 transition-all uppercase tracking-widest text-[10px] flex items-center space-x-2"
              >
                <SafeIcon icon={FiTrash2} />
                <span>Delete Selected ({selectedRecordIds.length})</span>
              </button>
            )}
            <button 
              onClick={() => window.print()} 
              disabled={selectedRecordIds.length === 0}
              className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center space-x-2 uppercase tracking-widest text-[10px]"
            >
              <SafeIcon icon={FiPrinter} />
              <span>Print Selected ({selectedRecordIds.length})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-3xl border border-gray-100">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Search Personnel</label>
            <input 
              type="text" 
              placeholder="Filter by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">From</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">To</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden no-print border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4 w-12 text-center">
                <button onClick={selectAllFiltered} className="text-blue-600">
                  <SafeIcon icon={selectedRecordIds.length === filteredRecords.length && filteredRecords.length > 0 ? FiCheckSquare : FiSquare} className="text-xl" />
                </button>
              </th>
              <th className="px-6 py-4">Recipient</th>
              <th className="px-6 py-4">Pay Period</th>
              <th className="px-6 py-4">Processed On</th>
              <th className="px-6 py-4 text-right">Net Payout</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRecords.map(record => {
              const forensicNetPay = calculateNetPay(record);
              return (
                <tr key={record.id} className={`hover:bg-blue-50/30 transition-colors ${selectedRecordIds.includes(record.id) ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => toggleRecordSelection(record.id)} className="text-blue-600">
                      <SafeIcon icon={selectedRecordIds.includes(record.id) ? FiCheckSquare : FiSquare} className="text-xl" />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-black text-gray-800 uppercase tracking-tight">{record.employees?.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{record.employees?.position}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-blue-700 uppercase tracking-tight">{record.pay_period}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1.5 text-gray-400">
                      <SafeIcon icon={FiClock} className="text-[10px]" />
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {record.created_at ? format(parseISO(record.created_at), 'MMM dd, yyyy HH:mm') : '—'}
                      </span>
                    </div>
                  </td>
                  <td className={`px-6 py-4 text-right font-mono font-black ${forensicNetPay < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(forensicNetPay)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => navigate(`/results/${record.id}`)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title="View Details"><SafeIcon icon={FiEye} /></button>
                      <button onClick={() => navigate('/calculate', { state: { employee: record.employees, payRecord: record, isEdit: true }})} className="p-2 text-orange-500 hover:bg-orange-100 rounded-lg" title="Edit Record"><SafeIcon icon={FiEdit2} /></button>
                      <button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg" title="Delete Record"><SafeIcon icon={FiTrash2} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="print-only">
        {selectedRecordIds.map((recordId, index) => {
          const record = allRecords.find(r => r.id === recordId);
          if (!record) return null;
          return (
            <div key={recordId} className={`payslip-page-container ${index > 0 ? 'page-break-before' : ''}`}>
              {renderPayslipContent(record, 'Employee Copy')}
              {renderPayslipContent(record, 'Company Copy')}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalculationResults;