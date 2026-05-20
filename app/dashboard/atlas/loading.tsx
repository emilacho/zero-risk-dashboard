import { Skeleton } from "@/components/Skeleton"

export default function AtlasLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton kind="overview" ariaLabel="Loading Atlas snapshot" />
    </div>
  )
}
