import React, { useState, useEffect } from 'react';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';

const { FiGift, FiPlus, FiTrash2, FiEdit2, FiSave, FiX, FiCalendar, FiBriefcase, FiAlertCircle } = FiIcons;

const HolidaySettings = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [form, setForm] = useState({ name: '', date: '', type: 'regular' });

  useEffect(() => {
    loadHolidays();
  }, []);

  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await employeeService.getHolidays();
      setHolidays(data);
    } catch (error) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (holiday = null) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setForm({ name: holiday.name, date: holiday.date, type: holiday.type });
    } else {
      setEditingHoliday(null);
      setForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'regular' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = editingHoliday ? { id: editingHoliday.id, ...form } : form;
      await employeeService.upsertHoliday(payload);
      toast.success(editingHoliday ? 'Holiday Updated' : 'Holiday Added');
      setIsModalOpen(false);
      loadHolidays();
    } catch (error) {
      toast.error(error.message.includes('unique') ? 'Date already exists' : 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this holiday? This will affect payroll calculations.')) return;
    try {
      await employeeService.deleteHoliday(id);
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success('Holiday removed');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  if (loading) return (
    <div className="py-20 text-center">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Holiday Registry...</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 text-left">
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          <div className="flex items-center space-x-6">
            <div className="bg-blue-600 p-5 rounded-[2.5rem] text-white shadow-2xl shadow-blue-100">
              <SafeIcon icon={FiGift} className="text-4xl" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase">Holiday Registry</h1>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Global System Configuration</p>
            </div>
          </div>
          <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-blue-700 transition-all flex items-center">
            <SafeIcon icon={FiPlus} className="mr-2" /> Add Holiday
          </button>
        </div>

        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-start space-x-4 mb-8">
          <SafeIcon icon={FiAlertCircle} className="text-blue-600 text-xl mt-1 shrink-0" />
          <div>
            <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Policy Reminder</p>
            <p className="text-[11px] font-bold text-blue-600/80 leading-relaxed mt-1">
              Holiday pay rates (Regular 200%, Special 130%) are automatically applied during payroll processing 
              strictly for <span className="underline">Full-Time Personnel</span>. Attendance status must be 
              marked as "Holiday" or "Present" on these dates.
            </p>
          </div>
        </div>

        <div className="overflow-hidden border border-gray-100 rounded-[2.5rem]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Holiday Name</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-black">
              {holidays.map(h => (
                <tr key={h.id} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-10 py-6 text-gray-800 text-sm font-mono tracking-tight">{format(parseISO(h.date), 'MMMM dd, yyyy')}</td>
                  <td className="px-10 py-6 text-gray-800 text-sm tracking-tight">{h.name}</td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest border ${
                      h.type === 'regular' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                    }`}>
                      {h.type} Holiday
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <div className="flex justify-end space-x-2">
                       <button onClick={() => handleOpenModal(h)} className="p-3 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"><SafeIcon icon={FiEdit2} /></button>
                       <button onClick={() => handleDelete(h.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all"><SafeIcon icon={FiTrash2} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-20 text-center text-gray-300 font-black uppercase italic tracking-widest">No holidays configured</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <SafeIcon icon={FiCalendar} className="text-2xl" />
                <h3 className="font-black text-xl uppercase tracking-tight">{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><SafeIcon icon={FiX} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Holiday Name</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black outline-none focus:border-blue-500 transition-all bg-gray-50 focus:bg-white" placeholder="e.g. Independence Day" required />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black outline-none focus:border-blue-500 transition-all bg-gray-50 focus:bg-white" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-1">Holiday Type</label>
                  <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))} className="w-full p-4 border-2 border-gray-100 rounded-2xl font-black outline-none focus:border-blue-500 transition-all bg-gray-50 focus:bg-white text-sm">
                    <option value="regular">Regular (200%)</option>
                    <option value="special">Special (130%)</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all mt-4 flex items-center justify-center">
                <SafeIcon icon={FiSave} className="mr-2" /> Save Registry Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HolidaySettings;