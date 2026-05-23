package com.bookmyturf.service;

import com.bookmyturf.model.*;
import com.bookmyturf.repository.BookingRepository;
import com.bookmyturf.repository.PaymentRepository;
import com.bookmyturf.repository.RefundRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Durably records the payment + refund pair that results from a race-condition
 * refund, in a transaction that is INDEPENDENT of the caller's booking transaction.
 *
 * Must live on a separate Spring bean — @Transactional(REQUIRES_NEW) is only
 * honoured when the call goes through the Spring AOP proxy, which means the
 * caller (BookingService) must invoke via an injected reference, not via this.method().
 *
 * Transaction boundary:
 *   Outer tx  (BookingService.confirm, @Transactional):
 *     Holds a SELECT FOR UPDATE (X lock) on sub_courts row.
 *     Creates ZERO rows on the race path.  Throws 409 after this service returns,
 *     which rolls the outer tx back.  Recovery rows are unaffected because they
 *     were already committed by the inner tx below.
 *
 *   Inner tx  (this class, @Transactional REQUIRES_NEW):
 *     Spring suspends the outer tx, starts a fresh DB transaction on a new
 *     connection, commits two rows, then resumes the outer tx.  Even if the
 *     outer tx later rolls back, these rows are durable.
 *
 *     Critically: payments.booking_id and refunds.booking_id are NULL for these
 *     recovery rows.  InnoDB skips FK checks for NULL values, so no shared lock
 *     on sub_courts is ever requested here — the X lock the outer tx holds on
 *     sub_courts causes no conflict.
 *
 * Rows created (race path only):
 *   1. Payment — booking=null, status=SUCCESS (payment was genuinely captured
 *                before race detection). payment_method stored AS-IS from Razorpay.
 *   2. Refund  — booking=null, status=SUCCESS, full amount, Razorpay refund ID.
 *
 * No stub Booking row is created: it is unnecessary (payment_method + razorpay_refund_id
 * already identify the transaction end-to-end) and would require an FK check on
 * sub_courts that deadlocks with the outer tx's X lock.
 */
@Service
public class RaceRefundRecoveryService {

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;

