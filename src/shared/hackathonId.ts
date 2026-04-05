export const HACKATHON_ID_LENGTH = 12;

export function normalizeHackathonId(value: string): string {
  return String(value || "").replace(/\D+/g, "");
}

function getLuhnChecksum(value: string): number {
  let sum = 0;
  const parity = value.length % 2;

  for (let index = 0; index < value.length; index += 1) {
    let digit = Number(value[index] || 0);

    if (index % 2 === parity) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
  }

  return sum;
}

export function calculateHackathonIdCheckDigit(baseDigits: string): string {
  const normalizedBase = normalizeHackathonId(baseDigits);
  const sum = getLuhnChecksum(`${normalizedBase}0`);
  return String((10 - (sum % 10)) % 10);
}

export function isValidHackathonId(value: string): boolean {
  const normalized = normalizeHackathonId(value);

  return (
    normalized.length === HACKATHON_ID_LENGTH &&
    /^\d+$/.test(normalized) &&
    getLuhnChecksum(normalized) % 10 === 0
  );
}

export function getHackathonIdValidationError(value: string): string | null {
  const normalized = normalizeHackathonId(value);

  if (!normalized) {
    return "Hackathon ID is required.";
  }

  if (normalized.length !== HACKATHON_ID_LENGTH) {
    return `Hackathon ID must be ${HACKATHON_ID_LENGTH} digits.`;
  }

  if (!isValidHackathonId(normalized)) {
    return "Hackathon ID is invalid. Check the number and try again.";
  }

  return null;
}
