import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { parseISO, eachDayOfInterval, isSunday, format } from 'date-fns';

const { FiTrendingUp, FiTrendingDown, FiUser, FiArrowLeft, FiPrinter, FiClock, FiShield, FiZap, FiMinus, FiPlus, FiSun, FiSunrise, FiGift } = FiIcons;

const PayslipDetail = () => {
  const { payRecordId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [employee, setEmployee] = useState(location.state?.employee || null);
  const [payRecord, setPayRecord] = useState(location.state?.record || null);
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let record = payRecord;
        if (!record) {
          record = await employeeService.getPayRecordById(payRecordId);
          setPayRecord(record);
        }
        if (record) {
          const [emp, logs, holidayList] = await Promise.all([
            employeeService.getEmployeeById(record.employee_id),
            employeeService.getAttendance(record.employee_id, record.start_date, record.end_date),
            employeeService.getHolidays()
          ]);
          setEmployee(emp);
          setAttendance(logs);
          setHolidays(holidayList);
        }
      } catch (error) {
        console.error('Error loading payslip:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [payRecordId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
  };

  const audit = useMemo(() => {
    if (!payRecord || !employee) return null;
    const dailyRate = Number(employee.daily_salary || 0);
    const minuteRate = (dailyRate / 8) / 60;
    const isFullTime = employee.employee_type === 'Full Time';

    const start = parseISO(payRecord.start_date);
    const end = parseISO(payRecord.end_date);
    const dateRange = eachDayOfInterval({ start, end });
    const expectedDays = dateRange.filter(day => !isSunday(day)).length;
    const expectedSalary = expectedDays * dailyRate;
    
    const holidayMap = {};
    holidays.forEach(h => { holidayMap[h.date] = h; });

    const attendanceMap = {};
    attendance.forEach(log => { attendanceMap[log.date] = log; });

    let fullDays = 0;
    let halfDays = 0;
    const holidayBreakdown = [];
    const halfDayDates = new Set();
    const absentDatesList = [];

    dateRange.forEach(day => {
      if (isSunday(day)) return;
      const dateStr = format(day, 'yyyy-MM-dd');
      const holiday = holidayMap[dateStr];
      const log = attendanceMap[dateStr];
      const isWorking = log && ['present', 'late', 'undertime'].includes(log.status);

      if (holiday) {
        let multiplier = 0;
        if (isFullTime) {
          multiplier = holiday.type === 'regular' ? (isWorking ? 2.0 : 1.0) : (isWorking ? 1.3 : 0);
        } else {
          multiplier = isWorking ? 1.0 : 0;
        }
        if (multiplier > 0) {
          holidayBreakdown.push({
            date: dateStr,
            name: holiday.name,
            type: holiday.type,
            status: isWorking ? 'Worked' : 'Off',
            amount: dailyRate * multiplier
          });
        }
      } else {
        if (isWorking || (log && log.status === 'holiday')) {
          if (log.check_in_time) {
            const [h, m] = log.check_in_time.split(':').map(Number);
            if ((h * 60 + m) >= 720) {
              halfDays++;
              halfDayDates.add(dateStr);
            } else {
              fullDays++;
            }
          }
        } else {
          absentDatesList.push(format(day, 'MMM dd'));
        }
      }
    });

    const otLogs = attendance.filter(log => (log.overtime_hours || 0) > 0).map(log => ({
      date: log.date,
      minutes: Math.round(log.overtime_hours * 60),
      amount: Math.round(log.overtime_hours * 60 * minuteRate * 100) / 100
    }));

    const lateLogs = attendance
      .filter(log => (log.late_minutes || 0) > 0 && !halfDayDates.has(log.date))
      .map(log => ({
        date: log.date,
        minutes: log.late_minutes,
        amount: Math.round(log.late_minutes * minuteRate * 100) / 100
      }));

    const utLogs = attendance.filter(log => (log.undertime_minutes || 0) > 0).map(log => ({
      date: log.date,
      minutes: log.undertime_minutes,
      amount: Math.round(log.undertime_minutes * minuteRate * 100) / 100
    }));

    const totalEarnings = Number(payRecord.gross_pay || 0);
    const statutory = (payRecord.sss_contribution || 0) + (payRecord.philhealth_contribution || 0) + (payRecord.pagibig_contribution || 0);
    const debtTotal = (payRecord.applied_deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const totalDeductions = statutory + debtTotal + (payRecord.other_deductions || 0);

    return {
      expectedDays, expectedSalary, absentDates: absentDatesList, 
      absenceDeduction: absentDatesList.length * dailyRate,
      fullDays, halfDays, holidayBreakdown,
      otLogs, lateLogs, utLogs,
      totalEarnings, totalDeductions, netPay: Number(payRecord.net_pay || 0),
      statutory, debtTotal, dailyRate
    };
  }, [payRecord, employee, attendance, holidays]);

  const renderPrintCopy = (copyLabel) => {
    if (!audit) return null;
    return (
      <div className="payslip-print-block">
        <div className="copy-label">{copyLabel}</div>
        <div className="text-center border-b-2 border-black pb-1 mb-2">
          <h1 className="text-lg font-black uppercase tracking-tight">GT International</h1>
          <p className="text-[7px] font-bold uppercase tracking-widest">Official Payroll Ledger • Cycle Audit</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-left border-b border-black pb-1 mb-2">
          <div>
            <p className="text-[8px] font-black uppercase">Personnel</p>
            <p className="text-xs font-black uppercase leading-none">{employee.name}</p>
            <p className="text-[7px] font-bold uppercase">{employee.position} • ₱{audit.dailyRate}/day</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black uppercase">Cycle</p>
            <p className="text-[10px] font-black leading-none">{payRecord.pay_period}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-[8px] flex-grow font-bold">
          {/* EARNINGS SECTION - Print Cleaned */}
          <div className="space-y-0.5 text-left">
            <h4 className="border-b-2 border-black uppercase text-[8px] mb-1">Earnings Blueprint</h4>
            
            <div className="border-b border-black pb-1 mb-1">
              <p className="text-[7px] font-black uppercase mb-1">Verified Attendance Weights</p>
              <div className="flex justify-between"><span>Full Days ({audit.fullDays}):</span><span>{formatCurrency(audit.fullDays * audit.dailyRate)}</span></div>
              <div className="flex justify-between"><span>Half Days ({audit.halfDays}):</span><span>{formatCurrency(audit.halfDays * (audit.dailyRate * 0.5))}</span></div>
              {audit.holidayBreakdown.map((h, i) => (
                <div key={i} className="flex justify-between">
                  <span>{h.name} ({h.status}):</span>
                  <span>{formatCurrency(h.amount)}</span>
                </div>
              ))}
              {audit.absentDates.length > 0 && (
                <div className="flex justify-between italic mt-1 border-t border-black pt-0.5">
                  <span>Absence ({audit.absentDates.join(',')}):</span>
                  <span>-{formatCurrency(audit.absenceDeduction)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-black border-b border-black pb-0.5 pt-0.5"><span>Basic Earned:</span><span>{formatCurrency(payRecord.basic_salary)}</span></div>
            {audit.otLogs.map((ot, i) => (
              <div key={i} className="flex justify-between">
                <span>OT ({format(parseISO(ot.date), 'MM/dd')}):</span>
                <span>+{formatCurrency(ot.amount)}</span>
              </div>
            ))}
            {payRecord.allowances > 0 && <div className="flex justify-between"><span>Allowances:</span><span>+{formatCurrency(payRecord.allowances)}</span></div>}
            <div className="flex justify-between border-t-2 border-black pt-1 font-black text-[9px] mt-1 italic"><span>Gross Total</span><span>{formatCurrency(audit.totalEarnings)}</span></div>
          </div>

          {/* DEDUCTIONS SECTION - Print Cleaned */}
          <div className="space-y-0.5 text-left">
            <h4 className="border-b-2 border-black uppercase text-[8px] mb-1">Deductions Audit</h4>
            {audit.lateLogs.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>Late ({format(parseISO(item.date), 'MM/dd')}):</span>
                <span>-{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {audit.utLogs.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>UT ({format(parseISO(item.date), 'MM/dd')}):</span>
                <span>-{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {audit.statutory > 0 && <div className="flex justify-between"><span>Statutory Deductions:</span><span>-{formatCurrency(audit.statutory)}</span></div>}
            
            {/* Itemized Deductions Print */}
            {payRecord.applied_deductions?.map((d, i) => (
              <div key={i} className="flex justify-between italic">
                <span>{d.category} ({format(parseISO(d.date), 'MM/dd')}):</span>
                <span>-{formatCurrency(d.amount)}</span>
              </div>
            ))}
            
            {payRecord.other_deductions > 0 && <div className="flex justify-between"><span>Misc Deductions:</span><span>-{formatCurrency(payRecord.other_deductions)}</span></div>}
            <div className="flex justify-between border-t-2 border-black font-black text-[9px] pt-1 mt-auto italic"><span>Total Deductions</span><span>{formatCurrency(audit.totalDeductions)}</span></div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t-2 border-black">
          {/* Net Settlement Analysis - B&W High Contrast */}
          <div className="border-2 border-black p-2 flex justify-between items-center mb-2">
            <div className="text-left">
              <p className="text-[7px] font-black uppercase tracking-widest">Net Settlement Analysis</p>
              <p className="text-[6px] uppercase">{formatCurrency(audit.totalEarnings)} Gross — {formatCurrency(audit.totalDeductions)} deductions</p>
            </div>
            <div className="text-right">
              <p className="text-[7px] font-black uppercase tracking-widest">Net Take Home</p>
              <p className="text-lg font-black leading-none">{formatCurrency(audit.netPay)}</p>
            </div>
          </div>
          
          <div className="text-[7px] font-bold text-center italic mb-4">
            "I agree & acknowledge received in full the salary amount stated above"
          </div>

          <div className="grid grid-cols-2 gap-12 mt-4">
            <div className="border-t-2 border-black pt-1 text-center text-[7px] font-black uppercase">Employee Signature</div>
            <div className="border-t-2 border-black pt-1 text-center text-[7px] font-black uppercase">Authorized Auditor</div>
          </div>
        </div>
      </div>
    );
  };

  if (loading || !audit) return <div className="p-20 text-center font-black uppercase tracking-widest animate-pulse">Syncing Records...</div>;

  return (
    <div className="max-w-7xl mx-auto pb-12 text-left">
      <div className="no-print space-y-8">
        <div className="bg-white p-6 rounded-3xl shadow-xl flex justify-between items-center border border-gray-100">
          <button onClick={() => navigate(-1)} className="text-blue-600 font-black flex items-center hover:bg-blue-50 px-6 py-3 rounded-2xl transition-all uppercase tracking-widest text-[10px]">
            <SafeIcon icon={FiArrowLeft} className="mr-2" /> Return to Archives
          </button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black shadow-2xl hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px] flex items-center">
            <SafeIcon icon={FiPrinter} className="mr-3" /> Print Vouchers
          </button>
        </div>

        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100">
          <div className={`p-12 text-white flex justify-between items-center ${audit.netPay < 0 ? 'bg-red-900' : 'bg-gray-900'} relative`}>
            <div className="flex items-center space-x-8 relative z-10">
              <div className={`p-6 rounded-[2rem] shadow-2xl ${audit.netPay < 0 ? 'bg-red-600' : 'bg-blue-600'}`}>
                <SafeIcon icon={FiUser} className="text-5xl" />
              </div>
              <div>
                <h2 className="text-4xl font-black tracking-tight uppercase mb-1">{employee.name}</h2>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.3em]">{employee.position} • ₱{audit.dailyRate}/day</p>
              </div>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.3em] mb-1">Audit Period</p>
              <p className="text-4xl font-black text-blue-400 tracking-tighter">{payRecord.pay_period}</p>
            </div>
          </div>

          <div className="p-16 grid grid-cols-1 lg:grid-cols-2 gap-20">
            {/* Screen View: Earnings */}
            <div className="space-y-10">
              <h3 className="font-black text-green-700 border-b-2 border-green-50 pb-4 flex items-center uppercase text-xs tracking-[0.3em]">
                <SafeIcon icon={FiTrendingUp} className="mr-3" /> 1. Earnings Blueprint
              </h3>
              <div className="bg-gray-50/50 p-8 rounded-[2.5rem] border border-gray-100 space-y-8">
                <div className="space-y-6 border-b border-gray-100 pb-8 text-left">
                  <div className="bg-blue-900 text-white p-6 rounded-3xl shadow-xl flex justify-between items-center">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-300 mb-1">Expected Potential ({audit.expectedDays} Days)</p>
                      <p className="text-2xl font-black">{formatCurrency(audit.expectedSalary)}</p>
                    </div>
                    <SafeIcon icon={FiShield} className="text-3xl opacity-20" />
                  </div>

                  {audit.absentDates.length > 0 && (
                    <div className="bg-red-50 p-6 rounded-3xl border border-red-100 flex justify-between items-center">
                      <div className="text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-600 mb-1">Absence Audit ({audit.absentDates.length} Days Lost)</p>
                        <p className="text-[10px] font-bold text-red-900/60 uppercase mb-2">Dates: {audit.absentDates.join(',')}</p>
                        <p className="text-lg font-black text-red-700">-{formatCurrency(audit.absenceDeduction)}</p>
                      </div>
                      <SafeIcon icon={FiMinus} className="text-2xl text-red-300" />
                    </div>
                  )}

                  <div className="bg-white p-6 rounded-3xl border border-gray-100 space-y-3 mt-4 shadow-sm">
                    <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest mb-2 border-b border-gray-50 pb-2">Verified Attendance Weights</p>
                    <div className="flex justify-between text-[11px] font-bold text-gray-700">
                      <span className="flex items-center"><SafeIcon icon={FiSunrise} className="mr-2 text-blue-400" /> Full Days Worked ({audit.fullDays})</span>
                      <span>{formatCurrency(audit.fullDays * audit.dailyRate)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-gray-700">
                      <span className="flex items-center"><SafeIcon icon={FiSun} className="mr-2 text-orange-400" /> Half Days ({audit.halfDays})</span>
                      <span>{formatCurrency(audit.halfDays * (audit.dailyRate * 0.5))}</span>
                    </div>
                    {audit.holidayBreakdown.map((h, i) => (
                      <div key={i} className="flex justify-between text-[11px] font-black text-blue-600">
                        <span className="flex items-center"><SafeIcon icon={FiGift} className="mr-2 text-blue-500" /> {h.name} ({h.status})</span>
                        <span>{formatCurrency(h.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-4 border-t border-dashed border-gray-200">
                    <span className="text-[10px] font-black uppercase text-gray-800 tracking-tight">Basic Earned Salary</span>
                    <span className="font-black text-2xl text-gray-900">{formatCurrency(payRecord.basic_salary)}</span>
                  </div>
                </div>

                {audit.otLogs.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest flex items-center">
                      <SafeIcon icon={FiZap} className="mr-2" /> Itemized Overtime Pay
                    </p>
                    {audit.otLogs.map((ot, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-4 rounded-2xl text-[11px] font-bold border border-blue-50">
                        <span className="text-gray-800 uppercase">{format(parseISO(ot.date), 'MMMM dd')} ({ot.minutes}m)</span>
                        <span className="text-blue-700 font-black">+{formatCurrency(ot.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-6 border-t-2 border-gray-900 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest">Total Gross Earnings</span>
                  <span className="text-3xl font-black text-green-700">{formatCurrency(audit.totalEarnings)}</span>
                </div>
              </div>
            </div>

            {/* Screen View: Deductions */}
            <div className="space-y-10">
              <h3 className="font-black text-red-700 border-b-2 border-red-50 pb-4 flex items-center uppercase text-xs tracking-[0.3em]">
                <SafeIcon icon={FiTrendingDown} className="mr-3" /> 2. Deductions Audit
              </h3>
              <div className="bg-red-50/30 p-8 rounded-[2.5rem] border border-red-50 space-y-6">
                {(audit.lateLogs.length > 0 || audit.utLogs.length > 0) && (
                  <div className="space-y-3 text-left">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Penalties Breakdown</p>
                    {audit.lateLogs.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl text-[10px] font-bold border border-orange-100">
                        <span className="text-gray-500">Late: {format(parseISO(item.date), 'MMM dd')} ({item.minutes}m)</span>
                        <span className="text-orange-700">-{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                    {audit.utLogs.map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl text-[10px] font-bold border border-orange-100">
                        <span className="text-gray-500">UT: {format(parseISO(item.date), 'MMM dd')} ({item.minutes}m)</span>
                        <span className="text-orange-700">-{formatCurrency(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-2 text-left">
                  {audit.statutory > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-600">
                      <span>Consolidated Statutory</span>
                      <span>-{formatCurrency(audit.statutory)}</span>
                    </div>
                  )}
                  {payRecord.applied_deductions?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-red-800 bg-white p-3 rounded-xl border border-red-100">
                      <span className="font-black uppercase text-[9px]">{item.category} ({format(parseISO(item.date), 'MMM dd')})</span>
                      <span className="font-black text-xs">-{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t-2 border-red-900 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-widest">Total Audit Deductions</span>
                  <span className="text-3xl font-black text-red-700">{formatCurrency(audit.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 p-16 text-white text-left">
            <div className="max-w-4xl space-y-8">
              <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 border-b border-white/10 pb-4">Net Settlement Analysis</h4>
              <div className="space-y-6">
                <div className="flex justify-between items-center opacity-60">
                  <span className="text-xl font-bold uppercase tracking-widest italic">Gross Earnings Generated</span>
                  <span className="text-2xl font-black">{formatCurrency(audit.totalEarnings)}</span>
                </div>
                <div className="flex justify-between items-center text-red-400">
                  <span className="text-xl font-bold uppercase tracking-widest flex items-center italic">
                    <FiMinus className="mr-3" /> Total Authorized Deductions
                  </span>
                  <span className="text-2xl font-black">-{formatCurrency(audit.totalDeductions)}</span>
                </div>
                <div className="pt-8 border-t-4 border-blue-600 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-2">Net Take Home Pay</p>
                    <p className="text-7xl font-black tracking-tighter italic">{formatCurrency(audit.netPay)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="print-only">
        <div className="payslip-page-container">
          {renderPrintCopy('Employee Copy')}
          {renderPrintCopy('Company Copy')}
        </div>
      </div>
    </div>
  );
};

export default PayslipDetail;