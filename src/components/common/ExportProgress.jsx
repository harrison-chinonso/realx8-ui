import Button from '../ui/Button';
import { reloadForNewBuild } from '../../utils/lazyImport';

/**
 * What an export is doing, while it does it.
 *
 * Exports felt broken before this: clicking the button did nothing visible for
 * several seconds — the spreadsheet engine alone is a ~940KB download on first
 * use — and then the operating system's save dialog appeared with no
 * explanation of the gap. Long enough to click twice, or to conclude it had
 * failed.
 *
 * The stages shown are the real ones the exporter reports, not a timer: the
 * bar moves when something actually happens, and the label says which part is
 * slow. On a fast connection it flashes past, which is the correct behaviour —
 * it is there for the case where it does not.
 */
export default function ExportProgress({ progress, error, staleBuild, onDismiss }) {
  if (staleBuild) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--line-strong)', backgroundColor: 'var(--surface-sunken)', color: 'var(--content)' }}
      >
        <span className="flex-1">{error}</span>
        {/* The whole remedy is one click; anything else is asking the user to
            diagnose a deployment for us. */}
        <Button type="button" size="sm" variant="primary" onClick={reloadForNewBuild}>
          Reload
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--danger)' }}>
        <span role="alert" className="flex-1">{error}</span>
        {onDismiss && (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>Dismiss</Button>
        )}
      </div>
    );
  }

  if (!progress) return null;

  return (
    <div className="space-y-1" aria-live="polite">
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--content-muted)' }}>
        <span>{progress.stage}…</span>
        <span className="tabular-nums">{progress.percent}%</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--surface-sunken)' }}
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Export progress"
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${progress.percent}%`, backgroundColor: 'var(--primary)' }}
        />
      </div>
    </div>
  );
}
