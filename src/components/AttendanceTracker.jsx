import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, parseISO } from 'date-fns';

const { 
  FiChevronLeft, FiChevronRight, FiCalendar, FiX, FiClock, 
  FiEdit2, FiTrash2, FiList, FiGift, FiZap, FiTrash, 
  FiShield, FiInfo, FiCheckCircle, FiActivity, FiUser, FiPlus 
} = FiIcons;

// Time Constants (Minutes from Midnight)
const SHIFT_START = 8 * 60; // 08:00
const LUNCH_START = 12 * 60; // 12:00
const LUNCH_END = 13 * 60; // 13:00
const SHIFT_END = 17 * 60; // 17:00

const AttendanceTracker = () => {
  const { profile, checkPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({ 
    check_in_time: '08:00', 
    check_out_time: '17:00', 
    status: 'present' 
  });

  const currentUserName = profile?.full_name || 'System Admin';

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [empData, holidayData] = await Promise.all([
        employeeService.getEmployeeBasicInfo(),
        employeeService.getHolidays()
      ]);
      setEmployees(empData);
      setHolidays(holidayData);
      if (empData.length > 0) setSelectedEmployee(empData[0]);
    } catch (error) {
      console.error('Initial Load Error:', error);
      toast.error('Failed to load initial personnel data');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = useCallback(async () => {
    if (!selectedEmployee) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      const data = await employeeService.getAttendance(selectedEmployee.id, start, end);
      setAttendance([...data].sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      toast.error('Failed to retrieve activity logs');
    }
  }, [selectedEmployee, currentMonth]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  const holidayMap = useMemo(() => {
    const map = {};
    holidays.forEach(h => { map[h.date] = h; });
    return map;
  }, [holidays]);

  const calculateMinutesExcludingLunch = (startMins, endMins) => {
    if (startMins >= endMins) return 0;
    let total = endMins - startMins;
    const overlapStart = Math.max(startMins, LUNCH_START);
    const overlapEnd = Math.min(endMins, LUNCH_END);
    if (overlapStart < overlapEnd) total -= (overlapEnd - overlapStart);
    return Math.max(0, total);
  };

  const handleAutoFill = async () => {
    if (!selectedEmployee) return;
    if (!checkPermission('manage_attendance')) return toast.error('Access denied');
    
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    
    if (!window.confirm(`Auto-fill attendance for the current work week (${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')})?`)) return;

    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const newRecords = days
      .filter(day => day.getDay() !== 0) // Skip Sundays
      .map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (attendance.some(a => a.date === dateStr)) return null;
        const holiday = holidayMap[dateStr];
        return {
          employee_id: selectedEmployee.id,
          date: dateStr,
          status: holiday ? 'holiday' : 'present',
          check_in_time: '08:00',
          check_out_time: '17:00',
          late_minutes: 0,
          undertime_minutes: 0,
          overtime_hours: 0,
          modified_by_name: currentUserName
        };
      })
      .filter(Boolean);

    if (newRecords.length === 0) {
      toast.info('Work week is already fully recorded');
      return;
    }

    try {
      await employeeService.bulkCreateAttendance(newRecords);
      toast.success(`Generated ${newRecords.length} records`);
      loadAttendance();
    } catch (error) {
      toast.error('Auto-fill protocol failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedEmployee) return;
    if (!checkPermission('manage_attendance')) return toast.error('Access denied');
    if (!window.confirm(`PERMANENTLY PURGE ALL logs for ${format(currentMonth, 'MMMM')}?`)) return;
    
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    
    try {
      await employeeService.deleteAttendanceRange(selectedEmployee.id, start, end);
      toast.success('Month data cleared');
      loadAttendance();
    } catch (error) {
      toast.error('Bulk purge failed');
    }
  };

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const days = eachDayOfInterval({ 
      start: startOfWeek(monthStart, { weekStartsOn: 1 }), 
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }) 
    });
    return { monthStart, days };
  }, [currentMonth]);

  const handleStatusChange = async (date, status) => {
    if (!checkPermission('manage_attendance')) return toast.error('Access denied');
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const data = {
      employee_id: selectedEmployee.id,
      date: dateStr,
      status: status,
      check_in_time: status !== 'absent' ? '08:00' : null,
      check_out_time: status !== 'absent' ? '17:00' : null,
      late_minutes: 0,
      undertime_minutes: 0,
      overtime_hours: 0,
      modified_by_name: currentUserName
    };
    try {
      await employeeService.createAttendance(data);
      loadAttendance();
      toast.success(`Logged: ${dateStr}`);
    } catch (error) {
      toast.error('Status update failed');
    }
  };

  const openEditModal = (log) => {
    if (!checkPermission('manage_attendance')) return toast.error('Access denied');
    setEditingLog(log);
    setEditForm({
      check_in_time: log.check_in_time?.slice(0, 5) || '08:00',
      check_out_time: log.check_out_time?.slice(0, 5) || '17:00',
      status: log.status || 'present'
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingLog) return;

    const parseTime = (t) => {
      if (!t || !t.includes(':')) return 0;
      const [h, m] = t.split(':').map(Number);
      return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
    };
    const checkinMins = parseTime(editForm.check_in_time);
    const checkoutMins = parseTime(editForm.check_out_time) || (8 * 60 + 17 * 60);

    const lateMinutes = (checkinMins > SHIFT_START) ? calculateMinutesExcludingLunch(SHIFT_START, checkinMins) : 0;
    const undertimeMinutes = (checkoutMins < SHIFT_END && editForm.status !== 'absent' && editForm.status !== 'holiday') ? calculateMinutesExcludingLunch(checkoutMins, SHIFT_END) : 0;

    let totalOTMins = 0;
    if (checkinMins < SHIFT_START) totalOTMins += (SHIFT_START - checkinMins);
    if (checkoutMins > SHIFT_END) totalOTMins += (checkoutMins - SHIFT_END);

    let finalStatus = editForm.status;
    if (['present', 'late', 'undertime'].includes(finalStatus)) {
      if (lateMinutes > 0) finalStatus = 'late';
      else if (undertimeMinutes > 0) finalStatus = 'undertime';
      else finalStatus = 'present';
    }

    const data = {
      id: editingLog.id,
      employee_id: selectedEmployee.id,
      date: editingLog.date,
      status: finalStatus,
      check_in_time: editForm.check_in_time,
      check_out_time: editForm.check_out_time,
      late_minutes: lateMinutes,
      undertime_minutes: undertimeMinutes,
      overtime_hours: Math.round((totalOTMins / 60) * 100) / 100,
      modified_by_name: currentUserName
    };

    try {
      await employeeService.createAttendance(data);
      loadAttendance();
      setIsEditModalOpen(false);
      toast.success('Record Synchronized');
    } catch (error) {
      toast.error('Failed to commit changes');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-100';
      case 'absent': return 'bg-red-50 text-red-700 border-red-100';
      case 'late': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'undertime': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'holiday': return 'bg-blue-600 text-white border-blue-700';
      case 'holiday_off_regular': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'holiday_off_special': return 'bg-pink-50 text-pink-600 border-pink-200';
      default: return 'bg-gray-50 text-gray-400 border-gray-100';
    }
  };

  if (loading && !selectedEmployee) return (
    <div className="py-20 text-center flex flex-col items-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Accessing Vault...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24 text-left">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-10">
          <div className="flex items-center space-x-6">
            <div className="bg-blue-600 p-5 rounded-[2.5rem] shadow-2xl shadow-blue-100 text-white">
              <SafeIcon icon={FiCalendar} className="text-4xl" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase">Attendance Vault</h1>
              <div className="flex items-center space-x-2 mt-1">
                 <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Global Personnel Tracking</span>
                 <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                 <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">Lunch 12:00-13:00 Excluded</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleAutoFill} className="bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm hover:bg-blue-100 transition-all">
              <SafeIcon icon={FiZap} className="mr-2" /> Auto Fill Week
            </button>
            <button onClick={handleBulkDelete} className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-sm hover:bg-red-100 transition-all">
              <SafeIcon icon={FiTrash} className="mr-2" /> Clear Month
            </button>
            <div className="relative">
              <select 
                value={selectedEmployee?.id || ''} 
                onChange={(e) => setSelectedEmployee(employees.find(emp => emp.id === e.target.value))} 
                className="pl-6 pr-12 py-3.5 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none transition-all appearance-none"
              >
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <SafeIcon icon={FiIcons.FiChevronDown} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-8 bg-gray-900 p-6 rounded-[2rem] text-white shadow-2xl">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><SafeIcon icon={FiChevronLeft} className="text-xl" /></button>
          <h2 className="text-lg font-black uppercase tracking-[0.4em]">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-3 hover:bg-white/10 rounded-2xl transition-all"><SafeIcon icon={FiChevronRight} className="text-xl" /></button>
        </div>

        <div className="overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[900px] grid grid-cols-7 gap-px bg-gray-100 border-2 border-gray-100 rounded-[2.5rem] overflow-hidden">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
              <div key={day} className="bg-gray-50/50 p-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</div>
            ))}
            {calendarData.days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const record = attendance.find(a => a.date === dateStr);
              const isCurrentMonth = isSameMonth(day, calendarData.monthStart);
              const holiday = holidayMap[dateStr];
              
              return (
                <div key={idx} className={`min-h-[140px] p-4 transition-all relative ${!isCurrentMonth ? 'bg-gray-50/30 opacity-20' : 'bg-white hover:bg-blue-50/20'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[11px] font-black ${isToday(day) ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg' : 'text-gray-400'}`}>{format(day, 'd')}</span>
                    {holiday && (
                      <div className="group relative">
                        <SafeIcon icon={FiGift} className="text-blue-600 text-sm animate-bounce" />
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-gray-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap z-50">{holiday.name}</div>
                      </div>
                    )}
                  </div>
                  
                  {isCurrentMonth && (
                    <div className="space-y-2">
                      {record ? (
                        <div className="space-y-2">
                          <span className={`block text-[9px] font-black uppercase px-3 py-1.5 rounded-xl text-center border transition-all ${getStatusStyle(record.status)}`}>
                            {record.status === 'holiday_off_regular' ? 'HOL-OFF(R)' : record.status === 'holiday_off_special' ? 'HOL-OFF(S)' : record.status}
                          </span>
                          {(record.late_minutes > 0 || record.undertime_minutes > 0) && (
                            <span className="block text-[8px] font-black text-red-500 text-center uppercase tracking-tighter">
                              -{record.late_minutes + record.undertime_minutes}m lost
                            </span>
                          )}
                          <button 
                            onClick={() => openEditModal(record)} 
                            className="w-full py-2 text-[9px] font-black text-blue-600 bg-blue-50/50 rounded-xl transition-all uppercase hover:bg-blue-600 hover:text-white"
                          >
                            Edit Log
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleStatusChange(day, holiday ? 'holiday' : 'present')} 
                          className="w-full py-6 border-2 border-dashed border-gray-100 rounded-[1.5rem] text-[9px] font-black text-gray-300 hover:border-blue-300 hover:text-blue-600 uppercase transition-all flex flex-col items-center justify-center space-y-1"
                        >
                          <SafeIcon icon={FiPlus} />
                          <span>Log</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
        <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SafeIcon icon={FiActivity} className="text-blue-600 text-xl" />
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Chronological Activity Audit</h3>
          </div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-gray-100">Total Entries: {attendance.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Stamp</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Clock In/Out</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Deviations</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Modified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-black">
              {attendance.map(log => (
                <tr key={log.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-10 py-6 text-sm text-gray-800">{format(parseISO(log.date), 'MMMM dd, yyyy')}</td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] uppercase border tracking-widest ${getStatusStyle(log.status)}`}>{log.status}</span>
                  </td>
                  <td className="px-10 py-6 text-center text-xs font-mono text-gray-400">{log.check_in_time?.slice(0,5) || '--:--'} — {log.check_out_time?.slice(0,5) || '--:--'}</td>
                  <td className={`px-10 py-6 text-right font-mono text-xs ${log.late_minutes + log.undertime_minutes > 0 ? 'text-red-500' : 'text-gray-300'}`}>
                    {log.late_minutes + log.undertime_minutes}m lost
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase text-gray-800 font-black">{log.modified_by_name || 'System'}</span>
                      <span className="text-[8px] text-gray-400 uppercase">{log.modified_at ? format(parseISO(log.modified_at), 'HH:mm • MMM dd') : 'Initial Log'}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-20 text-center text-gray-300 font-black uppercase italic tracking-widest">No attendance records found for this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
              <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 p-3 rounded-2xl"><SafeIcon icon={FiEdit2} className="text-2xl" /></div>
                  <div className="text-left">
                    <h3 className="font-black text-xl uppercase tracking-tight">Modify Registry</h3>
                    <p className="text-blue-100 text-[9px] font-black uppercase tracking-widest">{format(parseISO(editingLog.date), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><SafeIcon icon={FiX} /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="p-10 space-y-6 text-left">
                <div>
                   <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Daily Status</label>
                   <div className="grid grid-cols-2 gap-3">
                      {['present', 'absent', 'late', 'undertime', 'holiday', 'holiday_off_regular', 'holiday_off_special'].map(s => (
                        <button 
                          key={s} 
                          type="button" 
                          onClick={() => setEditForm(p => ({...p, status: s}))}
                          className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${
                            editForm.status === s ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-blue-200'
                          }`}
                        >
                          {s === 'holiday_off_regular' ? 'Holiday Off (Regular)' : s === 'holiday_off_special' ? 'Holiday Off (Special)' : s === 'holiday' ? 'Holiday (Worked)' : s}
                        </button>
                      ))}
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Clock In</label>
                    <input type="time" value={editForm.check_in_time} onChange={e => setEditForm(p => ({...p, check_in_time: e.target.value}))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black outline-none focus:border-blue-500 transition-all bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Clock Out</label>
                    <input type="time" value={editForm.check_out_time} onChange={e => setEditForm(p => ({...p, check_out_time: e.target.value}))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black outline-none focus:border-blue-500 transition-all bg-gray-50" />
                  </div>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 flex items-start space-x-3 mt-4">
                  <SafeIcon icon={FiInfo} className="text-blue-600 mt-1" />
                  <p className="text-[10px] font-bold text-blue-800 leading-relaxed uppercase">
                    System will automatically recalculate Late/Undertime and Overtime based on these parameters upon saving.
                  </p>
                </div>

                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4">
                  Commit To Ledger
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceTracker;