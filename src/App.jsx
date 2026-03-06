import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { parseExcelFile } from './utils/excelParser';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async file => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseExcelFile(file);
      if (!parsed.movements.length) {
        throw new Error('No movement data found. The file may use an unsupported format.');
      }
      setData(parsed);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
            <span>Traffic Counts Dashboard</span>
          </div>
          {data && (
            <span className="header-file">{data.meta.name || data.meta.fileName}</span>
          )}
        </div>
      </header>

      <main className="app-main">
        {!data ? (
          <div className="landing">
            <div className="landing-hero">
              <h1>Traffic Counts Analysis</h1>
              <p>Upload an intersection counts Excel file to explore volumes, peak hours, vehicle types, and movement breakdowns.</p>
            </div>
            <FileUpload onFile={handleFile} loading={loading} />
            {error && (
              <div className="error-box">
                <strong>Could not parse file:</strong> {error}
              </div>
            )}
          </div>
        ) : (
          <Dashboard data={data} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}
