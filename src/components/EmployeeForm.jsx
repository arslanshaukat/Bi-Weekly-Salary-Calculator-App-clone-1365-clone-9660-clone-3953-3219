import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import { parseISO, format, eachDayOfInterval, isSunday } from 'date-fns';

const { FiCalculator, FiArrowLeft, FiTrendingUp, FiTrendingDown, FiSave, FiClock, FiShield } = FiIcons;

const EmployeeForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEmployee, setSelectedEmployee] = useState(location.state?.employee || null);
  const [employeesList, setEmployeesList] = useState([]);
  const existingRecord = location.state?.payRecord;
  const isEditPayroll = location.state?.isEdit || false;

  const initialFormState = {
    employee_id: '',
    name: '',
    department: '',
    position: '',
    daily_salary: '',
    employee_type: 'Full Time',
    payPeriodStart: existingRecord?.start_date || '',
    payPeriodEnd: existingRecord?.end_date || '',
    manualDays: existingRecord?.days_present?.toString() || '0',
    manualRegHolidays: existingRecord?.reg_holiday_pay ? (existingRecord.reg_holiday_pay / (existingRecord.basic_salary / existingRecord.days_present)).toString() : '0',
    manualSpecHolidays: '0',
    lateMinutes: '0', // will be recalculated from attendance
    undertimeMinutes: existingRecord?.undertime_minutes?.toString() || '0',
    overtimeMinutes: ((existingRecord?.overtime_hours || 0) * 60).toString(),
    otherAllowances: existingRecord?.allowances?.toString() || '0',
    allowanceDescription: existingRecord?.allowance_description || '',
    sssContribution: existingRecord?.sss_contribution?.toString() || '0',
    philHealthContribution: existingRecord?.philhealth_contribution?.toString() || '0',
    pagIbigContribution: existingRecord?.pagibig_contribution?.toString() || '0',
    otherDeductions: existingRecord?.other_deductions?.toString() || '0',
    thirteenthMonth: existingRecord?.thirteenth_month?.toString() || '0',
    thirteenthMonthDays: existingRecord?.thirteenth_month_days?.toString() || '0'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [pendingItems, setPendingItems] = useState([]);
  const [appliedDeductions, setAppliedDeductions] = useState({});

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployeeBasicInfo();
        setEmployeesList(data);
      } catch (error) {
        console.error('Failed to load employee list');
      }
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    const syncAttendanceData = async () => {
      if (selectedEmployee && formData.payPeriodStart && formData.payPeriodEnd) {
        try {
          {
            const stats = await employeeService.getAttendanceSummary(
              selectedEmployee.id,
              formData.payPeriodStart,
              formData.payPeriodEnd
            );
            // Calculate 13th month based on daily salary and eligible days
            const dailySal = Number(selectedEmployee.daily_salary || 0);
            const thirteenthAmt = dailySal > 0 ? Math.round((dailySal * stats.thirteenthMonthDays / 12) * 100) / 100 : 0;
            // Days present = ONLY regular working days (holidays paid separately via reg/spec holiday pay)
            const totalDaysPresent = (stats.regularDaysPresent || 0);
            setFormData(prev => ({
              ...prev,
              manualDays: totalDaysPresent.toString(),
              lateMinutes: (stats.totalLateMinutes || 0).toString(),
              overtimeMinutes: (stats.totalOvertimeMinutes || 0).toString(),
              undertimeMinutes: (stats.totalUndertimeMinutes || 0).toString(),
              manualRegHolidays: (selectedEmployee.employee_type === 'Full Time') 
                ? (stats.regularHolidaysPresent || 0).toString()
                : (stats.regularHolidaysWorked || 0).toString(),
              manualSpecHolidays: (selectedEmployee.employee_type === 'Full Time') ? (stats.specialHolidaysPresent || 0).toString() : '0',
              thirteenthMonthDays: (stats.thirteenthMonthDays || 0).toString(),
              thirteenthMonth: thirteenthAmt.toString(),
            }));
          }
          const deductions = await employeeService.getPendingDeductions(
            selectedEmployee.id,
            isEditPayroll ? existingRecord.id : null
          );
          setPendingItems(deductions);
          const initialApplied = {};
          if (isEditPayroll && existingRecord.applied_deductions) {
            existingRecord.applied_deductions.forEach(d => { initialApplied[d.id] = d.amount; });
          } else {
            deductions.forEach(d => { initialApplied[d.id] = d.amount; });
          }
          setAppliedDeductions(initialApplied);
        } catch (e) {
          console.error('Attendance sync error:', e);
        }
      }
    };
    syncAttendanceData();
  }, [formData.payPeriodStart, formData.payPeriodEnd, selectedEmployee]);

  useEffect(() => {
    if (selectedEmployee) {
      setFormData(prev => ({
        ...prev,
        employee_id: selectedEmployee.employee_id || '',
        name: selectedEmployee.name || '',
        daily_salary: selectedEmployee.daily_salary?.toString() || '',
        employee_type: selectedEmployee.employee_type || 'Full Time',
      }));
    }
  }, [selectedEmployee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const round = (num) => Math.round(num * 100) / 100;
      const dailySalary = Number(formData.daily_salary) || 0;
      const minuteRate = (dailySalary / 8) / 60;
      const isFullTime = formData.employee_type === 'Full Time';

      const basicPay = round(dailySalary * (Number(formData.manualDays) || 0));
      const regHolidayPay = isFullTime 
        ? round((Number(formData.manualRegHolidays) || 0) * dailySalary)
        : 0; // Non-full-time: no holiday pay when off, worked holidays already in basic days
      const specHolidayPay = isFullTime ? round((Number(formData.manualSpecHolidays) || 0) * dailySalary * 0.3) : 0;
      const otPay = round(Number(formData.overtimeMinutes || 0) * minuteRate);
      const allowances = round(Number(formData.otherAllowances || 0));

      const lateDed = round(Number(formData.lateMinutes || 0) * minuteRate);
      const undertimeDed = round(Number(formData.undertimeMinutes || 0) * minuteRate);

      // Gross Pay calculation
      const grossPay = round(basicPay + regHolidayPay + specHolidayPay + otPay + allowances - lateDed - undertimeDed);

      const finalApplied = pendingItems
        .filter(item => appliedDeductions[item.id] > 0)
        .map(item => ({ id: item.id, category: item.category, date: item.date, amount: appliedDeductions[item.id] }));
      
      const totalLiabilities = finalApplied.reduce((sum, item) => sum + item.amount, 0);
      const sss = round(Number(formData.sssContribution || 0));
      const ph = round(Number(formData.philHealthContribution || 0));
      const pi = round(Number(formData.pagIbigContribution || 0));
      const other = round(Number(formData.otherDeductions || 0));

      const netPay = round(grossPay - (sss + ph + pi + totalLiabilities + other));

      const recordData = {
        employee_id: selectedEmployee.id,
        pay_period: `${formData.payPeriodStart} to ${formData.payPeriodEnd}`,
        start_date: formData.payPeriodStart,
        end_date: formData.payPeriodEnd,
        days_present: Number(formData.manualDays),
        basic_salary: basicPay,
        reg_holiday_pay: regHolidayPay,
        spec_holiday_pay: specHolidayPay,
        overtime_hours: round(Number(formData.overtimeMinutes || 0) / 60),
        overtime_pay: otPay,
        late_minutes: Number(formData.lateMinutes),
        late_deduction: lateDed,
        undertime_minutes: Number(formData.undertimeMinutes),
        undertime_deduction: undertimeDed,
        allowances: allowances,
        allowance_description: formData.allowanceDescription,
        sss_contribution: sss,
        philhealth_contribution: ph,
        pagibig_contribution: pi,
        other_deductions: other,
        gross_pay: grossPay,
        net_pay: netPay,
        applied_deductions: finalApplied,
        thirteenth_month: round(Number(formData.thirteenthMonth || 0)),
        thirteenth_month_days: Number(formData.thirteenthMonthDays || 0)
      };

      if (isEditPayroll && existingRecord) {
        await employeeService.updatePayRecord(existingRecord.id, recordData, finalApplied);
      } else {
        await employeeService.createPayRecord(recordData, finalApplied);
      }
      toast.success('Payroll Processed');
      navigate('/results');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12 text-left">
      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-white flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SafeIcon icon={FiCalculator} className="text-3xl" />
            <h2 className="text-2xl font-black uppercase tracking-tight">Financial Blueprint</h2>
          </div>
          <button onClick={() => navigate(-1)} className="p-3 hover:bg-white/10 rounded-full transition-colors">
            <SafeIcon icon={FiArrowLeft} className="text-xl" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-10 space-y-12">
          {!isEditPayroll && (
            <section className="bg-blue-50/50 p-8 rounded-[2rem] border-2 border-blue-100">
              <label className="block text-[10px] font-black text-blue-600 mb-3 uppercase tracking-widest">Select Personnel</label>
              <select 
                onChange={(e) => setSelectedEmployee(employeesList.find(emp => emp.id === e.target.value))} 
                value={selectedEmployee?.id || ''}
                className="w-full px-6 py-5 bg-white border-2 border-blue-100 rounded-2xl font-black text-gray-800 appearance-none focus:border-blue-500 outline-none transition-all shadow-sm text-lg"
              >
                <option value="">— Select Active Roster —</option>
                {employeesList.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Earnings Column */}
            <div className="space-y-10">
              <section className="space-y-6">
                <h3 className="text-sm font-black text-green-700 uppercase tracking-[0.2em] flex items-center border-b border-green-50 pb-2">
                  <SafeIcon icon={FiTrendingUp} className="mr-2" /> Earnings & Time
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-full grid grid-cols-2 gap-4">
                    <input type="date" value={formData.payPeriodStart} onChange={(e) => setFormData(p => ({ ...p, payPeriodStart: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50" required />
                    <input type="date" value={formData.payPeriodEnd} onChange={(e) => setFormData(p => ({ ...p, payPeriodEnd: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50" required />
                  </div>

                  <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white flex items-center justify-between col-span-full shadow-2xl relative overflow-hidden">
                    <div className="text-left relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Days Present</p>
                      <input type="number" step="0.1" value={formData.manualDays} onChange={(e) => setFormData(p => ({ ...p, manualDays: e.target.value }))} className="bg-transparent text-4xl font-black focus:outline-none w-32 border-b-4 border-blue-600" />
                    </div>
                    <div className="text-right relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">OT Minutes</p>
                      <input type="number" value={formData.overtimeMinutes} onChange={(e) => setFormData(p => ({ ...p, overtimeMinutes: e.target.value }))} className="bg-transparent text-3xl font-black focus:outline-none w-24 text-right text-green-400 border-b-4 border-green-600/30" />
                    </div>
                  </div>

                  <div className="col-span-full grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Other Allowances</label>
                      <input type="number" value={formData.otherAllowances} onChange={(e) => setFormData(p => ({ ...p, otherAllowances: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Allowance Note</label>
                      <input type="text" value={formData.allowanceDescription} onChange={(e) => setFormData(p => ({ ...p, allowanceDescription: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl font-bold bg-gray-50" placeholder="e.g. Fuel" />
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Deductions Column */}
            <div className="space-y-10">
              <section className="space-y-6">
                <h3 className="text-sm font-black text-red-700 uppercase tracking-[0.2em] flex items-center border-b border-red-50 pb-2">
                  <SafeIcon icon={FiTrendingDown} className="mr-2" /> Deductions & Penalties
                </h3>
                
                <div className="bg-red-50/30 p-8 rounded-[2.5rem] border-2 border-red-50 space-y-6">
                  <div className="grid grid-cols-2 gap-4 border-b border-red-100 pb-6">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Late Minutes</label>
                      <input type="number" value={formData.lateMinutes} onChange={(e) => setFormData(p => ({ ...p, lateMinutes: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl font-black bg-white focus:border-red-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">UT Minutes</label>
                      <input type="number" value={formData.undertimeMinutes} onChange={(e) => setFormData(p => ({ ...p, undertimeMinutes: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl font-black bg-white focus:border-red-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[8px] font-black text-gray-400 mb-1 uppercase tracking-widest">SSS</label>
                      <input type="number" value={formData.sssContribution} onChange={(e) => setFormData(p => ({ ...p, sssContribution: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-gray-400 mb-1 uppercase tracking-widest">Ph-Health</label>
                      <input type="number" value={formData.philHealthContribution} onChange={(e) => setFormData(p => ({ ...p, philHealthContribution: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold text-xs" />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-gray-400 mb-1 uppercase tracking-widest">Pag-IBIG</label>
                      <input type="number" value={formData.pagIbigContribution} onChange={(e) => setFormData(p => ({ ...p, pagIbigContribution: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold text-xs" />
                    </div>
                  </div>

                  <div className="pt-4">
                    <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest">Other Deductions</label>
                    <input type="number" value={formData.otherDeductions} onChange={(e) => setFormData(p => ({ ...p, otherDeductions: e.target.value }))} className="w-full px-5 py-4 border-2 border-gray-200 rounded-2xl font-black bg-white" placeholder="0.00" />
                  </div>
                  <div className="pt-4">
                    <label className="block text-[10px] font-black text-green-600 mb-2 uppercase tracking-widest">13th Month Pay</label>
                    <input type="number" value={formData.thirteenthMonth} onChange={(e) => setFormData(p => ({ ...p, thirteenthMonth: e.target.value }))} className="w-full px-5 py-4 border-2 border-green-200 rounded-2xl font-black bg-white" placeholder="0.00" />
                  </div>
                  <div className="pt-2">
                    <label className="block text-[10px] font-black text-green-600 mb-2 uppercase tracking-widest">13th Month Days Counted</label>
                    <input type="number" value={formData.thirteenthMonthDays} onChange={(e) => setFormData(p => ({ ...p, thirteenthMonthDays: e.target.value }))} className="w-full px-5 py-4 border-2 border-green-200 rounded-2xl font-black bg-white" placeholder="0" />
                  </div>
                </div>

                {pendingItems.length > 0 && (
                  <div className="bg-purple-50 p-6 rounded-[2rem] border border-purple-100 space-y-4">
                    <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center">
                      <SafeIcon icon={FiShield} className="mr-2" /> Outstanding Liabilities
                    </h4>
                    <div className="space-y-2">
                      {pendingItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-purple-50">
                          <div className="text-left">
                            <span className="text-[9px] font-black uppercase text-gray-800 block">{item.category}</span>
                            <span className="text-[8px] text-gray-400 font-bold uppercase">{format(parseISO(item.date), 'MM/dd/yyyy')}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="font-black text-red-500 text-xs">₱{item.amount}</span>
                            <input 
                              type="checkbox" 
                              checked={appliedDeductions[item.id] > 0} 
                              onChange={(e) => setAppliedDeductions(p => ({ ...p, [item.id]: e.target.checked ? item.amount : 0 }))}
                              className="w-5 h-5 rounded-lg accent-purple-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="pt-10 border-t border-gray-100 flex flex-col items-end space-y-4">
            <button type="submit" className="px-20 py-6 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs flex items-center group">
               <SafeIcon icon={FiSave} className="mr-3 text-lg group-hover:scale-110 transition-transform" />
               {isEditPayroll ? 'Commit Update' : 'Generate Payslip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;