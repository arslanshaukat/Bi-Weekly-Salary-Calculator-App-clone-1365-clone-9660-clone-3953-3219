import React, { useState, useEffect, useMemo } from 'react';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';
import { toast } from 'react-toastify';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

const { FiPieChart, FiFilter, FiPrinter, FiUser, FiShield, FiGift, FiTrendingUp, FiRefreshCw } = FiIcons;

const FinancialSummary = () => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Default date range: Current Year
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch both employees and pay records to ensure everyone is included
      const [empData, recordData] = await Promise.all([
        employeeService.getEmployees(),
        employeeService.getPayRecordsWithEmployees(2000)
      ]);
      setEmployees(empData);
      setRecords(recordData);
    } catch (error) {
      toast.error('Failed to load financial records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const summaryData = useMemo(() => {
    // 1. Initialize result object with ALL employees from the system
    const grouped = employees.reduce((acc, emp) => {
      acc[emp.id] = {
        name: emp.name,
        idNum: emp.employee_id || 'N/A',
        type: emp.employee_type || 'Full Time',
        thirteenth: 0,
        sss: 0,
        philhealth: 0,
        pagibig: 0,
        totalStatutory: 0,
        hasRecord: false
      };
      return acc;
    }, {});

    // 2. Filter records by date range
    const filteredRecords = records.filter(record => {
      if (!startDate || !endDate) return true;
      try {
        const recordDate = parseISO(record.start_date);
        return isWithinInterval(recordDate, {
          start: startOfDay(parseISO(startDate)),
          end: endOfDay(parseISO(endDate))
        });
      } catch (e) {
        return false;
      }
    });

    // 3. Aggregate financial data into the employee slots
    filteredRecords.forEach(record => {
      const empId = record.employee_id;
      if (grouped[empId]) {
        const s = Number(record.sss_contribution || 0);
        const ph = Number(record.philhealth_contribution || 0);
        const pi = Number(record.pagibig_contribution || 0);
        const th = Number(record.thirteenth_month || 0);

        grouped[empId].thirteenth += th;
        grouped[empId].sss += s;
        grouped[empId].philhealth += ph;
        grouped[empId].pagibig += pi;
        grouped[empId].totalStatutory += (s + ph + pi);
        grouped[empId].hasRecord = true;
      }
    });

    const list = Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    
    const totals = list.reduce((acc, curr) => ({
      thirteenth: acc.thirteenth + curr.thirteenth,
      sss: acc.sss + curr.sss,
      philhealth: acc.philhealth + curr.philhealth,
      pagibig: acc.pagibig + curr.pagibig,
      totalStatutory: acc.totalStatutory + curr.totalStatutory
    }), { thirteenth: 0, sss: 0, philhealth: 0, pagibig: 0, totalStatutory: 0 });

    return { list, totals };
  }, [records, employees, startDate, endDate]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0);
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Syncing Full Personnel Roster...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-gray-100 no-print text-left">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 text-white">
              <SafeIcon icon={FiPieChart} className="text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight uppercase">Financial Ledger</h1>
              <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">GT International • Global Personnel Summary</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={loadData} 
              className="bg-white border-2 border-gray-100 text-gray-600 p-4 rounded-2xl font-black hover:bg-gray-50 transition-all shadow-sm"
              title="Refresh Data"
            >
              <SafeIcon icon={FiRefreshCw} />
            </button>
            <button 
              onClick={() => window.print()} 
              className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-black transition-all flex items-center space-x-2 uppercase tracking-widest text-[10px]"
            >
              <SafeIcon icon={FiPrinter} />
              <span>Generate Report</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-3xl border border-gray-100">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Period Start</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl font-black outline-none transition-all shadow-sm" 
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Period End</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-blue-600 rounded-2xl font-black outline-none transition-all shadow-sm" 
            />
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="bg-green-600 p-8 rounded-[2rem] text-white shadow-2xl shadow-green-100 flex justify-between items-center transform hover:scale-[1.02] transition-transform">
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">13th Month Accrual</p>
            <h3 className="text-3xl font-black tracking-tighter">{formatCurrency(summaryData.totals.thirteenth)}</h3>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl"><SafeIcon icon={FiGift} className="text-2xl" /></div>
        </div>
        <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-2xl shadow-blue-100 flex justify-between items-center transform hover:scale-[1.02] transition-transform">
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total Contributions</p>
            <h3 className="text-3xl font-black tracking-tighter">{formatCurrency(summaryData.totals.totalStatutory)}</h3>
          </div>
          <div className="bg-white/20 p-4 rounded-2xl"><SafeIcon icon={FiShield} className="text-2xl" /></div>
        </div>
        <div className="bg-gray-900 p-8 rounded-[2rem] text-white shadow-2xl flex justify-between items-center transform hover:scale-[1.02] transition-transform">
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Consolidated Liability</p>
            <h3 className="text-3xl font-black tracking-tighter">{formatCurrency(summaryData.totals.thirteenth + summaryData.totals.totalStatutory)}</h3>
          </div>
          <div className="bg-blue-600 p-4 rounded-2xl"><SafeIcon icon={FiTrendingUp} className="text-2xl" /></div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100 text-left">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50 no-print">
          <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest flex items-center">
            <SafeIcon icon={FiUser} className="mr-2 text-blue-600" /> System Personnel Ledger
          </h3>
          <div className="flex space-x-4">
            <span className="text-[10px] font-black text-gray-400 bg-gray-100 px-4 py-1.5 rounded-full uppercase tracking-widest">
              Total Roster: {employees.length}
            </span>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
              Active in Period: {summaryData.list.filter(e => e.hasRecord).length}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/80 border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Personnel</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">13th Month</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">SSS</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">PhilHealth</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Pag-IBIG</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-800 uppercase tracking-[0.2em] text-right bg-blue-50/30">Total Stat.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-black">
              {summaryData.list.map((emp, idx) => (
                <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${!emp.hasRecord ? 'opacity-40' : ''}`}>
                  <td className="px-8 py-5">
                    <p className="text-gray-800 text-sm leading-tight uppercase font-black">{emp.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-[8px] text-gray-400 uppercase tracking-widest">ID: {emp.idNum}</span>
                      <span className={`text-[8px] uppercase px-2 py-0.5 rounded ${emp.type === 'Full Time' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                        {emp.type}
                      </span>
                      {!emp.hasRecord && <span className="text-[7px] font-black text-gray-300 uppercase italic">(No records in range)</span>}
                    </div>
                  </td>
                  <td className={`px-8 py-5 text-right font-mono italic text-sm ${emp.thirteenth > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                    {formatCurrency(emp.thirteenth)}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-xs ${emp.sss > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                    {formatCurrency(emp.sss)}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-xs ${emp.philhealth > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                    {formatCurrency(emp.philhealth)}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-xs ${emp.pagibig > 0 ? 'text-gray-500' : 'text-gray-300'}`}>
                    {formatCurrency(emp.pagibig)}
                  </td>
                  <td className={`px-8 py-5 text-right font-mono text-sm bg-blue-50/10 ${emp.totalStatutory > 0 ? 'text-blue-800' : 'text-gray-300'}`}>
                    {formatCurrency(emp.totalStatutory)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-900 text-white">
              <tr>
                <td className="px-8 py-6 text-[10px] font-black uppercase tracking-widest">Grand Aggregate Totals</td>
                <td className="px-8 py-6 text-right font-black text-green-400 text-lg font-mono tracking-tighter border-l border-white/5">
                  {formatCurrency(summaryData.totals.thirteenth)}
                </td>
                <td className="px-8 py-6 text-right font-bold text-gray-400 font-mono text-xs border-l border-white/5">
                  {formatCurrency(summaryData.totals.sss)}
                </td>
                <td className="px-8 py-6 text-right font-bold text-gray-400 font-mono text-xs border-l border-white/5">
                  {formatCurrency(summaryData.totals.philhealth)}
                </td>
                <td className="px-8 py-6 text-right font-bold text-gray-400 font-mono text-xs border-l border-white/5">
                  {formatCurrency(summaryData.totals.pagibig)}
                </td>
                <td className="px-8 py-6 text-right font-black text-blue-400 text-lg font-mono tracking-tighter border-l border-white/5">
                  {formatCurrency(summaryData.totals.totalStatutory)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Print-Only Template Header */}
      <div className="print-only p-12 text-left">
        <div className="text-center mb-10 border-b-8 border-black pb-6">
          <h1 className="text-5xl font-black uppercase tracking-[0.5em] mb-2">GT International</h1>
          <p className="text-sm font-black tracking-[0.3em]">CONSOLIDATED FINANCIAL SUMMARY LEDGER</p>
          <p className="text-xs font-bold mt-2 bg-black text-white inline-block px-4 py-1 uppercase">
            Period: {startDate} — {endDate}
          </p>
        </div>
        <div className="mt-20 flex justify-between">
          <div className="w-72 border-t-4 border-black pt-3 text-center text-[10px] font-black uppercase tracking-widest">Prepared By / Accountant</div>
          <div className="w-72 border-t-4 border-black pt-3 text-center text-[10px] font-black uppercase tracking-widest">Approved By / Management</div>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;