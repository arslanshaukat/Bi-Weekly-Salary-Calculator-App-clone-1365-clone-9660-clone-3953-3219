import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Header from './components/Header';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './supabase.js';
import SafeIcon from './common/SafeIcon';
import * as FiIcons from 'react-icons/fi';
import Loading from './components/common/Loading';
import SystemHeartbeat from './components/common/SystemHeartbeat';
import PublicPulse from './components/common/PublicPulse';
import ActivityWatcher from './components/common/ActivityWatcher';
import './App.css';

// Lazy load components
const EmployeeForm = lazy(() => import('./components/EmployeeForm'));
const CalculationResults = lazy(() => import('./components/CalculationResults'));
const EmployeeList = lazy(() => import('./components/EmployeeList'));
const AttendanceTracker = lazy(() => import('./components/AttendanceTracker'));
const EmployeeDetail = lazy(() => import('./components/EmployeeDetail'));
const PayslipDetail = lazy(() => import('./components/PayslipDetail'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const FinancialSummary = lazy(() => import('./components/FinancialSummary'));

const { FiAlertTriangle } = FiIcons;

// Component to handle redirection for restricted users like Mel
const RootRedirect = () => {
  const { user } = useAuth();
  if (user?.email === 'gtsubic@gmail.com') {
    return <Navigate to="/attendance" replace />;
  }
  return <ProtectedRoute><EmployeeList /></ProtectedRoute>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <SystemHeartbeat />
          <ActivityWatcher />
          
          {!isSupabaseConfigured && (
            <div className="bg-orange-600 text-white px-4 py-3 shadow-md relative z-50">
              <div className="container mx-auto flex items-center justify-center space-x-2">
                <SafeIcon icon={FiAlertTriangle} className="text-xl" />
                <span className="font-medium">Supabase is not connected. Check environment variables.</span>
              </div>
            </div>
          )}

          <Header />

          <main className="container mx-auto px-4 py-8 flex-grow">
            <Suspense fallback={<Loading />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/pulse" element={<PublicPulse />} />
                <Route path="/login" element={<Login />} />

                {/* Protected Routes */}
                <Route path="/" element={<RootRedirect />} />
                
                <Route path="/calculate" element={
                  <ProtectedRoute requirePermission="manage_payroll">
                    <EmployeeForm />
                  </ProtectedRoute>
                } />
                
                <Route path="/results" element={
                  <ProtectedRoute requirePermission="manage_payroll">
                    <CalculationResults />
                  </ProtectedRoute>
                } />
                
                <Route path="/attendance" element={
                  <ProtectedRoute requirePermission="manage_attendance">
                    <AttendanceTracker />
                  </ProtectedRoute>
                } />
                
                <Route path="/employee/:employeeId" element={
                  <ProtectedRoute requirePermission="manage_employees">
                    <EmployeeDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/results/:payRecordId" element={
                  <ProtectedRoute requirePermission="manage_payroll">
                    <PayslipDetail />
                  </ProtectedRoute>
                } />
                
                <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                
                <Route path="/summary" element={
                  <ProtectedRoute requirePermission="manage_payroll">
                    <FinancialSummary />
                  </ProtectedRoute>
                } />
                
                <Route path="/users" element={<ProtectedRoute requireAdmin={true}><UserManagement /></ProtectedRoute>} />

                {/* Catch-all redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>

          <ToastContainer position="top-right" autoClose={3000} theme="colored" pauseOnHover closeOnClick />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;