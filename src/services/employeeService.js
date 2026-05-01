import { pb } from '../supabase.js';
import { getHoliday } from '../utils/holidays';

const inFlightRequests = new Map();

const SHIFT_START = 8 * 60;
const LUNCH_START = 12 * 60;
const LUNCH_END = 13 * 60;
const SHIFT_END = 17 * 60;

// Helper: map PocketBase record to Supabase-compatible format
function mapRecord(record) {
  const r = { ...record };
  if (r.sb_id) { r.id = r.sb_id; delete r.sb_id; }
  delete r.collectionId;
  delete r.collectionName;
  // Normalize date fields to YYYY-MM-DD format
  if (r.date && r.date.includes(" ")) r.date = r.date.split(" ")[0];
  if (r.start_date && r.start_date.includes(" ")) r.start_date = r.start_date.split(" ")[0];
  if (r.end_date && r.end_date.includes(" ")) r.end_date = r.end_date.split(" ")[0];
  // Normalize timestamp fields to ISO format
  if (r.created_at && typeof r.created_at === "string") r.created_at = r.created_at.replace(" ", "T"); else if (!r.created_at) r.created_at = new Date().toISOString();
  if (r.updated_at && r.updated_at.includes(" ")) r.updated_at = r.updated_at.replace(" ", "T");
  if (r.modified_at && r.modified_at.includes(" ")) r.modified_at = r.modified_at.replace(" ", "T");
  if (r.pay_date && r.pay_date.includes(" ")) r.pay_date = r.pay_date.split(" ")[0];
  // Convert empty strings to numbers for numeric fields
  const numericFields = ["basic_salary","gross_pay","net_pay","overtime_hours","overtime_pay","holiday_hours","holiday_pay","undertime_hours","undertime_deduction","late_minutes","late_deduction","allowances","thirteenth_month","sss_contribution","philhealth_contribution","pagibig_contribution","cash_advance","loans","food_allowance","other_deductions","days_present","overtime_minutes","undertime_minutes","reg_holiday_pay","spec_holiday_pay","thirteenth_month_days","daily_salary","late_minutes","undertime_minutes"];
  numericFields.forEach(f => {
    if (r[f] === '' || r[f] === null || r[f] === undefined) r[f] = 0;
    else if (typeof r[f] === 'string') r[f] = parseFloat(r[f]) || 0;
  });

  return r;
}

