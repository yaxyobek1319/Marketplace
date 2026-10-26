import { OrderItemStatus } from '@prisma/client';
export function orderStatus(statuses: OrderItemStatus[]): string {
  if (!statuses.length) return 'EMPTY';
  if (statuses.includes('DISPUTED')) return 'ATTENTION_REQUIRED';
  if (statuses.every((s) => s === 'CANCELLED')) return 'CANCELLED';
  if (statuses.every((s) => s === 'RETURNED')) return 'RETURNED';
  if (statuses.every((s) => s === 'COMPLETED')) return 'COMPLETED';
  if (statuses.every((s) => ['COMPLETED', 'CANCELLED', 'RETURNED'].includes(s))) return 'CLOSED';
  return 'IN_PROGRESS';
}
