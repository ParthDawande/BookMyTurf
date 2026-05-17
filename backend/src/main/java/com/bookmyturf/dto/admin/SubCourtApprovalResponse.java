package com.bookmyturf.dto.admin;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record SubCourtApprovalResponse(
        Long subCourtId,
        String status,
        String previousStatus,
        Long turfId,
        String turfStatus,       // null on reject → omitted
        Boolean publiclyVisible  // null on reject → omitted
) {}
