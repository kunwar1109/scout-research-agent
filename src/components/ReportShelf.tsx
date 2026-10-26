'use client';

import Link from 'next/link';
import type { SavedReport } from '@/lib/chat-store';

function download(report: SavedReport) {
  const blob = new Blob([report.markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.title.replace(/[^\w\- ]+/g, '').trim() || 'report'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportShelf({ reports, persisted }: { reports: SavedReport[]; persisted: boolean }) {
  return (
    <aside className="aside" aria-label="Saved reports">
      <h2 className="shelf-title">Reports</h2>
      <p className="shelf-hint">
        {reports.length === 0
          ? 'Ask Scout to “write a report” on anything it researched. You approve it before it’s saved here.'
          : `${reports.length} saved${persisted ? '' : ' in this session'}`}
      </p>
      {reports.map((r) => (
        <article key={r.id} className="report">
          <h3>{r.title}</h3>
          <p>{r.summary}</p>
          <div className="actions">
            <button className="btn" onClick={() => download(r)}>Download .md</button>
            <button className="btn" onClick={() => navigator.clipboard.writeText(r.markdown)}>Copy</button>
            {persisted && r.chatId && (
              <Link className="btn" href={`/c/${r.chatId}`}>Open session</Link>
            )}
          </div>
        </article>
      ))}
    </aside>
  );
}
