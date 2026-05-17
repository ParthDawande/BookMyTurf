package com.bookmyturf.model;

/**
 * REFUNDED is a real, reachable state per DECISIONS.md §3.
 * A cancellation with a successful refund sets status = REFUNDED (not CANCELLED).
 * CANCELLED is used only for cancellations with no refund.
 */
public enum BookingStatus {
    CONFIRMED, CANCELLED, COMPLETED, REFUNDED
}
