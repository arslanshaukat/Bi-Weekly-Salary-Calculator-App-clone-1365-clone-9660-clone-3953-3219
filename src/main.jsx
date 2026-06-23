import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { initVersionCheck } from './utils/versionManager';
initVersionCheck();
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
