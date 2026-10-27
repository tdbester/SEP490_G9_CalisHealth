import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook tải dữ liệu tối giản thay cho @tanstack/react-query (dự án chỉ có MUI + axios).
 *
 *   const { data, isLoading, error, isFetching, refetch } = useApiQuery(
 *     () => contentManagerApi.exercises(),
 *     { enabled: true, deps: [code] },
 *   );
 *
 * - `deps` giống deps của useEffect: đổi giá trị -> tự tải lại.
 * - `fetcher` luôn được gọi qua ref nên không cần useCallback ở nơi gọi.
 * - Không setState sau khi unmount.
 */
export function useApiQuery(fetcher, { enabled = true, deps = [] } = {}) {
  const [state, setState] = useState({
    data: undefined,
    error: null,
    isLoading: enabled,
    isFetching: enabled,
  });
  const mounted = useRef(false);
  const fetcherRef = useRef(fetcher);
  const requestId = useRef(0);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setData = useCallback((updater) => {
    setState((current) => ({
      ...current,
      data: typeof updater === "function" ? updater(current.data) : updater,
    }));
  }, []);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((current) => ({ ...current, isFetching: true, error: null }));
    try {
      const data = await fetcherRef.current();
      // bỏ qua response cũ nếu đã có request mới hơn
      if (mounted.current && id === requestId.current) {
        setState({ data, error: null, isLoading: false, isFetching: false });
      }
      return data;
    } catch (error) {
      if (mounted.current && id === requestId.current) {
        setState({ data: undefined, error, isLoading: false, isFetching: false });
      }
      return undefined;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ data: undefined, error: null, isLoading: false, isFetching: false });
      return;
    }
    run();
    // deps do nơi gọi khai báo; fetcher đã được giữ trong ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  return { ...state, refetch: run, setData };
}

/**
 * Hook mutation tối giản: `mutate(values)` + `isPending` + `error` của lần gần nhất.
 * onSuccess/onError được đọc qua ref nên không làm thay đổi identity của `mutate`.
 */
export function useApiMutation(mutationFn, { onSuccess, onError } = {}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(false);
  const handlers = useRef({ onSuccess, onError, mutationFn });
  handlers.current = { onSuccess, onError, mutationFn };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(async (variables) => {
    setIsPending(true);
    setError(null);
    try {
      const result = await handlers.current.mutationFn(variables);
      if (mounted.current) {
        setIsPending(false);
        handlers.current.onSuccess?.(result, variables);
      }
      return result;
    } catch (requestError) {
      if (mounted.current) {
        setIsPending(false);
        setError(requestError);
        handlers.current.onError?.(requestError, variables);
      }
      return undefined;
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { mutate, isPending, error, reset };
}
