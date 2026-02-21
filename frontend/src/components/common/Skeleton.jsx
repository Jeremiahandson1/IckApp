/**
 * Skeleton loading components for Ick
 * Usage: <SkeletonCard /> or <SkeletonList count={5} />
 */

function Pulse({ className = '' }) {
  return (
    <div className={`animate-pulse bg-gray-800 rounded-xl ${className}`} />
  );
}

/** Single card skeleton — matches pantry/swap card height */
export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Pulse className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Pulse className="h-4 w-3/4" />
          {lines >= 2 && <Pulse className="h-3 w-1/2" />}
          {lines >= 3 && <Pulse className="h-3 w-2/3" />}
        </div>
        <Pulse className="w-12 h-12 rounded-full shrink-0" />
      </div>
    </div>
  );
}

/** Stacked list of skeleton cards */
export function SkeletonList({ count = 4, lines = 2 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

/** Recipe card skeleton */
export function SkeletonRecipeCard() {
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <Pulse className="h-36 rounded-none rounded-t-2xl" />
      <div className="p-4 space-y-2">
        <Pulse className="h-4 w-2/3" />
        <Pulse className="h-3 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Pulse className="h-6 w-16 rounded-full" />
          <Pulse className="h-6 w-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Product result skeleton */
export function SkeletonProduct() {
  return (
    <div className="space-y-4 p-4">
      {/* Score circle */}
      <div className="flex justify-center">
        <Pulse className="w-36 h-36 rounded-full" />
      </div>
      {/* Name/brand */}
      <div className="space-y-2 text-center">
        <Pulse className="h-6 w-3/4 mx-auto" />
        <Pulse className="h-4 w-1/2 mx-auto" />
      </div>
      {/* Score breakdown */}
      <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
        {[1,2,3].map(i => (
          <div key={i} className="flex justify-between items-center">
            <Pulse className="h-4 w-1/3" />
            <Pulse className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Profile page skeleton */
export function SkeletonProfile() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Pulse className="w-16 h-16 rounded-full" />
        <div className="space-y-2 flex-1">
          <Pulse className="h-5 w-1/2" />
          <Pulse className="h-4 w-2/3" />
        </div>
      </div>
      {[1,2,3].map(i => (
        <Pulse key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

export default Pulse;
