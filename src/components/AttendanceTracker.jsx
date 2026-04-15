import React, { useState, useEffect, useMemo, useCallback } from 'react';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { getHoliday } from '../utils/holidays';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, parseISO } from 'date-fns';

const { FiChevronLeft, FiChevronRight, FiCalendar, FiX, FiClock, FiEdit2, FiTrash2, FiList, FiGift, FiZap, FiTrash, FiShield } = FiIcons;

// Time Constants (Minutes from Midnight)
const SHIFT_START = 8 * 60;   // 08:00
const LUNCH_START = 12 * 60;  // 12:00
const LUNCH_END = 13 * 60;    // 13:00
const SHIFT_END = 17 * 60;    // 17:00

const AttendanceTracker = () => {
  const { profile, checkPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editForm, setEditForm] = useState({ check_in_time: '', check_out_time: '', status: 'present' });

  const currentUserName = profile?.full_name || 'System';

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await employeeService.getEmployeeBasicInfo();
        setEmployees(data);
        if (data.length > 0) setSelectedEmployee(data[0]);
      } catch (error) {
        toast.error('Failed to load employees');
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!selectedEmployee) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      const data = await employeeService.getAttendance(selectedEmployee.id, start, end);
      setAttendance([...data].sort((a, b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
      toast.error('Failed to load logs');
    }
  }, [selectedEmployee, currentMonth]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

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
        const holiday = getHoliday(dateStr);
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
      toast.info('Work week is already filled');
      return;
    }

    try {
      await employeeService.bulkCreateAttendance(newRecords);
      toast.success(`Generated ${newRecords.length} records`);
      loadAttendance();
    } catch (error) {
      toast.error('Auto-fill failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedEmployee) return;
    if (!checkPermission('manage_attendance')) return toast.error('Access denied');
    if (!window.confirm(`PERMANENTLY DELETE ALL logs for ${format(currentMonth, 'MMMM')}?`)) return;

    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    try {
      await employeeService.deleteAttendanceRange(selectedEmployee.id, start, end);
      toast.success('Month cleared');
      loadAttendance();
    } catch (error) {
      toast.error('Bulk delete failed');
    }
  };

  const calendarData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const days = eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(endOfMonth(monthStart))
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
      toast.success(`Updated ${dateStr}`);
    } catch (error) {
      toast.error('Update failed');
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
    const [inH, inM] = editForm.check_in_time.split(':').map(Number);
    const checkinMins = (inH * 60) + inM;
    const [outH, outM] = editForm.check_out_time.split(':').map(Number);
    const checkoutMins = (outH * 60) + outM;

    // LATE CALCULATION (8:00 to actual arrival, excluding 12-1 lunch)
    const lateMinutes = (checkinMins > SHIFT_START) 
      ? calculateMinutesExcludingLunch(SHIFT_START, checkinMins) 
      : 0;

    // UNDERTIME CALCULATION (actual departure to 17:00, excluding 12-1 lunch)
    const undertimeMinutes = (checkoutMins < SHIFT_END && editForm.status !== 'absent' && editForm.status !== 'holiday') 
      ? calculateMinutesExcludingLunch(checkoutMins, SHIFT_END) 
      : 0;

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
      toast.success('Record Updated (Lunch Excluded)');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'undertime': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'holiday': return 'bg-blue-600 text-white border-blue-700';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  if (loading && !selectedEmployee) return <div className="p-12 text-center text-gray-400 font-black uppercase tracking-widest">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-3xl shadow-xl p-4 md:p-8 border border-gray-100 text-left">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-lg"><SafeIcon icon={FiCalendar} className="text-white text-2xl" /></div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-gray-800 uppercase tracking-tight">Attendance Vault</h1>
              <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">{selectedEmployee?.name} • Lunch (12-1) Excluded</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleAutoFill} className="flex-1 md:flex-none px-3 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center border border-blue-100 hover:bg-blue-100 transition-colors">
              <SafeIcon icon={FiZap} className="mr-1.5" /> Auto Fill Week
            </button>
            <button onClick={handleBulkDelete} className="flex-1 md:flex-none px-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center border border-red-100 hover:bg-red-100 transition-colors">
              <SafeIcon icon={FiTrash} className="mr-1.5" /> Clear Month
            </button>
            <select value={selectedEmployee?.id || ''} onChange={(e) => setSelectedEmployee(employees.find(emp => emp.id === e.target.value))} className="w-full md:w-auto p-2.5 border rounded-xl bg-gray-50 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500">
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6 bg-gray-900 p-4 rounded-2xl text-white shadow-xl">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/10 rounded-full transition-colors"><SafeIcon icon={FiChevronLeft} /></button>
          <h2 className="text-sm md:text-lg font-black uppercase tracking-[0.2em]">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/10 rounded-full transition-colors"><SafeIcon icon={FiChevronRight} /></button>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="min-w-[700px] grid grid-cols-7 gap-px bg-gray-200 border rounded-2xl overflow-hidden shadow-inner">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-100 p-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</div>
            ))}
            {calendarData.days.map((day, idx) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const record = attendance.find(a => a.date === dateStr);
              const isCurrentMonth = isSameMonth(day, calendarData.monthStart);
              const holiday = getHoliday(dateStr);
              return (
                <div key={idx} className={`min-h-[110px] md:min-h-[130px] p-2 transition-all relative ${!isCurrentMonth ? 'bg-gray-50/50 opacity-30' : 'bg-white hover:bg-blue-50/30 cursor-pointer'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-black ${isToday(day) ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-gray-400'}`}>{format(day, 'd')}</span>
                    {holiday && <SafeIcon icon={FiGift} className="text-blue-600 text-[10px]" />}
                  </div>
                  {isCurrentMonth && (
                    <div className="space-y-1">
                      {record ? (
                        <>
                          <span className={`block text-[8px] font-black uppercase px-2 py-1 rounded-lg text-center border truncate ${getStatusStyle(record.status)}`}>{record.status}</span>
                          {(record.late_minutes > 0 || record.undertime_minutes > 0) && (
                            <span className="block text-[7px] font-black text-red-600 text-center uppercase">-{record.late_minutes + record.undertime_minutes}m Lost</span>
                          )}
                          <button onClick={() => openEditModal(record)} className="w-full mt-1.5 p-1 text-[8px] font-black text-blue-600 hover:bg-blue-50 rounded-lg transition-colors uppercase">Edit</button>
                        </>
                      ) : (
                        <button onClick={() => handleStatusChange(day, holiday ? 'holiday' : 'present')} className="w-full py-4 border border-dashed border-gray-200 rounded-xl text-[8px] font-black text-gray-300 hover:border-blue-200 hover:text-blue-500 uppercase transition-all">+ LOG</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl overflow-hidden text-left border border-gray-100">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <h3 className="text-xs md:text-sm font-black text-gray-800 uppercase tracking-widest flex items-center"><SafeIcon icon={FiList} className="mr-2 text-blue-600" /> Activity Audit (Lunch Hours Deducted)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">In/Out</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Mins Lost</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">OT Mins</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Last Modified</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendance.map(log => {
                const totalMinsLost = (log.late_minutes || 0) + (log.undertime_minutes || 0);
                const otMinutes = Math.round((Number(log.overtime_hours) || 0) * 60);
                return (
                  <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 font-black text-xs md:text-sm text-gray-800">{format(parseISO(log.date), 'EEE, MMM dd')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase border ${getStatusStyle(log.status)}`}>{log.status}</span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-[10px] md:text-xs font-bold text-gray-600">{log.check_in_time?.slice(0, 5)} - {log.check_out_time?.slice(0, 5)}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-black ${totalMinsLost > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                          {totalMinsLost}m
                        </span>
                        {totalMinsLost > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {log.late_minutes > 0 && <span className="text-[7px] bg-red-50 text-red-500 px-1 rounded font-bold uppercase">L:{log.late_minutes}</span>}
                            {log.undertime_minutes > 0 && <span className="text-[7px] bg-orange-50 text-orange-500 px-1 rounded font-bold uppercase">U:{log.undertime_minutes}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-black ${otMinutes > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                        {otMinutes > 0 ? `+${otMinutes}m` : '0m'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start space-y-0.5">
                        <span className="text-[9px] font-black text-blue-600 uppercase flex items-center">
                          <SafeIcon icon={FiShield} className="mr-1 text-[8px]" /> {log.modified_by_name || 'System'}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">
                          {log.modified_at ? format(parseISO(log.modified_at), 'MMM dd | HH:mm') : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-1">
                        <button onClick={() => openEditModal(log)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"><SafeIcon icon={FiEdit2} /></button>
                        <button onClick={() => { if (window.confirm('Delete log?')) employeeService.deleteAttendance(log.id).then(loadAttendance) }} className="p-2 text-red-500 hover:bg-red-100 rounded-xl transition-all"><SafeIcon icon={FiTrash2} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden p-6 md:p-10">
              <div className="flex justify-between items-center mb-8">
                <div className="text-left">
                  <h3 className="font-black text-xl uppercase tracking-tighter">Edit Record</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date: {editingLog?.date}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><SafeIcon icon={FiX} /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-6 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Clock In</label>
                    <input type="time" value={editForm.check_in_time} onChange={(e) => setEditForm(p => ({ ...p, check_in_time: e.target.value }))} className="w-full p-4 border rounded-2xl font-black bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Clock Out</label>
                    <input type="time" value={editForm.check_out_time} onChange={(e) => setEditForm(p => ({ ...p, check_out_time: e.target.value }))} className="w-full p-4 border rounded-2xl font-black bg-gray-50 focus:ring-2 focus:ring-blue-500 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 ml-1">Daily Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm(p => ({ ...p, status: e.target.value }))} className="w-full p-4 border rounded-2xl font-black uppercase text-xs bg-gray-50 focus:ring-2 focus:ring-blue-500">
                    <option value="present">Present (Full Day)</option>
                    <option value="undertime">Under Time</option>
                    <option value="late">Late Arrival</option>
                    <option value="absent">Absent</option>
                    <option value="holiday">Holiday</option>
                  </select>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">
                    Lunch hour (12pm-1pm) is <span className="underline">automatically deducted</span> from late/undertime.
                  </p>
                </div>
                <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 uppercase text-[10px] tracking-[0.2em] transform active:scale-95 transition-all">Update Log Entry</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AttendanceTracker;