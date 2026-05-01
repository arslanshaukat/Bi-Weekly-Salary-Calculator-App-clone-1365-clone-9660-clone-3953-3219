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
            employeeService.getAttendance(record.employee_id, record.start_date.split(' ')[0].split('T')[0], record.end_date.split(' ')[0].split('T')[0]),
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
      const isWorking = log && ['present', 'late', 'undertime', 'holiday'].includes(log.status);

      if (holiday) {
        let multiplier = 0;
        if (isFullTime) {
          multiplier = holiday.type === 'regular' ? (isWorking ? 2.0 : 1.0) : (isWorking ? 1.3 : 0);
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
          // Non-full-time: only paid if worked, counted as regular day (no holiday premium)
          if (isWorking) fullDays += 1;
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

    const SHIFT_END_MINS = 17 * 60;
    const attendanceOtLogs = attendance
      .filter(log => {
        if ((log.overtime_hours || 0) > 0) return true;
        if (log.check_out_time) {
          const parts = log.check_out_time.split(':').map(Number);
          return ((parts[0]||0)*60+(parts[1]||0)) > SHIFT_END_MINS;
        }
        return false;
      })
      .map(log => {
        let otMins = Math.round((log.overtime_hours||0)*60);
        if (otMins === 0 && log.check_out_time) {
          const parts = log.check_out_time.split(':').map(Number);
          otMins = Math.max(0, (parts[0]||0)*60+(parts[1]||0) - SHIFT_END_MINS);
        }
        return { date: log.date, minutes: otMins, amount: Math.round(otMins*minuteRate*100)/100 };
      })
      .filter(log => log.minutes > 0);
    const otLogs = attendanceOtLogs.length > 0 ? attendanceOtLogs :
      (payRecord.overtime_pay > 0) ? [{
        date: payRecord.start_date,
        minutes: Math.round((payRecord.overtime_hours||0)*60),
        amount: payRecord.overtime_pay||0
      }] : [];

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

    // Recalculate from display components so non-fulltime holiday exclusion is reflected
    const attendanceEarnings = 
      (fullDays * dailyRate) + 
      (halfDays * dailyRate * 0.5) +
      holidayBreakdown.reduce((s, h) => s + h.amount, 0);
    const otEarnings = otLogs.reduce((s, o) => s + o.amount, 0);
    const allowanceEarnings = Number(payRecord.allowances || 0);
    const calculatedEarnings = attendanceEarnings + otEarnings + allowanceEarnings;
    // Fall back to stored gross_pay if no attendance records available
    const storedGross = Number(payRecord.gross_pay || 0) + Number(payRecord.late_deduction || 0) + Number(payRecord.undertime_deduction || 0);
    const totalEarnings = attendance.length > 0 ? calculatedEarnings : storedGross;
    const statutory = (payRecord.sss_contribution || 0) + (payRecord.philhealth_contribution || 0) + (payRecord.pagibig_contribution || 0);
    const debtTotal = (payRecord.applied_deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const totalDeductions = statutory + debtTotal + (payRecord.other_deductions || 0) + (payRecord.late_deduction || 0) + (payRecord.undertime_deduction || 0);

    return {
      expectedDays, expectedSalary, absentDates: absentDatesList, 
      absenceDeduction: absentDatesList.length * dailyRate,
      fullDays, halfDays, holidayBreakdown,
      otLogs, lateLogs, utLogs,
      totalEarnings, totalDeductions, netPay: totalEarnings - totalDeductions,
      statutory, debtTotal, dailyRate
    };
  }, [payRecord, employee, attendance, holidays]);

  const renderPrintCopy = (copyLabel) => {
    if (!audit) return null;
    return (
      <div className="payslip-print-block" style={{fontFamily:'Arial,sans-serif',fontSize:'10px',color:'#000',display:'flex',flexDirection:'column'}}>
        
        {/* Header */}
        <div style={{textAlign:'center',borderBottom:'3px solid #000',paddingBottom:'6px',marginBottom:'8px'}}>
          <div style={{fontSize:'18px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'4px'}}>GT INTERNATIONAL</div>
          <div style={{fontSize:'7px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'3px',color:'#555',marginTop:'2px'}}>O F F I C I A L   P A Y R O L L   L E D G E R   &bull;   C Y C L E   A U D I T</div>
          <div style={{textAlign:'right',fontSize:'7px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',marginTop:'2px',color:'#888'}}>{copyLabel}</div>
        </div>

        {/* Employee Info Header */}
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px'}}>
          <div>
            <div style={{fontSize:'8px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',color:'#555',marginBottom:'2px'}}>Employee Details</div>
            <div style={{fontSize:'16px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'2px'}}>{employee.name}</div>
            <div style={{fontSize:'9px',fontWeight:'700',textTransform:'uppercase',color:'#333'}}>{employee.position} • &#x20B1;{Number(audit.dailyRate).toLocaleString()}/Day</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'8px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',color:'#555',marginBottom:'2px'}}>Pay Period</div>
            <div style={{fontSize:'13px',fontWeight:'900'}}>{payRecord.pay_period}</div>
          </div>
        </div>

        {/* Main Body */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',flex:'1 1 auto'}}>
          
          {/* Earnings */}
          <div>
            <div style={{fontSize:'10px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px',borderBottom:'3px solid #000',paddingBottom:'3px',marginBottom:'6px'}}>Earnings Breakdown</div>
            
            {audit.fullDays > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span style={{fontWeight:'700'}}>Full Days ({audit.fullDays}d):</span>
                <span style={{fontWeight:'700'}}>&#x20B1;{(audit.fullDays * audit.dailyRate).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            )}
            {audit.halfDays > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span style={{fontWeight:'700'}}>Half Days ({audit.halfDays}d):</span>
                <span style={{fontWeight:'700'}}>&#x20B1;{(audit.halfDays * audit.dailyRate * 0.5).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            )}
            {audit.absentDates.length > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0',fontStyle:'italic',color:'#555'}}>
                <div>
                  <div>Absence ({audit.absentDates.length}d):</div>
                  <div style={{fontSize:'8px',color:'#777'}}>{audit.absentDates.join(', ')}</div>
                </div>
                <span>-&#x20B1;{audit.absenceDeduction.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            )}
            
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px',padding:'4px 0',borderTop:'1px solid #000',borderBottom:'1px solid #000',background:'#f5f5f5'}}>
              <span style={{fontWeight:'900'}}>Salary Earned:</span>
              <span style={{fontWeight:'900'}}>&#x20B1;{Number(payRecord.basic_salary).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
            </div>

            {audit.holidayBreakdown.map((h, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <div>
                  <div>{h.name} ({h.status === 'Worked' ? '2x Pay' : '1x Pay'}):</div>
                  <div style={{fontSize:'8px',color:'#777'}}>{format(parseISO(h.date), 'MMM dd, yyyy')} • {h.type === 'regular' ? 'Regular Holiday' : 'Special Holiday'}</div>
                </div>
                <span>+&#x20B1;{h.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            {audit.otLogs.map((ot, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span>OT Pay ({format(parseISO(ot.date),'MM/dd')} {ot.minutes}m):</span>
                <span>+&#x20B1;{ot.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            {payRecord.allowances > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span>Allowances:</span>
                <span>+&#x20B1;{Number(payRecord.allowances).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            )}

            <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderTop:'3px solid #000',marginTop:'4px'}}>
              <span style={{fontSize:'11px',fontWeight:'900',textTransform:'uppercase'}}>Gross Pay</span>
              <span style={{fontSize:'11px',fontWeight:'900'}}>&#x20B1;{audit.totalEarnings.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <div style={{fontSize:'10px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px',borderBottom:'3px solid #000',paddingBottom:'3px',marginBottom:'6px'}}>Deductions</div>
            
            {audit.lateLogs.map((item, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span>Late {format(parseISO(item.date),'MM/dd')} ({item.minutes}m):</span>
                <span>-&#x20B1;{item.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            {audit.utLogs.map((item, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}>
                <span>UT {format(parseISO(item.date),'MM/dd')} ({item.minutes}m):</span>
                <span>-&#x20B1;{item.amount.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            {payRecord.sss_contribution > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}><span>SSS:</span><span>-&#x20B1;{Number(payRecord.sss_contribution).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>}
            {payRecord.philhealth_contribution > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}><span>PhilHealth:</span><span>-&#x20B1;{Number(payRecord.philhealth_contribution).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>}
            {payRecord.pagibig_contribution > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}><span>Pag-IBIG:</span><span>-&#x20B1;{Number(payRecord.pagibig_contribution).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>}
            {payRecord.applied_deductions?.map((d, i) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0',fontStyle:'italic'}}>
                <span>{d.category} ({format(parseISO(d.date),'MM/dd')}):</span>
                <span>-&#x20B1;{Number(d.amount).toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
              </div>
            ))}
            {payRecord.other_deductions > 0 && <div style={{display:'flex',justifyContent:'space-between',marginBottom:'3px',padding:'2px 0'}}><span>Other:</span><span>-&#x20B1;{Number(payRecord.other_deductions).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>}

            <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderTop:'3px solid #000',marginTop:'4px'}}>
              <span style={{fontSize:'10px',fontWeight:'900',textTransform:'uppercase'}}>Total Ded.</span>
              <span style={{fontSize:'10px',fontWeight:'900'}}>&#x20B1;{audit.totalDeductions.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
            </div>
          </div>
        </div>

        {/* Net Take Home */}
        <div style={{border:'2px solid #000',padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'8px'}}>
          <span style={{fontSize:'12px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px'}}>Net Take Home:</span>
          <span style={{fontSize:'20px',fontWeight:'900',letterSpacing:'1px'}}>&#x20B1;{audit.netPay.toLocaleString('en-PH',{minimumFractionDigits:2})}</span>
        </div>

        {/* Acknowledgement */}
        <div style={{textAlign:'center',fontSize:'7px',fontWeight:'700',fontStyle:'italic',marginTop:'6px',marginBottom:'4px'}}>
          "I AGREE & ACKNOWLEDGE RECEIVED IN FULL THE SALARY AMOUNT STATED ABOVE."
        </div>

        {/* Signatures */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px',marginTop:'4px'}}>
          <div style={{borderTop:'2px solid #000',paddingTop:'3px',textAlign:'center',fontSize:'8px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px'}}>Employee Signature</div>
          <div style={{borderTop:'2px solid #000',paddingTop:'3px',textAlign:'center',fontSize:'8px',fontWeight:'900',textTransform:'uppercase',letterSpacing:'1px'}}>Authorized By</div>
        </div>

        {/* Dashed border bottom */}
        <div style={{borderTop:'2px dashed #000',marginTop:'6px',paddingTop:'3px',textAlign:'center',fontSize:'7px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'2px',color:'#888'}}>{copyLabel}</div>
      </div>
    );
  };


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
                        <span className="flex items-center"><SafeIcon icon={FiGift} className="mr-2 text-blue-500" /> {h.name} ({h.type === "regular" ? "Regular" : "Special"} • {h.status === "Worked" ? "Worked × 2x" : "Day Off × 1x"})</span>
                        <span>{formatCurrency(h.amount)}</span>
                      </div>
                    ))}
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
                  {payRecord.sss_contribution > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-600">
                      <span>SSS Contribution</span>
                      <span>-{formatCurrency(payRecord.sss_contribution)}</span>
                    </div>
                  )}
                  {payRecord.philhealth_contribution > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-600">
                      <span>PhilHealth Contribution</span>
                      <span>-{formatCurrency(payRecord.philhealth_contribution)}</span>
                    </div>
                  )}
                  {payRecord.pagibig_contribution > 0 && (
                    <div className="flex justify-between text-xs font-bold text-gray-600">
                      <span>Pag-IBIG Contribution</span>
                      <span>-{formatCurrency(payRecord.pagibig_contribution)}</span>
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