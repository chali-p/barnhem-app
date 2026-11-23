import { User } from 'firebase/auth';
import React, { useEffect, useMemo, useState } from 'react';
import { signInWithGoogleCloud, signOutCloud } from '../firebase';
import {
  deleteRegistrationByAdmin,
  RegistrationFormInput,
  reviewRegistrationByAdmin,
  submitPlatformRegistration,
  subscribeAllRegistrationsForAdmin,
  subscribeMyRegistration,
  updateMyRegistrationDetails,
} from '../services/platformRegistrations';
import { MASTER_ADMIN_EMAIL } from '../services/firestoreSync';
import {
  AUTOMATION_ADDON_OPTIONS,
  getOrganizationPreset,
  ORGANIZATION_PRESETS,
} from '../data/organizationPresets';
import {
  ActiveTenantContext,
  AppSettings,
  AppState,
  AutomationAddonId,
  Language,
  ModalAlertPayload,
  OrganizationPresetId,
  PlatformRegistration,
  RegistrationApplicationType,
  RegistrationStatus,
} from '../types/barnhem';
import {
  copyTextToClipboard,
  downloadJsonBackup,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  postSyncToDriveOrSheet,
} from '../utils/syncStorage';
import {
  loadOrgStorageOnboardingPref,
  saveOrgStorageOnboardingPref,
} from '../utils/tenantTemplate';
import { MinimartGateDemoModal } from './MinimartGateDemoModal';
import {
  OrgStorageGuideCard,
  PlatformVisualArchitecture,
  TwoStorageOptionsCard,
} from './OrgStorageGuideCard';

