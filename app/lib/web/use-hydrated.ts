import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

// False on the server and during hydration, true afterwards. Use it to render controls that need
// JavaScript only when it is running, so that no dead buttons show up without it.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
