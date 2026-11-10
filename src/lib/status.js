// Booking statuses as they exist in the current production collection. The unique
// slot index (`idx_unique_active_booking`) frees a slot for exactly these cancelled
// values, so the slot check must use the same list.
export const CANCELLED_STATUSES = ['cancelled', 'cancelled_by_client', 'cancelled_by_admin'];

const LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  cancelled_by_client: 'Cancelled',
  cancelled_by_admin: 'Cancelled by studio',
  reschedule_requested: 'Reschedule requested',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
};

export function isCancelled(status) {
  return CANCELLED_STATUSES.includes(status);
}

/** PocketBase filter clause that leaves out every cancelled booking. */
export function notCancelledFilter() {
  return CANCELLED_STATUSES.map((s) => `status != '${s}'`).join(' && ');
}

export function statusLabel(status) {
  return LABELS[status] ?? 'Pending';
}

export function clientCanCancel(status) {
  return !isCancelled(status) && status !== 'completed';
}
