import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AutomationAddonId,
  OrganizationPresetId,
  PlatformRegistration,
  RegistrationApplicationType,
  RegistrationStatus,
} from '../types/barnhem';

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function mapDocToRegistration(raw: Record<string, unknown>, docId: string): PlatformRegistration {
  return {
    uid: typeof raw.uid === 'string' ? raw.uid : docId,
    email: typeof raw.email === 'string' ? raw.email : '',
    applicantName: typeof raw.applicantName === 'string' ? raw.applicantName : '',
    nickname: typeof raw.nickname === 'string' ? raw.nickname : '',
    organizationName: typeof raw.organizationName === 'string' ? raw.organizationName : '',
    applicationType:
      raw.applicationType === 'apply_staff' ? 'apply_staff' : 'open_organization',
    organizationPreset:
      raw.organizationPreset === 'foundation_care' ? 'foundation_care' : undefined,
    automationAddons: Array.isArray(raw.automationAddons)
      ? (raw.automationAddons.filter((x): x is AutomationAddonId => typeof x === 'string') as AutomationAddonId[])
      : undefined,
    contactInfo: typeof raw.contactInfo === 'string' ? raw.contactInfo : '',
    experienceOrSize:
      typeof raw.experienceOrSize === 'string' ? raw.experienceOrSize : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    status:
      raw.status === 'interview' ||
      raw.status === 'approved' ||
      raw.status === 'rejected'
        ? raw.status
        : 'pending',
    assignedOrgId:
      typeof raw.assignedOrgId === 'string' ? raw.assignedOrgId : `org_${docId}`,
    adminNote: typeof raw.adminNote === 'string' ? raw.adminNote : '',
    createdAt: toIsoString(raw.createdAt),
    updatedAt: toIsoString(raw.updatedAt),
  };
}

export function subscribeMyRegistration(
  uid: string,
  onUpdate: (reg: PlatformRegistration | null) => void
): () => void {
  const path = `registrations/${uid}`;
  return onSnapshot(
    doc(db, 'registrations', uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapDocToRegistration(snap.data() as Record<string, unknown>, snap.id));
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export function subscribeAllRegistrationsForAdmin(
  onUpdate: (regs: PlatformRegistration[]) => void
): () => void {
  return onSnapshot(
    collection(db, 'registrations'),
    (snap) => {
      const list: PlatformRegistration[] = [];
      snap.forEach((docSnap) => {
        list.push(
          mapDocToRegistration(docSnap.data() as Record<string, unknown>, docSnap.id)
        );
      });
      list.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
      onUpdate(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'registrations');
    }
  );
}

export interface RegistrationFormInput {
  applicantName: string;
  nickname: string;
  organizationName: string;
  applicationType: RegistrationApplicationType;
  organizationPreset?: OrganizationPresetId;
  automationAddons?: AutomationAddonId[];
  contactInfo: string;
  experienceOrSize: string;
  notes: string;
}

export async function submitPlatformRegistration(
  user: User,
  input: RegistrationFormInput
): Promise<void> {
  if (!user.email) {
    throw new Error('Verified email address is required.');
  }
  const path = `registrations/${user.uid}`;
  const payload = {
    uid: user.uid,
    email: clampStr(user.email, 200),
    applicantName: clampStr(input.applicantName, 120),
    nickname: clampStr(input.nickname, 64),
    organizationName: clampStr(input.organizationName, 140),
    applicationType: input.applicationType,
    ...(input.organizationPreset ? { organizationPreset: input.organizationPreset } : {}),
    ...(Array.isArray(input.automationAddons)
      ? { automationAddons: input.automationAddons.slice(0, 10) }
      : {}),
    contactInfo: clampStr(input.contactInfo, 160),
    experienceOrSize: clampStr(input.experienceOrSize, 240),
    notes: clampStr(input.notes, 600),
    status: 'pending' as const,
    assignedOrgId: `org_${user.uid}`.slice(0, 128),
    adminNote: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'registrations', user.uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateMyRegistrationDetails(
  uid: string,
  input: RegistrationFormInput
): Promise<void> {
  const path = `registrations/${uid}`;
  try {
    await updateDoc(doc(db, 'registrations', uid), {
      applicantName: clampStr(input.applicantName, 120),
      nickname: clampStr(input.nickname, 64),
      organizationName: clampStr(input.organizationName, 140),
      applicationType: input.applicationType,
      ...(input.organizationPreset ? { organizationPreset: input.organizationPreset } : {}),
      ...(Array.isArray(input.automationAddons)
        ? { automationAddons: input.automationAddons.slice(0, 10) }
        : {}),
      contactInfo: clampStr(input.contactInfo, 160),
      experienceOrSize: clampStr(input.experienceOrSize, 240),
      notes: clampStr(input.notes, 600),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function reviewRegistrationByAdmin(
  uid: string,
  params: {
    status: RegistrationStatus;
    assignedOrgId: string;
    adminNote: string;
  }
): Promise<void> {
  const path = `registrations/${uid}`;
  try {
    await updateDoc(doc(db, 'registrations', uid), {
      status: params.status,
      assignedOrgId: clampStr(params.assignedOrgId || `org_${uid}`, 128),
      adminNote: clampStr(params.adminNote, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function deleteRegistrationByAdmin(uid: string): Promise<void> {
  const path = `registrations/${uid}`;
  try {
    await deleteDoc(doc(db, 'registrations', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
