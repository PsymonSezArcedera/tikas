import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

// A log card: title + date-nav on the header, a couple of fields and a submit
// button in the body — matches both the Weight and Body measurement cards.
function LogCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
        <Skeleton className="h-3.5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldSkeleton />
          <FieldSkeleton />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// Matches the tracking layout: header + two-column grid of the weight and
// measurement log cards.
export default function TrackingLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <LogCardSkeleton />
        <LogCardSkeleton />
      </div>
    </div>
  );
}
