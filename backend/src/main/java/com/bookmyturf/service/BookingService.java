package com.bookmyturf.service;

import com.bookmyturf.dto.customer.CancelBookingResponse;
import com.bookmyturf.dto.customer.ConfirmBookingRequest;
import com.bookmyturf.dto.customer.ConfirmBookingResponse;
import com.bookmyturf.dto.customer.InitiateBookingRequest;
import com.bookmyturf.dto.customer.InitiateBookingResponse;
import com.bookmyturf.dto.customer.ReceiptResponse;
import com.bookmyturf.model.*;
import com.bookmyturf.repository.*;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final int BOOKING_HORIZON_DAYS = 90;

    private final SubCourtRepository subCourtRepository;
    private final BookingRepository bookingRepository;
    private final BookingSlotRepository bookingSlotRepository;
    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final PayoutRepository payoutRepository;
    private final NotificationRepository notificationRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final RazorpayClient razorpayClient;
    private final RaceRefundRecoveryService raceRefundRecoveryService;

    @Value("${app.razorpay.key-id}")
    private String razorpayKeyId;

    @Value("${app.razorpay.key-secret}")
    private String razorpayKeySecret;

    // Read from config — DECISIONS.md §1: never hardcode 0.10 in business logic.
    @Value("${app.platform.commission-rate}")
    private BigDecimal commissionRate;

    // Read from config — DECISIONS.md §2: independent property, not collapsed with others.
    @Value("${app.payout.hold-hours}")
    private int payoutHoldHours;

    // DECISIONS.md §2: independent cancellation window property — do NOT hardcode 24.
    @Value("${app.booking.cancellation-window-hours}")
    private int cancellationWindowHours;

    // TODO: Remove this flag once a real fault-injection framework is adopted.
    // Test-only fault injection: when true, forces a RazorpayException at the refund call
    // site so the 5C-3 catch path is exercised without a real Razorpay failure.
    // Default: false (application.properties). Override via application-local.properties
    // (gitignored) or APP_TEST_FORCE_REFUND_FAILURE env var. NEVER set true in production.
    @Value("${app.test.force-refund-failure:false}")
    private boolean forceRefundFailure;

    public BookingService(SubCourtRepository subCourtRepository,
                          BookingRepository bookingRepository,
                          BookingSlotRepository bookingSlotRepository,
                          PaymentRepository paymentRepository,
                          RefundRepository refundRepository,
                          PayoutRepository payoutRepository,
                          NotificationRepository notificationRepository,
                          CustomerProfileRepository customerProfileRepository,
                          RazorpayClient razorpayClient,
                          RaceRefundRecoveryService raceRefundRecoveryService) {
        this.subCourtRepository = subCourtRepository;
        this.bookingRepository = bookingRepository;
        this.bookingSlotRepository = bookingSlotRepository;
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.payoutRepository = payoutRepository;
        this.notificationRepository = notificationRepository;
        this.customerProfileRepository = customerProfileRepository;
        this.razorpayClient = razorpayClient;
        this.raceRefundRecoveryService = raceRefundRecoveryService;
    }

    // -------------------------------------------------------------------------
    // Endpoint 1: initiate — validate + create Razorpay order (no DB writes)
    // -------------------------------------------------------------------------

    public InitiateBookingResponse initiate(User customer, InitiateBookingRequest req) {
        // 1. Parse and range-check booking date.
        LocalDate bookingDate = parseDate(req.bookingDate(), "Invalid booking date");
        LocalDate today = LocalDate.now();
        if (bookingDate.isBefore(today) || bookingDate.isAfter(today.plusDays(BOOKING_HORIZON_DAYS))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid booking date");
        }

        // 2. Fetch sub-court: must be APPROVED, turf APPROVED, owner ACTIVE — same
        //    discoverability rule used in 5A. Non-matching → 404 (no leak of existence).
        SubCourt sc = subCourtRepository.findBookableById(req.subCourtId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Sub-court not available for booking"));

        // 3. Parse and validate requested slots (hourly, within operating hours, contiguous).
        List<LocalTime[]> parsedSlots = parseAndValidateSlots(req.slots(), sc);

        // 4. Slot availability check — reuse 5A's status-derived rule (CONFIRMED + COMPLETED
        //    block the slot; CANCELLED + REFUNDED free it).
        Set<LocalTime> takenStarts = new HashSet<>(bookingSlotRepository.findTakenSlotStartTimes(
                sc.getId(), bookingDate,
                List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED)));

        List<String> unavailable = parsedSlots.stream()
                .filter(s -> takenStarts.contains(s[0]))
                .map(s -> TIME_FMT.format(s[0]) + "-" + TIME_FMT.format(s[1]))
                .collect(Collectors.toList());
        if (!unavailable.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "One or more slots are no longer available");
        }

        // 5. Compute total server-side from the DB price — never trust a client-supplied amount.
        BigDecimal rate = sc.getHourlyPrice();
        BigDecimal total = rate.multiply(BigDecimal.valueOf(parsedSlots.size()));

        // 6. Encode slots compactly for Razorpay notes (Razorpay limits note values to 256 chars).
        //    Format: "HH:mm-HH:mm" per slot, pipe-delimited across slots.
        String slotsEncoded = parsedSlots.stream()
                .map(s -> TIME_FMT.format(s[0]) + "-" + TIME_FMT.format(s[1]))
                .collect(Collectors.joining("|"));

        JSONObject notes = new JSONObject();
        notes.put("customer_id", customer.getId().toString());
        notes.put("sub_court_id", sc.getId().toString());
        notes.put("booking_date", bookingDate.toString());
        notes.put("slots_json", slotsEncoded);
        notes.put("total_amount", total.toPlainString());
        notes.put("rate_at_booking", rate.toPlainString());

        JSONObject orderRequest = new JSONObject();
        // Razorpay amount is in paise (integer).
        orderRequest.put("amount", total.multiply(BigDecimal.valueOf(100)).longValue());
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "init_" + customer.getId() + "_" + System.currentTimeMillis());
        orderRequest.put("notes", notes);

        Order rzpOrder;
        try {
            rzpOrder = razorpayClient.orders.create(orderRequest);
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Unable to create payment order. Please try again.");
        }

        String orderId = rzpOrder.get("id");

        // 7. Build response — include rate_at_booking on each slot (price-freezing confirmation).
        List<InitiateBookingResponse.SlotWithRate> responseSlots = parsedSlots.stream()
                .map(s -> new InitiateBookingResponse.SlotWithRate(
                        TIME_FMT.format(s[0]), TIME_FMT.format(s[1]), rate))
                .collect(Collectors.toList());

        return new InitiateBookingResponse(
                sc.getId(),
                sc.getName(),
                sc.getTurf().getName(),
                bookingDate.toString(),
                responseSlots,
                total,
                orderId,
                razorpayKeyId
        );
    }

    // -------------------------------------------------------------------------
    // Endpoint 2: confirm — verify payment, create all rows (happy path only — 5B)
    // -------------------------------------------------------------------------

    @Transactional
    public ConfirmBookingResponse confirm(User customer, ConfirmBookingRequest req) {

        // 1. Signature verification — FIRST check, before any DB read or lock.
        //    A forged/tampered request is rejected here and nothing else executes.
        //    No refund/capture attempted on a failed signature (5C-2/3 concern).
        try {
            JSONObject sigAttrs = new JSONObject();
            sigAttrs.put("razorpay_order_id", req.razorpayOrderId());
            sigAttrs.put("razorpay_payment_id", req.razorpayPaymentId());
            sigAttrs.put("razorpay_signature", req.razorpaySignature());
            boolean valid = Utils.verifyPaymentSignature(sigAttrs, razorpayKeySecret);
            if (!valid) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment verification failed");
            }
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment verification failed");
        }

        // 2. Re-fetch the Razorpay order and read notes.
        //    Do NOT trust client for amount or slots — the notes are the authoritative source.
        Order rzpOrder;
        try {
            rzpOrder = razorpayClient.orders.fetch(req.razorpayOrderId());
        } catch (RazorpayException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }

        long subCourtId;
        LocalDate bookingDate;
        BigDecimal totalAmount;
        BigDecimal rateAtBooking;
        List<LocalTime[]> slots;
        try {
            JSONObject notes = (JSONObject) rzpOrder.get("notes");
            if (notes == null || !notes.has("sub_court_id")) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }

            long notesCustomerId = Long.parseLong(notes.getString("customer_id"));
            if (notesCustomerId != customer.getId()) {
                // Payment made by a different customer — reject without revealing reason.
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden");
            }

            subCourtId = Long.parseLong(notes.getString("sub_court_id"));
            bookingDate = LocalDate.parse(notes.getString("booking_date"));
            totalAmount = new BigDecimal(notes.getString("total_amount"));
            rateAtBooking = new BigDecimal(notes.getString("rate_at_booking"));
            slots = decodeSlotsEncoded(notes.getString("slots_json"));
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }

        LocalTime lastSlotEnd = slots.get(slots.size() - 1)[1];

        // 3. Acquire a pessimistic WRITE lock on the sub_courts row.
        //    This serialises concurrent confirms for the SAME sub-court;
        //    different sub-courts proceed in parallel.
        SubCourt sc = subCourtRepository.findByIdForUpdate(subCourtId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Sub-court no longer available"));

        // 4. Verify sub-court and its turf are still discoverable (happy path: they are).
        //    If not, 400 placeholder — 5C adds refund/rollback around this.
        if (sc.getStatus() != ListingStatus.APPROVED
                || sc.getTurf().getStatus() != ListingStatus.APPROVED
                || sc.getTurf().getOwner().getStatus() != UserStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Sub-court no longer available");
        }

        // 5. Race re-check — executes AFTER the SELECT FOR UPDATE lock (step 3) so
        //    concurrent confirms for this sub-court are serialized here.
        //    Same status-derived rule as 5A/5B: CONFIRMED + COMPLETED block the slot.
        Set<LocalTime> takenStarts = new HashSet<>(bookingSlotRepository.findTakenSlotStartTimes(
                sc.getId(), bookingDate,
                List.of(BookingStatus.CONFIRMED, BookingStatus.COMPLETED)));
        boolean anyTaken = slots.stream().anyMatch(s -> takenStarts.contains(s[0]));
        if (anyTaken) {
            // 5C-2b: race detected — refund the captured payment, commit the recovery record,
            // then return 409.  Exact Option A sequencing:
            //   (a) fetch method  (b) refund via Razorpay  (c) commit recovery rows  (d) 409.
            //
            // Razorpay refund is issued BEFORE any DB write.  Recovery rows are committed in
            // RaceRefundRecoveryService (@Transactional REQUIRES_NEW) and survive this tx
            // rolling back.  Outer tx creates ZERO rows on this path (5C-2a invariant preserved).

            String paymentMethod = fetchRazorpayPaymentMethod(req.razorpayPaymentId());

            JSONObject refundRequest = new JSONObject();
            refundRequest.put("amount", totalAmount.multiply(BigDecimal.valueOf(100)).longValue());
            com.razorpay.Refund rzpRefund;
            try {
                // TODO: Remove fault-injection block once a real fault-injection framework is adopted.
                if (forceRefundFailure) {
                    throw new RazorpayException("test-only: forced refund failure");
                }
                rzpRefund = razorpayClient.payments.refund(req.razorpayPaymentId(), refundRequest);
            } catch (RazorpayException e) {
                // 5C-3: refund call itself failed. Durably record the orphaned payment and
                // FAILED refund (REQUIRES_NEW — committed independently, survives outer rollback).
                // Outer tx creates ZERO booking-side rows. Return 502; do not echo Razorpay detail.
                log.error("Razorpay refund failed for payment {}: {}", req.razorpayPaymentId(), e.getMessage());
                raceRefundRecoveryService.recordFailedRefund(
                        totalAmount, req.razorpayPaymentId(), paymentMethod);
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Payment refund could not be processed");
            }

            raceRefundRecoveryService.recordRaceRefund(
                    totalAmount, req.razorpayPaymentId(), paymentMethod, rzpRefund.get("id"));

            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Selected slot is no longer available");
        }

        // 6. Commission — DECISIONS.md §1: read from config property, HALF_UP, 2 decimal places.
        BigDecimal commissionAmount = totalAmount.multiply(commissionRate)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal ownerPayout = totalAmount.subtract(commissionAmount);

        // 7a. Insert booking.
        Booking booking = new Booking();
        booking.setCustomer(customer);
        booking.setSubCourt(sc);
        booking.setBookingDate(bookingDate);
        booking.setTotalAmount(totalAmount);
        booking.setCommissionAmount(commissionAmount);
        booking.setStatus(BookingStatus.CONFIRMED);
        booking = bookingRepository.save(booking);

        // 7b. Insert booking_slots — one per slot.
        //     Each row carries the denormalized sub_court_id and booking_date (required by the
        //     Phase 1 unique-constraint backstop on uq_active_slot).
        //     slot_active = 1: this CONFIRMED booking holds the slot (NOT null).
        for (LocalTime[] slot : slots) {
            BookingSlot bs = new BookingSlot();
            bs.setBooking(booking);
            bs.setStartTime(slot[0]);
            bs.setEndTime(slot[1]);
            bs.setRateAtBooking(rateAtBooking);
            bs.setSubCourt(sc);          // denormalized — needed by uq_active_slot index
            bs.setBookingDate(bookingDate); // denormalized — needed by uq_active_slot index
            bs.setSlotActive(1);          // 1 = active (CONFIRMED); null = freed (5C sets null on cancel)
            bookingSlotRepository.save(bs);
        }

        // 7c. Insert payment.
        String paymentMethod = fetchRazorpayPaymentMethod(req.razorpayPaymentId());
        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setAmount(totalAmount);
        payment.setGatewayTransactionId(req.razorpayPaymentId());
        payment.setStatus(PaymentStatus.SUCCESS);
        payment.setPaymentMethod(paymentMethod); // stored AS-IS from Razorpay varchar — 5C hardens mapping
        payment = paymentRepository.save(payment);

        // 7d. Insert payout for the owner.
        //     scheduled_at = booking_date at last_slot_end_time PLUS hold hours (config).
        //
        //     Midnight assumption: OwnerService enforces closingHour.isAfter(openingHour) at
        //     sub-court creation, which means closingHour > openingHour in LocalTime ordering.
        //     Therefore no slot can have end_time = 00:00 or span midnight — the latest valid
        //     closing is 23:59. scheduled_at is always a time AFTER the game ends.
        LocalDateTime gameEnd = bookingDate.atTime(lastSlotEnd);
        LocalDateTime scheduledAt = gameEnd.plusHours(payoutHoldHours);

        Payout payout = new Payout();
        payout.setOwner(sc.getTurf().getOwner());
        payout.setBooking(booking);
        payout.setAmount(ownerPayout);
        payout.setStatus(PayoutStatus.PENDING);
        payout.setScheduledAt(scheduledAt);
        payoutRepository.save(payout);

        // 8. Emit owner-directed NEW_BOOKING notification.
        //    DECISIONS.md §5: owner-directed ONLY; NO customer-facing notification of any kind.
        Notification notification = new Notification();
        notification.setUser(sc.getTurf().getOwner());
        notification.setType("NEW_BOOKING");
        notification.setMessage("New booking for " + sc.getTurf().getName()
                + " (" + sc.getName() + ") on " + bookingDate);
        notificationRepository.save(notification);

        // 9. Build and return response.
        List<ConfirmBookingResponse.SlotWithRate> responseSlots = slots.stream()
                .map(s -> new ConfirmBookingResponse.SlotWithRate(
                        TIME_FMT.format(s[0]), TIME_FMT.format(s[1]), rateAtBooking))
                .collect(Collectors.toList());

        return new ConfirmBookingResponse(
                booking.getId(),
                booking.getStatus().name(),
                sc.getId(),
                sc.getName(),
                sc.getTurf().getName(),
                bookingDate.toString(),
                responseSlots,
                totalAmount,
                payment.getId(),
                req.razorpayPaymentId(),
                booking.getCreatedAt() != null ? booking.getCreatedAt().toString() : null
        );
    }

    // -------------------------------------------------------------------------
    // Endpoint 3: receipt — read-only JSON receipt for a confirmed/completed/
    //             cancelled/refunded booking. DECISIONS.md §4: 400 (NEVER 422)
    //             for disallowed status; 404 for not-found or not-owned (no-leak).
    // -------------------------------------------------------------------------

    public ReceiptResponse getReceipt(User customer, Long bookingId) {
        // 1. Fetch booking — 404 if not found.
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

        // 2. Ownership check — 404 (not 403) to avoid leaking existence of other customers' bookings.
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }

        // 3. Status whitelist — DECISIONS.md §4: all four current enum values are allowed.
        //    Defensive guard for any future status additions — reject with 400, NEVER 422.
        BookingStatus status = booking.getStatus();
        if (status != BookingStatus.CONFIRMED && status != BookingStatus.COMPLETED
                && status != BookingStatus.CANCELLED && status != BookingStatus.REFUNDED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Receipt not available for this booking status");
        }

        // 4. Fetch all related data — ZERO writes anywhere below this line.
        SubCourt sc = booking.getSubCourt();
        Turf turf = sc.getTurf();

        CustomerProfile cp = customerProfileRepository.findById(customer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));

        List<BookingSlot> slots = bookingSlotRepository.findByBookingId(bookingId);
        slots.sort(Comparator.comparing(BookingSlot::getStartTime));

        // Payments where booking_id = :bookingId — race-recovery rows (booking_id NULL) excluded
        // by JPQL equality semantics (NULL != :bookingId in InnoDB).
        List<Payment> payments = paymentRepository.findByBookingId(bookingId);

        // Refunds where booking_id = :bookingId — same NULL-exclusion guarantee.
        // Race-recovery refunds (booking_id IS NULL) CANNOT appear on any booking's receipt.
        List<Refund> refunds = refundRepository.findByBookingId(bookingId);

        // 5. Owner payout derived from the locked booking amounts (DECISIONS.md §1).
        BigDecimal ownerPayout = booking.getTotalAmount().subtract(booking.getCommissionAmount());

        // 6. Build response.
        ReceiptResponse.CustomerInfo customerInfo = new ReceiptResponse.CustomerInfo(
                cp.getName(), customer.getEmail(), customer.getPhone());

        ReceiptResponse.TurfInfo turfInfo = new ReceiptResponse.TurfInfo(
                turf.getId(), turf.getName(), turf.getAddress(), turf.getCity(),
                sc.getName(), turf.getOwner().getPhone());

        List<ReceiptResponse.SlotLine> slotLines = slots.stream()
                .map(s -> new ReceiptResponse.SlotLine(
                        TIME_FMT.format(s.getStartTime()),
                        TIME_FMT.format(s.getEndTime()),
                        s.getRateAtBooking()))
                .collect(Collectors.toList());

        ReceiptResponse.PaymentInfo paymentInfo = payments.isEmpty() ? null
                : new ReceiptResponse.PaymentInfo(
                        payments.get(0).getId(),
                        payments.get(0).getGatewayTransactionId(),
                        payments.get(0).getPaymentMethod(),
                        payments.get(0).getCreatedAt() != null
                                ? payments.get(0).getCreatedAt().toString() : null,
                        payments.get(0).getAmount());

        List<ReceiptResponse.RefundInfo> refundInfos = refunds.stream()
                .map(r -> new ReceiptResponse.RefundInfo(
                        r.getId(),
                        r.getAmount(),
                        r.getRazorpayRefundId(),
                        r.getStatus().name(),
                        r.getProcessedAt() != null ? r.getProcessedAt().toString() : null))
                .collect(Collectors.toList());

        return new ReceiptResponse(
                booking.getId(),
                booking.getStatus().name(),
                booking.getCreatedAt() != null ? booking.getCreatedAt().toString() : null,
                customerInfo,
                turfInfo,
                booking.getBookingDate().toString(),
                slotLines,
                booking.getTotalAmount(),
                booking.getCommissionAmount(),
                ownerPayout,
                paymentInfo,
                refundInfos
        );
    }

    // -------------------------------------------------------------------------
    // Endpoint 4: cancel — pre-checks, Razorpay refund (Sequence A), DB writes.
    //             DECISIONS §3: successful-refund → REFUNDED (NOT CANCELLED).
    //             DECISIONS §2: IST-aligned 24h window, config-driven.
    //             6B-i: refund-failure-record writing is a placeholder; hardened in 6B-ii.
    // -------------------------------------------------------------------------

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    @Transactional
    public CancelBookingResponse cancel(User customer, Long bookingId) {

        // ── PRE-CHECKS ──────────────────────────────────────────────────────────
        // All guards run BEFORE any Razorpay call. Ordering is exact per spec.

        // 1. Fetch booking — 404 for both not-found AND not-owned (no-leak pattern).
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (!booking.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
        }

        // 2. Status guard — only CONFIRMED bookings can be cancelled.
        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only confirmed bookings can be cancelled");
        }

        // 3 & 4. Time-window checks — require slots first.
        List<BookingSlot> slots = bookingSlotRepository.findByBookingId(bookingId);
        LocalTime earliestStart = slots.stream()
                .map(BookingSlot::getStartTime)
                .min(LocalTime::compareTo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "Internal server error"));

        // Timezone-correct comparison (DECISIONS §2 + Phase 5 IST hazard):
        // Slot times are wall-clock IST. Resolve to UTC Instant for a safe comparison.
        // Do NOT compare LocalDateTime to LocalDateTime relying on JVM default zone.
        Instant slotStartInstant = booking.getBookingDate().atTime(earliestStart)
                .atZone(IST).toInstant();
        Instant now = Instant.now();

        // 3. Past-slot guard — reject if the slot's wall-clock start has already arrived.
        if (!now.isBefore(slotStartInstant)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot cancel a booking whose start time has passed");
        }

        // 4. 24-hour window guard (DECISIONS §2: config-driven, NOT hardcoded).
        //    Reject if now is NOT more than cancellationWindowHours before slot start.
        Instant cancellationCutoff = slotStartInstant.minus(cancellationWindowHours, ChronoUnit.HOURS);
        if (!now.isBefore(cancellationCutoff)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cancellations must be made at least " + cancellationWindowHours
                            + " hours before the booking start time");
        }

        // ── ZERO-AMOUNT DEFENSIVE PATH ──────────────────────────────────────────
        // Impossible by current booking flow, but per DECISIONS §3: no Razorpay call;
        // status = CANCELLED (NOT REFUNDED — DECISIONS §3 distinction: REFUNDED means
        // money was returned; CANCELLED means no money changed hands).
        if (booking.getTotalAmount().compareTo(BigDecimal.ZERO) == 0) {
            booking.setStatus(BookingStatus.CANCELLED);
            bookingRepository.save(booking);
            cancelPayoutForBooking(bookingId);
            int nullified = nullifySlotActive(slots);
            log.info("Zero-amount cancel: booking {} CANCELLED, {} slots freed", bookingId, nullified);
            emitBookingCancelledNotification(booking);
            return new CancelBookingResponse(booking.getId(), BookingStatus.CANCELLED.name(),
                    LocalDateTime.now().toString(), List.of(), BigDecimal.ZERO);
        }

        // ── SEQUENCE A: RAZORPAY FIRST, THEN DB ─────────────────────────────────
        // Find SUCCESS payments for this booking.
        // booking_id = :bookingId means race-recovery payments (booking_id NULL) are NEVER matched.
        List<Payment> successPayments = paymentRepository.findByBookingIdAndStatus(
                bookingId, PaymentStatus.SUCCESS);

        List<CancelBookingResponse.RefundInfo> refundInfos = new ArrayList<>();
        BigDecimal totalRefunded = BigDecimal.ZERO;

        for (Payment payment : successPayments) {
            JSONObject refundRequest = new JSONObject();
            refundRequest.put("amount",
                    payment.getAmount().multiply(BigDecimal.valueOf(100)).longValue());

            com.razorpay.Refund rzpRefund;
            try {
                rzpRefund = razorpayClient.payments.refund(
                        payment.getGatewayTransactionId(), refundRequest);
            } catch (RazorpayException e) {
                // 6B-i: refund-failure record writing deferred to 6B-ii.
                // Do NOT write any FAILED refund row here — that is 6B-ii's scope.
                // The outer @Transactional will roll back; booking remains CONFIRMED.
                log.error("Razorpay cancel-refund failed for booking {} payment {}: {}",
                        bookingId, payment.getGatewayTransactionId(), e.getMessage());
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Payment refund could not be processed");
            }

            // Razorpay confirmed the refund — write refund row immediately.
            // booking_id = this booking (NOT NULL — this is a cancellation refund, NOT race-recovery).
            Refund refund = new Refund();
            refund.setBooking(booking);
            refund.setPayment(payment);
            refund.setAmount(payment.getAmount());
            refund.setRazorpayRefundId(rzpRefund.get("id"));
            refund.setStatus(RefundStatus.SUCCESS);
            refund.setProcessedAt(LocalDateTime.now());
            refund = refundRepository.save(refund);

            totalRefunded = totalRefunded.add(payment.getAmount());
            refundInfos.add(new CancelBookingResponse.RefundInfo(
                    refund.getId(),
                    refund.getAmount(),
                    refund.getRazorpayRefundId(),
                    refund.getStatus().name(),
                    refund.getProcessedAt().toString()));
        }

        // ── DB WRITES — all in the same outer @Transactional ────────────────────

        // DECISIONS §3: REFUNDED (NOT CANCELLED) for a cancellation with a successful refund.
        booking.setStatus(BookingStatus.REFUNDED);
        bookingRepository.save(booking);

        // Owner will not be paid — cancel the pending payout.
        cancelPayoutForBooking(bookingId);

        // Phase 1 contract: set slot_active = NULL on every booking_slots row so the
        // uq_active_slot unique index releases the slot for re-booking.
        int nullified = nullifySlotActive(slots);
        log.info("Cancel booking {}: {} slot(s) freed (slot_active → NULL)", bookingId, nullified);

        // DECISIONS §5: owner-directed notification ONLY; zero customer-facing notifications.
        emitBookingCancelledNotification(booking);

        return new CancelBookingResponse(
                booking.getId(),
                booking.getStatus().name(),
                LocalDateTime.now().toString(),
                refundInfos,
                totalRefunded
        );
    }

    // ── Cancel helpers ────────────────────────────────────────────────────────

    private void cancelPayoutForBooking(Long bookingId) {
        payoutRepository.findByBookingId(bookingId).ifPresent(payout -> {
            payout.setStatus(PayoutStatus.CANCELLED);
            payoutRepository.save(payout);
        });
    }

    private int nullifySlotActive(List<BookingSlot> slots) {
        for (BookingSlot slot : slots) {
            slot.setSlotActive(null);
            bookingSlotRepository.save(slot);
        }
        return slots.size();
    }

    private void emitBookingCancelledNotification(Booking booking) {
        SubCourt sc = booking.getSubCourt();
        Notification notification = new Notification();
        notification.setUser(sc.getTurf().getOwner());
        notification.setType("BOOKING_CANCELLED");
        notification.setMessage("Booking cancelled for " + sc.getTurf().getName()
                + " (" + sc.getName() + ") on " + booking.getBookingDate());
        notificationRepository.save(notification);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private LocalDate parseDate(String dateStr, String errorMsg) {
        try {
            return LocalDate.parse(dateStr);
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, errorMsg);
        }
    }

    private List<LocalTime[]> parseAndValidateSlots(
            List<InitiateBookingRequest.SlotRequest> reqSlots, SubCourt sc) {
        List<LocalTime[]> parsed = new ArrayList<>();
        for (InitiateBookingRequest.SlotRequest sr : reqSlots) {
            LocalTime start, end;
            try {
                start = LocalTime.parse(sr.startTime(), TIME_FMT);
                end = LocalTime.parse(sr.endTime(), TIME_FMT);
            } catch (DateTimeParseException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid slot configuration");
            }
            if (!end.equals(start.plusHours(1))) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid slot configuration");
            }
            if (start.isBefore(sc.getOpeningHour()) || end.isAfter(sc.getClosingHour())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid slot configuration");
            }
            parsed.add(new LocalTime[]{start, end});
        }

        parsed.sort(Comparator.comparing(s -> s[0]));

        // Verify contiguity: each slot must immediately follow the previous one.
        for (int i = 1; i < parsed.size(); i++) {
            if (!parsed.get(i)[0].equals(parsed.get(i - 1)[1])) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid slot configuration");
            }
        }
        return parsed;
    }

    // Decode the compact pipe-delimited slot string stored in Razorpay notes.
    // Format: "HH:mm-HH:mm|HH:mm-HH:mm|..."
    private List<LocalTime[]> decodeSlotsEncoded(String encoded) {
        List<LocalTime[]> slots = new ArrayList<>();
        for (String part : encoded.split("\\|")) {
            // split("-", 2) guards against any future format change that adds extra dashes.
            String[] times = part.split("-", 2);
            LocalTime start = LocalTime.parse(times[0], TIME_FMT);
            LocalTime end = LocalTime.parse(times[1], TIME_FMT);
            slots.add(new LocalTime[]{start, end});
        }
        slots.sort(Comparator.comparing(s -> s[0]));
        return slots;
    }

    // Fetch the Razorpay payment method string and store it AS-IS in the varchar column.
    // 5B happy path: payment exists; any API failure stores null (5C hardens the mapping).
    private String fetchRazorpayPaymentMethod(String razorpayPaymentId) {
        try {
            com.razorpay.Payment rzpPayment = razorpayClient.payments.fetch(razorpayPaymentId);
            Object method = rzpPayment.get("method");
            return method != null ? method.toString() : null;
        } catch (RazorpayException e) {
            return null;
        }
    }
}
