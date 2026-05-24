import { ValidationErrorItem } from '@app/common/validation/types/validation-error-item.type';
import { ValidationError } from 'class-validator';

export function formatValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationErrorItem[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    const ownErrors = error.constraints
      ? [{ field, message: Object.values(error.constraints)[0] }]
      : [];

    const childErrors = error.children?.length
      ? formatValidationErrors(error.children, field)
      : [];

    return [...ownErrors, ...childErrors];
  });
}
