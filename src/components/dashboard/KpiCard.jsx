import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown } from 'lucide-react';

// Card visual language mirrors Medusa_Merchant_M_V2's dashboard cards
// (bg-white, rounded-2xl, p-5, zinc label + bold black value, pill delta
// badge) — no leading icon box.
export default function KpiCard({ label, value, sub, subHighlight, onClick, trend, trendLabel, to }) {
  const navigate = useNavigate();
  const isUp = trend > 0;
  const isDown = trend < 0;

  const handleClick = () => {
    if (to) navigate(to);
    else onClick?.();
  };

  return (
    <div
      role={to || onClick ? 'button' : undefined}
      tabIndex={to || onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={`min-w-0 rounded-2xl bg-white p-5 transition-all ${to || onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
    >
      <p className="truncate text-sm text-zinc-400" title={label}>{label}</p>
      <p className="mt-1.5 break-words text-xl font-semibold leading-tight text-black md:text-2xl lg:text-2xl">{value}</p>
      {sub && (
        <p className="mt-1.5 text-xs text-slate-400">
          {subHighlight && <span className="font-semibold text-slate-600">{subHighlight} </span>}
          {sub}
        </p>
      )}
      {trendLabel && trend !== undefined && (
        <div
          className={`mt-2 flex w-fit items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold ${
            isUp
              ? 'border-green-200 bg-green-50 text-green-700'
              : isDown
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}
        >
          {isUp ? <ArrowUp size={12} /> : isDown ? <ArrowDown size={12} /> : null}
          {trendLabel}
        </div>
      )}
    </div>
  );
}
