import type { Order, DeliveryVersion } from "@prisma/client";

export function publicOrderCode(now = new Date()) {
  return `ORD-${now.toISOString().slice(2, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function subOrderCode(orderCode: string, index: number) {
  return `${orderCode}-${String(index).padStart(2, "0")}`;
}

export function briefContent(order: Order) {
  return {
    title: order.title,
    objective: order.objective,
    topic: order.topic,
    quantity: order.quantity,
    duration: order.duration,
    platform: order.platform,
    aspectRatio: order.aspectRatio,
    audience: order.audience,
    style: order.style,
    referenceUrls: order.referenceUrls,
    forbiddenElements: order.forbiddenElements,
    deadline: order.deadline.toISOString(),
    acceptanceCriteria: order.acceptanceCriteria,
    mode: order.mode,
    slots: order.slots,
    sampleRequired: order.sampleRequired,
  };
}

export function reputation(completed: number, onTime: number, reviews: { rating: number }[]) {
  return {
    completed,
    onTimeRate: completed ? Math.round((onTime / completed) * 100) : null,
    averageRating: reviews.length ? Math.round((reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length) * 10) / 10 : null,
    reviewCount: reviews.length,
  };
}

export function nextDeliveryVersion(deliveries: Pick<DeliveryVersion, "version">[]) {
  return deliveries.reduce((max, item) => Math.max(max, item.version), 0) + 1;
}
