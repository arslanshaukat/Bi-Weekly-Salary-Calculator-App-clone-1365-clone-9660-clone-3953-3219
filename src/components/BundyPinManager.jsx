import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../supabase.js';
import * as faceapi from 'face-api.js';
import { toast } from 'react-toastify';

function hashPin(pin) {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = ((h << 5) - h) + pin.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36).toUpperCase();
}

export default function BundyPinManager({ employee }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [pinId, setPinId] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [faceReady, setFaceReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const empId = employee?.sb_id || employee?.id;

  useEffect(() => {
    if (!empId) return;
    loadPinStatus();
    loadRecentLogs();
    if (employee?.photo) setPhotoUrl(employee.photo);
  }, [empId]);

  async function loadPinStatus() {
    try {
      const result = await pb.collection('employee_pins').getFirstListItem(`employee_id="${empId}"`);
      setHasPin(true); setPinId(result.id);
    } catch (e) { setHasPin(false); setPinId(null); }
  }

  async function loadRecentLogs() {
    try {
      const logs = await pb.collection('bundy_logs').getFullList({ filter: `employee_id="${empId}"`, sort: '-created', batch: 10 });
      setRecentLogs(logs.slice(0, 10));
    } catch (e) { setRecentLogs([]); }
  }

  async function savePin() {
    if (pin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    if (pin !== confirmPin) { toast.error('PINs do not match'); return; }
    setLoading(true);
    try {
      const hash = hashPin(pin);
      if (hasPin && pinId) {
        await pb.collection('employee_pins').update(pinId, { pin_hash: hash, employee_name: employee.name });
      } else {
        await pb.collection('employee_pins').create({ employee_id: empId, pin_hash: hash, employee_name: employee.name });
      }
      toast.success('PIN saved successfully');
      setPin(''); setConfirmPin(''); loadPinStatus();
    } catch (e) { toast.error('Failed to save PIN'); }
    setLoading(false);
  }

  async function deletePin() {
    if (!pinId) return;
    if (!window.confirm('Remove PIN for this employee?')) return;
    try {
      await pb.collection('employee_pins').delete(pinId);
      setHasPin(false); setPinId(null);
      toast.success('PIN removed');
    } catch (e) { toast.error('Failed to remove PIN'); }
  }

  async function startCapture() {
    setCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { toast.error('Camera access denied'); setCapturing(false); }
  }

  async function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    // Resize to max 320px to keep base64 small
    const maxSize = 320;
    const ratio = Math.min(maxSize / videoRef.current.videoWidth, maxSize / videoRef.current.videoHeight);
    canvas.width = videoRef.current.videoWidth * ratio;
    canvas.height = videoRef.current.videoHeight * ratio;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setPhotoUrl(dataUrl);
    stopCamera();
    try {
      if (!faceReady) {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        setFaceReady(true);
      }
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; });
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks(true).withFaceDescriptor();

      // Find PB record - try sb_id first then direct id
      let empRec = null;
      try {
        empRec = await pb.collection('employees').getFirstListItem(`sb_id="${empId}"`);
      } catch(e) {
        try { empRec = await pb.collection('employees').getOne(empId); } catch(e2) {}
      }

      if (empRec) {
        if (detection) {
          const descriptor = Array.from(detection.descriptor);
          await pb.collection('employees').update(empRec.id, { 
            photo: dataUrl, 
            face_descriptor_type_JSON: descriptor 
          });
          toast.success('✅ Photo & face data saved! Employee can now use Face Scan at bundy clock.');
        } else {
          await pb.collection('employees').update(empRec.id, { photo: dataUrl });
          toast.warning('Photo saved but no face detected. Ensure face is clearly visible and try again.');
        }
      } else {
        toast.error('Employee record not found');
      }
    } catch (e) { 
      console.error('Photo save error:', e);
      toast.error('Failed to save: ' + (e.message || 'Unknown error')); 
    }
  }

  function stopCamera() {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCapturing(false);
  }

  return (
    <div className="p-10 space-y-10">
      {/* PIN Management */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">PIN Management</h3>
          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${hasPin ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {hasPin ? '✅ PIN Set' : 'No PIN'}
          </span>
        </div>
        <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem] p-8">
          <div className="grid grid-cols-2 gap-6 max-w-md">
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">{hasPin ? 'New PIN' : 'Set PIN'}</label>
              <input type="password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="4-6 digits" maxLength={6}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none tracking-widest text-center text-xl" />
            </div>
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 block mb-2">Confirm PIN</label>
              <input type="password" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="Repeat PIN" maxLength={6}
                className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-blue-400 outline-none tracking-widest text-center text-xl" />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={savePin} disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">
              {loading ? 'Saving...' : hasPin ? 'Update PIN' : 'Set PIN'}
            </button>
            {hasPin && (
              <button onClick={deletePin}
                className="px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-100 transition-all">
                Remove PIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Photo / Face Registration */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Face Recognition</h3>
          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${photoUrl ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
            {photoUrl ? '✅ Photo Set' : 'No Photo'}
          </span>
        </div>
        <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem] p-8">
          <div className="flex gap-8 items-start">
            <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
              {photoUrl ? <img src={photoUrl} alt="Employee" className="w-full h-full object-cover" /> : <span className="text-4xl">👤</span>}
            </div>
            <div className="flex-1">
              {!capturing ? (
                <div>
                  <p className="text-sm text-gray-500 mb-4">Take a photo to enable face recognition at the bundy clock.</p>
                  <button onClick={startCapture} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-700 transition-all">
                    📷 Open Camera
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-2 border-purple-400 mb-4">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3">
                    <button onClick={capturePhoto} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-purple-700">📸 Capture</button>
                    <button onClick={stopCamera} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bundy Logs */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Recent Bundy Logs</h3>
          <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-5 py-2.5 rounded-full border border-gray-100 tracking-widest">Last 10</span>
        </div>
        <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                <th className="px-10 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-black">
              {recentLogs.length === 0 ? (
                <tr><td colSpan="4" className="px-10 py-10 text-center text-gray-400 text-sm uppercase tracking-widest">No bundy logs yet</td></tr>
              ) : recentLogs.map((log, i) => (
                <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-10 py-6 text-sm font-mono text-gray-700">{log.date}</td>
                  <td className="px-10 py-6 text-sm font-mono text-gray-700">{log.time}</td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${log.action === 'clock_in' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {log.action === 'clock_in' ? 'Clock In' : 'Clock Out'}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-[10px] text-gray-400 uppercase tracking-widest">{log.method || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
