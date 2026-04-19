import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../supabase.js';
import * as faceapi from 'face-api.js';

function nowDate() { return new Date(); }
function fmtTime(d) { return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }); }
function fmtDateShort(d) { return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtShort(d) { return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function todayISO() { return nowDate().toISOString().split('T')[0]; }
function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h) + pin.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36).toUpperCase();
}
function toFloat32(d) {
  if (!d) return null;
  if (d instanceof Float32Array) return d;
  if (Array.isArray(d)) return new Float32Array(d);
  if (typeof d === 'object') return new Float32Array(Object.values(d).map(Number));
  return null;
}

export default function BundyClock() {
  const [time, setTime] = useState(nowDate());
  const [mode, setMode] = useState('idle');
  const [pin, setPin] = useState('');
  const [employees, setEmployees] = useState([]);
  const [clockedIn, setClockedIn] = useState([]);
  const [message, setMessage] = useState('');
  const [faceReady, setFaceReady] = useState(false);
  const [faceLoading, setFaceLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showWhoIn, setShowWhoIn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => { const t = setInterval(() => setTime(nowDate()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { loadData(); const t = setInterval(loadData, 20000); return () => clearInterval(t); }, []);

  async function loadData() {
    try {
      const emps = await pb.collection('employees').getFullList({ filter: 'is_active=true', sort: 'name' });
      setEmployees(emps);
      const logs = await pb.collection('bundy_logs').getFullList({ filter: `date="${todayISO()}"`, sort: '-time' });
      const latest = {};
      logs.forEach(l => { if (!latest[l.employee_id]) latest[l.employee_id] = l; });
      const inNow = Object.values(latest).filter(l => l.action === 'clock_in').map(l => ({ id: l.employee_id, name: l.employee_name, time: l.time }));
      setClockedIn(inNow);
    } catch (e) { console.error(e); }
  }

  async function loadFaceModels() {
    if (faceReady) return true;
    setFaceLoading(true);
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
      setFaceReady(true); setFaceLoading(false); return true;
    } catch (e) { setFaceLoading(false); return false; }
  }

  async function startFaceScan() {
    const ok = await loadFaceModels();
    if (!ok) { showError('Face models unavailable. Use PIN.'); return; }
    setMode('face'); setScanStatus('Starting camera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanStatus('Look at the camera...');
      setTimeout(() => runFaceScan(), 2500);
    } catch (e) { showError('Camera denied. Use PIN.'); setMode('idle'); }
  }

  async function runFaceScan() {
    if (!videoRef.current) return;
    setScanStatus('Scanning...');
    try {
      const det = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 })).withFaceLandmarks(true).withFaceDescriptor();
      if (!det) { setScanStatus('No face. Retrying...'); setTimeout(() => runFaceScan(), 1500); return; }
      setScanStatus('Matching...');
      const empsWithFace = employees.filter(e => e.face_descriptor_type_JSON);
      if (!empsWithFace.length) { stopCamera(); showError('No face data registered.'); return; }
      let bestMatch = null, bestDist = 0.55;
      for (const emp of empsWithFace) {
        const stored = toFloat32(emp.face_descriptor_type_JSON);
        if (!stored) continue;
        const dist = faceapi.euclideanDistance(det.descriptor, stored);
        if (dist < bestDist) { bestDist = dist; bestMatch = emp; }
      }
      stopCamera();
      if (bestMatch) await processClockAction(bestMatch, 'face');
      else { showError('Not recognized. Use PIN.'); setMode('idle'); }
    } catch (e) { stopCamera(); showError('Scan failed. Try PIN.'); setMode('idle'); }
  }

  function stopCamera() { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; } }

  function handlePin(digit) {
    if (pin.length >= 6) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4 || newPin.length === 6) setTimeout(() => verifyPin(newPin), 200);
  }

  async function verifyPin(enteredPin) {
    const hash = hashPin(enteredPin);
    try {
      const result = await pb.collection('employee_pins').getFirstListItem(`pin_hash="${hash}"`);
      const emp = employees.find(e => (e.sb_id === result.employee_id) || (e.id === result.employee_id));
      if (emp) { setPin(''); await processClockAction(emp, 'pin'); }
      else { setMessage('Not found.'); setPin(''); }
    } catch (e) { setMessage('Wrong PIN.'); setPin(''); }
  }

  async function processClockAction(emp, method) {
    const today = todayISO();
    const timeStr = fmtShort(nowDate());
    const empId = emp.sb_id || emp.id;
    let action = 'clock_in';
    try { await pb.collection('bundy_logs').getFirstListItem(`employee_id="${empId}" && date="${today}" && action="clock_in"`); action = 'clock_out'; } catch (e) {}
    if (action === 'clock_out') {
      try { await pb.collection('bundy_logs').getFirstListItem(`employee_id="${empId}" && date="${today}" && action="clock_out"`); showError(`${emp.name} already out.`); return; } catch (e) {}
    }
    await pb.collection('bundy_logs').create({ employee_id: empId, employee_name: emp.name, action, time: timeStr, date: today, method });
    await updateAttendance(empId, action, timeStr, today);
    setMessage(action === 'clock_in' ? `In · ${timeStr}` : `Out · ${timeStr}`);
    setSelectedEmployee({ ...emp, action, timeStr });
    setMode('success');
    await loadData();
    setTimeout(() => { setMode('idle'); setMessage(''); setSelectedEmployee(null); }, 4000);
  }

  async function handleClockOut(empEntry) {
    const emp = employees.find(e => (e.sb_id === empEntry.id) || (e.id === empEntry.id));
    if (!emp) return;
    setShowWhoIn(false);
    setSelectedEmployee(emp);
    setMode('pin');
    setPin('');
    setMessage(`Out: ${emp.name}`);
  }

  async function updateAttendance(empId, action, timeStr, date) {
    try {
      const existing = await pb.collection('attendance').getFirstListItem(`employee_id="${empId}" && date>="${date} 00:00:00.000Z" && date<="${date} 23:59:59.999Z"`);
      const updates = { modified_at: new Date().toISOString() };
      if (action === 'clock_in') updates.check_in_time = timeStr;
      if (action === 'clock_out') updates.check_out_time = timeStr;
      await pb.collection('attendance').update(existing.id, updates);
    } catch (e) {
      if (action === 'clock_in') {
        await pb.collection('attendance').create({ employee_id: empId, date: `${date} 00:00:00.000Z`, status: 'present', check_in_time: timeStr, check_out_time: '', late_minutes: 0, undertime_minutes: 0, modified_at: new Date().toISOString(), modified_by_name: 'Bundy Clock' });
      }
    }
  }

  function showError(msg) { setMessage(msg); setMode('error'); setTimeout(() => { setMode('idle'); setMessage(''); }, 3500); }
  function cancelMode() { stopCamera(); setPin(''); setMode('idle'); setMessage(''); setSelectedEmployee(null); }

  // Pure black background — OLED friendly, max battery saving
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: '#000', color: '#fff' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #1a1a1a' }} className="px-5 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <p style={{ color: '#3b82f6', fontSize: 10 }} className="font-black uppercase tracking-widest">GT International</p>
          <h1 className="font-black uppercase tracking-tight text-white" style={{ fontSize: 16 }}>⏱ Bundy Clock</h1>
        </div>
        <div className="text-right">
          <p className="font-black tabular-nums" style={{ fontSize: 20, color: '#fff' }}>{fmtTime(time)}</p>
          <p className="font-black uppercase tracking-widest" style={{ fontSize: 9, color: '#555' }}>{fmtDateShort(time)}</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-5 py-2 flex items-center justify-between flex-shrink-0" style={{ background: '#111', borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex gap-5">
          <div>
            <span className="font-black text-white" style={{ fontSize: 16 }}>{clockedIn.length}</span>
            <span className="font-black uppercase tracking-widest ml-1" style={{ fontSize: 9, color: '#22c55e' }}>In</span>
          </div>
          <div>
            <span className="font-black text-white" style={{ fontSize: 16 }}>{employees.length - clockedIn.length}</span>
            <span className="font-black uppercase tracking-widest ml-1" style={{ fontSize: 9, color: '#ef4444' }}>Out</span>
          </div>
        </div>
        <button onClick={() => setShowWhoIn(!showWhoIn)}
          className="font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all"
          style={{ fontSize: 9, background: '#1a1a1a', color: '#888', border: '1px solid #333' }}>
          {showWhoIn ? 'Hide ▴' : "Who's In ▾"}
        </button>
      </div>

      {/* Who's In Drawer */}
      {showWhoIn && (
        <div className="px-4 py-2 flex-shrink-0 overflow-y-auto" style={{ maxHeight: 150, background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
          {clockedIn.length === 0 ? (
            <p className="text-center font-black uppercase tracking-widest py-3" style={{ fontSize: 9, color: '#444' }}>No one clocked in</p>
          ) : clockedIn.map((emp, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid #111' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center font-black flex-shrink-0" style={{ background: '#1d4ed8', fontSize: 10, color: '#fff' }}>{emp.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-black uppercase truncate" style={{ fontSize: 10, color: '#ccc' }}>{emp.name}</p>
                <p className="font-black uppercase" style={{ fontSize: 8, color: '#555' }}>In: {emp.time}</p>
              </div>
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#22c55e' }} />
              <button onClick={() => handleClockOut(emp)}
                className="font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                style={{ fontSize: 8, background: '#1a0000', color: '#ef4444', border: '1px solid #330000' }}>Out</button>
            </div>
          ))}
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">

        {mode === 'idle' && (
          <div className="w-full text-center" style={{ maxWidth: 300 }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#0f172a', border: '1px solid #1e3a5f' }}>
              <span style={{ fontSize: 28 }}>🕐</span>
            </div>
            <h2 className="font-black uppercase tracking-tight mb-1" style={{ fontSize: 20, color: '#fff' }}>Ready</h2>
            <p className="font-black uppercase tracking-widest mb-6" style={{ fontSize: 9, color: '#444' }}>Choose verification method</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button onClick={() => { setMode('pin'); setPin(''); setMessage(''); }}
                className="py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
                style={{ fontSize: 12, background: '#1d4ed8', color: '#fff', border: 'none' }}>
                🔢<br/><span style={{ fontSize: 9 }}>PIN Code</span>
              </button>
              <button onClick={startFaceScan} disabled={faceLoading}
                className="py-5 rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
                style={{ fontSize: 12, background: '#6d28d9', color: '#fff', border: 'none', opacity: faceLoading ? 0.5 : 1 }}>
                {faceLoading ? '⏳' : '👤'}<br/><span style={{ fontSize: 9 }}>{faceLoading ? 'Loading...' : 'Face ID'}</span>
              </button>
            </div>
            <a href="/" className="font-black uppercase tracking-widest" style={{ fontSize: 9, color: '#333', textDecoration: 'none' }}>← Admin</a>
          </div>
        )}

        {mode === 'pin' && (
          <div className="w-full text-center" style={{ maxWidth: 280 }}>
            <h2 className="font-black uppercase tracking-tight mb-1" style={{ fontSize: 18, color: '#fff' }}>Enter PIN</h2>
            {message && <p className="font-black uppercase tracking-widest mb-2 px-3 py-1 rounded-full inline-block" style={{ fontSize: 9, background: '#1a0f00', color: '#f59e0b' }}>{message}</p>}
            <div className="flex justify-center gap-2 mb-5">
              {[...Array(Math.max(4, pin.length))].map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-full transition-all" style={{ background: i < pin.length ? '#3b82f6' : '#222', border: `2px solid ${i < pin.length ? '#3b82f6' : '#333'}`, transform: i < pin.length ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((d, i) => (
                <button key={i}
                  onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d !== '' ? handlePin(String(d)) : null}
                  className="py-4 rounded-xl font-black transition-all active:scale-95"
                  style={{ fontSize: 20, background: d === '' ? 'transparent' : '#111', color: '#fff', border: d === '' ? 'none' : '1px solid #222', visibility: d === '' ? 'hidden' : 'visible' }}>
                  {d}
                </button>
              ))}
            </div>
            <button onClick={cancelMode} className="font-black uppercase tracking-widest" style={{ fontSize: 9, color: '#333' }}>Cancel</button>
          </div>
        )}

        {mode === 'face' && (
          <div className="w-full text-center" style={{ maxWidth: 280 }}>
            <h2 className="font-black uppercase tracking-tight mb-3" style={{ fontSize: 18, color: '#fff' }}>Face ID</h2>
            <div className="relative mx-auto mb-3 rounded-2xl overflow-hidden" style={{ width: 200, height: 200, border: '3px solid #6d28d9' }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
              <div className="absolute inset-0 rounded-2xl" style={{ border: '3px solid #7c3aed', animation: 'pulse 2s infinite', opacity: 0.4 }} />
              <div className="absolute bottom-0 left-0 right-0 p-2" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                <p className="font-black uppercase tracking-widest text-center" style={{ fontSize: 8, color: '#a78bfa' }}>{scanStatus}</p>
              </div>
            </div>
            <button onClick={cancelMode} className="font-black uppercase tracking-widest" style={{ fontSize: 9, color: '#333' }}>Cancel</button>
          </div>
        )}

        {mode === 'success' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: selectedEmployee?.action === 'clock_in' ? '#14532d' : '#1e3a5f', border: `2px solid ${selectedEmployee?.action === 'clock_in' ? '#22c55e' : '#3b82f6'}` }}>
              <span style={{ fontSize: 30 }}>{selectedEmployee?.action === 'clock_in' ? '✅' : '👋'}</span>
            </div>
            {selectedEmployee?.photo && (
              <img src={selectedEmployee.photo} alt="" className="rounded-full object-cover mx-auto mb-3" style={{ width: 52, height: 52, border: '3px solid #1a1a1a' }} />
            )}
            <p className="font-black uppercase tracking-tight" style={{ fontSize: 20, color: '#fff' }}>{selectedEmployee?.name}</p>
            <p className="font-black uppercase tracking-widest mt-2 px-4 py-1.5 rounded-full inline-block"
              style={{ fontSize: 10, background: selectedEmployee?.action === 'clock_in' ? '#14532d' : '#1e3a5f', color: selectedEmployee?.action === 'clock_in' ? '#22c55e' : '#60a5fa' }}>{message}</p>
          </div>
        )}

        {mode === 'error' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: '#450a0a', border: '2px solid #ef4444' }}>
              <span style={{ fontSize: 30 }}>❌</span>
            </div>
            <p className="font-black uppercase tracking-wide px-4 py-3 rounded-2xl" style={{ fontSize: 12, background: '#1a0000', color: '#ef4444' }}>{message}</p>
            <button onClick={cancelMode} className="mt-4 px-6 py-2.5 rounded-2xl font-black uppercase tracking-widest transition-all" style={{ fontSize: 10, background: '#111', color: '#888' }}>Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
