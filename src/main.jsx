import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { parseInventory, compareInventories, reportCsv } from './inventory';
import './style.css';

const types = ['All results', 'Quantity mismatch', 'Missing from A', 'Missing from B', 'Duplicate SKU', 'Invalid record', 'Match'];
function App() {
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All results');
  const [page, setPage] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const versions = useRef({ A: 0, B: 0 });
  const ready = files.A && files.B;
  const rows = ready ? compareInventories(files.A.data, files.B.data) : [];
  const issues = rows.filter(row => row.type !== 'Match');
  const count = type => rows.filter(row => row.type === type).length;
  const visible = rows.filter(row => (filter === 'All results' || row.type === filter) && `${row.sku} ${row.name} ${row.detail}`.toLowerCase().includes(query.toLowerCase()));
  const maxPage = Math.max(0, Math.ceil(visible.length / 50) - 1);
  const currentPage = Math.min(page, maxPage);
  async function upload(file, source) {
    if (!file) return;
    const version = ++versions.current[source];
    setBusy(old => ({ ...old, [source]: true }));
    setFiles(old => ({ ...old, [source]: null }));
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds the 10 MB limit. Split it into smaller files.');
      const text = await file.text();
      const data = parseInventory(text, source);
      if (versions.current[source] === version) setFiles(old => ({ ...old, [source]: { name: file.name, data } }));
    } catch (error) {
      if (versions.current[source] === version) setFiles(old => ({ ...old, [source]: { name: file.name, data: { records: new Map(), uniqueCount: 0, duplicateCount: 0, fatal: true, issues: [{ type: 'Invalid record', source, sku: '', name: '', detail: error.message }] } } }));
    } finally {
      if (versions.current[source] === version) setBusy(old => ({ ...old, [source]: false }));
      setPage(0);
    }
  }
  function reset() {
    versions.current.A++; versions.current.B++;
    setFiles({}); setBusy({}); setQuery(''); setFilter('All results'); setPage(0); setEpoch(epoch + 1);
  }
  function download() {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + reportCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'stock-integrity-report.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const validation = ['A', 'B'].flatMap(source => files[source]?.data.issues || []);
  const fatal = ready && (files.A.data.fatal || files.B.data.fatal);
  return <div className="app">
    <aside><a className="brand" href="#"><span className="brand-icon">▥</span><span>STOCK<br/><b>WATCHDOG</b></span></a><div className="workspace-label">WORKSPACE</div><div className="nav-active"><span>▦</span> Inventory comparison <span className="nav-dot"/></div><div className="aside-bottom"><span className="secure">◈</span><strong>Your stock. Your browser.</strong><p>Files are processed locally.<br/>No uploads. No accounts.</p><span className="version">INTEGRITY WATCHDOG · V0.1</span></div></aside>
    <div className="main"><header><span>Workspace <span className="slash">/</span> <strong>Stock integrity</strong></span><span className="local"><i/> Local processing</span></header>
    <main><div className="heading"><div><div className="eyebrow">INVENTORY CONTROL</div><h1>A clearer picture of your stock.</h1><p>Compare two inventories. Find the gaps. Keep every SKU accounted for.</p></div><button className="reset" onClick={reset}>↻ &nbsp; Reset workspace</button></div>
    <section className="upload-section"><div className="section-title"><h2><span className="step">01</span> Add your inventories</h2><span>CSV files · up to 10 MB each</span></div><div className="upload-grid">{['A', 'B'].map(source => <div className="upload-card" key={source}><div className="upload-top"><span className="letter">{source}</span><div><h3>Inventory {source}</h3><p>{source === 'A' ? 'Your reference inventory' : 'The inventory to check against it'}</p></div>{files[source] && <span className={`file-tag ${files[source].data.issues.length ? 'warn' : ''}`}>{files[source].data.issues.length ? 'Review needed' : 'Validated'}</span>}</div><label className="dropzone"><span className="upload-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></svg></span><strong>{busy[source] ? 'Reading and validating…' : files[source]?.name || 'Choose a CSV file'}</strong><span>{files[source] ? 'Click to replace this file' : 'or drag and drop it here'}</span><input key={`${source}-${epoch}`} aria-label={`Upload Inventory ${source}`} type="file" accept=".csv,text/csv" onChange={event => upload(event.target.files[0], source)} /></label><a className="example" href={`/examples/inventory-${source.toLowerCase()}.csv`} download>↓ &nbsp; Download example {source}</a></div>)}</div><p className="format">ⓘ &nbsp; Required columns: <code>sku</code><code>product_name</code><code>quantity</code> <span>· Quantities must be nonnegative whole numbers. SKU case is preserved.</span></p></section>
    <div aria-live="polite" className="status">{busy.A || busy.B ? 'Processing your file locally…' : ready ? fatal ? 'Comparison paused. Fix file-level validation problems and replace the affected file.' : 'Comparison complete. Invalid and duplicate SKUs are excluded from quantity comparisons.' : 'Add both CSV files to generate your comparison.'}</div>
    {!!validation.length && <details className="validation" open><summary>{validation.length} validation problem{validation.length === 1 ? '' : 's'} to investigate</summary><ul>{validation.map((issue, index) => <li key={index}><strong>Inventory {issue.source}{issue.row ? ` · record ${issue.row}` : ''}{issue.sku ? ` · ${issue.sku}` : ''}:</strong> {issue.detail}</li>)}</ul></details>}
    <section><div className="section-title"><h2><span className="step">02</span> Your stock at a glance</h2><span>{ready && !fatal ? 'A → B comparison' : 'Awaiting valid inventories'}</span></div><div className="stats">{[
      ['UNIQUE SKUS · A', files.A?.data.uniqueCount, 'Reference inventory', ''], ['UNIQUE SKUS · B', files.B?.data.uniqueCount, 'Comparison inventory', ''], ['MATCHING STOCK', ready && !fatal ? count('Match') : null, 'Same SKU & quantity', 'green'], ['QUANTITY MISMATCHES', ready && !fatal ? count('Quantity mismatch') : null, 'Different stock levels', 'orange'], ['MISSING SKUS', ready && !fatal ? count('Missing from A') + count('Missing from B') : null, 'Present in one file only', 'red'], ['DUPLICATE SKUS', files.A || files.B ? (files.A?.data.duplicateCount || 0) + (files.B?.data.duplicateCount || 0) : null, 'Per-file SKU warnings', 'purple']
    ].map(([label, value, caption, color]) => <div className={`stat ${color}`} key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>{caption}</small></div>)}</div></section>
    <section className="results"><div className="results-heading"><div><h2>Comparison results <span className="badge">{rows.length}</span></h2><p>Every difference, with the detail you need to investigate.</p></div><button className="primary" onClick={download} disabled={!ready || !issues.length}>↓ &nbsp; Export issues{issues.length ? ` (${issues.length})` : ''}</button></div><div className="toolbar"><label className="search"><span>⌕</span><input aria-label="Search results" placeholder="Search SKU, product or issue…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}/></label><label className="filter">Show <select aria-label="Filter issue type" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}>{types.map(type => <option key={type}>{type}</option>)}</select></label></div><div className="table-wrap"><table><thead><tr><th>SKU / PRODUCT</th><th>INVENTORY A</th><th>INVENTORY B</th><th>DIFFERENCE <span>B − A</span></th><th>STATUS / DETAIL</th></tr></thead><tbody>{visible.slice(currentPage * 50, currentPage * 50 + 50).map((row, index) => <tr key={`${currentPage}-${index}`}><td><strong>{row.sku || '—'}</strong><small>{row.name || `Inventory ${row.source}${row.row ? ` · record ${row.row}` : ''}`}</small></td><td>{row.a ?? '—'}</td><td>{row.b ?? '—'}</td><td className={row.difference ? 'difference' : ''}>{row.difference > 0 ? '+' : ''}{row.difference ?? '—'}</td><td><span className={`pill ${row.type === 'Match' ? 'match' : row.type === 'Quantity mismatch' ? 'mismatch' : 'issue'}`}>{row.type}</span><small>{row.detail}</small></td></tr>)}</tbody></table>{!visible.length && <div className="empty"><span>▤</span><h3>{ready ? 'No results to display' : 'Your comparison starts here'}</h3><p>{ready ? 'Check validation messages or adjust your search and filters.' : 'Upload Inventory A and B above to see what matches — and what needs attention.'}</p></div>}</div><div className="table-footer"><span>{visible.length ? `${currentPage * 50 + 1}–${Math.min((currentPage + 1) * 50, visible.length)} of ${visible.length} results` : '0 results'} · Difference = B − A · Missing quantities are never treated as zero</span>{maxPage > 0 && <div><button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>Next</button></div>}</div></section>
    <footer><span><span className="footer-dot"/> Private by design. Your inventory never leaves this browser.</span><span>STOCK INTEGRITY WATCHDOG <b>0.1</b></span></footer></main></div></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
