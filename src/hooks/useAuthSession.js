import { useState, useEffect, useMemo } from "react";
import { getSession, getWorkspace, signOut, subscribeToAuthChanges } from "../services/authService.js";
import { showToast } from "../lib/toast.js";

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getSession()
      .then((currentSession) => {
        if (isMounted) setSession(currentSession);
      })
      .catch((error) => {
        console.error("Unable to restore session", error);
        showToast("Unable to restore session");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const unsubscribe = subscribeToAuthChanges((nextSession, event) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setIsRecoveringPassword(true);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!session?.user) {
      setWorkspace(null);
      setWorkspaceLoading(false);
      return undefined;
    }

    setWorkspaceLoading(true);
    getWorkspace(session.user.id)
      .then((nextWorkspace) => {
        if (isMounted) setWorkspace(nextWorkspace);
      })
      .catch((error) => {
        console.warn("[useAuthSession] Unable to load workspace:", error?.message || error);
        if (isMounted) setWorkspace(null);
      })
      .finally(() => {
        if (isMounted) setWorkspaceLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session]);

  const business = useMemo(() => {
    const fallbackOwner =
      session?.user?.user_metadata?.full_name || session?.user?.email || "there";

    if (!workspace?.business) {
      return {
        name: "BizTrac",
        owner: fallbackOwner,
        logoText: "BT",
        phone: "",
        email: session?.user?.email || "",
        location: "",
        currency: "GHS",
        slogan: "",
        momo_details: "",
        return_policy: "Goods sold in good condition are not returnable after 3 days.",
        receipt_width: "58mm",
        receipt_footer: "Thank you for your patronage! Visit again.",
      };
    }

    const current = workspace.business;
    const initials = current.name
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();

    return {
      ...current,
      logoText: initials || "BT",
      owner: fallbackOwner,
    };
  }, [session, workspace]);

  const handleSignOut = async (resetStates) => {
    try {
      await signOut();
      resetStates?.();
    } catch (error) {
      console.error("Unable to sign out", error);
      showToast("Unable to sign out");
    }
  };

  return {
    session,
    workspace,
    setWorkspace,
    workspaceLoading,
    isLoading,
    isRecoveringPassword,
    setIsRecoveringPassword,
    business,
    handleSignOut,
  };
}
