import { useState, useEffect, useMemo } from "react";
import { getSession, getWorkspace, signOut, subscribeToAuthChanges } from "../services/authService.js";
import { showToast } from "../lib/toast.js";
import { business as demoBusiness } from "../lib/mockData.js";

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [demoBusinessProfile, setDemoBusinessProfile] = useState(demoBusiness);
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
      if (nextSession) setIsDemo(false);
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
        console.error("Unable to load workspace", error);
        showToast("Unable to load workspace");
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
    if (isDemo) return demoBusinessProfile;

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
  }, [demoBusinessProfile, isDemo, session, workspace]);

  const handleSignOut = async (resetStates) => {
    if (isDemo) {
      setIsDemo(false);
      resetStates?.();
      return;
    }

    try {
      await signOut();
      resetStates?.();
    } catch (error) {
      console.error("Unable to sign out", error);
      showToast("Unable to sign out");
    }
  };

  const startDemo = (onDemoStart) => {
    setDemoBusinessProfile(demoBusiness);
    setIsDemo(true);
    onDemoStart?.();
  };

  return {
    session,
    workspace,
    workspaceLoading,
    isDemo,
    setIsDemo,
    isLoading,
    isRecoveringPassword,
    setIsRecoveringPassword,
    business,
    setDemoBusinessProfile,
    handleSignOut,
    startDemo,
  };
}
