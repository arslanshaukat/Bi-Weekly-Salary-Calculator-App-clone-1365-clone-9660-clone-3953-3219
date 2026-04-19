import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiUser, FiUsers } = FiIcons;

const DEPARTMENTS = ['Admin', 'Sales', 'Painters', 'Mechanics', 'Drivers', 'Warehouse', 'Finance', 'IT', 'Operations', 'Management'];
const EMPLOYEE_TYPES = ['Full Time', 'Part Time', 'Contractual', 'Probationary'];

const EMPTY_FORM = {
  employee_id: '', name: '', department: '', position: '',
  daily_salary: '', employee_type: 'Full Time', bank_account: '',
  tin_number: '', sss_number: '', philhealth_number: '', pagibig_number: '',
  notes: '', is_active: true
};

const Field = ({ label, name, form, setForm, type = 'text', options }) => (
  <div>
    <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">{label}</label>
    {options ? (
      <select value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none text-sm">
        <option value="">Select {label}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none text-sm" />
    )}
  </div>
);

export default function EmployeeManager() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => { loadEmployees(); }, []);

  async function loadEmployees() {
    setLoading(true);
    try {
      const data = await employeeService.getEmployees('*');
      setEmployees(data);
    } catch (e) { toast.error('Failed to load employees'); }
    setLoading(false);
  }

  async function openAdd() {
    // Auto-generate next employee ID
    let nextId = 'EMP0001';
    try {
      const ids = employees
        .map(e => e.employee_id)
        .filter(id => id && /^EMP\d+$/.test(id))
        .map(id => parseInt(id.replace('EMP', ''), 10))
        .filter(n => !isNaN(n));
      if (ids.length > 0) {
        const max = Math.max(...ids);
        nextId = 'EMP' + String(max + 1).padStart(4, '0');
      }
    } catch (e) {}
    setForm({ ...EMPTY_FORM, employee_id: nextId });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(emp) {
    setForm({
      employee_id: emp.employee_id || '',
      name: emp.name || '',
      department: emp.department || '',
      position: emp.position || '',
      daily_salary: emp.daily_salary?.toString() || '',
      employee_type: emp.employee_type || 'Full Time',
      bank_account: emp.bank_account || '',
      tin_number: emp.tin_number || '',
      sss_number: emp.sss_number || '',
      philhealth_number: emp.philhealth_number || '',
      pagibig_number: emp.pagibig_number || '',
      notes: emp.notes || '',
      is_active: emp.is_active !== false
    });
    setEditingId(emp.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.employee_id.trim()) { toast.error('Employee ID is required'); return; }
    if (!form.daily_salary || isNaN(form.daily_salary)) { toast.error('Valid daily salary is required'); return; }
    setSaving(true);
    try {
      const data = { ...form, daily_salary: Number(form.daily_salary) };
      if (editingId) {
        await employeeService.updateEmployee(editingId, data);
        toast.success('Employee updated');
      } else {
        await employeeService.createEmployee(data);
        toast.success('Employee added');
      }
      setShowForm(false);
      loadEmployees();
    } catch (e) { toast.error('Failed to save employee'); console.error(e); }
    setSaving(false);
  }

  async function handleDelete(emp) {
    if (!window.confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try {
      await employeeService.deleteEmployee(emp.id);
      toast.success('Employee deleted');
      loadEmployees();
    } catch (e) { toast.error('Failed to delete employee'); }
  }

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name?.toLowerCase().includes(q) || e.employee_id?.toLowerCase().includes(q) || e.position?.toLowerCase().includes(q);
    const matchDept = !filterDept || e.department === filterDept;
    const matchType = !filterType || e.employee_type === filterType;
    return matchSearch && matchDept && matchType;
  });



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">HR Management</p>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Employees</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-5 py-2.5 rounded-full border border-gray-100 tracking-widest">
              {employees.filter(e => e.is_active).length} Active · {employees.length} Total
            </span>
            <button onClick={openAdd} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">
              <SafeIcon icon={FiPlus} /> Add Employee
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mt-5">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, ID, position..."
            className="flex-1 border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm font-black text-gray-700 focus:border-blue-400 outline-none" />
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm font-black text-gray-700 focus:border-blue-400 outline-none">
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border-2 border-gray-100 rounded-xl px-4 py-2.5 text-sm font-black text-gray-700 focus:border-blue-400 outline-none">
            <option value="">All Types</option>
            {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Employee Table */}
      <div className="p-8">
        {loading ? (
          <div className="text-center py-20 text-gray-400 font-black uppercase tracking-widest text-sm">Loading...</div>
        ) : (
          <div className="bg-white rounded-[2rem] border-2 border-gray-50 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Department</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Daily Rate</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="px-8 py-16 text-center text-gray-400 font-black uppercase tracking-widest text-sm">No employees found</td></tr>
                ) : filtered.map(emp => (
                  <tr key={emp.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-black text-blue-600 text-sm flex-shrink-0">
                          {emp.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-gray-800 text-sm uppercase tracking-tight">{emp.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{emp.employee_id} · {emp.position}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-black text-gray-600 uppercase tracking-tight">{emp.department || '—'}</td>
                    <td className="px-8 py-5">
                      <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest bg-gray-50 text-gray-600 border-gray-200">{emp.employee_type}</span>
                    </td>
                    <td className="px-8 py-5 text-right font-mono font-black text-gray-800 text-sm">₱{Number(emp.daily_salary || 0).toLocaleString()}</td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest ${emp.is_active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {emp.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => navigate(`/employee/${emp.id}`)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="View Profile">
                          <SafeIcon icon={FiUser} />
                        </button>
                        <button onClick={() => openEdit(emp)} className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Edit">
                          <SafeIcon icon={FiEdit2} />
                        </button>
                        <button onClick={() => handleDelete(emp)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <SafeIcon icon={FiTrash2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-8 border-b border-gray-100">
              <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">{editingId ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <SafeIcon icon={FiX} className="text-xl text-gray-500" />
              </button>
            </div>
            <div className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Field form={form} setForm={setForm} label="Employee ID *" name="employee_id" />
                <Field form={form} setForm={setForm} label="Full Name *" name="name" />
                <Field form={form} setForm={setForm} label="Department" name="department" options={DEPARTMENTS} />
                <Field form={form} setForm={setForm} label="Position" name="position" />
                <Field form={form} setForm={setForm} label="Daily Salary *" name="daily_salary" type="number" />
                <Field form={form} setForm={setForm} label="Employee Type" name="employee_type" options={EMPLOYEE_TYPES} />
                <Field form={form} setForm={setForm} label="Bank Account" name="bank_account" />
                <Field form={form} setForm={setForm} label="TIN Number" name="tin_number" />
                <Field form={form} setForm={setForm} label="SSS Number" name="sss_number" />
                <Field form={form} setForm={setForm} label="PhilHealth Number" name="philhealth_number" />
                <Field form={form} setForm={setForm} label="Pag-IBIG Number" name="pagibig_number" />
                <div>
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">Status</label>
                  <select value={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
                    className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none text-sm">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                  className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-8 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">
                <SafeIcon icon={FiSave} /> {saving ? 'Saving...' : editingId ? 'Update' : 'Add Employee'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-8 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
