import { useState, useEffect } from "react";
import { Download, RefreshCw, Smartphone, X, CheckCircle2, Share, Monitor, Laptop } from "lucide-react";
import { classNames } from "../../lib/formatters.js";

export function PwaBanner({ _canInstall, isInstalled, isIOS, needRefresh, onInstall, onUpdate }) {
  const [dismissedInstall, setDismissedInstall] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem("biztrac_pwa_install_dismissed");
    if (isDismissed) {
      setDismissedInstall(true);
    }
  }, []);

  const handleDismissInstall = () => {
    setDismissedInstall(true);
    localStorage.setItem("biztrac_pwa_install_dismissed", "true");
  };

  const handleInstallClick = async () => {
    const installedNatively = await onInstall();
    if (!installedNatively) {
      setShowInstructionsModal(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* Floating PWA Install Widget / Card */}
      {!dismissedInstall ? (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-palm/30 bg-white/95 p-4 text-ink shadow-2xl shadow-palm/25 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-palm text-white shadow-md shadow-palm/30">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ink">Install BizTrac App</p>
                <p className="truncate text-xs font-medium text-slate-500">
                  Offline access & fast app mode
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 rounded-xl bg-palm px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-palm/20 transition hover:bg-palmDeep"
              >
                <Download className="h-4 w-4" />
                <span>Install</span>
              </button>
              <button
                onClick={handleDismissInstall}
                className="grid h-8 w-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Update Available Banner (floating at top-right or top center) */}
      {needRefresh ? (
        <div className="fixed top-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:w-96 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-600 p-4 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20 text-white">
                <RefreshCw className="h-5 w-5 animate-spin-slow" />
              </div>
              <div>
                <p className="text-sm font-black">App Update Available</p>
                <p className="text-xs font-medium text-sky-100">
                  New features ready. Update now.
                </p>
              </div>
            </div>
            <button
              onClick={onUpdate}
              className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-sky-700 transition hover:bg-sky-50 shadow-sm"
            >
              Update
            </button>
          </div>
        </div>
      ) : null}

      {/* Installation Instructions Modal */}
      {showInstructionsModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-palm text-white shadow-md">
                  <Laptop className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-black text-ink">Install BizTrac Application</p>
                  <p className="text-xs font-medium text-slate-500">Standalone App & Offline Access</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-600">
                  To install BizTrac on iPhone or iPad (Safari):
                </p>
                <ol className="space-y-2 text-xs font-semibold text-slate-700">
                  <li className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-palm text-[0.7rem] font-bold text-white">
                      1
                    </span>
                    <span>
                      Tap the <strong className="text-ink">Share</strong> button <Share className="inline h-3.5 w-3.5 text-palm" /> at the bottom of Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-palm text-[0.7rem] font-bold text-white">
                      2
                    </span>
                    <span>
                      Scroll down and select <strong className="text-ink">Add to Home Screen</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-palm text-[0.7rem] font-bold text-white">
                      3
                    </span>
                    <span>
                      Tap <strong className="text-ink">Add</strong> in the top right corner.
                    </span>
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-600">
                  Install BizTrac directly from your browser:
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <div className="rounded-xl bg-skyglass p-3 border border-palm/20 space-y-1">
                    <p className="font-black text-palm flex items-center gap-1.5">
                      <Monitor className="h-4 w-4" /> Desktop Chrome / Edge / Brave:
                    </p>
                    <p className="text-slate-600 leading-normal">
                      Click the <strong className="text-ink">Install Icon</strong> (computer icon with down arrow) located on the right side of your browser address URL bar, or click menu (⋮) &rarr; <em>Install BizTrac</em>.
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <p className="font-black text-ink flex items-center gap-1.5">
                      <Smartphone className="h-4 w-4 text-palm" /> Android Chrome:
                    </p>
                    <p className="text-slate-600 leading-normal">
                      Tap the browser menu (⋮) at top right and select <strong className="text-ink">Add to Home Screen</strong> or <strong className="text-ink">Install app</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowInstructionsModal(false)}
              className="w-full rounded-xl bg-palm py-3 text-xs font-black text-white shadow-lg shadow-palm/20 transition hover:bg-palmDeep"
            >
              Got It
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PwaInstallButton({ _canInstall, isInstalled, _isIOS, onInstall, className }) {
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return (
      <div className={classNames("flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-200", className)}>
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <span>App Installed</span>
      </div>
    );
  }

  const handleClick = async () => {
    const success = await onInstall();
    if (!success) {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={classNames(
          "flex items-center gap-2 rounded-xl bg-palm px-4 py-2 text-xs font-bold text-white shadow-md shadow-palm/20 transition hover:bg-palmDeep",
          className
        )}
      >
        <Download className="h-4 w-4" />
        <span>Install BizTrac App</span>
      </button>

      {showModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-black text-ink">Install Instructions</p>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Click the <strong>Install</strong> icon in your browser address bar (top right) or browser menu (⋮) &rarr; <strong>Install BizTrac</strong>.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full rounded-xl bg-palm py-2.5 text-xs font-bold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
