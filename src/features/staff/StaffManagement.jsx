import { useState, useEffect, useId, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
  Eye,
  EyeOff,
  Check,
  CheckCircle2,
  X,
  Trash2,
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Copy,
  KeyRound,
  Share2,
} from "lucide-react";
import {
  ROLES,
  ROLE_METADATA,
  PERMISSION_MATRIX,
  normalizeRole,
} from "./permissions.js";
import {
  listStaffMembers,
  updateStaffRole,
  removeStaffMember,
  addStaffMember,
  generateStaffId,
  generateStaffPassword,
  updateStaffPassword,
  unlockStaffAccount,
} from "../../services/staffService.js";
import { showToast } from "../../lib/toast.js";
import { useBackButtonModal } from "../../hooks/useBackButtonModal.js";
import { RoleDropdownSelector } from "./RoleDropdownSelector.jsx";

export function StaffManagement({
  business,
  currentUser,
  permissions,
  previewRole,
  onSetPreviewRole,
  isOpen = false,
  onClose,
}) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMatrix, setShowMatrix] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Add Member Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState(ROLES.STAFF);
  const [formStaffId, setFormStaffId] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Post-addition credential confirmation modal
  const [createdStaffCredentials, setCreatedStaffCredentials] = useState(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);

  // Password reset/view modal for existing staff
  const [passwordEditMember, setPasswordEditMember] = useState(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  const nameInputId = useId();
  const phoneInputId = useId();
  const emailInputId = useId();
  const staffIdInputId = useId();
  const passwordInputId = useId();

  // Android back-button modal handling
  useBackButtonModal(isOpen && !showAddModal && !createdStaffCredentials && !passwordEditMember, onClose, "staff-management-modal");
  useBackButtonModal(showAddModal, () => setShowAddModal(false), "add-staff-modal");
  useBackButtonModal(Boolean(createdStaffCredentials), () => setCreatedStaffCredentials(null), "staff-credentials-modal");
  useBackButtonModal(Boolean(passwordEditMember), () => setPasswordEditMember(null), "staff-password-modal");

  const businessId =
    business?.id || (currentUser?.id ? `biz-${currentUser.id}` : "default-business");

  const loadMembers = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const data = await listStaffMembers(businessId, currentUser);
      setMembers(data);
    } catch (err) {
      console.error("[StaffManagement] Failed to load staff:", err);
      showToast("Unable to load team list", { type: "warn" });
    } finally {
      setLoading(false);
    }
  }, [businessId, currentUser]);

  useEffect(() => {
    if (isOpen && businessId) {
      loadMembers();
    }
  }, [isOpen, businessId, loadMembers]);

  const handleOpenAddModal = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole(ROLES.STAFF);
    setFormStaffId(generateStaffId());
    setFormPassword(generateStaffPassword());
    setShowFormPassword(false);
    setFormError("");
    setShowAddModal(true);
  };

  const handleRoleChange = async (memberId, newRole) => {
    try {
      await updateStaffRole(businessId, memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: normalizeRole(newRole) } : m))
      );
      showToast(`Role updated to ${ROLE_METADATA[normalizeRole(newRole)]?.label || newRole}`, {
        type: "success",
      });
    } catch (err) {
      console.error("[StaffManagement] Failed to update role:", err);
      showToast("Unable to update staff role", { type: "error" });
    }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeStaffMember(businessId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      setDeleteConfirmId(null);
      showToast("Staff member removed", { type: "info" });
    } catch (err) {
      console.error("[StaffManagement] Failed to remove staff:", err);
      showToast("Unable to remove staff member", { type: "error" });
    }
  };

  const handleUnlockStaff = async (member) => {
    try {
      await unlockStaffAccount(businessId, member.id || member.staffId);
      showToast(`Account for ${member.fullName} unlocked.`, { type: "success" });
      loadMembers();
    } catch (err) {
      console.error("[StaffManagement] Failed to unlock account:", err);
      showToast(err?.message || "Unable to unlock account", { type: "warn" });
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Please enter staff member's full name");
      return;
    }

    if (!formStaffId.trim()) {
      setFormError("Staff ID is required");
      return;
    }

    if (!formPassword.trim()) {
      setFormError("Staff password is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const added = await addStaffMember(businessId, {
        fullName: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        role: formRole,
        staffId: formStaffId.trim(),
        password: formPassword.trim(),
        businessName: business?.name,
      });

      setMembers((prev) => [...prev, added]);
      setShowAddModal(false);
      setCreatedStaffCredentials({
        fullName: added.fullName,
        staffId: added.staffId,
        password: added.password,
        role: added.role,
      });
      setShowCreatedPassword(false);

      showToast(`${added.fullName} added (ID: ${added.staffId})`, {
        type: "success",
      });
    } catch (err) {
      console.error("[StaffManagement] Failed to add staff:", err);
      setFormError(err.message || "Unable to add staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSimulatingCashier = previewRole === ROLES.STAFF;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-palm/10 text-palm">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-black text-ink">Staff & Role Permissions</h2>
              <p className="text-xs text-slate-500">
                Manage counter cashiers and protect confidential profit margins
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Cashier Simulation Toggle (For Store Owners) */}
          {permissions?.isOwnerOrAdmin && onSetPreviewRole && (
            <div className="rounded-2xl border border-palm/20 bg-palm/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-palm text-white">
                  <ShieldAlert className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-palm">
                      Store Owner Feature
                    </p>
                    {isSimulatingCashier && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-800 animate-pulse">
                        SIMULATION ACTIVE
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-ink">
                    {isSimulatingCashier ? "Currently in Cashier View" : "Preview BizTrac as Cashier"}
                  </h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {isSimulatingCashier
                      ? "Cost prices and profits are currently hidden across your POS, Inventory, and Dashboard."
                      : "Test the app right now to verify cost prices and profit margins are completely hidden."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSetPreviewRole(isSimulatingCashier ? null : ROLES.STAFF)}
                className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition shadow-sm ${
                  isSimulatingCashier
                    ? "bg-slate-800 text-white hover:bg-slate-900"
                    : "bg-palm text-white hover:bg-palmDeep"
                }`}
              >
                {isSimulatingCashier ? (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    <span>Return to Owner View</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>Test Cashier View</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Current Role Overview Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Your Current Role</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black ${permissions?.roleMeta?.badgeBg}`}>
                  <UserCheck className="h-3 w-3" />
                  <span>{permissions?.roleMeta?.shortLabel || "Owner"}</span>
                </span>
                {permissions?.isSimulating && (
                  <span className="text-[10px] text-amber-600 font-bold">(Simulated)</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Team Members</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-black text-ink">{members.length}</span>
                <span className="text-xs text-slate-400">registered</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security Mode</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-700">Cost Protection Active</span>
              </div>
            </div>
          </div>

          {/* Team Members List */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-ink">Registered Staff & Cashiers</h3>
                <p className="text-xs text-slate-500">
                  Staff sign in using their unique Staff ID and password
                </p>
              </div>

              {permissions?.canManageStaff && (
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-palm px-3 py-1.5 text-xs font-black text-white hover:bg-palmDeep transition shadow-xs active:scale-95"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Add Staff</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading team members…</div>
            ) : members.length === 0 ? (
              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400">
                No staff members recorded yet.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white">
                {members.map((member) => {
                  const isCurrent = member.isCurrent;
                  const canEditThisMember = permissions?.canManageStaff && !isCurrent;
                  const isLocked = Boolean(member.isLocked);
                  const remainingMinutes = member.remainingMinutes || 1;

                  return (
                    <div
                      key={member.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                          {member.fullName
                            ?.split(/\s+/)
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase() || "ST"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-ink">{member.fullName}</p>
                            {isCurrent && (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-500">
                                You
                              </span>
                            )}
                            {isLocked && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[11px] font-bold text-amber-900 animate-pulse">
                                <Lock className="h-3 w-3 text-amber-700" />
                                <span>Locked ({remainingMinutes}m)</span>
                              </span>
                            )}
                            {member.staffId && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200/90 px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-700">
                                <span>ID:</span>
                                <span className="font-black text-ink">{member.staffId}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(member.staffId);
                                    showToast(`Copied Staff ID ${member.staffId}`);
                                  }}
                                  title="Copy Staff ID"
                                  className="text-slate-400 hover:text-palm ml-0.5"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[member.email, member.phone].filter(Boolean).join(" • ") || "No contact info"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {isLocked && canEditThisMember && (
                          <button
                            type="button"
                            onClick={() => handleUnlockStaff(member)}
                            title="Unlock Staff Account"
                            className="inline-flex items-center gap-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-xs font-bold transition shadow-xs"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            <span>Unlock</span>
                          </button>
                        )}

                        <RoleDropdownSelector
                          currentRole={member.role}
                          onChange={(newRole) => handleRoleChange(member.id, newRole)}
                          disabled={!canEditThisMember}
                          memberName={member.fullName}
                        />

                        {canEditThisMember && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPasswordEditMember(member);
                                setNewPasswordInput(member.password?.startsWith("$2") ? "" : (member.password || ""));
                                setShowResetPass(false);
                              }}
                              title="Manage / View Password"
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>

                            {deleteConfirmId === member.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(member.id)}
                                title="Remove staff member"
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permissions Matrix Accordion */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowMatrix((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100/60 transition"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-palm" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-ink">
                    Role Capabilities & Permission Matrix
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    See what Cashiers vs Managers vs Owners can access
                  </p>
                </div>
              </div>
              {showMatrix ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showMatrix && (
              <div className="border-t border-slate-200 p-4 bg-white overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-2">Capability</th>
                      <th className="pb-2 text-center text-emerald-700">Cashier</th>
                      <th className="pb-2 text-center text-blue-700">Manager</th>
                      <th className="pb-2 text-center text-purple-700">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PERMISSION_MATRIX.map((item) => (
                      <tr key={item.capability} className="hover:bg-slate-50">
                        <td className="py-2 pr-3">
                          <p className="font-bold text-ink">{item.capability}</p>
                          <p className="text-[10px] text-slate-400">{item.description}</p>
                        </td>
                        <td className="py-2 text-center">
                          {item.cashier ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400" title="Hidden / Restricted">
                              <Lock className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {item.admin ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-800">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {item.owner ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-800">
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Cashiers use Staff ID & password to sign in. Confidential costs remain safe.</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-palm/10 text-palm">
                  <UserPlus className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-ink">Add Team Member</h3>
                  <p className="text-[11px] text-slate-500">Auto-creates Staff ID for counter login</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label htmlFor={nameInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  required
                  placeholder="e.g. Abena Mensah"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-ink focus:border-palm focus:outline-hidden"
                />
              </div>

              {/* Auto-Created Alphanumeric Staff ID (Locked & Immutable) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={staffIdInputId} className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <span>Staff ID</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-black text-slate-600 uppercase tracking-wider">
                      <Lock className="h-2.5 w-2.5" />
                      Locked
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormStaffId(generateStaffId())}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-palm hover:text-palmDeep transition"
                    title="Generate a new random Staff ID"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Regenerate ID</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id={staffIdInputId}
                    type="text"
                    readOnly
                    tabIndex={-1}
                    value={formStaffId}
                    placeholder="e.g. AF190"
                    className="w-full font-mono font-black tracking-widest rounded-xl border border-slate-200 px-3 py-2.5 pr-20 text-sm text-ink uppercase bg-slate-100/90 cursor-not-allowed select-all focus:outline-hidden"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center gap-1 text-[10px] font-bold">
                    <Lock className="h-3 w-3" />
                    <span>No Edit</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Auto-generated (2 capital letters + 3 numbers). Cannot be manually altered.
                </p>
              </div>

              {/* Staff Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={passwordInputId} className="block text-xs font-bold text-slate-700">
                    Staff Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormPassword(generateStaffPassword())}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-palm hover:text-palmDeep transition"
                    title="Generate a new random PIN"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Random PIN</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id={passwordInputId}
                    type={showFormPassword ? "text" : "password"}
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter password or PIN"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 pr-10 text-sm text-ink focus:border-palm focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowFormPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Password used by staff to sign in at the counter terminal.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={phoneInputId} className="block text-xs font-bold text-slate-600 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    id={phoneInputId}
                    type="tel"
                    placeholder="e.g. 0244123456"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-ink focus:border-palm focus:outline-hidden"
                  />
                </div>

                <div>
                  <label htmlFor={emailInputId} className="block text-xs font-bold text-slate-600 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    id={emailInputId}
                    type="email"
                    placeholder="e.g. abena@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-ink focus:border-palm focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-600 mb-1.5">
                  Assigned Role
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole(ROLES.STAFF)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      formRole === ROLES.STAFF
                        ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-xs font-black text-emerald-800">Cashier</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Sales & receipts only. Profits & costs hidden.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole(ROLES.ADMIN)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      formRole === ROLES.ADMIN
                        ? "border-blue-500 bg-blue-50/70 ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-xs font-black text-blue-800">Manager</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                      Inventory restocks, view profit & margins.
                    </p>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-palm px-4 py-2 text-xs font-black text-white hover:bg-palmDeep transition shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Adding…" : "Add Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-Creation Credential Confirmation Card */}
      {createdStaffCredentials && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-base font-black text-ink">Staff Credentials Created!</h3>
                <p className="text-xs text-slate-500">Share these login details with your staff member</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Full Name</span>
                <span className="font-black text-ink">{createdStaffCredentials.fullName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Assigned Role</span>
                <span className="font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                  {ROLE_METADATA[createdStaffCredentials.role]?.label || createdStaffCredentials.role}
                </span>
              </div>

              <div className="border-t border-slate-200/70 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Staff ID (For Login)</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdStaffCredentials.staffId);
                      showToast("Copied Staff ID to clipboard");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-palm hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy ID</span>
                  </button>
                </div>
                <div className="mt-1 p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <span className="font-mono text-base font-black text-ink tracking-wider">
                    {createdStaffCredentials.staffId}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">Password</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(createdStaffCredentials.password);
                      showToast("Copied password to clipboard");
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-palm hover:underline"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy Password</span>
                  </button>
                </div>
                <div className="mt-1 p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-ink">
                    {showCreatedPassword ? createdStaffCredentials.password : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCreatedPassword((p) => !p)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {showCreatedPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const text = `BizTrac Counter Terminal Login:\nBusiness: ${business?.name || "Our Store"}\nStaff Name: ${createdStaffCredentials.fullName}\nStaff ID: ${createdStaffCredentials.staffId}\nPassword: ${createdStaffCredentials.password}\nRole: ${ROLE_METADATA[createdStaffCredentials.role]?.label || "Cashier"}`;
                  navigator.clipboard.writeText(text);
                  showToast("Copied all login credentials! Ready to paste into WhatsApp/SMS.", { type: "success" });
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-palm/40 bg-palm/5 py-2.5 text-xs font-black text-palm hover:bg-palm/10 transition"
              >
                <Share2 className="h-4 w-4" />
                <span>Copy All Details (WhatsApp / SMS)</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatedStaffCredentials(null)}
                className="w-full rounded-xl bg-ink py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Management / Reset Modal */}
      {passwordEditMember && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-palm/10 text-palm">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-ink">Manage Password</h3>
                  <p className="text-[11px] text-slate-500">{passwordEditMember.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordEditMember(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Staff ID</span>
                  <span className="font-mono text-sm font-black text-ink">{passwordEditMember.staffId}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(passwordEditMember.staffId);
                    showToast(`Copied Staff ID ${passwordEditMember.staffId}`);
                  }}
                  className="text-xs font-bold text-palm hover:underline inline-flex items-center gap-1"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password / PIN
                </label>
                <div className="relative">
                  <input
                    type={showResetPass ? "text" : "password"}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-xs text-ink focus:border-palm focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showResetPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setNewPasswordInput(generateStaffPassword())}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-palm hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Generate Random PIN</span>
              </button>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPasswordEditMember(null)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!newPasswordInput.trim()) {
                      showToast("Please enter a new password", { type: "error" });
                      return;
                    }
                    await updateStaffPassword(businessId, passwordEditMember.id, newPasswordInput.trim());
                    showToast(`Password updated for ${passwordEditMember.fullName}`, { type: "success" });
                    setPasswordEditMember(null);
                    loadMembers();
                  }}
                  className="rounded-xl bg-palm px-4 py-1.5 text-xs font-black text-white hover:bg-palmDeep"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
