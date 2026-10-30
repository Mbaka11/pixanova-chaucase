export const montageChoices = ['none', 'simple', 'animated'];
export const isValidMontage = (value) => typeof value === 'string' && montageChoices.includes(value);
export function montagePrice(platform, screens, montage) {
  if (!Number.isInteger(screens) || screens < 1 || !isValidMontage(montage)) throw new RangeError('Option de montage invalide');
  if (montage === 'none') return 0;
  return montage === 'simple' ? platform.montage.simpleCents : platform.montage.animatedCents;
}
export function montageHours(platform, montage) {
  if (!isValidMontage(montage)) throw new RangeError('Option de montage invalide');
  return montage === 'none' ? 0 : montage === 'simple' ? platform.montage.simpleHours : platform.montage.animatedHours;
}
