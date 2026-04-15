import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { parseISO, eachDayOfInterval, isSunday } from 'date-fns';

const { FiTrendingUp, FiTrendingDown, FiUser, FiArrowLeft, FiPrinter, FiInfo, FiClock, FiGift } = FiIcons;

const PayslipDetail = () => {
  const { payRecordId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [employee, setEmployee] = useState(location.state?.employee || null);
  const [payRecord, setPayRecord] = useState(location.state?.record || null);
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
        if (!employee && record.employee_id) {
          const emp = await employeeService.getEmployeeById(record.employee_id);
          setEmployee(emp);
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
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount || 0);
  };

  const calcData = useMemo(() => {
    if (!payRecord || !employee) return null;
    const dailyRate = Number(employee.daily_salary || 0);
    const start = parseISO(payRecord.start_date);
    const end = parseISO(payRecord.end_date);
    const daysInInterval = eachDayOfInterval({ start, end });
    const expectedDays = daysInInterval.filter(day => !isSunday(day)).length;
    const potentialSalary = expectedDays * dailyRate;
    const daysPresent = Number(payRecord.days_present || 0);
    const fullDaysAbsent = Math.floor(expectedDays - daysPresent);
    const hasHalfDay = (daysPresent % 1 !== 0);
    const halfDayDeduction = hasHalfDay ? (dailyRate * 0.5) : 0;
    const absenceDeduction = fullDaysAbsent * dailyRate;
    
    const isFullTime = employee.employee_type === 'Full Time';
    const statutoryTotal = isFullTime ? (
      (Number(payRecord.sss_contribution || 0)) +
      (Number(payRecord.philhealth_contribution || 0)) +
      (Number(payRecord.pagibig_contribution || 0))
    ) : 0;

    const totalDeductions = statutoryTotal +
      (Number(payRecord.cash_advance || 0)) +
      (Number(payRecord.food_allowance || 0)) +
      (Number(payRecord.other_deductions || 0)) +
      (Number(payRecord.late_deduction || 0)) +
      (Number(payRecord.undertime_deduction || 0));

    const lateUTHours = ((Number(payRecord.late_minutes || 0) + Number(payRecord.undertime_minutes || 0)) / 60).toFixed(2);
    
    // Derive day counts for holidays
    const regHolidayDays = Math.round((Number(payRecord.reg_holiday_pay || 0) / dailyRate) * 10) / 10;
    const specHolidayDays = Math.round((Number(payRecord.spec_holiday_pay || 0) / (dailyRate * 0.3)) * 10) / 10;

    return { 
      expectedDays, 
      potentialSalary, 
      fullDaysAbsent, 
      absenceDeduction, 
      halfDayDeduction, 
      totalDeductions, 
      dailyRate, 
      lateUTHours, 
      hasHalfDay, 
      statutoryTotal, 
      isFullTime,
      regHolidayDays,
      specHolidayDays
    };
  }, [payRecord, employee]);

  const renderPayslipContent = (record, emp, copyType) => {
    if (!calcData) return null;
    const otHours = Number(record.overtime_hours || 0).toFixed(2);
    return (
      <div className="payslip-print-block">
        <div className="copy-label">{copyType}</div>
        <div className="text-center mb-1.5 border-b-2 border-black pb-1">
          <h1 className="text-xl font-black uppercase tracking-tight">GT International</h1>
          <p className="text-[8px] font-bold tracking-[0.2em] uppercase">Official Payroll Ledger</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2 pb-1 border-b border-gray-300">
          <div className="text-left">
            <p className="text-[10px] font-black uppercase text-gray-500">Employee Details</p>
            <p className="text-sm font-black uppercase leading-tight">{emp?.name}</p>
            <p className="text-[9px] font-bold text-gray-600 uppercase italic leading-tight">{emp?.position} • ₱{calcData.dailyRate}/day</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-gray-500">Pay Period</p>
            <p className="text-xs font-black text-blue-800 leading-tight">{record.pay_period}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 text-[10px] mb-2 flex-grow">
          <div className="space-y-0.5 text-left">
            <h4 className="font-black border-b-2 border-gray-800 pb-0.5 uppercase text-blue-800 text-[11px]">Earnings Breakdown</h4>
            <div className="flex justify-between font-bold">
              <span>Expected Salary ({calcData.expectedDays}d):</span>
              <span>{formatCurrency(calcData.potentialSalary)}</span>
            </div>
            {calcData.fullDaysAbsent > 0 && (
              <div className="flex justify-between text-red-600 italic">
                <span>Absence ({calcData.fullDaysAbsent}d):</span>
                <span>-{formatCurrency(calcData.absenceDeduction)}</span>
              </div>
            )}
            {calcData.hasHalfDay && (
              <div className="flex justify-between text-orange-600 italic">
                <span>Half Day Adj:</span>
                <span>-{formatCurrency(calcData.halfDayDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-0.5 font-black text-gray-800 bg-gray-50 px-1">
              <span>Salary Earned:</span>
              <span>{formatCurrency(record.basic_salary)}</span>
            </div>
            
            {record.reg_holiday_pay > 0 && (
              <div className="flex justify-between pt-1 font-bold text-blue-700">
                <span>Reg. Holiday ({calcData.regHolidayDays}d):</span>
                <span>+{formatCurrency(record.reg_holiday_pay)}</span>
              </div>
            )}
            
            {record.spec_holiday_pay > 0 && (
              <div className="flex justify-between font-bold text-blue-700">
                <span>Spec. Holiday ({calcData.specHolidayDays}d):</span>
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
              {calcData.isFullTime && (
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
                  <span>Late/UT ({calcData.lateUTHours}h):</span>
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
              <span>{formatCurrency(calcData.totalDeductions)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-black p-2 mt-auto">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[11px] font-black uppercase">Net Take Home:</span>
            <span className="text-2xl font-black">{formatCurrency(record.net_pay)}</span>
          </div>
        </div>

        <div className="mt-4 mb-2 text-center">
          <p className="text-[8px] font-black uppercase leading-tight">
            "I AGREE & ACKNOWLEDGE RECEIVED IN FULL THE SALARY AMOUNT STATED ABOVE."
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 mt-2 mb-1">
          <div className="border-t-2 border-black pt-1 text-center text-[8px] font-black uppercase tracking-widest">Employee Signature</div>
          <div className="border-t-2 border-black pt-1 text-center text-[8px] font-black uppercase tracking-widest">Authorized By</div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center text-gray-400 font-black uppercase tracking-widest">Syncing Audit...</div>;
  if (!payRecord || !employee || !calcData) return <div className="p-20 text-center text-red-500 font-black uppercase">Record Not Found</div>;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="no-print space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-lg flex justify-between items-center text-left">
          <button onClick={() => navigate(-1)} className="text-blue-600 font-bold flex items-center hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
            <SafeIcon icon={FiArrowLeft} className="mr-2" /> Back
          </button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-[10px]">
            <SafeIcon icon={FiPrinter} className="mr-2" /> Print Payslips
          </button>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden text-left border border-gray-100">
          <div className="bg-gray-900 p-10 text-white flex justify-between items-center">
            <div className="flex items-center space-x-6">
              <div className="bg-blue-600 p-5 rounded-3xl shadow-xl"><SafeIcon icon={FiUser} className="text-4xl" /></div>
              <div>
                <h2 className="text-3xl font-black tracking-tight">{employee.name}</h2>
                <div className="flex items-center space-x-3">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{employee.position} • ID: {employee.employee_id}</p>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${calcData.isFullTime ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}`}>
                    {employee.employee_type}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Period Audit</p>
              <p className="text-3xl font-black text-blue-400">{payRecord.pay_period}</p>
            </div>
          </div>

          <div className="p-12 grid grid-cols-1 lg:grid-cols-2 gap-20">
            <div className="space-y-8">
              <h3 className="font-black text-green-700 border-b-2 border-green-50 pb-3 flex items-center uppercase text-xs tracking-widest">
                <SafeIcon icon={FiTrendingUp} className="mr-2" /> Earnings Audit
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold uppercase text-[10px]">Expected Salary ({calcData.expectedDays}d)</span>
                  <span className="font-black text-gray-800">{formatCurrency(calcData.potentialSalary)}</span>
                </div>
                {calcData.fullDaysAbsent > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span className="font-bold uppercase text-[10px]">Absence ({calcData.fullDaysAbsent}d)</span>
                    <span className="font-black">-{formatCurrency(calcData.absenceDeduction)}</span>
                  </div>
                )}
                {calcData.hasHalfDay && (
                  <div className="flex justify-between items-center text-orange-600">
                    <span className="font-bold uppercase text-[10px]">Half Day Adjustment</span>
                    <span className="font-black">-{formatCurrency(calcData.halfDayDeduction)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t font-black text-blue-800 bg-blue-50/30 p-2 rounded-xl">
                  <span className="uppercase text-[10px]">Salary Earned</span>
                  <span className="text-xl">{formatCurrency(payRecord.basic_salary)}</span>
                </div>

                {payRecord.reg_holiday_pay > 0 && (
                  <div className="flex justify-between items-center text-blue-600 bg-blue-50/20 p-2 rounded-xl border border-blue-50">
                    <span className="font-black uppercase text-[10px]">Regular Holiday ({calcData.regHolidayDays}d)</span>
                    <span className="font-black">+{formatCurrency(payRecord.reg_holiday_pay)}</span>
                  </div>
                )}
                
                {payRecord.spec_holiday_pay > 0 && (
                  <div className="flex justify-between items-center text-blue-600 bg-blue-50/20 p-2 rounded-xl border border-blue-50">
                    <span className="font-black uppercase text-[10px]">Special Holiday ({calcData.specHolidayDays}d)</span>
                    <span className="font-black">+{formatCurrency(payRecord.spec_holiday_pay)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-bold uppercase text-[10px]">Overtime ({Number(payRecord.overtime_hours).toFixed(2)}h)</span>
                  <span className="font-black text-green-600">+{formatCurrency(payRecord.overtime_pay)}</span>
                </div>

                {payRecord.allowances > 0 && (
                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                    <div className="flex justify-between items-center">
                      <span className="text-green-700 font-black uppercase text-[10px]">Allowances</span>
                      <span className="font-black text-green-700">+{formatCurrency(payRecord.allowances)}</span>
                    </div>
                    <p className="text-[9px] font-bold text-green-600/60 uppercase mt-1 italic">— {payRecord.allowance_description}</p>
                  </div>
                )}

                <div className="flex justify-between font-black text-2xl pt-6 border-t border-gray-100">
                  <span className="text-sm uppercase">Gross Earnings</span>
                  <span className="text-green-700">{formatCurrency(payRecord.gross_pay)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="font-black text-red-700 border-b-2 border-red-50 pb-3 flex items-center uppercase text-xs tracking-widest">
                <SafeIcon icon={FiIcons.FiTrendingDown} className="mr-2" /> Deductions Audit
              </h3>
              <div className="space-y-4">
                {calcData.isFullTime ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-xl border">
                      <p className="text-[8px] font-black text-gray-400 uppercase">SSS</p>
                      <p className="font-black text-xs">{formatCurrency(payRecord.sss_contribution)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border">
                      <p className="text-[8px] font-black text-gray-400 uppercase">PhilHealth</p>
                      <p className="font-black text-xs">{formatCurrency(payRecord.philhealth_contribution)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border">
                      <p className="text-[8px] font-black text-gray-400 uppercase">Pag-IBIG</p>
                      <p className="font-black text-xs">{formatCurrency(payRecord.pagibig_contribution)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest text-center">
                    <SafeIcon icon={FiInfo} className="inline mr-2" /> Statutory Benefits Restricted (Temp)
                  </div>
                )}

                <div className="flex justify-between items-center text-red-600 pt-4">
                  <span className="font-bold uppercase text-[10px] flex items-center">
                    <SafeIcon icon={FiIcons.FiClock} className="mr-1" /> Late/UT ({calcData.lateUTHours}h)
                  </span>
                  <span className="font-black">-{formatCurrency(Number(payRecord.late_deduction || 0) + Number(payRecord.undertime_deduction || 0))}</span>
                </div>

                {payRecord.food_allowance > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span className="font-bold uppercase text-[10px]">Food Deduction</span>
                    <span className="font-black">-{formatCurrency(payRecord.food_allowance)}</span>
                  </div>
                )}

                {payRecord.cash_advance > 0 && (
                  <div className="flex justify-between items-center text-red-500">
                    <span className="font-bold uppercase text-[10px]">Cash/Loan Repayment</span>
                    <span className="font-black">-{formatCurrency(payRecord.cash_advance)}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-3xl pt-10 border-t-2 border-gray-100 text-gray-900">
                  <span className="uppercase text-sm">Net Take Home</span>
                  <span className="text-blue-600 tracking-tighter">{formatCurrency(payRecord.net_pay)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="print-only">
        <div className="payslip-page-container">
          {renderPayslipContent(payRecord, employee, 'Employee Copy')}
          {renderPayslipContent(payRecord, employee, 'Company Copy')}
        </div>
      </div>
    </div>
  );
};

export default PayslipDetail;