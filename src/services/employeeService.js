import { supabase } from '../supabase.js';
import { getHoliday } from '../utils/holidays';

const inFlightRequests = new Map();

export const employeeService = {
  async deduplicate(key, fetcher) {
    if (inFlightRequests.has(key)) return inFlightRequests.get(key);
    const promise = fetcher().finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, promise);
    return promise;
  },

  async createEmployee(employeeData) {
    const { data, error } = await supabase.from('employees').insert([employeeData]).select();
    if (error) throw error;
    return data[0];
  },

  async updateEmployee(id, employeeData) {
    const { data, error } = await supabase.from('employees').update(employeeData).eq('id', id).select();
    if (error) throw error;
    return data[0];
  },

  async getEmployees(columns = 'id,employee_id,name,department,position,daily_salary,is_active,employee_type') {
    return this.deduplicate(`list-${columns}`, async () => {
      const { data, error } = await supabase.from('employees').select(columns).order('name', { ascending: true });
      if (error) throw error;
      return data;
    });
  },

  async getEmployeeBasicInfo() {
    return this.deduplicate('basic-info', async () => {
      const { data, error } = await supabase.from('employees').select('id,name,position,daily_salary,employee_type').eq('is_active', true).order('name', { ascending: true });
      if (error) throw error;
      return data;
    });
  },

  async getEmployeeById(id) {
    const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async deleteEmployee(id) {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
  },

  async getPendingDeductions(employeeId) {
    const { data, error } = await supabase
      .from('employee_deductions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_processed', false)
      .order('date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createDeduction(deductionData) {
    const { data, error } = await supabase.from('employee_deductions').insert([deductionData]).select();
    if (error) throw error;
    return data[0];
  },

  async deleteDeduction(id) {
    const { error } = await supabase.from('employee_deductions').delete().eq('id', id);
    if (error) throw error;
  },

  async createPayRecord(payData, deductionIds = []) {
    const { data: record, error: recordError } = await supabase.from('pay_records').insert([payData]).select().single();
    if (recordError) throw recordError;
    if (deductionIds.length > 0) {
      const { error: updateError } = await supabase
        .from('employee_deductions')
        .update({ is_processed: true, processed_in_record_id: record.id })
        .in('id', deductionIds);
      if (updateError) console.error('Failed to link deductions:', updateError);
    }
    return record;
  },

  async updatePayRecord(id, payData) {
    const { data, error } = await supabase.from('pay_records').update(payData).eq('id', id).select();
    if (error) throw error;
    return data[0];
  },

  async getPayRecordById(id) {
    const { data, error } = await supabase.from('pay_records').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  async deletePayRecord(id) {
    const { error } = await supabase.from('pay_records').delete().eq('id', id);
    if (error) throw error;
  },

  async getPayRecordsWithEmployees(limit = 1000) {
    const { data, error } = await supabase.from('pay_records').select(`
      id, pay_period, start_date, end_date, net_pay, employee_id, sss_contribution, philhealth_contribution, pagibig_contribution, thirteenth_month, basic_salary, overtime_hours, overtime_pay, late_deduction, undertime_deduction, reg_holiday_pay, spec_holiday_pay, holiday_pay, allowances, allowance_description, cash_advance, food_allowance, other_deductions, days_present, late_minutes, undertime_minutes, created_at,
      employees (name, position, department, employee_id, employee_type, daily_salary)
    `).order('start_date', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  async getPayRecords(employeeId, limit = 20) {
    const { data, error } = await supabase.from('pay_records').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return data;
  },

  async getAttendance(employeeId, startDate, endDate) {
    const { data, error } = await supabase.from('attendance').select('*').eq('employee_id', employeeId).gte('date', startDate).lte('date', endDate).order('date', { ascending: true });
    if (error) throw error;
    return data;
  },

  async createAttendance(data) {
    const { error } = await supabase.from('attendance').upsert(data, { onConflict: 'employee_id,date' });
    if (error) throw error;
  },

  async bulkCreateAttendance(records) {
    const { error } = await supabase.from('attendance').upsert(records, { onConflict: 'employee_id,date' });
    if (error) throw error;
  },

  async deleteAttendance(id) {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteAttendanceRange(employeeId, startDate, endDate) {
    const { error } = await supabase.from('attendance')
      .delete()
      .eq('employee_id', employeeId)
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;
  },

  async getAttendanceSummary(employeeId, startDate, endDate) {
    const attendance = await this.getAttendance(employeeId, startDate, endDate);
    let stats = {
      regularDaysPresent: 0,
      regularHolidaysPresent: 0,
      regularHolidaysAbsent: 0,
      specialHolidaysPresent: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      totalOvertimeMinutes: 0,
      thirteenthMonthDays: 0,
      totalRecords: attendance.length
    };

    const SHIFT_START_MINS = (8 * 60);
    const SHIFT_END_MINS = (17 * 60);
    const NOON_MINS = (12 * 60);

    attendance.forEach(log => {
      const holiday = getHoliday(log.date);
      const isPresent = ['present', 'late', 'holiday', 'undertime'].includes(log.status);
      let dayWeight = 1.0;
      let dayLateMinutes = (log.late_minutes || 0);
      let checkinMins = 0;

      if (log.check_in_time && isPresent) {
        const [h, m] = log.check_in_time.split(':').map(Number);
        checkinMins = (h * 60) + m;
        if (checkinMins >= NOON_MINS) {
          dayWeight = 0.5;
          dayLateMinutes = 0;
        }
        if (checkinMins < SHIFT_START_MINS) {
          stats.totalOvertimeMinutes += (SHIFT_START_MINS - checkinMins);
        }
      }

      const isHalfDay = checkinMins >= NOON_MINS;
      const undertimeMins = (log.undertime_minutes || 0);
      const isEligibleFor13th = isPresent && !isHalfDay && undertimeMins < 240;

      if (holiday) {
        if (holiday.type === 'regular') {
          isPresent ? stats.regularHolidaysPresent += dayWeight : stats.regularHolidaysAbsent++;
        } else {
          isPresent ? stats.specialHolidaysPresent += dayWeight : null;
        }
      } else if (isPresent) {
        stats.regularDaysPresent += dayWeight;
      }

      if (isEligibleFor13th) {
        stats.thirteenthMonthDays++;
      }

      stats.totalLateMinutes += dayLateMinutes;
      stats.totalUndertimeMinutes += undertimeMins;

      if (log.check_out_time && isPresent) {
        const [h, m] = log.check_out_time.split(':').map(Number);
        const checkoutTotal = (h * 60) + m;
        if (checkoutTotal > SHIFT_END_MINS) {
          stats.totalOvertimeMinutes += (checkoutTotal - SHIFT_END_MINS);
        }
      }
    });

    return stats;
  }
};