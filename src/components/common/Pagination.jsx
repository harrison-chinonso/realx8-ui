import Button from '../ui/Button';

export default function Pagination({ page, totalPages, onPageChange }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 pt-4">
      <Button variant="secondary" onClick={() => onPageChange(Math.max(page - 1, 1))} disabled={page <= 1}>Previous</Button>
      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
      <Button variant="secondary" onClick={() => onPageChange(Math.min(page + 1, totalPages))} disabled={page >= totalPages}>Next</Button>
    </div>
  );
}
