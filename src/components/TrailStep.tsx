'use client';

import type { ScoutMessage } from '@/lib/agent';
import { Markdown } from './Markdown';

type Part = ScoutMessage['parts'][number];
type ToolPart = Extract<Part, { type: `tool-${string}` }>;
type ApprovalHandler = (args: { id: string; approved: boolean; reason?: string }) => void;

function hostOf(url?: string) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return url ?? '';
  }
}

function stateOf(part: ToolPart) {
  if (part.state === 'output-available') return 'done';
  if (part.state === 'output-error' || part.state === 'output-denied') return 'error';
  return 'running';
}

/** One line on the agent's trail: what it did, and what came back. */
export function TrailStep({ part, onApprove }: { part: ToolPart; onApprove: ApprovalHandler }) {
  const state = stateOf(part);

  let label: React.ReactNode = null;
  let detail: React.ReactNode = null;

  switch (part.type) {
    case 'tool-webSearch': {
      label = <>Searching for <strong>“{part.input?.query ?? '…'}”</strong></>;
      if (part.state === 'output-available') {
        detail = (
          <ul className="step-detail">
            {part.output.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a>{' '}
                <span>{hostOf(r.url)}</span>
              </li>
            ))}
          </ul>
        );
      }
      break;
    }
    case 'tool-readPage': {
      label = <>Reading <strong>{hostOf(part.input?.url) || 'a page'}</strong></>;
      if (part.state === 'output-available') {
        detail = (
          <ul className="step-detail">
            <li>
              {part.output.title}
              {part.output.truncated ? ', long page, read the first part' : ''}
            </li>
          </ul>
        );
      }
      break;
    }
    case 'tool-lookupDocs': {
      label = <>Checking the docs for <strong>{part.input?.library ?? '…'}</strong>: {part.input?.topic ?? ''}</>;
      if (part.state === 'output-available') {
        detail = (
          <ul className="step-detail">
            <li>
              Context7 · {part.output.libraryId}
              {part.output.truncated ? ', long, read the first part' : ''}
            </li>
          </ul>
        );
      }
      break;
    }
    case 'tool-calculator': {
      label = <>Calculating <strong>{part.input?.expression ?? '…'}</strong></>;
      if (part.state === 'output-available') label = <>{label} = <strong>{part.output.result}</strong></>;
      break;
    }
    case 'tool-saveReport': {
      if (part.state === 'approval-requested') {
        return (
          <li className="step" data-state="running">
            <div className="approval" role="group" aria-label="Approve saving report">
              <h3>Save “{part.input.title}” to your reports?</h3>
              <p>{part.input.summary}</p>
              <details>
                <summary>Preview the report</summary>
                <div><Markdown>{part.input.markdown}</Markdown></div>
              </details>
              <div className="actions">
                <button className="btn btn-primary" onClick={() => onApprove({ id: part.approval.id, approved: true })}>
                  Save report
                </button>
                <button
                  className="btn"
                  onClick={() => onApprove({ id: part.approval.id, approved: false, reason: 'User chose not to save' })}
                >
                  Don’t save
                </button>
              </div>
            </div>
          </li>
        );
      }
      label =
        part.state === 'output-available' ? <>Saved <strong>{part.output.title}</strong> to reports</>
        : part.state === 'output-denied' ? <>Report not saved</>
        : <>Writing a report…</>;
      break;
    }
    default:
      label = <>Using a tool</>;
  }

  return (
    <li className="step" data-state={state}>
      <span className="step-label">{label}</span>
      {detail}
      {part.state === 'output-error' && <div className="step-error">{part.errorText}</div>}
    </li>
  );
}
