import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

// Matches the nutrition layout: header + two columns (the log form, and the
// day's totals summary), so the real cards drop straight in.
export default function NutritionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Log form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="h-3.5 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldSkeleton />
            {/* Meal segmented control */}
            <Skeleton className="h-11 w-full rounded-xl" />
            <FieldSkeleton />
            <div className="grid grid-cols-3 gap-3">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Day summary */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-3.5 w-36" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-4">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-10 w-32" />
              <div className="grid grid-cols-3 gap-2">
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
                <Skeleton className="h-14 rounded-lg" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
