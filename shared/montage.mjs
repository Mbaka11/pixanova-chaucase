export const montageChoices = ['none', 'simple', 'animated'];
export const isValidMontage = (value) => typeof value === 'string' && montageChoices.includes(value);
export function montagePrice(platform, screens, montage) {
  if (!Number.isInteger(screens) || screens < 1 || !isValidMontage(montage)) throw new RangeError('Option de montage invalide');
  if (montage === 'none') return 0;
  const base = montage === 'simple' ? platform.montage.simpleCents : platform.montage.animatedCents;
  return base + (screens >= 2 ? platform.montage.multipleScreensExtraCents : 0);
}
