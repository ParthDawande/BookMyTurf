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
}
