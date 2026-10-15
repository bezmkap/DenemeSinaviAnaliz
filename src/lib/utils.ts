export { cn } from "cn";

import { useSyncExternalStore } from "react";

export function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
