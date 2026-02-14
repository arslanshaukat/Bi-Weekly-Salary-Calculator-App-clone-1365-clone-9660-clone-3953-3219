/**
 * Philippines Public Holidays 2026
 * 
 * Regular Holidays:
 * - Present: 200% pay
 * - Absent: 100% pay
 * 
 * Special Non-Working Holidays:
 * - Present: 130% pay
 * - Absent: 0% pay
 */
export const HOLIDAYS_2026 = {
  // Regular Holidays
  '2026-01-01': { name: "New Year's Day", type: 'regular' },
  '2026-04-02': { name: "Maundy Thursday", type: 'regular' },
  '2026-04-03': { name: "Good Friday", type: 'regular' },
  '2026-04-09': { name: "Araw ng Kagitingan", type: 'regular' },
  '2026-05-01': { name: "Labor Day", type: 'regular' },
  '2026-06-12': { name: "Independence Day", type: 'regular' },
  '2026-08-31': { name: "National Heroes Day", type: 'regular' },
  '2026-11-30': { name: "Bonifacio Day", type: 'regular' },
  '2026-12-25': { name: "Christmas Day", type: 'regular' },
  '2026-12-30': { name: "Rizal Day", type: 'regular' },

  // Special (Non-Working) Holidays
  '2026-01-17': { name: "James Leonard Tagle Gordon Day", type: 'special' },
  '2026-02-17': { name: "Chinese New Year", type: 'special' },
  '2026-02-25': { name: "EDSA People Power", type: 'special' },
  '2026-04-04': { name: "Black Saturday", type: 'special' },
  '2026-08-21': { name: "Ninoy Aquino Day", type: 'special' },
  '2026-11-01': { name: "All Saints' Day", type: 'special' },
  '2026-11-02': { name: "All Souls' Day", type: 'special' },
  '2026-12-08': { name: "Feast of the Immaculate Conception", type: 'special' },
  '2026-12-24': { name: "Christmas Eve", type: 'special' },
  '2026-12-31': { name: "Last Day of the Year", type: 'special' }
};

export const getHoliday = (dateStr) => HOLIDAYS_2026[dateStr] || null;