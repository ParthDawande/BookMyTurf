package com.bookmyturf.service;

import com.bookmyturf.dto.admin.*;
import com.bookmyturf.dto.customer.*;
import com.bookmyturf.dto.staff.*;
import com.bookmyturf.model.*;
import com.bookmyturf.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class ComplaintService {

    private final ComplaintRepository complaintRepository;
    private final ComplaintNoteRepository complaintNoteRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final NotificationRepository notificationRepository;

    public ComplaintService(ComplaintRepository complaintRepository,
                            ComplaintNoteRepository complaintNoteRepository,
                            BookingRepository bookingRepository,
                            UserRepository userRepository,
                            CustomerProfileRepository customerProfileRepository,
                            StaffProfileRepository staffProfileRepository,
                            NotificationRepository notificationRepository) {
        this.complaintRepository = complaintRepository;
        this.complaintNoteRepository = complaintNoteRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.customerProfileRepository = customerProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
        this.notificationRepository = notificationRepository;
    }

    // ── Customer: create complaint ────────────────────────────────────────────

    @Transactional
    public CustomerComplaintDetailResponse createComplaint(User customer, CreateComplaintRequest req) {
        Complaint complaint = new Complaint();
        complaint.setCustomer(customer);
        complaint.setSubject(req.subject().trim());
        complaint.setDescription(req.description().trim());
        complaint.setStatus(SupportTicketStatus.OPEN);

        if (req.bookingId() != null) {
            Booking booking = bookingRepository.findById(req.bookingId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            if (!booking.getCustomer().getId().equals(customer.getId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found");
            }
            complaint.setBooking(booking);
        }

        complaint = complaintRepository.save(complaint);
        return toCustomerDetail(complaint);
    }

    // ── Customer: list complaints ─────────────────────────────────────────────

    public ComplaintListResponse listCustomerComplaints(User customer, int page, int pageSize) {
        int size = Math.min(Math.max(pageSize, 1), 50);
        int pg = Math.max(page, 1);
        Page<Complaint> result = complaintRepository.findByCustomerId(
                customer.getId(), PageRequest.of(pg - 1, size));
        List<ComplaintListResponse.ComplaintItem> items = result.getContent().stream()
                .map(c -> new ComplaintListResponse.ComplaintItem(
                        c.getId(),
                        c.getSubject(),
                        c.getStatus().name(),
                        c.getCreatedAt() != null ? c.getCreatedAt().toString() : null))
                .collect(Collectors.toList());
        int totalPages = (int) Math.max(1, Math.ceil((double) result.getTotalElements() / size));
        return new ComplaintListResponse(pg, size, result.getTotalElements(), totalPages, items);
    }

    // ── Customer: complaint detail ────────────────────────────────────────────

    public CustomerComplaintDetailResponse getCustomerComplaint(User customer, Long complaintId) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        if (!c.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found");
        }
        return toCustomerDetail(c);
    }

    // ── Admin: list complaints ────────────────────────────────────────────────

    public AdminComplaintListResponse listAdminComplaints(String statusParam, int page, int pageSize) {
        int size = Math.min(Math.max(pageSize, 1), 50);
        int pg = Math.max(page, 1);
        Page<Complaint> result;
        if (statusParam != null) {
            SupportTicketStatus status = parseStatus(statusParam);
            result = complaintRepository.findByStatus(status, PageRequest.of(pg - 1, size));
        } else {
            result = complaintRepository.findByStatus(SupportTicketStatus.OPEN, PageRequest.of(pg - 1, size));
        }
        List<Long> ids = result.getContent().stream().map(Complaint::getId).collect(Collectors.toList());
        java.util.Map<Long, List<ComplaintNote>> notesMap = batchLoadNotes(ids);

        List<AdminComplaintListResponse.ComplaintItem> items = result.getContent().stream()
                .map(c -> toAdminItem(c, notesMap.getOrDefault(c.getId(), List.of())))
                .collect(Collectors.toList());
        int totalPages = (int) Math.max(1, Math.ceil((double) result.getTotalElements() / size));
        return new AdminComplaintListResponse(pg, size, result.getTotalElements(), totalPages, items);
    }

    // ── Admin: complaint detail ───────────────────────────────────────────────

    public AdminComplaintDetailResponse getAdminComplaint(Long complaintId) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        List<ComplaintNote> notes = complaintNoteRepository.findByComplaintId(c.getId());
        return toAdminDetail(c, notes);
    }

    // ── Admin: assign complaint ───────────────────────────────────────────────

    @Transactional
    public AssignComplaintResponse assignComplaint(User admin, Long complaintId, AssignComplaintRequest req) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));

        if (c.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot assign a resolved complaint");
        }

        User staff = userRepository.findById(req.staffId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff not found"));
        if (staff.getRole() != Role.STAFF) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "User is not a staff member");
        }

        c.setAssignedStaff(staff);
        c.setAssignedByAdmin(admin);
        c.setStatus(SupportTicketStatus.IN_PROGRESS);
        complaintRepository.save(c);

        // COMPLAINT_ASSIGNED notification to the new staff member.
        Notification notif = new Notification();
        notif.setUser(staff);
        notif.setType("COMPLAINT_ASSIGNED");
        notif.setMessage("You have been assigned complaint #" + c.getId() + ": " + c.getSubject());
        notif.setIsRead(false);
        notificationRepository.save(notif);

        String staffName = staffProfileRepository.findById(staff.getId())
                .map(StaffProfile::getName).orElse("Unknown");
        return new AssignComplaintResponse(c.getId(), staff.getId(), staffName, c.getStatus().name());
    }

    // ── Admin: resolve complaint ──────────────────────────────────────────────

    @Transactional
    public ResolveComplaintResponse resolveComplaint(User admin, Long complaintId,
                                                     ResolveComplaintRequest req) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        return doResolve(c, admin, req.resolutionNote());
    }

    // ── Admin: add note (admin can add notes on any complaint) ────────────────

    @Transactional
    public AddNoteResponse adminAddNote(User admin, Long complaintId, AddNoteRequest req) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        if (c.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot add notes to a resolved complaint");
        }
        return writeNote(c, admin, req.note().trim());
    }

    // ── Staff: list assigned complaints ──────────────────────────────────────

    public StaffComplaintListResponse listStaffComplaints(User staff) {
        List<Complaint> complaints = complaintRepository.findByAssignedStaffId(staff.getId());
        List<Long> ids = complaints.stream().map(Complaint::getId).collect(Collectors.toList());
        java.util.Map<Long, List<ComplaintNote>> notesMap = batchLoadNotes(ids);

        List<StaffComplaintListResponse.ComplaintItem> items = complaints.stream().map(c -> {
            String custName = customerName(c);
            List<AdminComplaintListResponse.NoteItem> noteItems = toNoteItems(
                    notesMap.getOrDefault(c.getId(), List.of()));
            return new StaffComplaintListResponse.ComplaintItem(
                    c.getId(),
                    c.getCustomer().getId(),
                    custName,
                    c.getBooking() != null ? c.getBooking().getId() : null,
                    c.getSubject(),
                    c.getStatus().name(),
                    c.getCreatedAt() != null ? c.getCreatedAt().toString() : null,
                    noteItems);
        }).collect(Collectors.toList());
        return new StaffComplaintListResponse(items);
    }

    // ── Staff: complaint detail (assigned only) ───────────────────────────────

    public StaffComplaintDetailResponse getStaffComplaint(User staff, Long complaintId) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        if (c.getAssignedStaff() == null || !c.getAssignedStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found");
        }
        List<ComplaintNote> notes = complaintNoteRepository.findByComplaintId(c.getId());
        String custName = customerName(c);
        return new StaffComplaintDetailResponse(
                c.getId(),
                c.getCustomer().getId(),
                custName,
                c.getBooking() != null ? c.getBooking().getId() : null,
                c.getSubject(),
                c.getDescription(),
                c.getStatus().name(),
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null,
                toNoteItems(notes));
    }

    // ── Staff: add note ───────────────────────────────────────────────────────

    @Transactional
    public AddNoteResponse staffAddNote(User staff, Long complaintId, AddNoteRequest req) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        // No-leak: staff not assigned to this complaint → 404.
        if (c.getAssignedStaff() == null || !c.getAssignedStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found");
        }
        if (c.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot add notes to a resolved complaint");
        }
        return writeNote(c, staff, req.note().trim());
    }

    // ── Staff: resolve complaint ──────────────────────────────────────────────

    @Transactional
    public ResolveComplaintResponse staffResolve(User staff, Long complaintId,
                                                 StaffResolveRequest req) {
        Complaint c = complaintRepository.findById(complaintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found"));
        // No-leak: only assigned staff can resolve.
        if (c.getAssignedStaff() == null || !c.getAssignedStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Complaint not found");
        }
        return doResolve(c, staff, req.resolutionNote());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ResolveComplaintResponse doResolve(Complaint c, User author, String resolutionNote) {
        if (c.getStatus() == SupportTicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Complaint must be assigned before resolution");
        }
        if (c.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Complaint is already resolved");
        }
        // Write resolution note first (XOR: complaint_id set, query_id null).
        ComplaintNote note = new ComplaintNote();
        note.setComplaint(c);
        note.setAuthor(author);
        note.setNoteText(resolutionNote.trim());
        note = complaintNoteRepository.save(note);

        c.setStatus(SupportTicketStatus.RESOLVED);
        c.setResolutionText(resolutionNote.trim());
        c.setResolvedAt(LocalDateTime.now());
        complaintRepository.save(c);

        return new ResolveComplaintResponse(
                c.getId(),
                c.getStatus().name(),
                note.getId(),
                c.getResolvedAt().toString());
    }

    private AddNoteResponse writeNote(Complaint c, User author, String text) {
        ComplaintNote note = new ComplaintNote();
        note.setComplaint(c);
        note.setAuthor(author);
        note.setNoteText(text);
        note = complaintNoteRepository.save(note);
        return new AddNoteResponse(
                note.getId(),
                c.getId(),
                author.getId(),
                note.getNoteText(),
                note.getCreatedAt() != null ? note.getCreatedAt().toString() : null);
    }

    private CustomerComplaintDetailResponse toCustomerDetail(Complaint c) {
        return new CustomerComplaintDetailResponse(
                c.getId(),
                c.getBooking() != null ? c.getBooking().getId() : null,
                c.getSubject(),
                c.getDescription(),
                c.getStatus().name(),
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null,
                c.getResolvedAt() != null ? c.getResolvedAt().toString() : null);
    }

    private AdminComplaintDetailResponse toAdminDetail(Complaint c, List<ComplaintNote> notes) {
        String custName = customerName(c);
        String staffName = c.getAssignedStaff() != null
                ? staffProfileRepository.findById(c.getAssignedStaff().getId())
                        .map(StaffProfile::getName).orElse("Unknown")
                : null;
        return new AdminComplaintDetailResponse(
                c.getId(),
                c.getCustomer().getId(),
                custName,
                c.getBooking() != null ? c.getBooking().getId() : null,
                c.getSubject(),
                c.getDescription(),
                c.getStatus().name(),
                c.getAssignedStaff() != null ? c.getAssignedStaff().getId() : null,
                staffName,
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null,
                c.getResolvedAt() != null ? c.getResolvedAt().toString() : null,
                toNoteItems(notes));
    }

    private AdminComplaintListResponse.ComplaintItem toAdminItem(Complaint c,
                                                                  List<ComplaintNote> notes) {
        String custName = customerName(c);
        String staffName = c.getAssignedStaff() != null
                ? staffProfileRepository.findById(c.getAssignedStaff().getId())
                        .map(StaffProfile::getName).orElse("Unknown")
                : null;
        return new AdminComplaintListResponse.ComplaintItem(
                c.getId(),
                c.getCustomer().getId(),
                custName,
                c.getBooking() != null ? c.getBooking().getId() : null,
                c.getSubject(),
                c.getStatus().name(),
                c.getAssignedStaff() != null ? c.getAssignedStaff().getId() : null,
                staffName,
                c.getCreatedAt() != null ? c.getCreatedAt().toString() : null,
                c.getResolvedAt() != null ? c.getResolvedAt().toString() : null,
                toNoteItems(notes));
    }

    private List<AdminComplaintListResponse.NoteItem> toNoteItems(List<ComplaintNote> notes) {
        return notes.stream()
                .map(n -> new AdminComplaintListResponse.NoteItem(
                        n.getId(),
                        n.getAuthor().getId(),
                        n.getNoteText(),
                        n.getCreatedAt() != null ? n.getCreatedAt().toString() : null))
                .collect(Collectors.toList());
    }

    private String customerName(Complaint c) {
        return customerProfileRepository.findById(c.getCustomer().getId())
                .map(CustomerProfile::getName).orElse("Unknown");
    }

    private java.util.Map<Long, List<ComplaintNote>> batchLoadNotes(List<Long> complaintIds) {
        if (complaintIds.isEmpty()) return java.util.Collections.emptyMap();
        // Load per-complaint (acceptable for small admin lists; N+1 bounded by page size).
        java.util.Map<Long, List<ComplaintNote>> map = new java.util.HashMap<>();
        for (Long id : complaintIds) {
            map.put(id, complaintNoteRepository.findByComplaintId(id));
        }
        return map;
    }

    private SupportTicketStatus parseStatus(String s) {
        try {
            return SupportTicketStatus.valueOf(s.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid status: " + s + ". Must be OPEN, IN_PROGRESS, or RESOLVED");
        }
    }
}
