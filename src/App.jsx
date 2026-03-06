import { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { parseExcelFile, SheetNotFoundError } from './utils/excelParser';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sheetSuggestions, setSheetSuggestions] = useState(null);

  const handleFile = async file => {
    setLoading(true);
    setError(null);
    setSheetSuggestions(null);
    try {
      const parsed = await parseExcelFile(file);
      if (!parsed.movements.length) {
        throw new Error('No movement data found after parsing. The file structure may differ from expected.');
      }
      setData(parsed);
    } catch (e) {
      if (e instanceof SheetNotFoundError) {
        setSheetSuggestions(e.suggestions);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    setSheetSuggestions(null);
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
            {sheetSuggestions && (
              <div className="suggestions-box">
                <p className="suggestions-title">No supported sheet found in this file.</p>
                <p className="suggestions-sub">Supported sheets: <code>data</code> (full counts) or <code>לוח 5</code> (PCU summary)</p>
                <table className="suggestions-table">
                  <thead><tr><th>Sheet</th><th>Description</th></tr></thead>
                  <tbody>
                    {sheetSuggestions.map(s => (
                      <tr key={s.name}>
                        <td><code>{s.name}</code></td>
                        <td>{s.hint}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
