import { useCallback, useEffect, useState } from 'react';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n || 0));
const number = n => new Intl.NumberFormat('en-IN').format(Number(n || 0));
const displayDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not paid yet';
const statusLabel = { paid: 'Settled & paid', pending: 'In payout cycle', overdue: 'Overdue 90+ days', production: 'In production', queued: 'Processing', success: 'Success', failed: 'Failed' };

async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'include', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status})`);
  return data;
}
function Badge({ value }) { return <span className={`badge ${value}`}>{statusLabel[value] || value}</span>; }
function Metric({ title, amount, note }) { return <article className="panel metric"><div className="micro">{title}</div><strong>{amount}</strong><small>{note}</small></article>; }
function LogCard({ log }) { return <article className="log-card"><div className="log-head"><b>{log.authorName || 'Royalty summary'}</b><Badge value={log.status} /></div><div className="muted tiny">{new Date(log.createdAt).toLocaleString()}{log.finishedAt ? ` · completed ${new Date(log.finishedAt).toLocaleTimeString()}` : ''}</div>{log.error && <p className="error-copy">{log.error}</p>}{log.summary && <details><summary>View generated summary</summary><pre>{log.summary}</pre></details>}</article>; }

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('admin@bookleaf.demo');
  const [password, setPassword] = useState('admin123');
  const [loginError, setLoginError] = useState('');
  const [toast, setToast] = useState('');
  const [authors, setAuthors] = useState([]);
  const [cities, setCities] = useState([]);
  const [summary, setSummary] = useState(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [author, setAuthor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState('');

  const notify = message => { setToast(message); window.setTimeout(() => setToast(''), 4200); };
  const loadLogs = useCallback(async () => { if (!user) return; try { const d = await request('/api/logs'); setLogs(d.logs); } catch {} }, [user]);
  const loadAuthors = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const params = new URLSearchParams({ q: query, city, status });
      const d = await request(`/api/authors?${params}`); setAuthors(d.authors); setCities(d.cities); setSummary(d.summary);
      if (selectedId) { const found = d.authors.find(a => a.id === selectedId); if (found) setSelectedAuthor(found); }
    } catch (error) { notify(error.message); }
  }, [user, query, city, status, selectedId]);
  const loadAuthor = useCallback(async () => {
    if (user?.role !== 'author') return;
    try { const d = await request('/api/author/me'); setAuthor(d.author); } catch (error) { notify(error.message); }
  }, [user]);

  useEffect(() => { request('/api/auth/me').then(d => setUser(d.user)).catch(() => {}).finally(() => setBooting(false)); }, []);
  useEffect(() => { if (user?.role === 'admin') loadAuthors(); if (user?.role === 'author') loadAuthor(); if (user) loadLogs(); }, [user, loadAuthors, loadAuthor, loadLogs]);
  useEffect(() => { if (!user) return undefined; const timer = window.setInterval(() => { loadLogs(); if (user.role === 'admin') loadAuthors(); }, 6000); return () => window.clearInterval(timer); }, [user, loadLogs, loadAuthors]);

  async function signIn(event) {
    event.preventDefault(); setLoginError('');
    try { const d = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); setUser(d.user); }
    catch (error) { setLoginError(error.message); }
  }
  async function signOut() { await request('/api/auth/logout', { method: 'POST' }); setUser(null); setAuthor(null); setAuthors([]); setLogs([]); }
  async function selectAuthor(id) { setSelectedId(id); try { const d = await request(`/api/authors/${encodeURIComponent(id)}`); setSelectedAuthor(d.author); } catch (error) { notify(error.message); } }
  async function trigger(authorId) {
    setBusy(authorId);
    try {
      const d = await request('/api/notifications/trigger', { method: 'POST', body: JSON.stringify({ authorId }) });
      notify(d.deduplicated ? 'A recent summary request exists; duplicate dispatch was skipped.' : d.mode === 'local-demo' ? 'Demo summary generated and logged. Configure n8n for AI processing.' : 'Summary sent to n8n; notification log will update when it completes.');
      await Promise.all([loadLogs(), user?.role === 'admin' ? loadAuthors() : loadAuthor()]);
      if (user?.role === 'admin' && selectedId) await selectAuthor(selectedId);
    } catch (error) { notify(error.message); await loadLogs(); }
    finally { setBusy(''); }
  }
  async function bulkTrigger() {
    setBusy('bulk');
    try { const d = await request('/api/notifications/bulk', { method: 'POST', body: JSON.stringify({}) }); notify(`${d.count} eligible author summaries processed.`); await Promise.all([loadAuthors(), loadLogs()]); }
    catch (error) { notify(error.message); }
    finally { setBusy(''); }
  }
  async function exportCsv() {
    const response = await fetch('/api/authors.csv', { credentials: 'include' });
    if (!response.ok) return notify('Could not export author data.');
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = 'bookleaf-authors.csv'; a.click(); URL.revokeObjectURL(url);
  }
  function exportStatement() {
    if (!author) return;
    const rows = [['Title','ISBN','Genre','Status','Published','MRP INR','Platforms','Partner','Copies Sold','Earned INR','Paid INR','Pending INR','Last Payout']];
    for (const b of author.books) rows.push([b.title,b.isbn,b.genre,b.status,b.publishedAt ? displayDate(b.publishedAt) : '',b.mrp ?? '',b.platforms.join('; '),b.printPartner || '',b.copiesSold,b.earned,b.paid,b.pending,b.lastPayout ? displayDate(b.lastPayout) : '']);
    const csv = rows.map(row => row.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'my-royalty-statement.csv'; a.click();
  }

  if (booting) return <div className="boot">Opening BookLeaf workspace…</div>;
  return <>
    <header className="topbar"><a className="brand" href="/"><span className="logo">B</span><span>BookLeaf</span><span className="tag">CREATOR OS</span></a><div className="top-actions"><span className="connection"><i />{user?.role === 'admin' ? 'ADMIN OPERATIONS' : user ? 'AUTHOR PORTAL' : 'ROYALTY WORKSPACE'}</span>{user && <><span className="user-name">{user.name}</span><button className="button compact" onClick={signOut}>Sign out</button></>}</div></header>
    {!user ? <main className="login-layout"><section className="login-intro"><div className="eyebrow">ROYALTY OPERATIONS · CREATOR HUB</div><h1>Your books.<br />Your royalties.<br />One clear view.</h1><p>BookLeaf connects royalty reporting, operations review, and summary notifications in one workspace.</p><div className="seed-note">10 AUTHORS · 18 TITLES · INR LEDGER DATA</div></section><form className="panel login-card" onSubmit={signIn}><h2>Sign in to BookLeaf</h2><p className="muted">Choose a demo role to explore the workspace.</p><label>Email address<input autoComplete="username" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{loginError && <div className="error-copy">{loginError}</div>}<button className="button primary full">Sign in <span>→</span></button><div className="credentials"><b>Admin</b> admin@bookleaf.demo / admin123<br /><b>Author</b> priya.sharma@email.com / author123</div></form></main> : user.role === 'admin' ? <main className="workspace">
      <div className="page-heading"><div><div className="eyebrow">SECTION A3 · OPERATIONS</div><h1>Author Overview & Royalty Engine</h1><p>Search creators, review settlements, and dispatch royalty summaries.</p></div><div className="heading-actions"><button className="button" onClick={exportCsv}>↓ Export CSV</button><button className="button primary" disabled={busy === 'bulk'} onClick={bulkTrigger}>{busy === 'bulk' ? 'Dispatching…' : '⚡ Bulk trigger pending authors'}</button></div></div>
      <section className="metrics">{summary && <><Metric title="Authors" amount={number(summary.authors)} note="registered creators" /><Metric title="Active titles" amount={number(summary.books)} note="published and in production" /><Metric title="Total earned" amount={money(summary.earned)} note="all time royalty ledger · INR" /><Metric title="Pending balance" amount={money(summary.pending)} note={`${summary.overdue} authors overdue`} /></>}</section>
      <div className="admin-grid"><section className="main-column"><div className="panel filters"><input aria-label="Search authors" placeholder="Search author name or email" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Filter by city" value={city} onChange={e => setCity(e.target.value)}><option value="">All cities</option>{cities.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="paid">Settled</option><option value="pending">Pending</option><option value="overdue">Overdue</option></select></div>
        <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Author</th><th>Books</th><th>Earned</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>{authors.map(a => <tr key={a.id} onClick={() => selectAuthor(a.id)} className={selectedId === a.id ? 'selected' : ''}><td><b>{a.name}</b><small>{a.email} · {a.city}</small></td><td>{a.totalBooks}</td><td>{money(a.totals.earned)}</td><td>{money(a.totals.paid)}</td><td><b>{money(a.totals.pending)}</b></td><td><Badge value={a.royaltyStatus} /></td></tr>)}</tbody></table>{!authors.length && <div className="empty">No authors match these filters.</div>}</div></section>
        <section className="panel log-panel"><div className="section-heading"><div><h2>Notification log</h2><p>Workflow dispatch outcomes and callback status</p></div><button className="button compact" onClick={loadLogs}>↻ Refresh</button></div><LogList logs={logs} /></section></section>
        <aside className="panel detail-panel">{selectedAuthor ? <AuthorDetail author={selectedAuthor} busy={busy} onTrigger={() => trigger(selectedAuthor.id)} /> : <div className="empty">Select an author to review their catalog, balances, payout history, and summary action.</div>}</aside>
      </div><footer>BookLeaf Creator OS · Admin access across the royalty ledger · amounts in INR</footer>
    </main> : <main className="workspace author-workspace">
      {author && <><section className="panel author-hero"><div><div className="eyebrow">CREATOR HUB // LEDGER · {author.id}</div><h1>Welcome back, {author.name.split(' ')[0]} ✨</h1><p>{author.email} · {author.city}, {author.country}{author.phone ? ` · ${author.phone}` : ''}</p><div className="hero-badge"><Badge value={author.royaltyStatus} /></div></div><button className="button" onClick={exportStatement}>↓ Download royalty pack</button></section>
        <section className="metrics author-metrics"><Metric title="Copies sold" amount={number(author.totals.copiesSold)} note="across all titles" /><Metric title="Royalties earned" amount={money(author.totals.earned)} note="lifetime gross · INR" /><Metric title="Paid out" amount={money(author.totals.paid)} note="settled payments" /><Metric title="Pending balance" amount={money(author.totals.pending)} note="quarterly cycle · 45 day window" /></section>
        <section className="panel catalog-panel"><div className="section-heading"><div><h2>My books & royalties</h2><p>Sales, royalty ledger, availability, and settlement status</p></div><button className="button" disabled={!!busy} onClick={() => trigger(author.id)}>{busy ? 'Requesting…' : '↻ Request statement refresh'}</button></div><div className="table-scroll"><table className="author-table"><thead><tr><th>Book details</th><th>Genre & status</th><th>Availability</th><th>Sold</th><th>Earned</th><th>Paid</th><th>Pending</th><th>Settlement</th></tr></thead><tbody>{author.books.map(book => <tr key={book.id}><td><b>{book.title}</b><small>ISBN {book.isbn} · MRP {book.mrp == null ? 'TBD' : money(book.mrp)}</small><small>{book.royaltyPerCopy == null ? '' : `${money(book.royaltyPerCopy)} royalty per copy`}</small></td><td>{book.genre}<small>{book.status}{book.printPartner ? ` · ${book.printPartner}` : ''}</small></td><td>{book.platforms.length ? book.platforms.join(', ') : 'Not listed'}<small>Published: {displayDate(book.publishedAt)}</small></td><td>{number(book.copiesSold)}</td><td>{money(book.earned)}</td><td>{money(book.paid)}</td><td><b>{money(book.pending)}</b></td><td><Badge value={book.royaltyStatus} /><small>Last payout: {displayDate(book.lastPayout)}</small></td></tr>)}</tbody></table></div></section>
        <section className="panel log-panel"><div className="section-heading"><div><h2>My notification history</h2><p>Royalty statement summaries for your account</p></div><button className="button compact" onClick={loadLogs}>↻ Refresh</button></div><LogList logs={logs} /></section></>}
      <footer>Your account shows only your author record and books · amounts in INR</footer>
    </main>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}

function AuthorDetail({ author, busy, onTrigger }) {
  return <><div className="detail-top"><div><div className="eyebrow">{author.id} · {author.verified ? 'VERIFIED' : 'UNVERIFIED'}</div><h2>{author.name}</h2><p>{author.email}</p><p>{author.city}, {author.country}{author.phone ? ` · ${author.phone}` : ''}</p></div><Badge value={author.royaltyStatus} /></div>
    <div className="mini-metrics"><div><small>Earned</small><b>{money(author.totals.earned)}</b></div><div><small>Paid</small><b>{money(author.totals.paid)}</b></div><div><small>Pending</small><b>{money(author.totals.pending)}</b></div></div>
    <button className="button primary full" disabled={!!busy} onClick={onTrigger}>{busy === author.id ? 'Dispatching…' : '⚡ Generate & send royalty summary'}</button>
    <h3>Books · {author.books.length}</h3><div className="detail-books">{author.books.map(book => <article className="detail-book" key={book.id}><b>{book.title}</b><small>{book.isbn} · {book.genre} · {book.printPartner || 'Partner TBD'}</small><small>{book.platforms.join(', ') || 'No platforms listed'}</small><div><span>{number(book.copiesSold)} sold · {money(book.earned)} earned</span><Badge value={book.royaltyStatus} /></div></article>)}</div>
    <h3>Payout & summary history</h3><LogList logs={author.logs} /></>;
}
function LogList({ logs }) { return logs.length ? <div className="log-list">{logs.map(log => <LogCard key={log.id} log={log} />)}</div> : <div className="empty compact-empty">No notifications yet.</div>; }