export const employeeService = {

  // --- HOLIDAY MANAGEMENT ---
  async getHolidays() {
    try {
      const records = await pb.collection('holidays_1773420000000').getFullList({ sort: 'date' });
      return records.map(mapRecord);
    } catch(e) { return []; }
  },

  async upsertHoliday(holidayData) {
    try {
      const existing = await pb.collection('holidays_1773420000000').getFirstListItem('date="' + holidayData.date + '"');
      const record = await pb.collection('holidays_1773420000000').update(existing.id, holidayData);
      return mapRecord(record);
    } catch(e) {
      const record = await pb.collection('holidays_1773420000000').create(holidayData);
      return mapRecord(record);
    }
  },

  async deleteHoliday(id) {
    try {
      const existing = await pb.collection('holidays_1773420000000').getFirstListItem('sb_id="' + id + '"');
      await pb.collection('holidays_1773420000000').delete(existing.id);
    } catch(e) {
      try { await pb.collection('holidays_1773420000000').delete(id); } catch(e2) { throw new Error(e2.message); }
    }
  },

  async deduplicate(key, fetcher) {
    if (inFlightRequests.has(key)) return inFlightRequests.get(key);
    const promise = fetcher().finally(() => inFlightRequests.delete(key));
    inFlightRequests.set(key, promise);
    return promise;
  },

  async createEmployee(employeeData) {
    const record = await pb.collection('employees').create(employeeData);
    return mapRecord(record);
  },

  async updateEmployee(id, employeeData) {
    try {
      const existing = await pb.collection('employees').getFirstListItem(`sb_id="${id}"`);
      const record = await pb.collection('employees').update(existing.id, employeeData);
      return mapRecord(record);
    } catch(e) {
      // Fallback: try direct PB id
      const record = await pb.collection('employees').update(id, employeeData);
      return mapRecord(record);
    }
  },

  async getEmployees(columns = '') {
    return this.deduplicate(`list-${columns}`, async () => {
      const records = await pb.collection('employees').getFullList({ sort: 'name' });
      return records.map(mapRecord);
    });
  },

  async getEmployeeBasicInfo() {
    return this.deduplicate('basic-info', async () => {
      const records = await pb.collection('employees').getFullList({
        filter: 'is_active=true',
        sort: 'name',
        fields: 'id,sb_id,name,position,daily_salary,employee_type'
      });
      return records.map(mapRecord);
    });
  },

  async getEmployeeById(id) {
    try {
      const record = await pb.collection('employees').getFirstListItem(`sb_id="${id}"`);
      return mapRecord(record);
    } catch(e) {
      const record = await pb.collection('employees').getOne(id);
      return mapRecord(record);
    }
  },

  async deleteEmployee(id) {
    // Soft delete — never permanently remove, just mark inactive
    try {
      const existing = await pb.collection('employees').getFirstListItem(`sb_id="${id}"`);
      await pb.collection('employees').update(existing.id, { is_active: false });
    } catch(e) {
      try { await pb.collection('employees').update(id, { is_active: false }); } catch(e2) { throw new Error(e2.message); }
    }
  },


  async getDeductionHistory(employeeId) {
    const records = await pb.collection('employee_deductions').getFullList({
      filter: 'employee_id="' + employeeId + '"',
      sort: '-date'
    });
    return records.map(mapRecord);
  },

  async updateDeductionStatus(id, isProcessed) {
    try {
      const existing = await pb.collection('employee_deductions').getFirstListItem('sb_id="' + id + '"');
      await pb.collection('employee_deductions').update(existing.id, { is_processed: isProcessed, processed_in_record_id: null });
    } catch(e) {
      await pb.collection('employee_deductions').update(id, { is_processed: isProcessed, processed_in_record_id: null });
    }
  },

  async getPendingDeductions(employeeId) {
    const records = await pb.collection('employee_deductions').getFullList({
      filter: `employee_id="${employeeId}" && is_processed=false`,
      sort: 'date'
    });
    return records.map(mapRecord);
  },

  async createDeduction(deductionData) {
    const record = await pb.collection('employee_deductions').create(deductionData);
    return mapRecord(record);
  },

  async deleteDeduction(id) {
    try {
      const existing = await pb.collection('employee_deductions').getFirstListItem(`sb_id="${id}"`);
      await pb.collection('employee_deductions').delete(existing.id);
    } catch(e) {
      try { await pb.collection('employee_deductions').delete(id); } catch(e2) { throw new Error(e2.message); }
    }
  },

  async createPayRecord(payData, deductionIds = []) {
    const record = await pb.collection('pay_records').create(payData);
    const mapped = mapRecord(record);
    if (deductionIds.length > 0) {
      for (const dedItem of deductionIds) {
        try {
          // dedItem can be an object {id, ...} or a plain id string
          const dedId = typeof dedItem === 'object' ? dedItem.id : dedItem;
          let dedPbId = dedId;
          try {
            const ded = await pb.collection('employee_deductions').getFirstListItem(`sb_id="${dedId}"`);
            dedPbId = ded.id;
          } catch(e) {
            // use dedId directly as PB id
          }
          await pb.collection('employee_deductions').update(String(dedPbId), {
            is_processed: true,
            processed_in_record_id: mapped.id
          });
        } catch(e) { console.error('Failed to link deduction:', e); }
      }
    }
    return mapped;
  },

  async updatePayRecord(id, payData) {
    const existing = await pb.collection('pay_records').getFirstListItem(`sb_id="${id}"`);
    const record = await pb.collection('pay_records').update(existing.id, payData);
    return mapRecord(record);
  },

  async getPayRecordById(id) {
    try {
      const record = await pb.collection('pay_records').getFirstListItem(`sb_id="${id}"`);
      return mapRecord(record);
    } catch(e) {
      const record = await pb.collection('pay_records').getOne(id);
      return mapRecord(record);
    }
  },

  async deletePayRecord(id) {
    try {
      const existing = await pb.collection('pay_records').getFirstListItem(`sb_id="${id}"`);
      await pb.collection('pay_records').delete(existing.id);
    } catch(e) {
      // Try deleting by PB id directly if sb_id lookup fails
      try {
        await pb.collection('pay_records').delete(id);
      } catch(e2) {
        throw new Error('Failed to delete pay record: ' + e2.message);
      }
    }
  },

  async getPayRecordsWithEmployees(limit = 1000) {
    const records = await pb.collection('pay_records').getFullList({
      sort: '-start_date',
      batch: limit
    });
    const employees = await pb.collection('employees').getFullList({
      fields: 'id,sb_id,name,position,department,employee_id,employee_type,daily_salary'
    });
    const empMap = {};
    employees.forEach(e => {
      const mapped = mapRecord(e);
      empMap[mapped.id] = mapped;
    });
    return records.map(r => {
      const mapped = mapRecord(r);
      mapped.employees = empMap[mapped.employee_id] || null;
      return mapped;
    });
  },

  async getPayRecords(employeeId, limit = 20) {
    const records = await pb.collection('pay_records').getFullList({
      filter: `employee_id="${employeeId}"`,
      sort: '-created_at',
      batch: limit
    });
    return records.map(mapRecord);
  },

  async getAttendance(employeeId, startDate, endDate) {
    const records = await pb.collection('attendance').getFullList({
      filter: `employee_id="${employeeId}" && date>="${startDate} 00:00:00.000Z" && date<="${endDate} 23:59:59.999Z"`,
      sort: 'date'
    });
    return records.map(mapRecord);
  },

  async createAttendance(data) {
    const { employee_id, date } = data;
    const { id, collectionId, collectionName, ...cleanData } = data;
    const timestamped = { ...cleanData, modified_at: new Date().toISOString() };
    // Normalize date for filter - handle both YYYY-MM-DD and full timestamp formats
    const datePrefix = date.split(' ')[0].split('T')[0];
    try {
      const existing = await pb.collection('attendance').getFirstListItem(
        `employee_id="${employee_id}" && date>="${datePrefix} 00:00:00.000Z" && date<="${datePrefix} 23:59:59.999Z"`
      );
      await pb.collection('attendance').update(existing.id, timestamped);
    } catch(e) {
      // Record doesn't exist, create it
      // Ensure date is in correct format
      if (!timestamped.date.includes(' ')) {
        timestamped.date = `${datePrefix} 00:00:00.000Z`;
      }
      await pb.collection('attendance').create(timestamped);
    }
  },

  async bulkCreateAttendance(records) {
    for (const data of records) {
      await this.createAttendance(data);
    }
  },

  async deleteAttendance(id) {
    try {
      const existing = await pb.collection('attendance').getFirstListItem(`sb_id="${id}"`);
      await pb.collection('attendance').delete(existing.id);
    } catch(e) {
      try { await pb.collection('attendance').delete(id); } catch(e2) { throw new Error(e2.message); }
    }
  },

  async deleteAttendanceRange(employeeId, startDate, endDate) {
    const records = await pb.collection('attendance').getFullList({
      filter: `employee_id="${employeeId}" && date>="${startDate}" && date<="${endDate}"`,
      fields: 'id'
    });
    for (const r of records) {
      await pb.collection('attendance').delete(r.id);
    }
  },

  async getAttendanceSummary(employeeId, startDate, endDate) {
    const attendance = await this.getAttendance(employeeId, startDate, endDate);
    // Fetch holidays from PocketBase (not hardcoded list)
    const holidayRecords = await this.getHolidays();
    const pbHolidayMap = {};
    holidayRecords.forEach(h => { pbHolidayMap[h.date] = { name: h.name, type: h.type }; });
    const getHolidayFromPB = (dateStr) => pbHolidayMap[dateStr] || null;

    let stats = {
      regularDaysPresent: 0,
      regularHolidaysPresent: 0,
      regularHolidaysWorked: 0,
      regularHolidaysAbsent: 0,
      specialHolidaysPresent: 0,
      totalLateMinutes: 0,
      totalUndertimeMinutes: 0,
      totalOvertimeMinutes: 0,
      thirteenthMonthDays: 0,
      totalRecords: attendance.length
    };

    attendance.forEach(log => {
      const holiday = getHolidayFromPB(log.date);
      const isPresent = ['present', 'late', 'holiday', 'undertime'].includes(log.status);
      const isHolidayOffRegular = log.status === 'holiday_off_regular';
      const isHolidayOffSpecial = log.status === 'holiday_off_special';
      const isHolidayOff = isHolidayOffRegular || isHolidayOffSpecial;
      let dayWeight = 1.0;
      let checkinMins = 0;
      let checkoutMins = 0;

      if (log.check_in_time && isPresent) {
        const [h, m] = log.check_in_time.split(':').map(Number);
        checkinMins = (h * 60) + m;
        if (checkinMins >= LUNCH_START) dayWeight = 0.5;
      }

      if (log.check_out_time && isPresent) {
        const [h, m] = log.check_out_time.split(':').map(Number);
        checkoutMins = (h * 60) + m;
      }

      // Check if the date is a Sunday
      const logDate = new Date(log.date);
      const isSunday = logDate.getDay() === 0;
      const isEligibleFor13th = isPresent && checkinMins < LUNCH_START && (log.undertime_minutes || 0) < 240 && !isSunday;

      if (holiday) {
        if (holiday.type === 'regular') {
          if (isPresent) {
            // Worked on regular holiday - counts as regular day present + holiday pay
            stats.regularDaysPresent += dayWeight;
            stats.regularHolidaysPresent += dayWeight;
            stats.regularHolidaysWorked += dayWeight;
          } else if (isHolidayOffRegular) {
            // Off on regular holiday - paid 1x via reg_holiday_pay, NOT in basic salary (Full Time only)
            stats.regularHolidaysPresent += 1;
          } else {
            stats.regularHolidaysAbsent++;
          }
        } else {
          if (isPresent) stats.specialHolidaysPresent += dayWeight;
          // holiday_off_special = no pay, not counted
        }
      } else if (isPresent) {
        stats.regularDaysPresent += dayWeight;
      }

      if (isEligibleFor13th) stats.thirteenthMonthDays++;
      // If clocked in at/after noon = half day (dayWeight 0.5)
      // Salary already halved so skip late minutes to avoid double penalty
      if (checkinMins >= LUNCH_START) {
        stats.totalLateMinutes += 0;
      } else {
        stats.totalLateMinutes += (log.late_minutes || 0);
      }
      stats.totalUndertimeMinutes += (log.undertime_minutes || 0);

      if (isPresent) {
        if (checkinMins < SHIFT_START) stats.totalOvertimeMinutes += (SHIFT_START - checkinMins);
        if (checkoutMins > SHIFT_END) stats.totalOvertimeMinutes += (checkoutMins - SHIFT_END);
      }
    });

    return stats;
  }
};
