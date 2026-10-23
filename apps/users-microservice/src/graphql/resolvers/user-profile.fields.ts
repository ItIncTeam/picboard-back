export type ProfileFieldsParent = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string;
  bio?: string | null;
  dateOfBirth?: Date | null;
};

export function resolveDisplayNameField(parent: ProfileFieldsParent): string {
  const { firstName, lastName, username } = parent;
  const nameParts = [firstName, lastName]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p));
  if (nameParts.length > 0) {
    return nameParts.join(' ');
  }
  return username ?? '';
}

export function resolveAboutMeField(parent: {
  bio?: string | null;
}): string | null {
  return parent.bio ?? null;
}

export function resolveDateOfBirthField(parent: {
  dateOfBirth?: Date | string | null;
}): string | null {
  const { dateOfBirth } = parent;
  if (dateOfBirth == null) return null;
  if (typeof dateOfBirth === 'string') return dateOfBirth.slice(0, 10);
  return dateOfBirth.toISOString().slice(0, 10);
}
