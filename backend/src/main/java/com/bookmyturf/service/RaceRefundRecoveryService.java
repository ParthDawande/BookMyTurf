package com.bookmyturf.service;

import com.bookmyturf.model.*;
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

    public RaceRefundRecoveryService(PaymentRepository paymentRepository,
                                     RefundRepository refundRepository) {
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
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
}