interface AdminRegistrationsPanelProps {
  cloudUser: User | null;
  lang: Language;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

const STATUS_META: Record<
  RegistrationStatus,
  { th: string; en: string; emoji: string; badgeClass: string }
> = {
  pending: {
    th: 'รอตรวจสอบ',
    en: 'Pending Review',
    emoji: '⏳',
    badgeClass: 'text-[#8A5A10] bg-[#FFF5CC] border-[#F2DA84]',
  },
  interview: {
    th: 'กำลังพิจารณา / นัดสัมภาษณ์',
    en: 'Interview / Reviewing',
    emoji: '🗓️',
    badgeClass: 'text-[#1E445C] bg-[#DCEEF8] border-[#A7D3EC]',
  },
  approved: {
    th: 'อนุมัติแล้ว',
    en: 'Approved',
    emoji: '✅',
    badgeClass: 'text-[#114A42] bg-[#DCF7F2] border-[#8FD4C6]',
  },
  rejected: {
    th: 'ไม่อนุมัติ / พักสิทธิ์',
    en: 'Not Approved',
    emoji: '⏸️',
    badgeClass: 'text-[#8B1D36] bg-[#FFE8ED] border-[#F3B7C0]',
  },
};

export const AdminRegistrationsPanel: React.FC<AdminRegistrationsPanelProps> = ({
  cloudUser,
  lang,
  onShowAlert,
}) => {
  const isMaster = Boolean(cloudUser?.email && cloudUser.email === MASTER_ADMIN_EMAIL);
  const [registrations, setRegistrations] = useState<PlatformRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isMaster) {
      setRegistrations([]);
      return;
    }
    setLoading(true);
    const unsub = subscribeAllRegistrationsForAdmin((list) => {
      setRegistrations(list);
      setLoading(false);
    });
    return () => unsub();
  }, [isMaster]);

  const counts = useMemo(() => {
    return {
      total: registrations.length,
      pending: registrations.filter((r) => r.status === 'pending').length,
      interview: registrations.filter((r) => r.status === 'interview').length,
      approved: registrations.filter((r) => r.status === 'approved').length,
    };
  }, [registrations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.applicantName.toLowerCase().includes(q) ||
        r.nickname.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.organizationName.toLowerCase().includes(q) ||
        r.contactInfo.toLowerCase().includes(q)
      );
    });
  }, [registrations, search, statusFilter]);

  if (!isMaster) {
    return (
      <div className="rounded-2xl border border-[#EBD8C3] bg-[#FFF9F2] p-5 text-sm text-[#6E5C52] space-y-3">
        <div className="font-bold text-[#3D322C]">
          🔐{' '}
          {lang === 'th'
            ? `กรุณาล็อกอิน Google ด้วยบัญชีเจ้าของระบบ (${MASTER_ADMIN_EMAIL}) เพื่อดูและอนุมัติผู้สมัคร`
            : `Sign in with Master Admin Google account (${MASTER_ADMIN_EMAIL}) to manage applicants.`}
        </div>
        <button
          type="button"
          onClick={() => void signInWithGoogleCloud()}
          className="min-h-[42px] rounded-2xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-4 py-2 text-xs font-bold cursor-pointer"
        >
          ☁️ {lang === 'th' ? 'เข้าสู่ระบบ Google (เจ้าของระบบ)' : 'Sign In with Google'}
        </button>
      </div>
    );
  }

  const handleAction = async (reg: PlatformRegistration, nextStatus: RegistrationStatus) => {
    const note = (noteDrafts[reg.uid] ?? reg.adminNote ?? '').trim();
    setBusyUid(reg.uid);
    try {
      await reviewRegistrationByAdmin(reg.uid, {
        status: nextStatus,
        assignedOrgId: reg.assignedOrgId || `org_${reg.uid}`,
        adminNote: note,
      });
      onShowAlert({
        icon: STATUS_META[nextStatus].emoji,
        title:
          lang === 'th'
            ? `อัปเดตสถานะของ ${reg.applicantName} เป็น "${STATUS_META[nextStatus].th}" แล้ว`
            : `Updated ${reg.applicantName} to ${STATUS_META[nextStatus].en}`,
        message:
          nextStatus === 'approved'
            ? reg.applicationType === 'open_organization'
              ? lang === 'th'
                ? `เปิดพื้นที่แยกสำหรับ "${reg.organizationName}" เรียบร้อยแล้ว ผู้สมัครสามารถกดเข้าใช้งานได้ทันที`
                : `Isolated workspace enabled for "${reg.organizationName}".`
              : lang === 'th'
              ? `ยืนยันรับใบสมัครงานของ ${reg.applicantName} เรียบร้อยแล้ว`
              : `Approved staff application for ${reg.applicantName}.`
            : note || (lang === 'th' ? 'บันทึกการอัปเดตสถานะแล้วค่ะ' : 'Status saved.'),
        tone: nextStatus === 'approved' ? 'mint' : nextStatus === 'rejected' ? 'pink' : 'blue',
      });
    } catch (err) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'บันทึกสถานะไม่สำเร็จ' : 'Update Failed',
        message: err instanceof Error ? err.message : String(err),
        tone: 'pink',
      });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Zero-Knowledge Creator Assurance Banner */}
      <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-4 py-3 text-xs text-[#114A42] leading-relaxed">
        <span className="font-extrabold">
          🔒 {lang === 'th' ? 'โหมดผู้สร้าง (เฉพาะเปิดสิทธิ์องค์กร): ' : 'Creator Mode (Access Approval Only): '}
        </span>
        {lang === 'th'
          ? 'คุณจะเห็นเฉพาะ "ชื่อมูลนิธิ/องค์กร ผู้ติดต่อ และสถานะ" เพื่อกดเปิดสิทธิ์ให้ใช้งานเท่านั้น ระบบได้ล็อกฐานข้อมูลไม่ให้คุณเปิดดูรายชื่อเด็ก พี่เลี้ยง รหัส PIN หรือการเงินภายในของมูลนิธิอื่นได้เลยค่ะ'
          : 'You only see organization sign-up requests and approval status. Internal members, kids, PINs, and finances of other foundations remain 100% private to each organization.'}
      </div>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { labelTh: 'คำขอทั้งหมด', labelEn: 'Total', value: counts.total },
          { labelTh: 'รอตรวจสอบ', labelEn: 'Pending', value: counts.pending },
          { labelTh: 'นัดสัมภาษณ์', labelEn: 'Interview', value: counts.interview },
          { labelTh: 'อนุมัติใช้งานแล้ว', labelEn: 'Approved', value: counts.approved },
        ].map((item) => (
          <div
            key={item.labelEn}
            className="rounded-2xl border border-[#EBD8C3] bg-white px-4 py-3"
          >
            <div className="text-xs font-medium text-[#7B695F]">
              {lang === 'th' ? item.labelTh : item.labelEn}
            </div>
            <div className="text-2xl font-extrabold text-[#3D322C] tabular-nums mt-0.5">
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-[#F6EFE6] border border-[#EBD8C3]">
          {(
            [
              { id: 'all', th: 'ทั้งหมด', en: 'All' },
              { id: 'pending', th: 'รอตรวจสอบ', en: 'Pending' },
              { id: 'interview', th: 'สัมภาษณ์', en: 'Interview' },
              { id: 'approved', th: 'อนุมัติแล้ว', en: 'Approved' },
              { id: 'rejected', th: 'ไม่อนุมัติ', en: 'Rejected' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === tab.id
                  ? 'bg-white text-[#3D322C] shadow-2xs'
                  : 'text-[#6E5C52] hover:text-[#3D322C]'
              }`}
            >
              {lang === 'th' ? tab.th : tab.en}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            lang === 'th'
              ? '🔍 ค้นหาชื่อ / อีเมล / ชื่อบ้าน...'
              : '🔍 Search name / email / org...'
          }
          className="rounded-2xl border border-[#EBD8C3] bg-white px-3.5 py-2 text-xs text-[#3D322C] w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
        />
      </div>

      {/* Applicants List */}
      {loading ? (
        <div className="rounded-2xl border border-[#EBD8C3] bg-white p-8 text-center text-sm text-[#7B695F]">
          {lang === 'th' ? 'กำลังโหลดรายการผู้สมัคร...' : 'Loading registrations...'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#DFD2C3] bg-[#FFFDF9] p-8 text-center space-y-1.5">
          <div className="text-2xl">📬</div>
          <div className="text-sm font-bold text-[#3D322C]">
            {lang === 'th' ? 'ยังไม่มีคำขอสมัครใช้งานในหมวดนี้' : 'No Registrations Found'}
          </div>
          <div className="text-xs text-[#7B695F]">
            {lang === 'th'
              ? 'เมื่อมีผู้ใช้งาน (เช่น Susan) ล็อกอินเข้ามาส่งใบสมัคร รายชื่อจะแสดงที่นี่แบบเรียลไทม์ค่ะ'
              : 'New applications submitted via the Portal appear here in real time.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((reg) => {
            const meta = STATUS_META[reg.status];
            const draftNote = noteDrafts[reg.uid] ?? reg.adminNote ?? '';
            const isBusy = busyUid === reg.uid;
            return (
              <div
                key={reg.uid}
                className="rounded-2xl border border-[#EBD8C3] bg-white p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-base font-extrabold text-[#3D322C]">
                      <span>{reg.applicantName}</span>
                      <span className="text-xs font-semibold text-[#7B695F]">
                        ({reg.nickname})
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6E5C52]">
                      <span>
                        {reg.applicationType === 'open_organization'
                          ? lang === 'th'
                            ? '🏠 ขอเปิดบ้าน/องค์กร:'
                            : '🏠 Open Home/Org:'
                          : lang === 'th'
                          ? '👩‍🏫 สมัครงาน/ร่วมทีม:'
                          : '👩‍🏫 Staff Application:'}{' '}
                        <strong className="text-[#3D322C]">{reg.organizationName}</strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{reg.email}</span>
                      <span aria-hidden="true">·</span>
                      <span>{reg.contactInfo}</span>
                    </div>
                  </div>

                  <span
                    className={`rounded-xl border px-3 py-1 text-xs font-extrabold whitespace-nowrap ${meta.badgeClass}`}
                  >
                    {meta.emoji} {lang === 'th' ? meta.th : meta.en}
                  </span>
                </div>

                {(reg.organizationPreset ||
                  (reg.automationAddons && reg.automationAddons.length > 0) ||
                  reg.experienceOrSize ||
                  reg.notes) && (
                  <div className="rounded-xl bg-[#FAF6F1] px-3.5 py-2.5 text-xs text-[#4F433C] space-y-1.5">
                    {reg.applicationType === 'open_organization' && reg.organizationPreset && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-[#114A42]">
                          {lang === 'th' ? 'รูปแบบระบบที่เลือก: ' : 'Selected Preset: '}
                        </span>
                        <span className="rounded-lg bg-[#E8FAF6] border border-[#8FD4C6] px-2 py-0.5 font-extrabold text-[#114A42]">
                          {getOrganizationPreset(reg.organizationPreset).emoji}{' '}
                          {lang === 'th'
                            ? getOrganizationPreset(reg.organizationPreset).titleTh
                            : getOrganizationPreset(reg.organizationPreset).titleEn}
                        </span>
                      </div>
                    )}
                    {reg.automationAddons && reg.automationAddons.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-bold mr-1">
                          {lang === 'th' ? 'ระบบเสริมอัตโนมัติ: ' : 'Add-ons: '}
                        </span>
                        {reg.automationAddons.map((addonId) => {
                          const addon = AUTOMATION_ADDON_OPTIONS.find((a) => a.id === addonId);
                          if (!addon) return null;
                          return (
                            <span
                              key={addonId}
                              className="rounded-md bg-white border border-[#EBD8C3] px-1.5 py-0.5 text-[10px] font-bold text-[#3D322C]"
                            >
                              {addon.emoji} {lang === 'th' ? addon.titleTh : addon.titleEn}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {reg.experienceOrSize && (
                      <div>
                        <span className="font-bold">
                          {lang === 'th' ? 'ขนาดทีม / ประสบการณ์: ' : 'Team Size / Experience: '}
                        </span>
                        {reg.experienceOrSize}
                      </div>
                    )}
                    {reg.notes && (
                      <div>
                        <span className="font-bold">
                          {lang === 'th' ? 'รายละเอียดเพิ่มเติม: ' : 'Notes: '}
                        </span>
                        {reg.notes}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={draftNote}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [reg.uid]: e.target.value }))
                    }
                    placeholder={
                      lang === 'th'
                        ? 'ข้อความถึงผู้สมัคร (เช่น นัดสัมภาษณ์ / คำแนะนำเริ่มต้น)...'
                        : 'Admin note or interview details for applicant...'
                    }
                    className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
                  />

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleAction(reg, 'approved')}
                      className="min-h-[38px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      ✅{' '}
                      {reg.applicationType === 'open_organization'
                        ? lang === 'th'
                          ? 'เปิดสิทธิ์องค์กร'
                          : 'Enable Org'
                        : lang === 'th'
                        ? 'อนุมัติ'
                        : 'Approve'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleAction(reg, 'interview')}
                      className="min-h-[38px] rounded-xl bg-[#DCEEF8] hover:bg-[#C6E2F3] text-[#1E445C] px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      🗓️ {lang === 'th' ? 'นัดคุย' : 'Interview'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleAction(reg, 'rejected')}
                      className="min-h-[38px] rounded-xl bg-[#FFE8ED] hover:bg-[#FADADD] text-[#8B1D36] px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      ⏸️ {lang === 'th' ? 'พัก/ไม่รับ' : 'Decline'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        onShowAlert({
                          icon: '🗑️',
                          title:
                            lang === 'th'
                              ? `ยืนยันลบใบสมัครของ ${reg.applicantName}?`
                              : `Delete registration for ${reg.applicantName}?`,
                          message:
                            lang === 'th'
                              ? 'การลบจะนำคำขอนี้ออกจากระบบถาวรค่ะ'
                              : 'This removes the registration record permanently.',
                          tone: 'pink',
                          confirmLabel: lang === 'th' ? 'ยืนยันลบ' : 'Delete',
                          onConfirm: () => {
                            void deleteRegistrationByAdmin(reg.uid);
                          },
                        });
                      }}
                      className="min-h-[38px] rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FFE8ED] text-[#7B695F] hover:text-[#8B1D36] px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                      aria-label="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface PlatformPortalViewProps {
  cloudUser: User | null;
  lang: Language;
  activeTenant: ActiveTenantContext | null;
  appState?: AppState;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  onEnterTenantWorkspace: (reg: PlatformRegistration) => void;
  onLeaveTenantWorkspace: () => void;
  onBackHome: () => void;
  onShowAlert: (payload: ModalAlertPayload) => void;
}

export const PlatformPortalView: React.FC<PlatformPortalViewProps> = ({
  cloudUser,
  lang,
  activeTenant,
  appState,
  onUpdateSettings,
  onEnterTenantWorkspace,
  onLeaveTenantWorkspace,
  onBackHome,
  onShowAlert,
}) => {
  const isMaster = Boolean(cloudUser?.email && cloudUser.email === MASTER_ADMIN_EMAIL);
  const [authBusy, setAuthBusy] = useState(false);
  const [myReg, setMyReg] = useState<PlatformRegistration | null | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [applicationType, setApplicationType] =
    useState<RegistrationApplicationType>('open_organization');
  const [organizationPreset, setOrganizationPreset] =
    useState<OrganizationPresetId>('autonomous_minimart');
  const [automationAddons, setAutomationAddons] = useState<AutomationAddonId[]>(
    getOrganizationPreset('autonomous_minimart').defaultAddons
  );
  const [applicantName, setApplicantName] = useState('');
  const [nickname, setNickname] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [experienceOrSize, setExperienceOrSize] = useState('');
  const [notes, setNotes] = useState('');

  // Per-org BYO storage setup state
  const [storageChoice, setStorageChoice] = useState<'own' | 'central'>('own');
  const [orgWebhookDraft, setOrgWebhookDraft] = useState(appState?.settings.syncWebhookUrl ?? '');
  const [orgDriveDraft, setOrgDriveDraft] = useState(appState?.settings.returnHomeDriveUrl ?? '');
  const [showOwnerVisualPreview, setShowOwnerVisualPreview] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const selectedPresetMeta = getOrganizationPreset(organizationPreset);

  const handleSelectOrganizationPreset = (nextId: OrganizationPresetId) => {
    setOrganizationPreset(nextId);
    setAutomationAddons(getOrganizationPreset(nextId).defaultAddons);
  };

  const toggleAutomationAddon = (addonId: AutomationAddonId) => {
    setAutomationAddons((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    );
  };

  // Interactive Master Admin Applicant Simulator (Preview-only, never writes to Firestore)
  type MasterPreviewMode =
    | 'admin'
    | 'visitor_landing'
    | 'applicant_form'
    | 'status_pending'
    | 'status_approved';
  const [masterPreviewMode, setMasterPreviewMode] = useState<MasterPreviewMode>('admin');
  const isPreviewing = isMaster && masterPreviewMode !== 'admin';

  const switchMasterPreview = (next: MasterPreviewMode) => {
    if (next !== 'admin') {
      if (!applicantName.trim()) setApplicantName('คุณสุซาน (ตัวอย่าง)');
      if (!nickname.trim()) setNickname('พี่สุ');
      if (!organizationName.trim()) setOrganizationName('มูลนิธิบ้านสายใจรักษ์');
      if (!contactInfo.trim()) setContactInfo('08x-xxx-xxxx / LINE: susan');
      if (!experienceOrSize.trim()) setExperienceOrSize('เด็ก 12 คน พี่เลี้ยง 4 คน');
    }
    setMasterPreviewMode(next);
  };

  useEffect(() => {
    if (!cloudUser || isMaster) return;
    const savedPref = loadOrgStorageOnboardingPref(cloudUser.uid);
    if (savedPref) {
      setStorageChoice(savedPref.useOwnStorageOnly ? 'own' : 'central');
      if (savedPref.syncWebhookUrl && !appState?.settings.syncWebhookUrl) {
        setOrgWebhookDraft(savedPref.syncWebhookUrl);
      }
      if (savedPref.returnHomeDriveUrl && !appState?.settings.returnHomeDriveUrl) {
        setOrgDriveDraft(savedPref.returnHomeDriveUrl);
      }
    }
  }, [cloudUser, isMaster, appState?.settings.syncWebhookUrl, appState?.settings.returnHomeDriveUrl]);

  useEffect(() => {
    if (appState?.settings.syncWebhookUrl !== undefined) {
      setOrgWebhookDraft(appState.settings.syncWebhookUrl);
    }
  }, [appState?.settings.syncWebhookUrl]);

  useEffect(() => {
    if (appState?.settings.returnHomeDriveUrl !== undefined) {
      setOrgDriveDraft(appState.settings.returnHomeDriveUrl);
    }
  }, [appState?.settings.returnHomeDriveUrl]);

  useEffect(() => {
    if (!cloudUser || isMaster) {
      setMyReg(null);
      return;
    }
    setMyReg(undefined);
    const unsub = subscribeMyRegistration(cloudUser.uid, (reg) => {
      setMyReg(reg);
      if (reg) {
        setApplicationType(reg.applicationType);
        if (reg.organizationPreset) {
          setOrganizationPreset(reg.organizationPreset);
        }
        if (Array.isArray(reg.automationAddons)) {
          setAutomationAddons(reg.automationAddons);
        }
        setApplicantName(reg.applicantName);
        setNickname(reg.nickname);
        setOrganizationName(reg.organizationName);
        setContactInfo(reg.contactInfo);
        setExperienceOrSize(reg.experienceOrSize);
        setNotes(reg.notes);
      } else {
        setApplicantName((prev) => prev || cloudUser.displayName || '');
      }
    });
    return () => unsub();
  }, [cloudUser, isMaster]);

  const handleGoogleSignIn = async () => {
    if (isPreviewing) {
      switchMasterPreview('applicant_form');
      return;
    }
    setAuthBusy(true);
    try {
      await signInWithGoogleCloud();
    } catch (err) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'Sign-In Failed',
        message: err instanceof Error ? err.message : String(err),
        tone: 'pink',
      });
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPreviewing) {
      switchMasterPreview('status_pending');
      onShowAlert({
        icon: '👀',
        title: lang === 'th' ? 'จำลองส่งใบสมัครสำเร็จ! (ตัวอย่าง)' : 'Simulated Submission!',
        message:
          lang === 'th'
            ? 'นี่คือหน้าจอที่ผู้สมัครจะเห็นทันทีหลังกดส่ง (ระบบไม่ได้บันทึกข้อมูลจำลองนี้ลงฐานข้อมูลจริงค่ะ)'
            : 'This is the confirmation screen applicants see (preview only; not saved).',
        tone: 'mint',
      });
      return;
    }
    if (!cloudUser) return;

    if (!applicantName.trim() || !nickname.trim() || !organizationName.trim() || !contactInfo.trim()) {
      onShowAlert({
        icon: '📝',
        title: lang === 'th' ? 'กรุณากรอกข้อมูลให้ครบ' : 'Missing Required Fields',
        message:
          lang === 'th'
            ? 'กรุณากรอกชื่อ-นามสกุล, ชื่อเล่น, ชื่อบ้าน/ตำแหน่งที่สมัคร และช่องทางติดต่อกลับค่ะ'
            : 'Please complete Name, Nickname, Organization/Role, and Contact info.',
        tone: 'pink',
      });
      return;
    }

    const input: RegistrationFormInput = {
      applicantName,
      nickname,
      organizationName,
      applicationType,
      ...(applicationType === 'open_organization'
        ? {
            organizationPreset,
            automationAddons,
          }
        : {}),
      contactInfo,
      experienceOrSize,
      notes,
    };

    setSubmitting(true);
    try {
      if (applicationType === 'open_organization') {
        saveOrgStorageOnboardingPref(cloudUser.uid, {
          useOwnStorageOnly: storageChoice === 'own',
          syncWebhookUrl: orgWebhookDraft.trim(),
          returnHomeDriveUrl: orgDriveDraft.trim(),
          organizationPreset,
          automationAddons,
        });
      }
      if (myReg && isEditing) {
        await updateMyRegistrationDetails(cloudUser.uid, input);
        setIsEditing(false);
        onShowAlert({
          icon: '✅',
          title: lang === 'th' ? 'อัปเดตใบสมัครเรียบร้อย!' : 'Application Updated!',
          message:
            lang === 'th'
              ? 'บันทึกข้อมูลเพิ่มเติมเรียบร้อยแล้ว รอเจ้าของระบบตรวจสอบนะคะ'
              : 'Your updated application has been saved.',
          tone: 'mint',
        });
      } else {
        await submitPlatformRegistration(cloudUser, input);
        onShowAlert({
          icon: '📨',
          title: lang === 'th' ? 'ส่งใบสมัครเรียบร้อยแล้ว!' : 'Application Submitted!',
          message:
            lang === 'th'
              ? 'ข้อมูลถูกส่งไปยังเจ้าของระบบเรียบร้อย สามารถเช็คสถานะการอนุมัติและเชื่อม Google Sheet/Drive ขององค์กรต่อที่หน้านี้ได้เลยค่ะ'
              : 'Your request has been sent for approval. Check your status here anytime.',
          tone: 'mint',
        });
      }
    } catch (err) {
      onShowAlert({
        icon: '⚠️',
        title: lang === 'th' ? 'ส่งข้อมูลไม่สำเร็จ' : 'Submission Failed',
        message: err instanceof Error ? err.message : String(err),
        tone: 'pink',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const previewReg: PlatformRegistration | null = isPreviewing
    ? {
        uid: 'preview_applicant',
        email: 'susan.foundation@gmail.com',
        applicantName: applicantName.trim() || 'คุณสุซาน (ตัวอย่าง)',
        nickname: nickname.trim() || 'พี่สุ',
        organizationName:
          organizationName.trim() ||
          (organizationPreset === 'autonomous_minimart'
            ? 'ร้านอิ่มสุข มินิมาร์ท 24 ชม.'
            : 'มูลนิธิบ้านสายใจรักษ์'),
        applicationType,
        organizationPreset,
        automationAddons,
        contactInfo: contactInfo.trim() || '08x-xxx-xxxx / LINE: susan',
        experienceOrSize: experienceOrSize.trim() || 'เด็ก 12 คน พี่เลี้ยง 4 คน',
        notes:
          notes.trim() ||
          (lang === 'th'
            ? 'ต้องการใช้งานเช็คชื่อเด็กและส่งสรุปเข้า LINE ทุกเย็นวันอาทิตย์ค่ะ'
            : 'Need daily attendance and Sunday LINE summaries.'),
        status: masterPreviewMode === 'status_approved' ? 'approved' : 'pending',
        assignedOrgId: 'org_preview_applicant',
        adminNote:
          masterPreviewMode === 'status_approved'
            ? lang === 'th'
              ? 'ยินดีต้อนรับค่ะ เปิดสิทธิ์พื้นที่ส่วนตัวให้เรียบร้อยแล้ว'
              : 'Welcome! Your isolated workspace has been enabled.'
            : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  const activeReg = isPreviewing ? previewReg : myReg;
  const displayEmail = isPreviewing
    ? 'susan.foundation@gmail.com (ตัวอย่างผู้สมัคร)'
    : cloudUser?.email ?? '';
  const showLanding = !cloudUser || (isMaster && masterPreviewMode === 'visitor_landing');
  const showMasterConsole = Boolean(cloudUser && isMaster && masterPreviewMode === 'admin');
  const showStatusTracker = isPreviewing
    ? masterPreviewMode === 'status_pending' || masterPreviewMode === 'status_approved'
    : Boolean(cloudUser && !isMaster && myReg && !isEditing);
  const showApplicationForm = isPreviewing
    ? masterPreviewMode === 'applicant_form'
    : Boolean(cloudUser && !isMaster && (myReg === null || isEditing));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="rounded-[30px] border-2 border-[#B9E8DF] bg-white p-5 sm:p-6 pastel-shadow flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#114A42]">
            {lang === 'th'
              ? 'แพลตฟอร์มระบบอัตโนมัติจัดการแทนคน — เลือกเปิดร้าน / ห้องเรียน / SME / มูลนิธิ'
              : 'Smart Zero-Staff Automation & Organization Portal'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6E5C52]">
            {lang === 'th'
              ? 'เลือกรูปแบบระบบให้ทำงานแทนคนได้เต็มที่ ทั้งมินิมาร์ทจ่ายเองสแกนใบเสร็จเปิดประตู ห้องเรียน ธุรกิจ SME หรือมูลนิธิ — แยกฐานข้อมูลส่วนตัว 100%'
              : 'Pick your tailored automation preset—Self-Checkout Minimart with Receipt Door Gate, Classroom, Lean SME, or Foundation—with 100% isolated data.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {cloudUser && (
            <button
              type="button"
              onClick={() => {
                if (activeTenant) onLeaveTenantWorkspace();
                void signOutCloud();
              }}
              className="min-h-[40px] rounded-2xl border border-[#F3B7C0] bg-[#FFE8ED] hover:bg-[#FADADD] px-3.5 py-1.5 text-xs font-bold text-[#8B1D36] cursor-pointer whitespace-nowrap"
            >
              {lang === 'th' ? `ออกจากระบบ (${cloudUser.email})` : `Sign Out (${cloudUser.email})`}
            </button>
          )}
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[40px] rounded-2xl border border-[#EBD8C3] bg-[#FFF9F2] hover:bg-[#F6EFE6] px-4 py-1.5 text-xs font-bold text-[#3D322C] cursor-pointer whitespace-nowrap"
          >
            ← {lang === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
          </button>
        </div>
      </div>

      {/* Master Admin Perspective Switcher (See Exact Applicant Experience) */}
      {cloudUser && isMaster && (
        <div className="rounded-[24px] border-2 border-[#DCEEF8] bg-[#F5FAFE] p-4 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs sm:text-sm font-extrabold text-[#1E445C]">
              👀{' '}
              {lang === 'th'
                ? 'สลับมุมมองดูหน้าจอจริงของ "ผู้ที่มาสมัครกับคุณ" (กดลองเล่นได้ทุกขั้นตอน ไม่กระทบข้อมูลจริง)'
                : 'Preview Applicant Experience (Safe Simulation — Does Not Modify Real Data)'}
            </div>
            {isPreviewing && (
              <button
                type="button"
                onClick={() => switchMasterPreview('admin')}
                className="min-h-[34px] rounded-xl bg-[#1E445C] text-white px-3 py-1 text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                ← {lang === 'th' ? 'กลับหน้าผู้ดูแลของจริง' : 'Back to Real Admin View'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'admin', th: '👑 หน้าผู้ดูแล (ของจริง)', en: '👑 Real Admin Console' },
                { id: 'visitor_landing', th: '1️⃣ หน้าแรกก่อนล็อกอิน', en: '1️⃣ Pre-Login Landing' },
                { id: 'applicant_form', th: '2️⃣ หน้ากรอกใบสมัคร', en: '2️⃣ Sign-Up Form' },
                { id: 'status_pending', th: '3️⃣ หน้ารออนุมัติ', en: '3️⃣ Pending Status' },
                { id: 'status_approved', th: '4️⃣ หน้าหลังได้รับอนุมัติ', en: '4️⃣ Approved & Ready' },
              ] as const
            ).map((tab) => {
              const active = masterPreviewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchMasterPreview(tab.id)}
                  className={`min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-extrabold cursor-pointer transition-colors border ${
                    active
                      ? 'bg-[#114A42] text-white border-[#114A42]'
                      : 'bg-white text-[#3D322C] border-[#CBDCE8] hover:bg-[#E8FAF6]'
                  }`}
                >
                  {lang === 'th' ? tab.th : tab.en}
                </button>
              );
            })}
          </div>

          {isPreviewing && (
            <div className="rounded-xl border border-[#F2DA84] bg-[#FFF8DC] px-3 py-2 text-xs font-bold text-[#7A5208]">
              💡{' '}
              {lang === 'th'
                ? 'กำลังจำลองมุมมองของ "เพื่อนมูลนิธิ / ผู้มาสมัคร" (ชื่อตัวอย่าง: คุณสุซาน) — คุณสามารถลองกดปุ่มต่างๆ และกรอกฟอร์มดูได้จริงเลยค่ะ'
                : 'Simulating partner applicant perspective (Sample: Susan). Feel free to interact with buttons and form fields.'}
            </div>
          )}
        </div>
      )}

      {/* Zero-Knowledge Privacy Callout */}
      {(!isMaster || isPreviewing) && (
        <div className="rounded-2xl border border-[#8FD4C6] bg-[#E8FAF6] px-4 py-3 text-xs text-[#114A42] leading-relaxed">
          <span className="font-extrabold">
            🔒 {lang === 'th' ? 'รับประกันความเป็นส่วนตัวขององค์กร: ' : 'Organization Data Privacy: '}
          </span>
          {lang === 'th'
            ? 'รายชื่อเด็ก พี่เลี้ยง การเงิน และรหัส PIN ของมูลนิธิคุณจะถูกเก็บแยกเป็นส่วนตัว 100% แม้แต่ผู้สร้างระบบก็ไม่สามารถเข้ามาเปิดดูข้อมูลภายในมูลนิธิของคุณได้ค่ะ'
            : 'All members, children, schedules, PINs, and financial records of your foundation are strictly isolated. Even the platform creator cannot access them.'}
        </div>
      )}

      {/* State 1: Not Signed In */}
      {showLanding && (
        <div className="rounded-[28px] border border-[#EBD8C3] bg-white p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01.',
                titleTh: 'ล็อกอินด้วยบัญชี Google ขององค์กร',
                titleEn: 'Sign In with Google',
                descTh: 'ใช้อีเมล Google ของผู้อำนวยการหรือผู้ดูแลมูลนิธิเพื่อยืนยันตัวตน',
                descEn: 'Sign in with your organization admin Google account.',
              },
              {
                step: '02.',
                titleTh: 'กรอกชื่อองค์กร & เลือกที่เก็บข้อมูล',
                titleEn: 'Apply & Choose Storage Option',
                descTh: 'เลือกว่าจะเชื่อม Google Sheet + Drive ของตัวเอง (เก็บได้ตลอดชีพ) หรือใช้คลาวด์กลาง 7-14 วัน',
                descEn: 'Choose your own Google Sheet/Drive (lifetime) or central cloud (7–14 days).',
              },
              {
                step: '03.',
                titleTh: 'รับอนุมัติแล้วใช้งานพื้นที่แยกทันที',
                titleEn: 'Launch Private Workspace',
                descTh: 'เมื่อผู้สร้างกดเปิดสิทธิ์ มูลนิธิของคุณจะได้ระบบแยกอิสระ 100% ไปตั้งค่าเด็กและทีมเองได้เลย',
                descEn: 'Once approved, launch your isolated workspace and manage your own data privately.',
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-[#EFE6DC] bg-[#FFFDF9] p-4 space-y-1.5">
                <div className="text-xs font-extrabold text-[#114A42]">{s.step}</div>
                <div className="text-sm font-extrabold text-[#3D322C]">
                  {lang === 'th' ? s.titleTh : s.titleEn}
                </div>
                <div className="text-xs text-[#6E5C52] leading-relaxed">
                  {lang === 'th' ? s.descTh : s.descEn}
                </div>
              </div>
            ))}
          </div>

          {/* Featured Automation Presets Showcase + Live Minimart Receipt-Gate Demo */}
          <div className="rounded-2xl border-2 border-[#8FD4C6] bg-[#F5FCFA] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <div className="text-sm sm:text-base font-extrabold text-[#114A42]">
                  ⚡{' '}
                  {lang === 'th'
                    ? 'ช้อยส์รูปแบบระบบอัตโนมัติให้เลือกตอนสมัคร (ลดคนดูแลได้มากที่สุด)'
                    : 'Choose Your Automated Business / Organization Mode at Sign-Up'}
                </div>
                <p className="text-xs text-[#4F433C] mt-0.5">
                  {lang === 'th'
                    ? 'เลือกสไตล์ที่ตรงกับงานของคุณ ระบบจะปรับบทบาท หน้าตาร้านค้า และกติกาอัตโนมัติให้ทันทีหลังสมัครค่ะ'
                    : 'Pick the automation workflow matching your venue—roles, store, and rules adapt automatically.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(true)}
                className="min-h-[38px] rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer whitespace-nowrap"
              >
                🚪 {lang === 'th' ? 'ทดลองเล่น: จ่ายเอง + ใบเสร็จเปิดประตู' : 'Try Self-Checkout Gate Demo'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {ORGANIZATION_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`rounded-xl border p-3 bg-white space-y-1 ${
                    preset.id === 'autonomous_minimart'
                      ? 'border-[#114A42] ring-1 ring-[#8FD4C6]'
                      : 'border-[#EBD8C3]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-base">{preset.emoji}</span>
                    {preset.badgeTh && (
                      <span className="rounded-md bg-[#E8FAF6] px-2 py-0.5 text-[10px] font-extrabold text-[#114A42]">
                        {lang === 'th' ? preset.badgeTh : preset.badgeEn}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-extrabold text-[#3D322C]">
                    {lang === 'th' ? preset.titleTh : preset.titleEn}
                  </div>
                  <div className="text-[11px] text-[#6E5C52] leading-snug">
                    {lang === 'th' ? preset.taglineTh : preset.taglineEn}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PlatformVisualArchitecture lang={lang} />

          <TwoStorageOptionsCard lang={lang} />

          <OrgStorageGuideCard lang={lang} onShowAlert={onShowAlert} defaultOpen />

          <div className="flex flex-col items-center justify-center pt-2 gap-3 text-center">
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void handleGoogleSignIn()}
              className="min-h-[48px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-6 py-3 text-sm font-extrabold cursor-pointer transition-colors disabled:opacity-60"
            >
              {authBusy
                ? lang === 'th'
                  ? 'กำลังเปิดหน้าล็อกอิน Google...'
                  : 'Opening Google Sign-In...'
                : lang === 'th'
                ? '🔐 ล็อกอิน Google เพื่อขอเปิดสิทธิ์มูลนิธิ / เข้าสู่พื้นที่องค์กร'
                : '🔐 Sign In with Google for Organization Portal'}
            </button>
            <div className="text-xs text-[#7B695F]">
              {lang === 'th'
                ? 'ใช้งานฟรี 100% — รองรับทั้งมูลนิธิที่ต้องการขอใช้งานใหม่ และผู้สร้างระบบสำหรับกดเปิดสิทธิ์'
                : '100% Free — For partner foundations requesting access and for the platform creator.'}
            </div>
          </div>
        </div>
      )}

      {/* State 2: Platform Master Admin Console */}
      {showMasterConsole && cloudUser && (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-[#EBD8C3] bg-white p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EFE6DC]">
              <div>
                <h2 className="text-lg font-extrabold text-[#3D322C]">
                  👑{' '}
                  {lang === 'th'
                    ? 'ศูนย์อนุมัติผู้สมัครใช้งานระบบ (สำหรับเจ้าของแพลตฟอร์ม)'
                    : 'Platform Owner Approval Console'}
                </h2>
                <p className="text-xs text-[#6E5C52] mt-0.5">
                  {lang === 'th'
                    ? 'ตรวจสอบรายชื่อผู้ขอเปิดบ้านใหม่หรือผู้สมัครงาน และกดอนุมัติเปิดพื้นที่ใช้งานแยกได้ทันที'
                    : 'Review registration requests and approve isolated organization workspaces.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOwnerVisualPreview((v) => !v)}
                className="min-h-[38px] rounded-xl border border-[#8FD4C6] bg-[#E8FAF6] hover:bg-[#D5F4EE] px-3.5 py-1.5 text-xs font-extrabold text-[#114A42] cursor-pointer whitespace-nowrap"
              >
                {showOwnerVisualPreview
                  ? lang === 'th'
                    ? '🙈 ซ่อนภาพตัวอย่างหน้าคู่มือองค์กร'
                    : '🙈 Hide Partner Visual Guide'
                  : lang === 'th'
                  ? '🗺️ ดูภาพรวม & คู่มือที่มูลนิธิอื่นเห็น'
                  : '🗺️ Preview Partner Visual Guide'}
              </button>
            </div>

            <AdminRegistrationsPanel
              cloudUser={cloudUser}
              lang={lang}
              onShowAlert={onShowAlert}
            />
          </div>

          {showOwnerVisualPreview && (
            <div className="rounded-[28px] border border-[#B9E8DF] bg-white p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-[#114A42]">
                  👀{' '}
                  {lang === 'th'
                    ? 'มุมมองตัวอย่าง: ภาพอธิบายระบบ & คู่มือ 2 นาที ที่มูลนิธิอื่นเห็นตอนเข้ามาสมัคร'
                    : 'Partner Preview: Visual Flow & 2-Min Guide Shown to Applicants'}
                </div>
              </div>
              <PlatformVisualArchitecture lang={lang} />
              <TwoStorageOptionsCard lang={lang} />
              <OrgStorageGuideCard lang={lang} onShowAlert={onShowAlert} />
            </div>
          )}
        </div>
      )}

      {/* State 3: Applicant Loading */}
      {cloudUser && !isMaster && myReg === undefined && (
        <div className="rounded-[28px] border border-[#EBD8C3] bg-white p-10 text-center text-sm text-[#7B695F]">
          {lang === 'th' ? 'กำลังตรวจสอบข้อมูลใบสมัครของคุณ...' : 'Checking your registration...'}
        </div>
      )}

      {/* State 4: Applicant Status Tracker */}
      {showStatusTracker && activeReg && (
        <div className="rounded-[28px] border border-[#EBD8C3] bg-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#EFE6DC]">
            <div>
              <div className="text-xs font-semibold text-[#7B695F]">
                {displayEmail} ·{' '}
                {activeReg.applicationType === 'open_organization'
                  ? lang === 'th'
                    ? 'ขอเปิดพื้นที่บ้านของตัวเอง'
                    : 'Isolated Home Workspace'
                  : lang === 'th'
                  ? 'สมัครงาน / ร่วมทีม'
                  : 'Staff Application'}
              </div>
              <h2 className="text-xl font-extrabold text-[#3D322C] mt-1">
                {activeReg.applicantName} ({activeReg.nickname}) — {activeReg.organizationName}
              </h2>
            </div>

            <span
              className={`rounded-xl border px-3.5 py-1.5 text-xs font-extrabold whitespace-nowrap ${
                STATUS_META[activeReg.status].badgeClass
              }`}
            >
              {STATUS_META[activeReg.status].emoji}{' '}
              {lang === 'th' ? STATUS_META[activeReg.status].th : STATUS_META[activeReg.status].en}
            </span>
          </div>

          {/* 3-Step Visual Progress */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            {[
              {
                labelTh: '1. ส่งใบสมัครแล้ว',
                labelEn: '1. Submitted',
                done: true,
              },
              {
                labelTh: '2. พิจารณา / นัดสัมภาษณ์',
                labelEn: '2. Review / Interview',
                done:
                  activeReg.status === 'interview' ||
                  activeReg.status === 'approved' ||
                  activeReg.status === 'rejected',
              },
              {
                labelTh:
                  activeReg.status === 'rejected'
                    ? '3. ยังไม่ผ่านการอนุมัติ'
                    : '3. อนุมัติพร้อมใช้งาน',
                labelEn:
                  activeReg.status === 'rejected' ? '3. Not Approved' : '3. Approved & Ready',
                done: activeReg.status === 'approved' || activeReg.status === 'rejected',
              },
            ].map((step) => (
              <div
                key={step.labelEn}
                className={`rounded-xl border px-3.5 py-2.5 font-bold ${
                  step.done
                    ? 'border-[#8FD4C6] bg-[#E8FAF6] text-[#114A42]'
                    : 'border-[#EFE6DC] bg-[#FAF6F1] text-[#8B796E]'
                }`}
              >
                {step.done ? '✓ ' : '○ '}
                {lang === 'th' ? step.labelTh : step.labelEn}
              </div>
            ))}
          </div>

          {activeReg.adminNote && (
            <div className="rounded-2xl border border-[#A7D3EC] bg-[#EEF7FC] p-4 space-y-1">
              <div className="text-xs font-extrabold text-[#1E445C]">
                💬 {lang === 'th' ? 'ข้อความจากเจ้าของระบบ' : 'Message from Platform Owner'}
              </div>
              <div className="text-sm font-medium text-[#2A3F4D]">{activeReg.adminNote}</div>
            </div>
          )}

          {/* Approved Organization Launch Panel */}
          {activeReg.status === 'approved' && activeReg.applicationType === 'open_organization' && (
            <div className="rounded-2xl border-2 border-[#7CC6B8] bg-[#E8FAF6] p-5 space-y-3">
              <div className="text-base font-extrabold text-[#114A42]">
                🎉{' '}
                {lang === 'th'
                  ? `พื้นที่ใช้งานสำหรับ "${activeReg.organizationName}" เปิดใช้งานแล้ว!`
                  : `Your workspace "${activeReg.organizationName}" is approved and ready!`}
              </div>
              <p className="text-xs text-[#1B5E52] leading-relaxed">
                {lang === 'th'
                  ? 'ข้อมูลทั้งหมดในพื้นที่นี้จะแยกขาดเป็นส่วนตัวจากบ้านอื่น ใช้รหัส PIN เริ่มต้น 1234 เพื่อเข้าโหมดพี่เลี้ยง/ผู้สร้างและเพิ่มรายชื่อสมาชิกของคุณได้เลยค่ะ'
                  : 'All members, chores, schedules, and piggy banks are 100% isolated. Initial Manager/Creator PIN is 1234.'}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {activeTenant?.orgId === activeReg.assignedOrgId ? (
                  <>
                    <button
                      type="button"
                      onClick={onBackHome}
                      className="min-h-[44px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-5 py-2.5 text-sm font-extrabold cursor-pointer"
                    >
                      🏡 {lang === 'th' ? 'ไปที่หน้าหลักของบ้านฉัน' : 'Open My Home'}
                    </button>
                    <button
                      type="button"
                      onClick={onLeaveTenantWorkspace}
                      className="min-h-[44px] rounded-2xl border border-[#7CC6B8] bg-white hover:bg-[#FAF6F1] text-[#114A42] px-4 py-2.5 text-xs font-bold cursor-pointer"
                    >
                      {lang === 'th' ? 'ออกจากโหมดพื้นที่ส่วนตัว' : 'Exit Organization Mode'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPreviewing) {
                        onShowAlert({
                          icon: '🚀',
                          title: lang === 'th' ? 'จำลองการเปิดพื้นที่องค์กรของซูซาน' : 'Simulated Launch',
                          message:
                            lang === 'th'
                              ? `เมื่อ ${activeReg.nickname} กดปุ่มนี้ ระบบจะเปิดแอปหน้าแรกในชื่อ "${activeReg.organizationName}" ทันที โดยมีรายชื่อเริ่มต้น 3 คน และใช้ PIN 1234 เพื่อตั้งค่ารายชื่อเด็กและพี่เลี้ยงเอง 100% ค่ะ`
                              : `Opens "${activeReg.organizationName}" isolated workspace with initial PIN 1234.`,
                          tone: 'mint',
                        });
                        return;
                      }
                      onEnterTenantWorkspace(activeReg);
                    }}
                    className="min-h-[46px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-6 py-2.5 text-sm font-extrabold cursor-pointer"
                  >
                    🚀{' '}
                    {lang === 'th'
                      ? `เข้าใช้งานระบบบ้าน "${activeReg.organizationName}"`
                      : `Launch "${activeReg.organizationName}" Workspace`}
                  </button>
                )}
              </div>

              {/* Per-Organization BYO Storage Setup Panel */}
              {activeTenant?.orgId === activeReg.assignedOrgId && appState && onUpdateSettings && (
                <div className="mt-3 rounded-2xl border border-[#8FD4C6] bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-sm font-extrabold text-[#114A42]">
                        💾{' '}
                        {lang === 'th'
                          ? 'ตั้งค่าที่เก็บข้อมูลขององค์กรคุณเอง (ประหยัดพื้นที่ & ฟรี 100%)'
                          : 'Your Organization Storage Settings (Free Space Saver)'}
                      </div>
                      <p className="text-xs text-[#4F433C] leading-relaxed">
                        {lang === 'th'
                          ? 'คุณสามารถเลือกใช้ Google Sheet / Google Drive ขององค์กรคุณเองเพื่อเก็บประวัติรายวัน-รายสัปดาห์ และเปิด "เก็บเฉพาะเครื่อง + Google Sheet ขององค์กร (0%)" เพื่อไม่ให้เปลืองพื้นที่ระบบกลางค่ะ'
                          : 'Connect your own Google Sheet/Drive and optionally enable local + own Sheet mode (0% central cloud quota).'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateSettings({ useOwnStorageOnly: false })}
                      className={`rounded-xl border-2 p-3 text-left cursor-pointer transition-colors ${
                        !appState.settings.useOwnStorageOnly
                          ? 'border-[#114A42] bg-[#E8FAF6]'
                          : 'border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF6F1]'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#114A42]">
                        ☁️ {lang === 'th' ? 'ซิงก์หลายเครื่อง (ระบบตัดประวัติเกิน 7-14 วัน)' : 'Multi-Device Cloud Sync (7-14 Day Trim)'}
                      </div>
                      <div className="text-[11px] text-[#4F433C] mt-0.5">
                        {lang === 'th'
                          ? 'เปิดดูตรงกันทุกเครื่องได้ฟรี ระบบช่วยล้างข้อมูลเก่าเกิน 7-14 วันให้อัตโนมัติ'
                          : 'Live sync across devices with automatic 7-14 day history cleanup'}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onUpdateSettings({ useOwnStorageOnly: true });
                        onShowAlert({
                          icon: '🏠',
                          title:
                            lang === 'th'
                              ? 'เปิดโหมดใช้ที่เก็บข้อมูลขององค์กรเองแล้ว'
                              : 'Own Storage Mode Enabled',
                          message:
                            lang === 'th'
                              ? 'ข้อมูลขององค์กรจะเก็บในเครื่องนี้และส่งเข้า Google Sheet ของคุณเองเท่านั้น ไม่ใช้พื้นที่ระบบกลางค่ะ'
                              : 'Your data now stays local and syncs only to your organization Google Sheet.',
                          tone: 'mint',
                        });
                      }}
                      className={`rounded-xl border-2 p-3 text-left cursor-pointer transition-colors ${
                        appState.settings.useOwnStorageOnly
                          ? 'border-[#114A42] bg-[#E8FAF6]'
                          : 'border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF6F1]'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#114A42]">
                        🏠 {lang === 'th' ? 'เก็บในเครื่อง + Google Sheet ตัวเอง (0% พื้นที่กลาง)' : 'Own Device + Google Sheet (0% Central Cloud)'}
                      </div>
                      <div className="text-[11px] text-[#4F433C] mt-0.5">
                        {lang === 'th'
                          ? 'ประหยัดพื้นที่กลาง 100% เหมาะสำหรับเช็คชื่อรายวัน/รายสัปดาห์หรือเครื่องเดียวประจำจุด'
                          : 'Uses zero central cloud space; best for daily/weekly local tracking + own Sheet backup'}
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-bold text-[#3D322C] block">
                        📊 {lang === 'th' ? 'ลิงก์ Google Sheet Web App ขององค์กร' : 'Organization Google Sheet Web App URL'}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={orgWebhookDraft}
                          onChange={(e) => setOrgWebhookDraft(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ syncWebhookUrl: orgWebhookDraft.trim() });
                            onShowAlert({
                              icon: '📊',
                              title: lang === 'th' ? 'บันทึกลิงก์ Google Sheet แล้ว' : 'Google Sheet URL Saved',
                              message:
                                orgWebhookDraft.trim() ||
                                (lang === 'th' ? 'ล้างลิงก์เรียบร้อยแล้ว' : 'Cleared.'),
                              tone: 'mint',
                            });
                          }}
                          className="rounded-xl bg-[#114A42] text-white px-3 py-2 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-[#3D322C] block">
                        📁 {lang === 'th' ? 'ลิงก์โฟลเดอร์ Google Drive ขององค์กร' : 'Organization Google Drive Folder URL'}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={orgDriveDraft}
                          onChange={(e) => setOrgDriveDraft(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                          className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSettings({ returnHomeDriveUrl: orgDriveDraft.trim() });
                            onShowAlert({
                              icon: '📁',
                              title: lang === 'th' ? 'บันทึกลิงก์ Google Drive แล้ว' : 'Google Drive URL Saved',
                              message:
                                orgDriveDraft.trim() ||
                                (lang === 'th' ? 'ล้างลิงก์เรียบร้อยแล้ว' : 'Cleared.'),
                              tone: 'mint',
                            });
                          }}
                          className="rounded-xl bg-[#114A42] text-white px-3 py-2 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const url = orgWebhookDraft.trim() || appState.settings.syncWebhookUrl?.trim();
                        if (!url) {
                          onShowAlert({
                            icon: '⚠️',
                            title: lang === 'th' ? 'ยังไม่ได้ใส่ลิงก์ Google Sheet' : 'No Google Sheet URL',
                            message:
                              lang === 'th'
                                ? 'กรุณาวาง Web App URL ของ Google Sheet องค์กรคุณในช่องด้านบนแล้วกด "บันทึก" ก่อนทดสอบส่งค่ะ'
                                : 'Please save your organization Google Sheet Web App URL first.',
                            tone: 'yellow',
                          });
                          return;
                        }
                        const targetState: AppState = {
                          ...appState,
                          settings: { ...appState.settings, syncWebhookUrl: url },
                        };
                        await postSyncToDriveOrSheet(targetState, 'Org Portal Test Sync');
                        onShowAlert({
                          icon: '📤',
                          title: lang === 'th' ? 'ส่งข้อมูลเข้า Google Sheet แล้ว!' : 'Synced to Google Sheet!',
                          message:
                            lang === 'th'
                              ? 'ระบบได้ส่งข้อมูลทดสอบเข้าชีตของคุณเรียบร้อย ลองเปิดดูที่แท็บ Logs ใน Google Sheet ขององค์กรได้เลยค่ะ'
                              : 'Dispatched test payload to your Google Sheet (check the Logs tab).',
                          tone: 'mint',
                        });
                      }}
                      className="min-h-[36px] rounded-xl bg-[#DCEEF8] hover:bg-[#C6E2F3] text-[#1E445C] px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      📤 {lang === 'th' ? 'ทดสอบส่งเข้าชีต' : 'Test Sheet Sync'}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyTextToClipboard(GOOGLE_APPS_SCRIPT_TEMPLATE);
                        onShowAlert({
                          icon: '📋',
                          title: ok
                            ? lang === 'th'
                              ? 'คัดลอกโค้ด Apps Script สำเร็จรูปแล้ว!'
                              : 'Apps Script Template Copied!'
                            : lang === 'th'
                            ? 'โค้ด Google Apps Script'
                            : 'Google Apps Script',
                          message:
                            lang === 'th'
                              ? 'เปิด Google Sheet ขององค์กร > ส่วนขยาย (Extensions) > Apps Script แล้ววางโค้ดนี้ จากนั้นกด Deploy → Web app (Anyone) แล้วนำลิงก์มาวางค่ะ'
                              : 'Paste into your Google Sheet > Extensions > Apps Script and deploy as Web app (Anyone).',
                          tone: 'mint',
                        });
                      }}
                      className="min-h-[36px] rounded-xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      📋 {lang === 'th' ? 'คัดลอกโค้ด Apps Script' : 'Copy Apps Script'}
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadJsonBackup(appState)}
                      className="min-h-[36px] rounded-xl border border-[#F4DB73] bg-[#FFF5BA] hover:bg-[#FCEB8E] text-[#3D322C] px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      💾 {lang === 'th' ? 'ดาวน์โหลดสำรอง (.json)' : 'Download Backup (.json)'}
                    </button>
                  </div>

                  <OrgStorageGuideCard lang={lang} onShowAlert={onShowAlert} compactTitle />
                </div>
              )}
            </div>
          )}

          {/* Pending / Interview Organization Pre-Setup Card */}
          {(activeReg.status === 'pending' || activeReg.status === 'interview') &&
            activeReg.applicationType === 'open_organization' && (
              <div className="rounded-2xl border border-[#8FD4C6] bg-[#F5FCFA] p-4 space-y-3">
                <div className="text-sm font-extrabold text-[#114A42]">
                  🛠️{' '}
                  {lang === 'th'
                    ? 'เตรียมเชื่อม Google Sheet & Drive ขององค์กรคุณล่วงหน้า (ทำรอระหว่างรออนุมัติได้เลยค่ะ)'
                    : 'Prepare Your Organization Google Sheet & Drive While Pending'}
                </div>
                <TwoStorageOptionsCard
                  lang={lang}
                  selectedMode={storageChoice}
                  onSelectMode={(mode) => {
                    setStorageChoice(mode);
                    if (!isPreviewing && cloudUser) {
                      saveOrgStorageOnboardingPref(cloudUser.uid, {
                        useOwnStorageOnly: mode === 'own',
                        syncWebhookUrl: orgWebhookDraft.trim(),
                        returnHomeDriveUrl: orgDriveDraft.trim(),
                      });
                    }
                  }}
                />
                {storageChoice === 'own' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="space-y-1">
                      <label className="font-bold text-[#3D322C] block">
                        📊 {lang === 'th' ? 'ลิงก์ Google Sheet Web App (ทำตามคู่มือด้านล่าง)' : 'Google Sheet Web App URL'}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={orgWebhookDraft}
                          onChange={(e) => setOrgWebhookDraft(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPreviewing && cloudUser) {
                              saveOrgStorageOnboardingPref(cloudUser.uid, {
                                useOwnStorageOnly: true,
                                syncWebhookUrl: orgWebhookDraft.trim(),
                                returnHomeDriveUrl: orgDriveDraft.trim(),
                              });
                            }
                            onShowAlert({
                              icon: '📊',
                              title: lang === 'th' ? 'บันทึกลิงก์รอไว้เรียบร้อย!' : 'Pre-saved Google Sheet URL!',
                              message:
                                lang === 'th'
                                  ? 'ระบบจะนำลิงก์นี้ไปเชื่อมให้อัตโนมัติทันทีที่ผู้สร้างกดอนุมัติค่ะ'
                                  : 'Will be auto-applied as soon as your workspace is approved.',
                              tone: 'mint',
                            });
                          }}
                          className="rounded-xl bg-[#114A42] text-white px-3 py-2 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-[#3D322C] block">
                        📁 {lang === 'th' ? 'ลิงก์โฟลเดอร์ Google Drive ขององค์กร' : 'Google Drive Folder URL'}
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={orgDriveDraft}
                          onChange={(e) => setOrgDriveDraft(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/..."
                          className="flex-1 min-w-0 rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!isPreviewing && cloudUser) {
                              saveOrgStorageOnboardingPref(cloudUser.uid, {
                                useOwnStorageOnly: true,
                                syncWebhookUrl: orgWebhookDraft.trim(),
                                returnHomeDriveUrl: orgDriveDraft.trim(),
                              });
                            }
                            onShowAlert({
                              icon: '📁',
                              title: lang === 'th' ? 'บันทึกลิงก์ Drive รอไว้เรียบร้อย!' : 'Pre-saved Google Drive URL!',
                              message:
                                lang === 'th'
                                  ? 'ระบบจะนำโฟลเดอร์นี้ไปตั้งค่าให้ทันทีที่เปิดใช้งานค่ะ'
                                  : 'Will be auto-applied when your workspace launches.',
                              tone: 'mint',
                            });
                          }}
                          className="rounded-xl bg-[#114A42] text-white px-3 py-2 font-bold cursor-pointer whitespace-nowrap"
                        >
                          {lang === 'th' ? 'บันทึก' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <OrgStorageGuideCard lang={lang} onShowAlert={onShowAlert} compactTitle />
              </div>
            )}

          {/* Submitted Summary Details */}
          <div className="rounded-2xl bg-[#FAF6F1] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#4F433C]">
            {activeReg.applicationType === 'open_organization' && activeReg.organizationPreset && (
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EFE6DC]">
                <div>
                  <span className="font-bold">
                    {lang === 'th' ? 'รูปแบบระบบที่เลือก: ' : 'Selected Automation Preset: '}
                  </span>
                  <span className="font-extrabold text-[#114A42]">
                    {getOrganizationPreset(activeReg.organizationPreset).emoji}{' '}
                    {lang === 'th'
                      ? getOrganizationPreset(activeReg.organizationPreset).titleTh
                      : getOrganizationPreset(activeReg.organizationPreset).titleEn}
                  </span>
                </div>
                {(activeReg.organizationPreset === 'autonomous_minimart' ||
                  activeReg.automationAddons?.includes('receipt_door_gate')) && (
                  <button
                    type="button"
                    onClick={() => setDemoModalOpen(true)}
                    className="rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3 py-1.5 text-[11px] font-extrabold cursor-pointer"
                  >
                    🚪 {lang === 'th' ? 'เปิดจำลองระบบใบเสร็จเปิดประตู' : 'Open Receipt Gate Demo'}
                  </button>
                )}
              </div>
            )}
            <div>
              <span className="font-bold">{lang === 'th' ? 'ช่องทางติดต่อ: ' : 'Contact: '}</span>
              {activeReg.contactInfo}
            </div>
            <div>
              <span className="font-bold">
                {lang === 'th' ? 'ขนาดทีม/ประสบการณ์: ' : 'Size/Experience: '}
              </span>
              {activeReg.experienceOrSize || '-'}
            </div>
            {activeReg.notes && (
              <div className="sm:col-span-2">
                <span className="font-bold">
                  {lang === 'th' ? 'ข้อความที่ส่ง: ' : 'Application Notes: '}
                </span>
                {activeReg.notes}
              </div>
            )}
          </div>

          {(activeReg.status === 'pending' || activeReg.status === 'interview') && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (isPreviewing) {
                    switchMasterPreview('applicant_form');
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="min-h-[40px] rounded-xl border border-[#EBD8C3] bg-white hover:bg-[#FFF5BA]/50 px-4 py-2 text-xs font-bold text-[#3D322C] cursor-pointer"
              >
                ✏️ {lang === 'th' ? 'แก้ไขรายละเอียดใบสมัคร' : 'Edit Application Details'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* State 5: Applicant Registration Form (New or Editing) */}
      {showApplicationForm && (
        <form
          onSubmit={(e) => void handleSubmitForm(e)}
          className="rounded-[28px] border border-[#EBD8C3] bg-white p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFE6DC]">
            <div>
              <h2 className="text-lg font-extrabold text-[#3D322C]">
                📝{' '}
                {isEditing
                  ? lang === 'th'
                    ? 'แก้ไขข้อมูลใบสมัคร'
                    : 'Edit Registration'
                  : lang === 'th'
                  ? 'แบบฟอร์มสมัครขอใช้งาน / สมัครงาน'
                  : 'Sign-Up & Application Form'}
              </h2>
              <p className="text-xs text-[#6E5C52] mt-0.5">
                {lang === 'th'
                  ? `เข้าสู่ระบบด้วย ${displayEmail} · กรอกข้อมูลเพื่อส่งให้เจ้าของระบบอนุมัติค่ะ`
                  : `Signed in as ${displayEmail} · Submit your details for owner approval.`}
              </p>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-[#7B695F] hover:text-[#3D322C] cursor-pointer"
              >
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
            )}
          </div>

          {/* Segmented Application Type Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#3D322C]">
              {lang === 'th' ? '1) เลือกรูปแบบที่ต้องการสมัคร' : '1) Application Type'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  id: 'open_organization' as const,
                  emoji: '⚡',
                  titleTh: 'เปิดระบบอัตโนมัติสำหรับร้าน / โรงเรียน / องค์กรของฉัน',
                  titleEn: 'Open Automated Shop / School / Organization Workspace',
                  descTh:
                    'เลือกช้อยส์ได้ทั้ง มินิมาร์ทจ่ายเองเปิดประตู, ห้องเรียน, SME ไร้ HR, มูลนิธิ หรือออกแบบเอง (แยกข้อมูลส่วนตัว 100%)',
                  descEn:
                    'Choose from Self-Checkout Minimart, Classroom, Lean SME, Foundation, or Custom (100% isolated data)',
                },
                {
                  id: 'apply_staff' as const,
                  emoji: '👩‍🏫',
                  titleTh: 'สมัครงาน / ขอร่วมทีมผู้ดูแล',
                  titleEn: 'Apply for Staff / Operator Role',
                  descTh: 'ส่งข้อมูลติดต่อกลับเพื่อสมัครร่วมทีมกับเจ้าของระบบ',
                  descEn: 'Apply to join as a team member / caregiver',
                },
              ].map((opt) => {
                const active = applicationType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setApplicationType(opt.id)}
                    className={`rounded-2xl border-2 p-3.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-[#114A42] bg-[#E8FAF6]'
                        : 'border-[#EBD8C3] bg-[#FFFDF9] hover:bg-[#FAF6F1]'
                    }`}
                  >
                    <div className="text-sm font-extrabold text-[#3D322C] flex items-center gap-2">
                      <span>{opt.emoji}</span>
                      <span>{lang === 'th' ? opt.titleTh : opt.titleEn}</span>
                    </div>
                    <div className="text-xs text-[#6E5C52] mt-1">
                      {lang === 'th' ? opt.descTh : opt.descEn}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Organization Automation Preset Cards + Custom Automation Add-on Checkboxes */}
          {applicationType === 'open_organization' && (
            <div className="rounded-2xl border-2 border-[#B9E8DF] bg-[#F7FCFA] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-[#114A42]">
                    2){' '}
                    {lang === 'th'
                      ? 'เลือกช้อยส์รูปแบบระบบอัตโนมัติ (จุดขายจัดการแทนคน)'
                      : '2) Select Your Automation Preset'}
                  </div>
                  <p className="text-xs text-[#4F433C]">
                    {lang === 'th'
                      ? 'เลือกได้ตามธุรกิจหรือพื้นที่ของคุณ ระบบจะเตรียมคำเรียกบทบาทและฟีเจอร์ให้พร้อมใช้งานทันทีค่ะ'
                      : 'Pick a preset—roles, greeting, and starter modules will be tailored automatically.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="rounded-xl bg-[#3D322C] hover:bg-[#2B221D] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer whitespace-nowrap"
                >
                  🚪 {lang === 'th' ? 'ทดลอง: จ่ายเอง + ใบเสร็จเปิดประตู' : 'Try Receipt Door Gate Demo'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ORGANIZATION_PRESETS.map((preset) => {
                  const selected = organizationPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectOrganizationPreset(preset.id)}
                      className={`rounded-2xl border-2 p-3.5 text-left transition-all cursor-pointer space-y-1.5 ${
                        selected
                          ? 'border-[#114A42] bg-white shadow-sm ring-1 ring-[#8FD4C6]'
                          : 'border-[#E5DDD3] bg-white/75 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg">{preset.emoji}</span>
                        {preset.badgeTh && (
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                              selected
                                ? 'bg-[#114A42] text-white'
                                : 'bg-[#E8FAF6] text-[#114A42]'
                            }`}
                          >
                            {lang === 'th' ? preset.badgeTh : preset.badgeEn}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-[#3D322C]">
                        {lang === 'th' ? preset.titleTh : preset.titleEn}
                      </div>
                      <div className="text-[11px] text-[#6E5C52] leading-snug">
                        {lang === 'th' ? preset.taglineTh : preset.taglineEn}
                      </div>
                      <div className="text-[10px] font-bold text-[#114A42] pt-0.5">
                        👥 {lang === 'th' ? preset.rolesLabelTh : preset.rolesLabelEn}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Add-on Automation Capabilities */}
              <div className="space-y-2 pt-1 border-t border-[#D2EFE8]">
                <div className="text-xs font-extrabold text-[#114A42]">
                  3){' '}
                  {lang === 'th'
                    ? 'ติ๊กเลือกระบบอัตโนมัติที่ต้องการให้ทำงานแทนคน (เลือกผสมได้ตามใจ)'
                    : '3) Customize Automation Modules (Mix & Match)'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {AUTOMATION_ADDON_OPTIONS.map((addon) => {
                    const checked = automationAddons.includes(addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => toggleAutomationAddon(addon.id)}
                        className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer flex items-start gap-2 ${
                          checked
                            ? 'border-[#114A42] bg-[#E8FAF6]'
                            : 'border-[#EBD8C3] bg-white hover:bg-[#FAF6F1]'
                        }`}
                      >
                        <span className="mt-0.5 text-sm shrink-0">
                          {checked ? '☑️' : '⬜'}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#3D322C]">
                            {addon.emoji} {lang === 'th' ? addon.titleTh : addon.titleEn}
                          </div>
                          <div className="text-[10px] text-[#6E5C52] leading-snug mt-0.5">
                            {lang === 'th' ? addon.descTh : addon.descEn}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {applicationType === 'open_organization'
                  ? lang === 'th'
                    ? 'ชื่อผู้ดูแล / เจ้าของร้าน *'
                    : 'Owner / Coordinator Name *'
                  : lang === 'th'
                  ? 'ชื่อ-นามสกุลผู้สมัคร *'
                  : 'Full Name *'}
              </label>
              <input
                type="text"
                maxLength={120}
                required
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น คุณสุซาน' : 'e.g. Susan Miller'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'ชื่อเล่น *' : 'Nickname *'}
              </label>
              <input
                type="text"
                maxLength={64}
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น พี่สุ' : 'e.g. Susan'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {applicationType === 'open_organization'
                  ? lang === 'th'
                    ? 'ชื่อร้าน / โรงเรียน / องค์กรที่จะเปิดใช้งาน *'
                    : 'Shop / School / Organization Name *'
                  : lang === 'th'
                  ? 'ตำแหน่งที่ต้องการสมัคร *'
                  : 'Position Applied For *'}
              </label>
              <input
                type="text"
                maxLength={140}
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                placeholder={
                  applicationType === 'open_organization'
                    ? lang === 'th'
                      ? selectedPresetMeta.orgNamePlaceholderTh
                      : selectedPresetMeta.orgNamePlaceholderEn
                    : lang === 'th'
                    ? 'เช่น ผู้ดูแลระบบ / พี่เลี้ยงประจำ'
                    : 'e.g. Caregiver / Store Operator'
                }
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'เบอร์โทร / LINE ID ติดต่อกลับ *' : 'Phone / LINE ID *'}
              </label>
              <input
                type="text"
                maxLength={160}
                required
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder={lang === 'th' ? 'เช่น 08x-xxx-xxxx / LINE: susan' : 'Phone or LINE ID'}
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {applicationType === 'open_organization'
                  ? lang === 'th'
                    ? 'ขนาดสาขา / จำนวนคน / รูปแบบจุดบริการโดยประมาณ'
                    : 'Estimated Branches / Team Size'
                  : lang === 'th'
                  ? 'ประสบการณ์ทำงานที่ผ่านมา'
                  : 'Relevant Experience'}
              </label>
              <input
                type="text"
                maxLength={240}
                value={experienceOrSize}
                onChange={(e) => setExperienceOrSize(e.target.value)}
                placeholder={
                  applicationType === 'open_organization'
                    ? lang === 'th'
                      ? selectedPresetMeta.sizePlaceholderTh
                      : selectedPresetMeta.sizePlaceholderEn
                    : lang === 'th'
                    ? 'เช่น เคยดูแลร้านมินิมาร์ท / ดูแลเด็กอนุบาล 3 ปี'
                    : 'e.g. 3 years in retail / classroom support'
                }
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#3D322C] mb-1">
                {lang === 'th' ? 'ไอเดีย / เงื่อนไขพิเศษที่อยากให้ระบบช่วยจัดการแทนคน' : 'Automation Goals / Notes'}
              </label>
              <textarea
                rows={3}
                maxLength={600}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  lang === 'th'
                    ? 'เช่น อยากให้ลูกค้าสแกนจ่ายเองแล้วใช้ QR ใบเสร็จเปิดประตูออกอัตโนมัติ หรือสรุปยอดส่ง LINE ทุกวัน'
                    : 'Tell us briefly what tasks you want automated'
                }
                className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3.5 py-2.5 text-sm text-[#3D322C] focus:outline-none focus:ring-2 focus:ring-[#9FE2D6]"
              />
            </div>
          </div>

          {/* Storage Option Selection & Optional Pre-Setup During Org Registration */}
          {applicationType === 'open_organization' && (
            <div className="rounded-2xl border border-[#B9E8DF] bg-[#F8FDFB] p-4 space-y-3">
              <TwoStorageOptionsCard
                lang={lang}
                selectedMode={storageChoice}
                onSelectMode={setStorageChoice}
              />

              {storageChoice === 'own' && (
                <div className="rounded-xl border border-[#D2EFE8] bg-white p-3.5 space-y-3">
                  <div className="text-xs font-bold text-[#114A42]">
                    🔗{' '}
                    {lang === 'th'
                      ? 'ใส่ลิงก์ Google Sheet / Drive ขององค์กรไว้ล่วงหน้าได้เลย (ถ้ายังไม่สะดวก ข้ามไปใส่หลังอนุมัติได้ค่ะ)'
                      : 'Optional: Pre-link Your Google Sheet & Drive (or add later after approval)'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-[#3D322C] block mb-1">
                        📊 {lang === 'th' ? 'ลิงก์ Google Sheet Web App (ไม่บังคับ)' : 'Google Sheet Web App URL (Optional)'}
                      </label>
                      <input
                        type="url"
                        value={orgWebhookDraft}
                        onChange={(e) => setOrgWebhookDraft(e.target.value)}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#3D322C] block mb-1">
                        📁 {lang === 'th' ? 'ลิงก์โฟลเดอร์ Google Drive (ไม่บังคับ)' : 'Google Drive Folder URL (Optional)'}
                      </label>
                      <input
                        type="url"
                        value={orgDriveDraft}
                        onChange={(e) => setOrgDriveDraft(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className="w-full rounded-xl border border-[#EBD8C3] bg-white px-3 py-2 text-xs text-[#3D322C]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <OrgStorageGuideCard lang={lang} onShowAlert={onShowAlert} compactTitle />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[46px] rounded-2xl bg-[#114A42] hover:bg-[#0D3A34] text-white px-6 py-2.5 text-sm font-extrabold cursor-pointer disabled:opacity-60"
            >
              {submitting
                ? lang === 'th'
                  ? 'กำลังบันทึก...'
                  : 'Submitting...'
                : isPreviewing
                ? lang === 'th'
                  ? '👀 ลองกดส่งใบสมัคร (โหมดจำลอง)'
                  : '👀 Simulate Submit Application'
                : isEditing
                ? lang === 'th'
                  ? '💾 บันทึกการแก้ไขใบสมัคร'
                  : '💾 Save Changes'
                : lang === 'th'
                ? '📨 ส่งใบสมัครขอใช้งาน'
                : '📨 Submit Application'}
            </button>
          </div>
        </form>
      )}

      <MinimartGateDemoModal
        open={demoModalOpen}
        orgName={organizationName}
        lang={lang}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
};
