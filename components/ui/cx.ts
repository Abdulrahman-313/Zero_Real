/** Joins truthy class names. Framework-agnostic and safe to call from server components. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
