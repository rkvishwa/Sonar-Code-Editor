function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

export function isValidAppVersion(version: string): boolean {
  const normalized = normalizeVersion(version);
  return /^\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?$/.test(normalized);
}

function parseVersion(version: string): { core: number[]; prerelease: string | null } | null {
  if (!isValidAppVersion(version)) {
    return null;
  }

  const normalized = normalizeVersion(version);
  const [corePart, prereleasePart] = normalized.split('-', 2);

  return {
    core: corePart.split('.').map((segment) => Number(segment)),
    prerelease: prereleasePart ?? null,
  };
}

function comparePrerelease(current: string, required: string): number {
  const currentParts = current.split('.');
  const requiredParts = required.split('.');
  const length = Math.max(currentParts.length, requiredParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index];
    const requiredPart = requiredParts[index];

    if (currentPart === undefined) {
      return -1;
    }

    if (requiredPart === undefined) {
      return 1;
    }

    const currentNumber = /^\d+$/.test(currentPart) ? Number(currentPart) : null;
    const requiredNumber = /^\d+$/.test(requiredPart) ? Number(requiredPart) : null;

    if (currentNumber !== null && requiredNumber !== null) {
      if (currentNumber !== requiredNumber) {
        return currentNumber > requiredNumber ? 1 : -1;
      }
      continue;
    }

    if (currentNumber !== null) {
      return -1;
    }

    if (requiredNumber !== null) {
      return 1;
    }

    if (currentPart !== requiredPart) {
      return currentPart > requiredPart ? 1 : -1;
    }
  }

  return 0;
}

export function compareAppVersions(currentVersion: string, requiredVersion: string): number | null {
  const current = parseVersion(currentVersion);
  const required = parseVersion(requiredVersion);

  if (!current || !required) {
    return null;
  }

  const length = Math.max(current.core.length, required.core.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = current.core[index] ?? 0;
    const requiredPart = required.core[index] ?? 0;

    if (currentPart !== requiredPart) {
      return currentPart > requiredPart ? 1 : -1;
    }
  }

  if (current.prerelease === required.prerelease) {
    return 0;
  }

  if (!current.prerelease) {
    return 1;
  }

  if (!required.prerelease) {
    return -1;
  }

  return comparePrerelease(current.prerelease, required.prerelease);
}

export function isAppVersionOutdated(currentVersion: string, requiredVersion: string): boolean {
  const comparison = compareAppVersions(currentVersion, requiredVersion);
  return comparison !== null && comparison < 0;
}
