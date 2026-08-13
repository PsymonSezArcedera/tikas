import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

// Matches the wellness layout: header + a 3-up row of topic cards + the hint
// line. Light page (only the Lux thread is fetched), but kept consistent.
export default function WellnessLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="gap-3 p-5">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3.5 w-full" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-4 w-56" />
    </div>
  );
}
