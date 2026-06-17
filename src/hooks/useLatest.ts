import { useRef } from "react";

/** A ref that always holds the latest value — for reading current state inside
 * callbacks without adding it to dependency arrays (advanced-use-latest). */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
