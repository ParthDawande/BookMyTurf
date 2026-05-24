package com.bookmyturf.dto.staff;

public record AddNoteResponse(
        Long noteId,
        Long complaintId,
        Long authorId,
        String noteText,
        String createdAt
) {}
