import Link from "next/link";

import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <Container className="py-20">
      <EmptyState title="That page does not exist">
        It may have moved, or the link may be wrong.{" "}
        <Link href="/" className="font-medium text-eclipse-700 hover:underline dark:text-eclipse-400">
          Back to the home page
        </Link>
        .
      </EmptyState>
    </Container>
  );
}
