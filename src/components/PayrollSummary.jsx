import React, { useState, useEffect, useMemo } from 'react';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import { format, parseISO, eachDayOfInterval, isSunday } from 'date-fns';

const { FiCalendar, FiUser, FiPrinter, FiRefreshCw, FiCheckCircle, FiAlertCircle } = FiIcons;

const PayrollSummary = () => {
  const [employees, setEmployees] = useState([]);
  const [attendanceByEmployee, setAttendanceByEmployee] = useState({});
  const [payRecordsByEmployee, setPayRecordsByEmployee] = useState({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(amount || 0);
  };

  const dayColumns = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      if (end < start) return [];
      return eachDayOfInterval({ start, end });
    } catch (e) {
      return [];
    }
  }, [startDate, endDate]);

  const loadSummary = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const empData = await employeeService.getEmployeeBasicInfo();
      const activeEmployees = empData.filter(e => e.is_active !== false);

      const periodKey = `${startDate} to ${endDate}`;

      const results = await Promise.all(
        activeEmployees.map(async (emp) => {
          const [attendance, payRecords] = await Promise.all([
            employeeService.getAttendance(emp.id, startDate, endDate).catch(() => []),
            employeeService.getPayRecords(emp.id, 200).catch(() => [])
          ]);
          // Match exact period first, then fall back to any record fully contained within the selected range
          // (covers cases like a new hire processed on a shorter sub-window within the chosen dates)
          let matchedRecord = (payRecords || []).find(r => r.pay_period === periodKey) || null;
          if (!matchedRecord) {
            matchedRecord = (payRecords || []).find(r => {
              const rStart = (r.start_date || '').split(' ')[0].split('T')[0];
              const rEnd = (r.end_date || '').split(' ')[0].split('T')[0];
              return rStart && rEnd && rStart >= startDate && rEnd <= endDate;
            }) || null;
          }
          return { empId: emp.id, attendance, matchedRecord };
        })
      );

      const attMap = {};
      const payMap = {};
      results.forEach(r => {
        attMap[r.empId] = r.attendance;
        payMap[r.empId] = r.matchedRecord;
      });

      setEmployees(activeEmployees);
      setAttendanceByEmployee(attMap);
      setPayRecordsByEmployee(payMap);
      setLoaded(true);
    } catch (error) {
      toast.error('Failed to load payroll summary');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    return employees.map(emp => {
      const attendance = attendanceByEmployee[emp.id] || [];
      const attMap = {};
      attendance.forEach(a => { attMap[a.date] = a; });

      const dayStatuses = dayColumns.map(day => {
        if (isSunday(day)) return { dateStr: format(day, 'yyyy-MM-dd'), status: 'sunday' };
        const dateStr = format(day, 'yyyy-MM-dd');
        const log = attMap[dateStr];
        if (!log) return { dateStr, status: 'none' };
        if (log.status === 'half_day') return { dateStr, status: 'half' };
        if (['present', 'late', 'undertime', 'holiday'].includes(log.status)) return { dateStr, status: 'present' };
        if (log.status === 'absent') return { dateStr, status: 'absent' };
        return { dateStr, status: 'other', label: log.status };
      });

      const daysPresent = dayStatuses.filter(d => d.status === 'present').length;
      const daysAbsent = dayStatuses.filter(d => d.status === 'absent').length;
      const halfDays = dayStatuses.filter(d => d.status === 'half').length;
      const totalOTMinutes = attendance.reduce((sum, a) => sum + (a.overtime_hours ? a.overtime_hours * 60 : 0), 0);
      const totalLateMinutes = attendance.reduce((sum, a) => sum + (a.late_minutes || 0), 0);

      const record = payRecordsByEmployee[emp.id] || null;
      const cashAdvance = record?.applied_deductions
        ?.filter(d => d.category === 'Cash Advance')
        .reduce((s, d) => s + (d.amount || 0), 0) || 0;
      const loans = record?.applied_deductions
        ?.filter(d => d.category !== 'Cash Advance')
        .reduce((s, d) => s + (d.amount || 0), 0) || 0;
      const contributions = (record?.sss_contribution || 0) + (record?.philhealth_contribution || 0) + (record?.pagibig_contribution || 0);
      const holidayPay = (record?.reg_holiday_pay || 0) + (record?.spec_holiday_pay || 0);

      return {
        emp,
        dayStatuses,
        daysPresent,
        daysAbsent,
        halfDays,
        totalOTMinutes,
        totalLateMinutes,
        record,
        cashAdvance,
        loans,
        contributions,
        holidayPay,
        hasRecord: !!record
      };
    });
  }, [employees, attendanceByEmployee, payRecordsByEmployee, dayColumns]);

  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (r.record?.net_pay || 0), 0);
  }, [rows]);

  const cellStyle = (status) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700';
      case 'absent': return 'bg-red-50 text-red-700 font-black';
      case 'half': return 'bg-amber-50 text-amber-700';
      case 'sunday': return 'bg-gray-50 text-gray-300';
      case 'other': return 'bg-blue-50 text-blue-600';
      defaWult: return 'bg-white text-gray-300';
    }
  };

  const cellLabel = (d) => {
    switch (d.status) {
      case 'present': return 'P';
      case 'absent': return 'A';
      case 'half': return 'H';
      case 'sunday': return '';
      case 'other': return (d.label || '').charAt(0).toUpperCase();
      default: return '-';
    }
  };

  return (
    <div className="max-w-full mx-auto px-4 lg:px-8 py-10 space-y-8 text-left">
      <div className="flex items-center justify-between no-print">
        <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight flex items-center">
          <SafeIcon icon={FiCalendar} className="mr-3 text-blue-600" /> Payroll Summary
        </h1>
        {loaded && (
          <button
            onClick={() => {
              const styleTag = document.createElement('style');
              styleTag.id = 'temp-landscape-print';
              styleTag.textContent = '@page { size: A4 landscape; margin: 8mm; }';
              document.head.appendChild(styleTag);
              window.print();
              setTimeout(() => {
                const tag = document.getElementById('temp-landscape-print');
                if (tag) tag.remove();
              }, 1000);
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-blue-700 transition-all flex items-center"
          >
            <SafeIcon icon={FiPrinter} className="mr-2" /> Print / Export
          </button>
        )}
      </div>

      {/* Date Range Picker */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-6 flex flex-wrap items-end gap-4 no-print">
        <div>
          <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-sm focus:border-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border-2 border-gray-100 rounded-xl px-4 py-3 font-bold text-sm focus:border-blue-500 outline-none"
          />
        </div>
        <button
          onClick={loadSummary}
          disabled={loading}
          className="bg-gray-900 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-black transition-all flex items-center disabled:opacity-50"
        >
          <SafeIcon icon={loading ? FiRefreshCw : FiCheckCircle} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading...' : 'Generate Summary'}
        </button>
        {loaded && (
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2.5 rounded-full border border-gray-100">
            {rows.filter(r => r.hasRecord).length} / {rows.length} processed
          </span>
        )}
        {loaded && (
          <span className="text-[12px] font-black text-white uppercase tracking-widest bg-gray-900 px-5 py-2.5 rounded-full">
            Grand Total: {formatCurrency(grandTotal)}
          </span>
        )}
      </div>

      {/* Legend */}
      {loaded && (
        <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest no-print">
          <span className="flex items-center"><span className="w-4 h-4 rounded bg-green-50 border border-green-200 mr-2"></span> Present</span>
          <span className="flex items-center"><span className="w-4 h-4 rounded bg-red-50 border border-red-200 mr-2"></span> Absent</span>
          <span className="flex items-center"><span className="w-4 h-4 rounded bg-amber-50 border border-amber-200 mr-2"></span> Half Day</span>
        </div>
      )}

      {/* Main Grid */}
      {loaded && (
        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 payroll-summary-print">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 no-print flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center">
              <SafeIcon icon={FiUser} className="mr-2 text-blue-600" /> Bi-Weekly Attendance & Payroll Sheet
            </h3>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {format(parseISO(startDate), 'MMM dd')} - {format(parseISO(endDate), 'MMM dd, yyyy')}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest sticky left-0 bg-orange-500 z-10 min-w-[180px]">Name</th>
                  {dayColumns.map((day, i) => (
                    <th key={i} className="px-2 py-4 text-[10px] font-black text-center min-w-[40px]">
                      <div>{format(day, 'd')}</div>
                    </th>
                  ))}
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-center bg-orange-600 min-w-[70px]">Days Present</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-center bg-red-700 min-w-[70px]">Absent</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-center bg-amber-600 min-w-[70px]">Half Day</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-center min-w-[60px]">OT</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[90px]">Daily Rate</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[100px]">Cash Advance</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[100px]">Loans/Ded.</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[100px]">Contributions</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[80px]">Lates</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[90px]">Holiday</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right min-w-[90px]">Allowance</th>
                  <th className="px-4 py-4 text-[9px] font-black uppercase tracking-widest text-right bg-orange-700 min-w-[110px]">Total Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((r, idx) => (
                  <tr key={idx} className={`${!r.hasRecord ? 'opacity-50' : ''} hover:bg-blue-50/20 transition-colors`}>
                    <td className="px-6 py-3 sticky left-0 bg-white z-10 border-r border-gray-50">
                      <p className="font-black text-gray-800 text-sm uppercase leading-tight">{r.emp.name}</p>
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest">{r.emp.position || r.emp.employee_type}</p>
                    </td>
                    {r.dayStatuses.map((d, di) => (
                      <td key={di} className={`px-2 py-3 text-center text-[10px] font-black ${cellStyle(d.status)}`}>
                        {cellLabel(d)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-black text-sm">{r.daysPresent}</td>
                    <td className="px-4 py-3 text-center font-black text-sm text-red-600">{r.daysAbsent}</td>
                    <td className="px-4 py-3 text-center font-black text-sm text-amber-600">{r.halfDays}</td>
                    <td className="px-4 py-3 text-center font-bold text-sm text-gray-500">{Math.round(r.totalOTMinutes)}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.emp.daily_salary ? formatCurrency(r.emp.daily_salary) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.cashAdvance) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.loans) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.contributions) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.record?.late_deduction) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.holidayPay) : '—'}</td>
                    <td className="px-4 py-3 text-right font-bold text-sm">{r.hasRecord ? formatCurrency(r.record?.allowances) : '—'}</td>
                    <td className="px-4 py-3 text-right font-black text-sm bg-orange-50">
                      {r.hasRecord ? formatCurrency(r.record?.net_pay) : (
                        <span className="text-[8px] font-black uppercase text-gray-400 flex items-center justify-end">
                          <SafeIcon icon={FiAlertCircle} className="mr-1" /> Not Processed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-900 text-white">
                  <td className="px-6 py-5 font-black uppercase text-xs tracking-widest sticky left-0 bg-gray-900" colSpan={dayColumns.length + 12}>
                    Total Amount
                  </td>
                  <td className="px-4 py-5 text-right font-black text-lg bg-orange-600 sticky right-0 z-10 shadow-[-8px_0_12px_-4px_rgba(0,0,0,0.3)]">{formatCurrency(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loaded && !loading && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-20 text-center">
          <SafeIcon icon={FiCalendar} className="text-5xl text-gray-200 mx-auto mb-4" />
          <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Select a date range and generate to view the summary</p>
        </div>
      )}
    </div>
  );
};

export default PayrollSummary;
