import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import { employeeService } from '../services/employeeService';

const { FiUsers, FiPlus, FiEdit, FiDollarSign, FiSearch } = FiIcons;

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await employeeService.getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter(employee => 
    employee.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-3 rounded-lg">
              <SafeIcon icon={FiUsers} className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Employee Overview</h1>
              <p className="text-gray-600">GT Payroll System</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Link
              to="/employee-list"
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
            >
              <SafeIcon icon={FiPlus} />
              <span>Manage Employees</span>
            </Link>
            <Link
              to="/calculate"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg"
            >
              <SafeIcon icon={FiEdit} />
              <span>Calculate Salary</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <SafeIcon icon={FiSearch} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <SafeIcon icon={FiUsers} className="text-gray-300 text-6xl mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              {employees.length === 0 ? 'No Employees Added' : 'No Employees Found'}
            </h3>
            <p className="text-gray-500 mb-6">
              {employees.length === 0 
                ? 'Get started by adding your first employee for payroll.' 
                : 'Try adjusting your search criteria.'}
            </p>
            {employees.length === 0 && (
              <Link
                to="/employee-list"
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                <SafeIcon icon={FiPlus} />
                <span>Add First Employee</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEmployees.map((employee) => (
              <div key={employee.id} className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <SafeIcon icon={FiUsers} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{employee.name}</h3>
                      <p className="text-sm text-gray-600">{employee.position || 'Position not specified'}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to="/calculate"
                      state={{ employee }}
                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                      title="Calculate Salary"
                    >
                      <SafeIcon icon={FiEdit} />
                    </Link>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Employee ID</p>
                    <p className="font-medium text-gray-800">{employee.employee_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="font-medium text-gray-800">{employee.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Daily Salary</p>
                    <p className="font-medium text-gray-800">{formatCurrency(employee.daily_salary)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium">
                      <span className={`px-2 py-1 rounded-full text-xs ${employee.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Created: {new Date(employee.created_at).toLocaleDateString()}</span>
                  <Link
                    to="/results"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View History
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;