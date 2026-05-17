package com.bookmyturf.exception;

import java.util.List;

public class SchedulingConflictException extends RuntimeException {

    private final List<Long> conflictingBookingIds;

    public SchedulingConflictException(List<Long> conflictingBookingIds) {
        super("Cannot shrink operating hours — there are upcoming bookings in the affected slots");
        this.conflictingBookingIds = conflictingBookingIds;
    }

    public List<Long> getConflictingBookingIds() {
        return conflictingBookingIds;
    }
}
