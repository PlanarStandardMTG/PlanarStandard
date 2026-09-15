import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <Container className="py-12">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-3 h-5 w-full max-w-prose" />

      <Skeleton className="mt-8 h-7 w-44" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </Container>
  );
}
