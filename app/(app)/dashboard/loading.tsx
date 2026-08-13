import { PageHeaderSkeleton, StatCardSkeleton } from "@/components/skeletons";

// Shown while the dashboard's parallel Prisma reads resolve — matches the 6-tile
// bento grid so there's no jump when the real stats arrive. Mirrors page.tsx.
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton icon={false} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
