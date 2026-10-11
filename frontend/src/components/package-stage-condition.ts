import type { Offering } from "@/lib/types";

// Show the first catalog condition, without maintaining a second copy of it.
export function packageStageCondition(service?: Offering): string | undefined {
  if (service?.slug !== "silver" || !service.requirements.trim()) return undefined;
  const requirements = service.requirements.trim();
  return requirements.match(/^.*?[.!?](?=\s|$)/)?.[0] || requirements;
}
