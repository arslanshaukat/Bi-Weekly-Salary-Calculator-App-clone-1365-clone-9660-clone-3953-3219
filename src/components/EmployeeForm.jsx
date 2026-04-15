import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import { parseISO, isValid } from 'date-fns';

const { FiUser, FiCalendar, FiCalculator, FiArrowLeft, FiTrendingUp, FiTrendingDown, FiSave, FiClock, FiChevronDown, FiHash, FiZap, FiBriefcase, FiShield, FiGift, FiTag } = FiIcons;

const EmployeeForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEmployee, setSelectedEmployee] = useState(location.state?.employee || null);
  const [employeesList, setEmployeesList] = useState([]);
  const existingRecord = location.state?.payRecord;
  const isEditEmployee = location.state?.isEditEmployee || false;
  const createNewEmployee = location.state?.createNew || false;
  const isEditPayroll = location.state?.isEdit || false;

  const initialFormState = {
    employee_id: '',
    name: '',
    department: '',
    position: '',
    daily_salary: '',
    employee_type: 'Full Time',
    sss_number: '',
    philhealth_number: '',
    pagibig_number: '',
    payPeriodStart: '',
    payPeriodEnd: '',
    payPeriodType: 'weekly',
    manualDays: '0',
    manualRegHolidays: '0',
    manualSpecHolidays: '0',
    lateMinutes: '0',
    undertimeMinutes: '0',
    overtimeMinutes: '0',
    otherAllowances: '0',
    allowanceDescription: '',
    thirteenth_month_days: '0',
    sssContribution: '0',
    philHealthContribution: '0',
    pagIbigContribution: '0',
    cashAdvance: '0',
    ednasFood: '0',
    otherDeductions: '0'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [pendingDeductionIds, setPendingDeductionIds] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

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
    const hydrateFullData = async () => {
      if (isEditEmployee && selectedEmployee?.id) {
        try {
          const fullData = await employeeService.getEmployeeById(selectedEmployee.id);
          setSelectedEmployee(fullData);
        } catch (e) {
          console.error("Hydration failed", e);
        }
      }
    };
    hydrateFullData();
  }, [isEditEmployee]);

  useEffect(() => {
    const syncAllData = async () => {
      if (selectedEmployee && formData.payPeriodStart && formData.payPeriodEnd && !isEditPayroll && !existingRecord && !isEditEmployee && !createNewEmployee) {
        setIsSyncing(true);
        try {
          const start = parseISO(formData.payPeriodStart);
          const end = parseISO(formData.payPeriodEnd);
          if (isValid(start) && isValid(end) && start <= end) {
            const stats = await employeeService.getAttendanceSummary(
              selectedEmployee.id,
              formData.payPeriodStart,
              formData.payPeriodEnd
            );
            const deductions = await employeeService.getPendingDeductions(selectedEmployee.id);
            setPendingDeductionIds(deductions.map(d => d.id));
            
            const ca = deductions.filter(d => d.category === 'Cash Advance' || d.category === 'Loan').reduce((s, d) => s + d.amount, 0);
            const food = deductions.filter(d => d.category === 'Food').reduce((s, d) => s + d.amount, 0);
            const other = deductions.filter(d => d.category === 'Others').reduce((s, d) => s + d.amount, 0);

            const isFullTime = formData.employee_type === 'Full Time';

            setFormData(prev => ({
              ...prev,
              manualDays: (stats.regularDaysPresent + stats.regularHolidaysPresent + stats.specialHolidaysPresent).toString(),
              thirteenth_month_days: (stats.thirteenthMonthDays || 0).toString(),
              lateMinutes: (stats.totalLateMinutes || 0).toString(),
              overtimeMinutes: (stats.totalOvertimeMinutes || 0).toString(),
              undertimeMinutes: (stats.totalUndertimeMinutes || 0).toString(),
              manualRegHolidays: (stats.regularHolidaysPresent || 0).toString(),
              manualSpecHolidays: isFullTime ? (stats.specialHolidaysPresent || 0).toString() : '0',
              cashAdvance: ca.toString(),
              ednasFood: food.toString(),
              otherDeductions: other.toString()
            }));
          }
        } catch (e) {
          console.error('Unified sync error:', e);
        } finally {
          setIsSyncing(false);
        }
      }
    };
    syncAllData();
  }, [formData.payPeriodStart, formData.payPeriodEnd, selectedEmployee, isEditPayroll, existingRecord, formData.employee_type]);

  useEffect(() => {
    if (selectedEmployee) {
      setFormData(prev => ({
        ...prev,
        employee_id: selectedEmployee.employee_id || '',
        name: selectedEmployee.name || '',
        department: selectedEmployee.department || '',
        position: selectedEmployee.position || '',
        daily_salary: selectedEmployee.daily_salary?.toString() || '',
        employee_type: selectedEmployee.employee_type || 'Full Time',
        sss_number: selectedEmployee.sss_number || '',
        philhealth_number: selectedEmployee.philhealth_number || '',
        pagibig_number: selectedEmployee.pagibig_number || '',
      }));
    }
  }, [selectedEmployee]);

  useEffect(() => {
    if (existingRecord && isEditPayroll) {
      setFormData(prev => ({
        ...prev,
        payPeriodStart: existingRecord.start_date || '',
        payPeriodEnd: existingRecord.end_date || '',
        manualDays: existingRecord.days_present?.toString() || '0',
        thirteenth_month_days: existingRecord.thirteenth_month_days?.toString() || '0',
        manualRegHolidays: existingRecord.reg_holiday_pay ? (existingRecord.reg_holiday_pay / (Number(formData.daily_salary) || 1)).toString() : '0',
        manualSpecHolidays: existingRecord.spec_holiday_pay ? (existingRecord.spec_holiday_pay / ((Number(formData.daily_salary) || 1) * 0.3)).toString() : '0',
        overtimeMinutes: ((existingRecord.overtime_hours || 0) * 60).toString(),
        lateMinutes: (existingRecord.late_minutes || 0).toString(),
        undertimeMinutes: (existingRecord.undertime_minutes || 0).toString(),
        otherAllowances: (existingRecord.allowances || 0).toString(),
        allowanceDescription: existingRecord.allowance_description || '',
        sssContribution: (existingRecord.sss_contribution || 0).toString(),
        philHealthContribution: (existingRecord.philhealth_contribution || 0).toString(),
        pagIbigContribution: (existingRecord.pagibig_contribution || 0).toString(),
        cashAdvance: (existingRecord.cash_advance || 0).toString(),
        ednasFood: (existingRecord.food_allowance || 0).toString(),
        otherDeductions: (existingRecord.other_deductions || 0).toString(),
        payPeriodType: existingRecord.pay_period_type || 'weekly'
      }));
    }
  }, [existingRecord, isEditPayroll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (createNewEmployee || isEditEmployee) {
        const empData = {
          employee_id: formData.employee_id,
          name: formData.name,
          department: formData.department,
          position: formData.position,
          daily_salary: Number(formData.daily_salary) || 0,
          employee_type: formData.employee_type,
          sss_number: formData.sss_number,
          philhealth_number: formData.philhealth_number,
          pagibig_number: formData.pagibig_number,
          is_active: true
        };
        if (isEditEmployee) await employeeService.updateEmployee(selectedEmployee.id, empData);
        else await employeeService.createEmployee(empData);
        toast.success(isEditEmployee ? 'Profile Updated' : 'Employee Added');
        navigate('/');
        return;
      }

      const round = (num) => Math.round(num * 100) / 100;
      const dailySalary = Number(formData.daily_salary) || 0;
      const minuteRate = (dailySalary / 8) / 60;
      const isFullTime = formData.employee_type === 'Full Time';

      const regDays = Number(formData.manualDays) || 0;
      const regHolidays = Number(formData.manualRegHolidays) || 0;
      const specHolidays = isFullTime ? (Number(formData.manualSpecHolidays) || 0) : 0;
      
      const basicPay = round(dailySalary * regDays);
      const regHolidayPay = round(regHolidays * dailySalary);
      const specHolidayPay = round(specHolidays * dailySalary * 0.3);
      const otPay = round(Number(formData.overtimeMinutes || 0) * minuteRate);
      const allowances = round(Number(formData.otherAllowances || 0));
      
      const grossPay = round(basicPay + regHolidayPay + specHolidayPay + otPay + allowances);
      
      const lateDed = round(Number(formData.lateMinutes || 0) * minuteRate);
      const undertimeDed = round(Number(formData.undertimeMinutes || 0) * minuteRate);
      
      const eligible13thDays = Number(formData.thirteenth_month_days || 0);
      const thirteenth = isFullTime ? round((dailySalary * eligible13thDays) / 12) : 0;
      
      const sss = isFullTime ? round(Number(formData.sssContribution || 0)) : 0;
      const ph = isFullTime ? round(Number(formData.philHealthContribution || 0)) : 0;
      const pi = isFullTime ? round(Number(formData.pagIbigContribution || 0)) : 0;
      const ca = round(Number(formData.cashAdvance || 0));
      const food = round(Number(formData.ednasFood || 0));
      const other = round(Number(formData.otherDeductions || 0));
      
      const totalDeductions = round(sss + ph + pi + lateDed + undertimeDed + ca + food + other);

      const recordData = {
        employee_id: selectedEmployee.id,
        pay_period: `${formData.payPeriodStart} to ${formData.payPeriodEnd}`,
        start_date: formData.payPeriodStart,
        end_date: formData.payPeriodEnd,
        days_present: regDays,
        thirteenth_month_days: eligible13thDays,
        basic_salary: basicPay,
        reg_holiday_pay: regHolidayPay,
        spec_holiday_pay: specHolidayPay,
        overtime_hours: round(Number(formData.overtimeMinutes || 0) / 60),
        overtime_pay: otPay,
        late_minutes: Number(formData.lateMinutes),
        late_deduction: lateDed,
        undertime_minutes: Number(formData.undertimeMinutes),
        undertime_deduction: undertimeDed,
        thirteenth_month: thirteenth,
        allowances: allowances,
        allowance_description: formData.allowanceDescription,
        sss_contribution: sss,
        philhealth_contribution: ph,
        pagibig_contribution: pi,
        cash_advance: ca,
        food_allowance: food,
        other_deductions: other,
        gross_pay: grossPay,
        net_pay: Math.max(0, round(grossPay - totalDeductions)),
        pay_period_type: formData.payPeriodType
      };

      if (isEditPayroll && existingRecord) {
        await employeeService.updatePayRecord(existingRecord.id, recordData);
        toast.success('Record Updated');
      } else {
        await employeeService.createPayRecord(recordData, pendingDeductionIds);
        toast.success('Payroll Saved');
      }
      navigate('/results');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const isCalcMode = !createNewEmployee && !isEditEmployee;
  const isProfileMode = createNewEmployee || isEditEmployee;
  const isFullTime = formData.employee_type === 'Full Time';

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden text-left">
        <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <SafeIcon icon={isProfileMode ? FiUser : FiCalculator} className="text-2xl" />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-bold uppercase tracking-tight">
                {createNewEmployee ? 'New Employee Entry' : isEditEmployee ? 'Profile Update' : 'Payroll Processor'}
              </h2>
              <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.2em]">GT International • Ledger v1.0</p>
            </div>
          </div>
          <button type="button" onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full">
            <SafeIcon icon={FiArrowLeft} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {isCalcMode && !isEditPayroll && (
            <section className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 mb-8">
              <label className="block text-[10px] font-black text-blue-600 mb-2 uppercase tracking-widest">Select Personnel to Process</label>
              <div className="relative">
                <select 
                  onChange={(e) => {
                    const emp = employeesList.find(emp => emp.id === e.target.value);
                    if (emp) {
                      employeeService.getEmployeeById(emp.id).then(setSelectedEmployee);
                    } else {
                      setSelectedEmployee(null);
                      setFormData(initialFormState);
                    }
                  }}
                  value={selectedEmployee?.id || ''}
                  className="w-full pl-4 pr-10 py-4 bg-white border-2 border-blue-100 rounded-2xl font-black text-gray-800 appearance-none focus:border-blue-500 outline-none transition-all shadow-sm"
                >
                  <option value="">— Select from Active Roster —</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.position})</option>
                  ))}
                </select>
                <SafeIcon icon={FiChevronDown} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-3 border-b pb-2">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center">
                <SafeIcon icon={FiUser} className="mr-2" /> Profile Identity
              </h3>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Full Legal Name</label>
              <div className="relative">
                <SafeIcon icon={FiUser} className="absolute left-3 top-3.5 text-gray-400 text-xs" />
                <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full pl-9 pr-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-bold" required disabled={isCalcMode && !isEditEmployee} />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Internal ID</label>
              <div className="relative">
                <SafeIcon icon={FiHash} className="absolute left-3 top-3.5 text-gray-400 text-xs" />
                <input type="text" value={formData.employee_id} onChange={(e) => setFormData(p => ({ ...p, employee_id: e.target.value }))} className="w-full pl-9 pr-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-bold" required disabled={isCalcMode && !isEditEmployee} />
              </div>
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Department</label>
              <input type="text" value={formData.department} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-bold" required disabled={isCalcMode && !isEditEmployee} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Position</label>
              <input type="text" value={formData.position} onChange={(e) => setFormData(p => ({ ...p, position: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-bold" required disabled={isCalcMode && !isEditEmployee} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Daily Rate (₱)</label>
              <input type="number" value={formData.daily_salary} onChange={(e) => setFormData(p => ({ ...p, daily_salary: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-black" required disabled={isCalcMode && !isEditEmployee} />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Employment Type</label>
              <div className="relative">
                <select value={formData.employee_type} onChange={(e) => setFormData(p => ({ ...p, employee_type: e.target.value }))} className="w-full px-4 py-3 border rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-black appearance-none" disabled={isCalcMode && !isEditEmployee} >
                  <option value="Full Time">Full Time</option>
                  <option value="Temporary">Temporary</option>
                </select>
                <SafeIcon icon={FiChevronDown} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {isProfileMode && (
              <>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">SSS Number</label>
                  <div className="relative">
                    <SafeIcon icon={FiShield} className="absolute left-3 top-3.5 text-gray-400 text-xs" />
                    <input type="text" value={formData.sss_number} onChange={(e) => setFormData(p => ({ ...p, sss_number: e.target.value }))} className="w-full pl-9 pr-4 py-3 border rounded-xl bg-white font-mono font-bold" placeholder="00-0000000-0" />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">PhilHealth ID</label>
                  <div className="relative">
                    <SafeIcon icon={FiTag} className="absolute left-3 top-3.5 text-gray-400 text-xs" />
                    <input type="text" value={formData.philhealth_number} onChange={(e) => setFormData(p => ({ ...p, philhealth_number: e.target.value }))} className="w-full pl-9 pr-4 py-3 border rounded-xl bg-white font-mono font-bold" placeholder="00-000000000-0" />
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Pag-IBIG Number</label>
                  <div className="relative">
                    <SafeIcon icon={FiBriefcase} className="absolute left-3 top-3.5 text-gray-400 text-xs" />
                    <input type="text" value={formData.pagibig_number} onChange={(e) => setFormData(p => ({ ...p, pagibig_number: e.target.value }))} className="w-full pl-9 pr-4 py-3 border rounded-xl bg-white font-mono font-bold" placeholder="0000-0000-0000" />
                  </div>
                </div>
              </>
            )}
          </section>

          {isCalcMode && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-4 border-b pb-2">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center">
                    <SafeIcon icon={FiCalendar} className="mr-2" /> Time & Period Tracker
                  </h3>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Start Date</label>
                  <input type="date" value={formData.payPeriodStart} onChange={(e) => setFormData(p => ({ ...p, payPeriodStart: e.target.value }))} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">End Date</label>
                  <input type="date" value={formData.payPeriodEnd} onChange={(e) => setFormData(p => ({ ...p, payPeriodEnd: e.target.value }))} className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 font-bold" required />
                </div>
                <div className="md:col-span-2 bg-gray-900 p-6 rounded-3xl text-white shadow-2xl flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-2xl transition-all ${isSyncing ? 'bg-orange-600 animate-pulse' : 'bg-blue-600'}`}>
                      <SafeIcon icon={isSyncing ? FiZap : FiClock} className="text-xl" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center">
                        <SafeIcon icon={FiZap} className="mr-1" /> {isSyncing ? 'Syncing Full Ledger...' : 'Auto-calc Work Days'}
                      </p>
                      <input type="number" step="0.1" value={formData.manualDays} onChange={(e) => setFormData(p => ({ ...p, manualDays: e.target.value }))} className="bg-transparent text-3xl font-black focus:outline-none w-24 border-b-2 border-blue-600" />
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-green-700 uppercase tracking-widest flex items-center"><SafeIcon icon={FiTrendingUp} className="mr-2" /> Earnings & Accruals</h3>
                  <div className="grid grid-cols-2 gap-4 bg-green-50/50 p-6 rounded-3xl border border-green-100">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Reg. Holidays</label>
                      <input type="number" value={formData.manualRegHolidays} onChange={(e) => setFormData(p => ({ ...p, manualRegHolidays: e.target.value }))} className="w-full px-4 py-3 border rounded-xl font-bold bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Spec. Holidays</label>
                      <input type="number" value={isFullTime ? formData.manualSpecHolidays : '0'} onChange={(e) => setFormData(p => ({ ...p, manualSpecHolidays: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl font-bold bg-white ${!isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isFullTime} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">OT Minutes</label>
                      <input type="number" value={formData.overtimeMinutes} onChange={(e) => setFormData(p => ({ ...p, overtimeMinutes: e.target.value }))} className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl font-black text-blue-600 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-blue-600 mb-1.5 uppercase tracking-widest flex items-center">
                        <SafeIcon icon={FiGift} className="mr-1" /> 13th Mo. Days
                      </label>
                      <input type="number" value={isFullTime ? formData.thirteenth_month_days : '0'} onChange={(e) => setFormData(p => ({ ...p, thirteenth_month_days: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl font-black bg-blue-50 text-blue-800 ${!isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isFullTime} />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Other Allowances</label>
                      <input type="number" value={formData.otherAllowances} onChange={(e) => setFormData(p => ({ ...p, otherAllowances: e.target.value }))} className="w-full px-4 py-3 border rounded-xl font-bold bg-white" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-black text-red-700 uppercase tracking-widest flex items-center"><SafeIcon icon={FiTrendingDown} className="mr-2" /> Deductions Ledger</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-red-50/50 p-6 rounded-3xl border border-red-100">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Late Mins</label>
                      <input type="number" value={formData.lateMinutes} onChange={(e) => setFormData(p => ({ ...p, lateMinutes: e.target.value }))} className="w-full px-4 py-3 border-2 border-red-200 rounded-xl font-black text-red-600 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">UT Mins</label>
                      <input type="number" value={formData.undertimeMinutes} onChange={(e) => setFormData(p => ({ ...p, undertimeMinutes: e.target.value }))} className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl font-black text-orange-600 bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">SSS Contrib.</label>
                      <input type="number" value={isFullTime ? formData.sssContribution : '0'} onChange={(e) => setFormData(p => ({ ...p, sssContribution: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl font-bold bg-white ${!isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isFullTime} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">PhilHealth</label>
                      <input type="number" value={isFullTime ? formData.philHealthContribution : '0'} onChange={(e) => setFormData(p => ({ ...p, philHealthContribution: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl font-bold bg-white ${!isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isFullTime} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Pag-IBIG</label>
                      <input type="number" value={isFullTime ? formData.pagIbigContribution : '0'} onChange={(e) => setFormData(p => ({ ...p, pagIbigContribution: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl font-bold bg-white ${!isFullTime ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={!isFullTime} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-red-600 mb-1.5 uppercase tracking-widest">Cash Adv.</label>
                      <input type="number" value={formData.cashAdvance} onChange={(e) => setFormData(p => ({ ...p, cashAdvance: e.target.value }))} className="w-full px-4 py-3 border-2 border-red-200 rounded-xl font-black bg-white" />
                    </div>
                    <div className="col-span-full">
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Other Ded.</label>
                      <input type="number" value={formData.otherDeductions} onChange={(e) => setFormData(p => ({ ...p, otherDeductions: e.target.value }))} className="w-full px-4 py-3 border rounded-xl font-bold bg-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-8 border-t flex flex-col sm:flex-row justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-8 py-3.5 border rounded-2xl font-black text-gray-500 hover:bg-gray-50 uppercase tracking-widest text-[10px]">Cancel</button>
            <button type="submit" className="px-12 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 uppercase tracking-widest text-[10px]">
              <SafeIcon icon={isEditPayroll ? FiSave : (createNewEmployee || isEditEmployee ? FiUser : FiCalculator)} />
              <span>{createNewEmployee ? 'Save Employee' : isEditEmployee ? 'Update Profile' : 'Commit To Ledger'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;