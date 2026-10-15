import { Skeleton } from "../../components/ui/skeleton";

/** Mirrors the workspace layout so nothing jumps when data arrives. */
export function WorkspaceSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 p-4 md:p-8 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="flex min-h-96 flex-col gap-4 rounded-panel bg-forest p-8 lg:col-span-8">
        <Skeleton className="h-10 w-40 bg-forest-2" />
        <Skeleton className="h-9 w-4/5 bg-forest-2" />
        <Skeleton className="h-4 w-3/5 bg-forest-2" />
        <div className="mt-6 grid flex-1 grid-cols-5 gap-4">
          <Skeleton className="col-span-3 h-full bg-forest-2" />
          <Skeleton className="col-span-2 h-full bg-forest-2" />
        </div>
      </div>
      <div className="flex flex-col gap-5 lg:col-span-4">
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
