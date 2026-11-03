import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const LIST_PATH = "/admin/notifications";

export default function useUnsavedNotificationNavigation(isDirty) {
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState(null);

  useEffect(() => {
    if (!isDirty) return undefined;
    const currentHref = window.location.href;
    const currentHistoryState = window.history.state;
    const preventLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const interceptBrowserBack = (event) => {
      event.stopImmediatePropagation();
      window.history.pushState(currentHistoryState, "", currentHref);
      setPendingPath(LIST_PATH);
    };
    const interceptLinkNavigation = (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setPendingPath(LIST_PATH);
    };

    window.addEventListener("beforeunload", preventLeaving);
    window.addEventListener("popstate", interceptBrowserBack, true);
    document.addEventListener("click", interceptLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventLeaving);
      window.removeEventListener("popstate", interceptBrowserBack, true);
      document.removeEventListener("click", interceptLinkNavigation, true);
    };
  }, [isDirty]);

  const requestLeave = (path = LIST_PATH) => {
    if (isDirty) setPendingPath(LIST_PATH);
    else navigate(path);
  };
  const cancelLeave = () => setPendingPath(null);
  const discardChanges = () => navigate(LIST_PATH, { replace: true });
  const completeSave = () => navigate(LIST_PATH, { replace: true });

  return {
    isLeaveConfirmationOpen: pendingPath !== null,
    requestLeave,
    cancelLeave,
    discardChanges,
    completeSave,
  };
}
