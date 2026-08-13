import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shared skeleton pieces so every route's loading.tsx speaks the same visual
// language — same card treatment, same muted pulse blocks — and lays out to
// match the real page, so the swap to real content doesn't shift.

/** Page header: optional icon tile + title + subtitle, matching the app header. */
export function PageHeaderSkeleton({ icon = true }: { icon?: boolean }) {
  return (
    <div className="flex items-start gap-4">
      {icon ? <Skeleton className="size-11 shrink-0 rounded-xl" /> : null}
      <div className="flex flex-col gap-2.5 pt-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}

/** A dashboard bento stat tile: label + icon up top, hero anchored to the bottom. */
export function StatCardSkeleton() {
  return (
    <Card className="min-h-40 gap-3 p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="size-4 rounded" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2.5">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>
    </Card>
  );
}

/** An analytics chart card: icon + title + description, then a plot-height block. */
export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3.5 w-52" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-56 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

/** A form field: label line + input box, for the log-form pages. */
export function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}
