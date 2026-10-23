import {
  resolveDisplayNameField,
  resolveAboutMeField,
  resolveDateOfBirthField,
  ProfileFieldsParent,
} from './user-profile.fields';

describe('user profile field resolvers', () => {
  describe('resolveDisplayNameField', () => {
    it('returns full name when both firstName and lastName are provided', () => {
      const parent: ProfileFieldsParent = {
        firstName: 'John',
        lastName: 'Doe',
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('John Doe');
    });

    it('returns only firstName when lastName is missing', () => {
      const parent: ProfileFieldsParent = {
        firstName: 'John',
        lastName: undefined,
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('John');
    });

    it('returns only lastName when firstName is missing', () => {
      const parent: ProfileFieldsParent = {
        firstName: undefined,
        lastName: 'Doe',
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('Doe');
    });

    it('falls back to username when both firstName and lastName are null', () => {
      const parent: ProfileFieldsParent = {
        firstName: null,
        lastName: null,
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('jdoe');
    });

    it('trims extra whitespace from name parts', () => {
      const parent: ProfileFieldsParent = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('John Doe');
    });

    it('returns username when firstName is all whitespace and lastName is missing', () => {
      const parent: ProfileFieldsParent = {
        firstName: '   ',
        lastName: undefined,
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('jdoe');
    });

    it('returns username when firstName is empty string and lastName is missing', () => {
      const parent: ProfileFieldsParent = {
        firstName: '',
        lastName: undefined,
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('jdoe');
    });

    it('returns lastName when firstName is empty and lastName is provided', () => {
      const parent: ProfileFieldsParent = {
        firstName: '',
        lastName: 'Doe',
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('Doe');
    });

    it('returns trimmed firstName', () => {
      const parent: ProfileFieldsParent = {
        firstName: ' John ',
        lastName: undefined,
        username: 'jdoe',
      };
      expect(resolveDisplayNameField(parent)).toBe('John');
    });
  });

  describe('resolveAboutMeField', () => {
    it('returns bio when it is set', () => {
      const parent = { bio: 'Some bio text' };
      expect(resolveAboutMeField(parent)).toBe('Some bio text');
    });

    it('returns null when bio is null', () => {
      const parent = { bio: null };
      expect(resolveAboutMeField(parent)).toBeNull();
    });

    it('returns null when bio is undefined', () => {
      const parent = {} as { bio?: string | null };
      expect(resolveAboutMeField(parent)).toBeNull();
    });
  });

  describe('resolveDateOfBirthField', () => {
    it('formats a valid date as YYYY-MM-DD', () => {
      const parent = { dateOfBirth: new Date('2000-05-17T00:00:00.000Z') };
      expect(resolveDateOfBirthField(parent)).toBe('2000-05-17');
    });

    it('returns null when dateOfBirth is null', () => {
      const parent = { dateOfBirth: null };
      expect(resolveDateOfBirthField(parent)).toBeNull();
    });

    it('returns null when dateOfBirth is undefined', () => {
      const parent = {} as { dateOfBirth?: Date | null };
      expect(resolveDateOfBirthField(parent)).toBeNull();
    });
  });
});
