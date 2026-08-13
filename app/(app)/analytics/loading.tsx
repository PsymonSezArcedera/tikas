import { ChartCardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

// Matches the analytics chart grid (two full-width trends, a 2-up row, a
// full-width activity chart), so the charts fade in without shifting layout.
export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ChartCardSkeleton className="lg:col-span-2" />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton className="lg:col-span-2" />
      </div>
    </div>
  );
}
