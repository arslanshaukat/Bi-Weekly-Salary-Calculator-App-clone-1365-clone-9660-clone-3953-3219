import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, isSunday } from 'date-fns';

const { FiFilter, FiCheckSquare, FiSquare, FiPrinter, FiSearch, FiEye, FiTrash2, FiEdit2 } = FiIcons;

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
        matchDate = isWithinInterval(recordDate, {
          start: startOfDay(parseISO(startDate)),
          end: endOfDay(parseISO(endDate))
        });
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  const renderPayslipContent = (record, copyType) => {
    const dailyRate = record.employees?.daily_salary || 0;
    const isFullTime = record.employees?.employee_type === 'Full Time';
    const start = parseISO(record.start_date);
    const end = parseISO(record.end_date);
    const daysInInterval = eachDayOfInterval({ start, end });
    const expectedDays = daysInInterval.filter(day => !isSunday(day)).length;
    const potentialSalary = expectedDays * dailyRate;
    const daysPresent = Number(record.days_present || 0);
    const fullDaysAbsent = Math.floor(expectedDays - daysPresent);
    const hasHalfDay = (daysPresent % 1 !== 0);
    const halfDayDeduction = hasHalfDay ? (dailyRate * 0.5) : 0;
    const absenceDeduction = fullDaysAbsent * dailyRate;

    const statutoryTotal = isFullTime ? (
      (record.sss_contribution || 0) +
      (record.philhealth_contribution || 0) +
      (record.pagibig_contribution || 0)
    ) : 0;

    const totalDeductions = statutoryTotal +
      (record.cash_advance || 0) +
      (record.food_allowance || 0) +
      (record.other_deductions || 0) +
      (record.late_deduction || 0) +
      (record.undertime_deduction || 0);

    const lateUTHours = ((Number(record.late_minutes || 0) + Number(record.undertime_minutes || 0)) / 60).toFixed(2);
    const otHours = Number(record.overtime_hours || 0).toFixed(2);
    
    // Derived Holiday Counts
    const regHolidayDays = Math.round((Number(record.reg_holiday_pay || 0) / (dailyRate || 1)) * 10) / 10;
    const specHolidayDays = Math.round((Number(record.spec_holiday_pay || 0) / ((dailyRate * 0.3) || 1)) * 10) / 10;

    return (
      <div className="payslip-print-block">
        <div className="copy-label">{copyType}</div>
        <div className="text-center mb-1.5 border-b-2 border-black pb-1">
          <h1 className="text-xl font-black uppercase tracking-tight">GT International</h1>
          <p className="text-[8px] font-bold tracking-[0.2em] uppercase">Official Payroll Ledger</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2 pb-1 border-b border-gray-300 text-left">
          <div className="text-left">
            <p className="text-[10px] font-black uppercase text-gray-500">Employee Details</p>
            <p className="text-sm font-black uppercase leading-tight">{record.employees?.name}</p>
            <p className="text-[9px] font-bold text-gray-600 uppercase italic leading-tight">
              {record.employees?.position} • ₱{dailyRate}/day • {record.employees?.employee_type}
            </p>
          </div>
          <div className="text-right text-right">
            <p className="text-[10px] font-black uppercase text-gray-500">Pay Period</p>
            <p className="text-xs font-black text-blue-800 leading-tight">{record.pay_period}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-[10px] mb-2 flex-grow">
          <div className="space-y-0.5 text-left">
            <h4 className="font-black border-b-2 border-gray-800 pb-0.5 uppercase text-blue-800 text-[11px]">Earnings Breakdown</h4>
            <div className="flex justify-between font-bold">
              <span>Expected Salary ({expectedDays}d):</span>
              <span>{formatCurrency(potentialSalary)}</span>
            </div>
            {fullDaysAbsent > 0 && (
              <div className="flex justify-between text-red-600 italic">
                <span>Absence ({fullDaysAbsent}d):</span>
                <span>-{formatCurrency(absenceDeduction)}</span>
              </div>
            )}
            {hasHalfDay && (
              <div className="flex justify-between text-orange-600 italic">
                <span>Half Day Adj:</span>
                <span>-{formatCurrency(halfDayDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-0.5 font-black text-gray-800 bg-gray-50 px-1">
              <span>Salary Earned:</span>
              <span>{formatCurrency(record.basic_salary)}</span>
            </div>

            {record.reg_holiday_pay > 0 && (
              <div className="flex justify-between pt-1 font-bold text-blue-800">
                <span>Reg. Holiday ({regHolidayDays}d):</span>
                <span>+{formatCurrency(record.reg_holiday_pay)}</span>
              </div>
            )}
            
            {record.spec_holiday_pay > 0 && (
              <div className="flex justify-between font-bold text-blue-800">
                <span>Spec. Holiday ({specHolidayDays}d):</span>
                <span>+{formatCurrency(record.spec_holiday_pay)}</span>
              </div>
            )}

            <div className="flex justify-between pt-1 font-bold">
              <span>OT Pay ({otHours}h):</span>
              <span>+{formatCurrency(record.overtime_pay)}</span>
            </div>
            
            {record.allowances > 0 && (
              <div className="mt-1 pt-1 border-t border-gray-100">
                <div className="flex justify-between text-green-700 font-bold">
                  <span>Allowances:</span>
                  <span>+{formatCurrency(record.allowances)}</span>
                </div>
                <p className="text-[7px] font-bold text-gray-500 italic leading-none pl-1">— {record.allowance_description || 'Personnel Allowance'}</p>
              </div>
            )}

            <div className="flex justify-between border-t-2 border-black pt-1 font-black text-[12px] mt-2">
              <span>GROSS PAY</span>
              <span>{formatCurrency(record.gross_pay)}</span>
            </div>
          </div>

          <div className="space-y-0.5 text-left">
            <h4 className="font-black border-b-2 border-gray-800 pb-0.5 uppercase text-red-800 text-[11px]">Deductions</h4>
            <div className="space-y-0.5 border-b border-gray-100 pb-1">
              {isFullTime && (
                <>
                  {record.sss_contribution > 0 && (
                    <div className="flex justify-between px-1"><span>SSS Contribution:</span><span>-{formatCurrency(record.sss_contribution)}</span></div>
                  )}
                  {record.philhealth_contribution > 0 && (
                    <div className="flex justify-between px-1"><span>PhilHealth:</span><span>-{formatCurrency(record.philhealth_contribution)}</span></div>
                  )}
                  {record.pagibig_contribution > 0 && (
                    <div className="flex justify-between px-1"><span>Pag-IBIG:</span><span>-{formatCurrency(record.pagibig_contribution)}</span></div>
                  )}
                </>
              )}
            </div>
            <div className="pt-1 space-y-0.5">
              {(record.late_deduction > 0 || record.undertime_deduction > 0) && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Late/UT ({lateUTHours}h):</span>
                  <span>-{formatCurrency(Number(record.late_deduction || 0) + Number(record.undertime_deduction || 0))}</span>
                </div>
              )}
              {record.food_allowance > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Food Deduction:</span>
                  <span>-{formatCurrency(record.food_allowance)}</span>
                </div>
              )}
              {record.cash_advance > 0 && (
                <div className="flex justify-between font-bold text-red-600">
                  <span>Cash/Loan:</span>
                  <span>-{formatCurrency(record.cash_advance)}</span>
                </div>
              )}
              {record.other_deductions > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Others:</span>
                  <span>-{formatCurrency(record.other_deductions)}</span>
                </div>
              )}
            </div>
            <div className="flex justify-between border-t-2 border-black pt-1 font-black text-[12px] mt-auto">
              <span>TOTAL DED.</span>
              <span>{formatCurrency(totalDeductions)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-black p-2 mt-auto text-center">
          <div className="flex justify-between items-center mb-0.5 px-4">
            <span className="text-[11px] font-black uppercase">Net Take Home:</span>
            <span className="text-2xl font-black">{formatCurrency(record.net_pay)}</span>
          </div>
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
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-3xl shadow-xl p-8 no-print border border-gray-100 text-left">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg"><SafeIcon icon={FiPrinter} className="text-white text-2xl" /></div>
            <div>
              <h1 className="text-2xl font-black text-gray-800 uppercase">Payroll Archive</h1>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">Bulk Print & History</p>
            </div>
          </div>
          <button 
            onClick={() => window.print()} 
            disabled={selectedRecordIds.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center space-x-2 uppercase tracking-widest text-[10px]"
          >
            <SafeIcon icon={FiPrinter} />
            <span>Print Selected ({selectedRecordIds.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-gray-50 p-6 rounded-3xl border border-gray-100">
          <div className="md:col-span-2 text-left">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Search</label>
            <input type="text" placeholder="Search name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold outline-none" />
          </div>
          <div className="text-left">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none" />
          </div>
          <div className="text-left">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl outline-none" />
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
              <th className="px-6 py-4 text-right">Net Payout</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredRecords.map(record => (
              <tr key={record.id} className={`hover:bg-blue-50/30 transition-colors ${selectedRecordIds.includes(record.id) ? 'bg-blue-50/50' : ''}`}>
                <td className="px-6 py-4 text-center">
                  <button onClick={() => toggleRecordSelection(record.id)} className="text-blue-600">
                    <SafeIcon icon={selectedRecordIds.includes(record.id) ? FiCheckSquare : FiSquare} className="text-xl" />
                  </button>
                </td>
                <td className="px-6 py-4">
                  <p className="font-black text-gray-800">{record.employees?.name}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">{record.employees?.position} • {record.employees?.employee_type}</p>
                </td>
                <td className="px-6 py-4 text-sm font-bold text-blue-700">{record.pay_period}</td>
                <td className="px-6 py-4 text-right font-mono font-black text-green-600">{formatCurrency(record.net_pay)}</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center space-x-1">
                    <button onClick={() => navigate(`/results/${record.id}`)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg" title="View Details"><SafeIcon icon={FiEye} /></button>
                    <button onClick={() => navigate('/calculate', { state: { employee: record.employees, payRecord: record, isEdit: true } })} className="p-2 text-orange-500 hover:bg-orange-100 rounded-lg" title="Edit Record"><SafeIcon icon={FiEdit2} /></button>
                    <button onClick={() => handleDeleteRecord(record.id)} className="p-2 text-red-500 hover:bg-red-100 rounded-lg" title="Delete Record"><SafeIcon icon={FiTrash2} /></button>
                  </div>
                </td>
              </tr>
            ))}
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