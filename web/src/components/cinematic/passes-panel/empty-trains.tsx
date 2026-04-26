/** Empty-state card rendered when a train_query returns no trains.
 *  Static informational text — no CTA, no buttons, no fallback.
 *  A user who wants individual Starlinks searches by NORAD ID or name. */
export function EmptyTrains() {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center">
      <div className="font-serif text-[16px] text-[#a89a84] mb-2">
        No active Starlink trains
      </div>
      <div className="text-[11px] text-[#8a7c68] max-w-[260px] leading-[1.5]">
        Trains form within the first ~30 days of a SpaceX launch. None visible
        from your location in this window — check back when there's been a
        recent launch.
      </div>
    </div>
  );
}
