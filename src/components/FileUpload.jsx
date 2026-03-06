import { useRef, useState } from 'react';

export default function FileUpload({ onFile, loading }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleFile = file => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    onFile(file);
  };

  const onDrop = e => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="upload-wrapper">
      <div
        className={`upload-zone ${dragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="upload-content">
            <div className="spinner" />
            <p>Parsing file…</p>
          </div>
        ) : (
          <div className="upload-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="upload-main">Drop a counts file here</p>
            <p className="upload-sub">or click to browse — .xlsx / .xls</p>
          </div>
        )}
      </div>
    </div>
  );
}
