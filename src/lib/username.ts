/**
 * A username made from the member's name ("Chidi Okafor" -> "chidi_okafor_4821"), so
 * joining doesn't ask for one. Members can change it later on their profile.
 */
export function makeUsername(name: string, random: () => number = Math.random): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 20)
      .replace(/_+$/, '') || 'abian'
  const digits = String(Math.floor(random() * 9000) + 1000)
  return `${base}_${digits}`
}
