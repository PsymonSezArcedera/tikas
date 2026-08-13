import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

// Matches the workout layout: header + the [plan-setup form | plan] two-column
// grid. The plan side stands in for either a rendered plan or the empty state.
export default function WorkoutLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* Plan setup form */}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3.5 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldSkeleton />
            <div className="grid grid-cols-2 gap-3">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <FieldSkeleton />
            <FieldSkeleton />
            <Skeleton className="h-11 w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Plan */}
        <Card className="min-h-72 gap-4 p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
          <div className="flex flex-col gap-3 pt-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </Card>
      </div>
    </div>
  );
}
