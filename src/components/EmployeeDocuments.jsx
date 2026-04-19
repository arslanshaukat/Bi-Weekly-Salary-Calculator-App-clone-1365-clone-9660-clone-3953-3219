import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../supabase.js';
import { toast } from 'react-toastify';
import SafeIcon from '../common/SafeIcon';
import * as FiIcons from 'react-icons/fi';

const { FiUpload, FiTrash2, FiDownload, FiFile, FiImage, FiFileText, FiX } = FiIcons;

const MAX_IMAGE_WIDTH = 1200;
const MAX_SIZE_KB = 500;

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > MAX_IMAGE_WIDTH) {
          height = (height * MAX_IMAGE_WIDTH) / width;
          width = MAX_IMAGE_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        // Try quality 0.7 first
        let dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        // If still too big, reduce quality further
        if (dataUrl.length > MAX_SIZE_KB * 1024 * 1.37) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.4);
        }
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressPdf(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatSize(kb) {
  if (kb < 1000) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function getIcon(type) {
  if (type?.startsWith('image')) return FiImage;
  if (type === 'application/pdf') return FiFileText;
  return FiFile;
}

function getTypeLabel(type) {
  if (type?.startsWith('image')) return 'Image';
  if (type === 'application/pdf') return 'PDF';
  return 'Document';
}

export default function EmployeeDocuments({ employee }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const fileRef = useRef(null);
  const empId = employee?.sb_id || employee?.id;

  useEffect(() => {
    if (empId) loadDocuments();
  }, [empId]);

  async function loadDocuments() {
    setLoading(true);
    try {
      const docs = await pb.collection('employee_documents').getFullList({
        filter: `employee_id="${empId}"`, sort: '-created'
      });
      setDocuments(docs);
    } catch (e) { setDocuments([]); }
    setLoading(false);
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);

    for (const file of files) {
      try {
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf';

        if (!isImage && !isPdf) {
          toast.error(`${file.name}: Only images and PDFs allowed`);
          continue;
        }

        const fileSizeKb = Math.round(file.size / 1024);
        let data;
        let finalSizeKb = fileSizeKb;

        if (isImage) {
          data = await compressImage(file);
          finalSizeKb = Math.round(data.length * 0.75 / 1024);
          toast.info(`${file.name}: ${fileSizeKb}KB → ${finalSizeKb}KB`);
        } else {
          // PDF — store as base64, warn if large
          if (fileSizeKb > 2048) {
            toast.warning(`${file.name} is large (${formatSize(fileSizeKb)}). Consider a smaller file.`);
          }
          data = await compressPdf(file);
          finalSizeKb = fileSizeKb;
        }

        await pb.collection('employee_documents').create({
          employee_id: empId,
          name: file.name,
          type: file.type,
          size_kb: finalSizeKb,
          data,
          uploaded_at: new Date().toISOString()
        });

        toast.success(`${file.name} uploaded`);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    await loadDocuments();
    setUploading(false);
    e.target.value = '';
  }

  function deleteDocument(doc) {
    setDeleteTarget(doc);
    setDeletePassword('');
    setDeleteError('');
  }

  async function confirmDelete() {
    // Verify against Supabase auth password via PocketBase admin check
    if (!deletePassword) { setDeleteError('Password required'); return; }
    try {
      // Re-authenticate PocketBase admin to verify password
      const res = await fetch('https://pb.gtintl.com.ph/api/admins/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: import.meta.env.VITE_PB_EMAIL, password: deletePassword })
      });
      if (!res.ok) { setDeleteError('Wrong password. Try again.'); return; }
      await pb.collection('employee_documents').delete(deleteTarget.id);
      toast.success('Document deleted');
      setDeleteTarget(null);
      setDeletePassword('');
      loadDocuments();
    } catch (e) { setDeleteError('Wrong password. Try again.'); }
  }

  function downloadDocument(doc) {
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  }

  return (
    <div className="p-10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-black text-gray-800 tracking-tight uppercase">Documents</h3>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-5 py-2.5 rounded-full border border-gray-100 tracking-widest">
            {documents.length} Files
          </span>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100">
            <SafeIcon icon={FiUpload} />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-6">
        Images are auto-compressed · Max recommended PDF: 2MB · Accepted: JPG, PNG, PDF
      </p>

      {loading ? (
        <div className="text-center py-16 text-gray-400 font-black uppercase tracking-widest text-sm">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="overflow-hidden border-2 border-dashed border-gray-100 rounded-[2.5rem] p-16 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiFile} className="text-3xl text-gray-300" />
          </div>
          <p className="font-black uppercase tracking-widest text-gray-300 text-sm mb-2">No documents yet</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">Upload IDs, contracts, certificates</p>
          <button onClick={() => fileRef.current?.click()}
            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all">
            Upload First Document
          </button>
        </div>
      ) : (
        <div className="overflow-hidden border-2 border-gray-50 rounded-[2.5rem]">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Document</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Size</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-black">
              {documents.map((doc, i) => (
                <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${doc.type?.startsWith('image') ? 'bg-purple-100' : 'bg-red-100'}`}>
                        <SafeIcon icon={getIcon(doc.type)} className={`text-sm ${doc.type?.startsWith('image') ? 'text-purple-600' : 'text-red-600'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800 truncate max-w-xs">{doc.name}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                          {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString('en-PH') : '—'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border tracking-widest ${doc.type?.startsWith('image') ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                      {getTypeLabel(doc.type)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right font-mono text-sm text-gray-500">{formatSize(doc.size_kb || 0)}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      {doc.type?.startsWith('image') && (
                        <button onClick={() => setPreview(doc)}
                          className="p-2 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors" title="Preview">
                          <SafeIcon icon={FiImage} />
                        </button>
                      )}
                      <button onClick={() => downloadDocument(doc)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Download">
                        <SafeIcon icon={FiDownload} />
                      </button>
                      <button onClick={() => deleteDocument(doc)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-sm p-8 shadow-2xl">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <SafeIcon icon={FiTrash2} className="text-red-600 text-xl" />
            </div>
            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight text-center mb-1">Confirm Delete</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-center mb-5">Enter your admin password to delete</p>
            <p className="text-xs font-black text-gray-600 bg-gray-50 px-4 py-2 rounded-xl mb-5 text-center truncate">{deleteTarget.name}</p>
            <input type="password" value={deletePassword} onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
              placeholder="Admin password" autoFocus
              className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 font-black text-gray-800 focus:border-red-400 outline-none text-sm mb-2" />
            {deleteError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mb-3">{deleteError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-xs hover:bg-red-700 transition-all">
                Delete
              </button>
              <button onClick={() => { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); }}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)}
              className="absolute -top-4 -right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg z-10">
              <SafeIcon icon={FiX} className="text-gray-800" />
            </button>
            <img src={preview.data} alt={preview.name} className="w-full rounded-2xl shadow-2xl object-contain max-h-[80vh]" />
            <p className="text-center text-white font-black uppercase tracking-widest text-xs mt-3">{preview.name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
