export const PROJECT_DEADLINE = "2026-09-25";

export function daysUntilProjectDeadline(today = new Date()) {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineUtc = Date.parse(`${PROJECT_DEADLINE}T00:00:00Z`);
  return Math.max(0, Math.ceil((deadlineUtc - todayUtc) / 86_400_000));
}
