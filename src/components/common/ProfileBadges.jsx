/**
 * A person's operable profiles. A user holding both realtor and client roles
 * shows both chips — the account `type` alone would hide the second.
 */
export default function ProfileBadges({ profiles = [], hasBoth = false }) {
  if (!profiles.length) return <span className="text-slate-400">—</span>;

  const style = {
    realtor: 'bg-indigo-100 text-indigo-700',
    client: 'bg-sky-100 text-sky-700',
  };

  return (
    <span className="flex flex-wrap items-center gap-1">
      {profiles.map((profile) => (
        <span key={profile} className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${style[profile] || 'bg-slate-100 text-slate-600'}`}>
          {profile}
        </span>
      ))}
      {hasBoth && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700" title="Holds both a client and a realtor account">
          Both
        </span>
      )}
    </span>
  );
}
