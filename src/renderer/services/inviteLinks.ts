import { normalizeHackathonId } from '../../shared/hackathonId';
import {
  IncomingEditorInvite,
  LoginInvitePrefill,
} from '../../shared/types';

const INVITE_WEBSITE_URL = String(
  import.meta.env.VITE_SONAR_WEBSITE_URL || '',
).trim();
const INVITE_SECRET = String(
  import.meta.env.VITE_SONAR_INVITE_SECRET || '',
).trim();

interface TeamInvitePayload {
  version: 1;
  kind: 'team';
  hackathonId: string;
  studentId: string;
  password: string;
  issuedAt: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizeStudentId(value: string): string {
  return String(value || '').trim().toUpperCase();
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);

  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getInviteKey() {
  if (!INVITE_SECRET) {
    throw new Error(
      'Set VITE_SONAR_INVITE_SECRET in the editor env file to enable encrypted invite links.',
    );
  }

  const keyBytes = await window.crypto.subtle.digest(
    'SHA-256',
    encoder.encode(INVITE_SECRET),
  );

  return window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
}

function getWebsiteBaseUrl(): string {
  const normalized = INVITE_WEBSITE_URL.replace(/\/+$/g, '');
  if (!normalized) {
    throw new Error(
      'Set VITE_SONAR_WEBSITE_URL in the editor env file to generate shareable invite links.',
    );
  }

  return normalized;
}

function buildDownloadInviteUrl(params: Record<string, string>): string {
  const url = new URL('/download', `${getWebsiteBaseUrl()}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function encryptTeamInvite(payload: TeamInvitePayload): Promise<string> {
  const key = await getInviteKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoder.encode(JSON.stringify(payload)),
  );

  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(cipherBuffer))}`;
}

async function decryptTeamInvite(token: string): Promise<TeamInvitePayload | null> {
  const [ivEncoded, cipherEncoded] = token.split('.');
  if (!ivEncoded || !cipherEncoded) {
    return null;
  }

  try {
    const key = await getInviteKey();
    const iv = base64UrlDecode(ivEncoded);
    const cipherBytes = base64UrlDecode(cipherEncoded);
    const plainBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      cipherBytes,
    );

    const parsed = JSON.parse(decoder.decode(plainBuffer)) as Partial<TeamInvitePayload>;
    if (
      parsed.version !== 1 ||
      parsed.kind !== 'team' ||
      !parsed.hackathonId ||
      !parsed.studentId ||
      !parsed.password
    ) {
      return null;
    }

    return {
      version: 1,
      kind: 'team',
      hackathonId: normalizeHackathonId(parsed.hackathonId),
      studentId: normalizeStudentId(parsed.studentId),
      password: String(parsed.password),
      issuedAt: String(parsed.issuedAt || ''),
    };
  } catch {
    return null;
  }
}

export function canGenerateEncryptedTeamInvite(): boolean {
  return INVITE_SECRET.length > 0;
}

export async function createTeamInviteLink(payload: {
  hackathonId: string;
  studentId: string;
  password?: string;
}): Promise<string> {
  const normalizedHackathonId = normalizeHackathonId(payload.hackathonId);
  const normalizedStudentId = normalizeStudentId(payload.studentId);
  const password = String(payload.password || '');

  if (!normalizedHackathonId || !normalizedStudentId) {
    throw new Error('Hackathon ID and student ID are required.');
  }

  if (!password) {
    return buildDownloadInviteUrl({
      hackathonId: normalizedHackathonId,
      studentId: normalizedStudentId,
    });
  }

  const teamInvite: TeamInvitePayload = {
    version: 1,
    kind: 'team',
    hackathonId: normalizedHackathonId,
    studentId: normalizedStudentId,
    password,
    issuedAt: new Date().toISOString(),
  };

  const encryptedInvite = await encryptTeamInvite(teamInvite);
  return buildDownloadInviteUrl({ invite: encryptedInvite });
}

export function createHackathonInviteLink(hackathonId: string): string {
  const normalizedHackathonId = normalizeHackathonId(hackathonId);
  if (!normalizedHackathonId) {
    throw new Error('Hackathon ID is required to generate an invite link.');
  }

  return buildDownloadInviteUrl({ hackathonId: normalizedHackathonId });
}

export async function resolveIncomingInvite(
  invite: IncomingEditorInvite,
): Promise<LoginInvitePrefill | null> {
  if (invite.kind === 'hackathon') {
    const normalizedHackathonId = normalizeHackathonId(invite.hackathonId);
    const normalizedStudentId = invite.studentId
      ? normalizeStudentId(invite.studentId)
      : undefined;
    if (!normalizedHackathonId) {
      return null;
    }

    return {
      inviteKey: `hackathon:${normalizedHackathonId}:${normalizedStudentId || ''}`,
      kind: 'hackathon',
      hackathonId: normalizedHackathonId,
      studentId: normalizedStudentId,
      autoSubmit: false,
    };
  }

  const decrypted = await decryptTeamInvite(invite.payload);
  if (!decrypted?.hackathonId || !decrypted.studentId || !decrypted.password) {
    return null;
  }

  return {
    inviteKey: invite.payload,
    kind: 'team',
    hackathonId: decrypted.hackathonId,
    studentId: decrypted.studentId,
    password: decrypted.password,
    autoSubmit: true,
  };
}
