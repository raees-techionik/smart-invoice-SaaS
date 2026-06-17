export type ActionState = {
  error?: string;
};

export const initialActionState: ActionState = {};

export function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