    public RaceRefundRecoveryService(PaymentRepository paymentRepository,
                                     RefundRepository refundRepository,
                                     BookingRepository bookingRepository) {
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.bookingRepository = bookingRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRaceRefund(BigDecimal totalAmount,
                                 String razorpayPaymentId,
                                 String paymentMethod,
                                 String rzpRefundId) {

        // 1. Payment — captured before race detection; booking=null (race path, no booking created).
        //    Status = SUCCESS: the payment was genuinely captured by Razorpay before we detected
        //    the race.  The refund row below records that we returned the money.
        //    payment_method stored AS-IS (opaque gateway string, no whitelist/enum mapping).
        Payment payment = new Payment();
        payment.setBooking(null);
        payment.setAmount(totalAmount);
        payment.setGatewayTransactionId(razorpayPaymentId);
        payment.setPaymentMethod(paymentMethod);
        payment.setStatus(PaymentStatus.SUCCESS);
        paymentRepository.save(payment);

        // 2. Refund — Razorpay confirmed the refund before this method was called.
        //    booking=null for the same reason as the payment above.
        Refund refund = new Refund();
        refund.setBooking(null);
        refund.setAmount(totalAmount);
        refund.setRazorpayRefundId(rzpRefundId);
        refund.setStatus(RefundStatus.SUCCESS);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }

    /**
     * 5C-3 path: race detected, Razorpay refund call itself failed.
     * Commits payment + FAILED-refund pair independently of the outer booking transaction.
     *
     * payment.status = SUCCESS  — the capture happened; we just failed to reverse it.
     * refund.status  = FAILED   — the refund call did not complete; razorpayRefundId is null.
     * refund.payment = payment  — operator queue FK. Query:
     *   SELECT r.id, r.amount, p.gateway_transaction_id
     *   FROM refunds r JOIN payments p ON r.payment_id = p.id
     *   WHERE r.status = 'FAILED'
     * gives every Razorpay payment id that needs manual dashboard remediation.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailedRefund(BigDecimal totalAmount,
                                   String razorpayPaymentId,
                                   String paymentMethod) {

        Payment payment = new Payment();
        payment.setBooking(null);
        payment.setAmount(totalAmount);
        payment.setGatewayTransactionId(razorpayPaymentId);
        payment.setPaymentMethod(paymentMethod);
        payment.setStatus(PaymentStatus.SUCCESS);
        payment = paymentRepository.save(payment);

        Refund refund = new Refund();
        refund.setBooking(null);
        refund.setPayment(payment);
        refund.setAmount(totalAmount);
        refund.setRazorpayRefundId(null);
        refund.setStatus(RefundStatus.FAILED);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }

    /**
     * 6B-ii path: cancellation Razorpay refund call failed.
     * Commits a single FAILED refund row, independently of the outer cancel transaction.
     *
     * booking_id IS NOT NULL — this is a real cancellation attempt against an existing
     *   booking; distinguishes from race-recovery FAILED rows (booking_id IS NULL).
     * payment_id is set     — operator queue FK; lets the queue surface the captured
     *   Razorpay payment ID for manual dashboard remediation.
     * razorpayRefundId = null — the refund call did not complete; no Razorpay refund ID.
     *
     * The booking remains CONFIRMED; slot_active stays 1; payout stays PENDING.
     * The cancellation did not happen — a future retry is eligible.
     *
     * Operator queues:
     *   Race FAILED:        SELECT ... FROM refunds WHERE status='FAILED' AND booking_id IS NULL
     *   Cancellation FAILED: SELECT ... FROM refunds WHERE status='FAILED' AND booking_id IS NOT NULL
     *
     * IDs are passed (not entities) to avoid detached-entity issues across the tx boundary.
     * getReferenceById creates a proxy; only the ID is used for the INSERT FK column.
     */
    /**
     * 6C-iii-2 path: race detected after the customer already paid an additional charge for
     * a PAYMENT reschedule. Razorpay refund succeeded; record the captured-then-refunded pair
     * with booking_id NOT NULL (Q1a decision — a booking exists and the customer paid against
     * it; differs from 5C-2b where booking_id IS NULL because no booking had been created).
     *
     * Transaction boundary: REQUIRES_NEW suspends the caller's outer booking transaction,
     * opens a fresh connection, commits both rows, then resumes. The outer tx rolls back
     * from the 409 throw; these rows survive on the separate committed connection.
     *
     * IDs are passed (not entities) to avoid detached-entity issues across tx boundary.
     * getReferenceById creates a proxy; only the ID column is written on INSERT.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAdditionalChargeRaceRefund(Long bookingId,
                                                 String razorpayPaymentId,
                                                 String rzpRefundId,
                                                 BigDecimal amount,
                                                 String paymentMethod) {
        Booking bookingRef = bookingRepository.getReferenceById(bookingId);

        // Payment row — booking_id NOT NULL (Q1a). Captures the fact that this payment
        // was genuinely taken from the customer for this booking's reschedule attempt.
        Payment payment = new Payment();
        payment.setBooking(bookingRef);
        payment.setGatewayTransactionId(razorpayPaymentId);
        payment.setAmount(amount);
        payment.setPaymentMethod(paymentMethod);
        payment.setStatus(PaymentStatus.SUCCESS);
        payment = paymentRepository.save(payment);

        // Refund row — booking_id NOT NULL (Q1a). Records that the money was returned.
        Refund refund = new Refund();
        refund.setBooking(bookingRef);
        refund.setPayment(payment);
        refund.setAmount(amount);
        refund.setRazorpayRefundId(rzpRefundId);
        refund.setStatus(RefundStatus.SUCCESS);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCancelRefundFailure(Long bookingId, Long paymentId, BigDecimal amount) {
        Booking bookingRef = bookingRepository.getReferenceById(bookingId);
        Payment paymentRef = paymentRepository.getReferenceById(paymentId);

        Refund refund = new Refund();
        refund.setBooking(bookingRef);
        refund.setPayment(paymentRef);
        refund.setAmount(amount);
        refund.setRazorpayRefundId(null);
        refund.setStatus(RefundStatus.FAILED);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }

    /**
     * 6C-iii-3 Site A: reschedule REFUND-case Razorpay refund call failed.
     * Commits a single FAILED refunds row via REQUIRES_NEW; the outer booking
     * transaction is untouched (booking remains CONFIRMED, no slot/payout changes).
     *
     * Structurally identical to recordCancelRefundFailure; named separately to
     * distinguish the source (reschedule-REFUND failure vs cancel failure) in logs.
     *
     * booking_id NOT NULL — a real booking exists; distinct from race-recovery rows (IS NULL).
     * razorpayRefundId = null — call did not complete; no Razorpay refund ID issued.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordRescheduleRefundFailure(Long bookingId, Long paymentId, BigDecimal amount) {
        Booking bookingRef = bookingRepository.getReferenceById(bookingId);
        Payment paymentRef = paymentRepository.getReferenceById(paymentId);

        Refund refund = new Refund();
        refund.setBooking(bookingRef);
        refund.setPayment(paymentRef);
        refund.setAmount(amount);
        refund.setRazorpayRefundId(null);
        refund.setStatus(RefundStatus.FAILED);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }

    /**
     * 6C-iii-3 Site B: PAYMENT-race auto-refund call failed.
     * The customer paid the additional charge (capture succeeded), a slot race was then
     * detected, and the auto-refund call failed. The outer booking tx rolled back, so
     * NO payment record for this capture exists yet. This method writes BOTH:
     *   1. payments row (status=SUCCESS) — records the captured payment; booking_id NOT NULL (Q1a).
     *   2. refunds  row (status=FAILED)  — records the failed refund; razorpayRefundId=null.
     *
     * Symmetric counterpart to recordAdditionalChargeRaceRefund (success path): both write a
     * payments + refunds pair; the success path writes SUCCESS/SUCCESS, this one SUCCESS/FAILED.
     *
     * Why two rows vs one at Site A: Site A's booking already has a SUCCESS payment row in the DB.
     * Site B's additional payment has no DB record (outer tx rolled back); both rows are needed
     * to give the operator queue a complete picture of what was captured and what refund failed.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAdditionalChargeRaceRefundFailure(Long bookingId,
                                                        String razorpayPaymentId,
                                                        BigDecimal amount,
                                                        String paymentMethod) {
        Booking bookingRef = bookingRepository.getReferenceById(bookingId);

        // Payment row — booking_id NOT NULL (Q1a). status=SUCCESS: capture succeeded; only refund failed.
        Payment payment = new Payment();
        payment.setBooking(bookingRef);
        payment.setGatewayTransactionId(razorpayPaymentId);
        payment.setAmount(amount);
        payment.setPaymentMethod(paymentMethod);
        payment.setStatus(PaymentStatus.SUCCESS);
        payment = paymentRepository.save(payment);

        // Refund row — booking_id NOT NULL. razorpayRefundId=null: call did not complete.
        Refund refund = new Refund();
        refund.setBooking(bookingRef);
        refund.setPayment(payment);
        refund.setAmount(amount);
        refund.setRazorpayRefundId(null);
        refund.setStatus(RefundStatus.FAILED);
        refund.setProcessedAt(LocalDateTime.now());
        refundRepository.save(refund);
    }
}
