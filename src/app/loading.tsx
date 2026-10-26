/** Shown while a session loads on the server. Also the Suspense boundary Cache Components needs for request-time pages. */
export default function Loading() {
  return (
    <div className="shell">
      <nav className="sessions" aria-hidden />
      <main className="main">
        <header className="topbar">
          <span className="brand">Scout</span>
          <span className="tagline">Searches, reads, checks the math, cites its sources.</span>
        </header>
        <div className="thread">
          <ol className="trail"><li className="step step-wait" data-state="running"><span className="step-label">Loading research…</span></li></ol>
        </div>
      </main>
      <aside className="aside" aria-hidden />
    </div>
  );
}
