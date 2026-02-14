/**
 * Version Manager for GT Payroll
 *
 * This utility handles automatic cache busting and state clearing
 * when a new version of the application is deployed.
 */
const APP_VERSION = '1.0.9'; // Incremented version
const VERSION_KEY = 'gt_payroll_app_version';

export const initVersionCheck = () => {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);
    if (storedVersion !== APP_VERSION) {
      console.log(`New version detected: ${APP_VERSION}. Clearing stale cache...`);
      
      // 1. Clear Local Storage
      // We clear everything to ensure Supabase sessions and old profiles are wiped
      // This prevents schema mismatches from breaking the UI
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        localStorage.removeItem(key);
      });

      // 2. Clear Session Storage
      sessionStorage.clear();

      // 3. Set the new version
      localStorage.setItem(VERSION_KEY, APP_VERSION);

      // 4. REMOVED: Force a hard reload
      // window.location.reload(true); 
      // Removing this prevents the "NetworkError" caused by the browser cancelling 
      // active requests during the immediate reload in the preview environment.
      
      console.log('Cache cleared. Application initialized.');
    }
  } catch (error) {
    console.error('Version check failed:', error);
  }
};