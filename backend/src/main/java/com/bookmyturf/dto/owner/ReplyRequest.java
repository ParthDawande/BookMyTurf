package com.bookmyturf.dto.owner;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReplyRequest(
        @NotBlank @Size(min = 1, max = 1000) String replyText
) {}
