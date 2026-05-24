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
public class QueryService {

    private final CustomerQueryRepository queryRepository;
    private final ComplaintNoteRepository noteRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final StaffProfileRepository staffProfileRepository;

    public QueryService(CustomerQueryRepository queryRepository,
                        ComplaintNoteRepository noteRepository,
                        CustomerProfileRepository customerProfileRepository,
                        StaffProfileRepository staffProfileRepository) {
        this.queryRepository = queryRepository;
        this.noteRepository = noteRepository;
        this.customerProfileRepository = customerProfileRepository;
        this.staffProfileRepository = staffProfileRepository;
    }

    // ── Customer: create query ────────────────────────────────────────────────

    @Transactional
    public CustomerQueryDetailResponse createQuery(User customer, CreateQueryRequest req) {
        CustomerQuery q = new CustomerQuery();
        q.setCustomer(customer);
        q.setSubject(req.subject().trim());
        q.setDescription(req.description().trim());
        q.setStatus(SupportTicketStatus.OPEN);
        q = queryRepository.save(q);
        return toCustomerDetail(q);
    }

    // ── Customer: list own queries ────────────────────────────────────────────

    public QueryListResponse listCustomerQueries(User customer, int page, int pageSize) {
        int size = Math.min(Math.max(pageSize, 1), 50);
        int pg = Math.max(page, 1);
        Page<CustomerQuery> result = queryRepository.findByCustomerId(
                customer.getId(), PageRequest.of(pg - 1, size));
        List<QueryListResponse.QueryItem> items = result.getContent().stream()
                .map(q -> new QueryListResponse.QueryItem(
                        q.getId(), q.getSubject(), q.getStatus().name(),
                        q.getCreatedAt() != null ? q.getCreatedAt().toString() : null))
                .collect(Collectors.toList());
        int totalPages = (int) Math.max(1, Math.ceil((double) result.getTotalElements() / size));
        return new QueryListResponse(pg, size, result.getTotalElements(), totalPages, items);
    }

    // ── Customer: query detail ────────────────────────────────────────────────

    public CustomerQueryDetailResponse getCustomerQuery(User customer, Long queryId) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        if (!q.getCustomer().getId().equals(customer.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found");
        }
        return toCustomerDetail(q);
    }

    // ── Staff: list queries (pool or mine) ────────────────────────────────────

    public StaffQueryListResponse listStaffQueries(User staff, String status, boolean mine) {
        List<CustomerQuery> queries;
        if (mine) {
            // Claimed by this staff regardless of status param.
            queries = queryRepository.findByPickedUpByStaffId(staff.getId());
        } else {
            // Pool view — default OPEN unless overridden.
            SupportTicketStatus s = status != null ? parseStatus(status) : SupportTicketStatus.OPEN;
            queries = queryRepository.findByStatus(s, PageRequest.of(0, 200)).getContent();
        }
        List<StaffQueryListResponse.QueryItem> items = queries.stream().map(q -> {
            List<ComplaintNote> notes = mine ? noteRepository.findByQueryId(q.getId()) : List.of();
            return new StaffQueryListResponse.QueryItem(
                    q.getId(),
                    q.getCustomer().getId(),
                    customerName(q),
                    q.getSubject(),
                    q.getStatus().name(),
                    q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
                    toNoteItems(notes));
        }).collect(Collectors.toList());
        return new StaffQueryListResponse(items);
    }

    // ── Staff: query detail (only if claimed by this staff) ───────────────────

    public StaffQueryDetailResponse getStaffQuery(User staff, Long queryId) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        if (q.getPickedUpByStaff() == null || !q.getPickedUpByStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found");
        }
        List<ComplaintNote> notes = noteRepository.findByQueryId(q.getId());
        return new StaffQueryDetailResponse(
                q.getId(), q.getCustomer().getId(), customerName(q),
                q.getSubject(), q.getDescription(), q.getStatus().name(),
                q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
                toNoteItems(notes));
    }

    // ── Staff: atomic claim ───────────────────────────────────────────────────

    @Transactional
    public ClaimQueryResponse claimQuery(User staff, Long queryId) {
        // Confirm the query exists at all (404 if not found).
        if (!queryRepository.existsById(queryId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found");
        }

        // Atomic UPDATE WHERE status = OPEN. Returns 1 if this transaction won.
        int updated = queryRepository.claimQuery(
                queryId, staff, SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This query has already been claimed");
        }

        // claimed_at is derived at claim time — NOT persisted (DECISIONS §8).
        String claimedAt = LocalDateTime.now().toString();
        return new ClaimQueryResponse(queryId, SupportTicketStatus.IN_PROGRESS.name(),
                staff.getId(), claimedAt);
    }

    // ── Staff: add note ───────────────────────────────────────────────────────

    @Transactional
    public AddNoteResponse staffAddQueryNote(User staff, Long queryId, AddNoteRequest req) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        if (q.getPickedUpByStaff() == null || !q.getPickedUpByStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found");
        }
        if (q.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot add notes to a resolved query");
        }
        return writeNote(q, staff, req.note().trim());
    }

    // ── Staff: resolve ────────────────────────────────────────────────────────

    @Transactional
    public ResolveQueryResponse staffResolveQuery(User staff, Long queryId, StaffResolveRequest req) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        if (q.getPickedUpByStaff() == null || !q.getPickedUpByStaff().getId().equals(staff.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found");
        }
        return doResolve(q, staff, req.resolutionNote());
    }

    // ── Admin: list queries ───────────────────────────────────────────────────

    public AdminQueryListResponse listAdminQueries(String statusParam, int page, int pageSize) {
        int size = Math.min(Math.max(pageSize, 1), 50);
        int pg = Math.max(page, 1);
        Page<CustomerQuery> result;
        if (statusParam != null) {
            result = queryRepository.findByStatus(parseStatus(statusParam), PageRequest.of(pg - 1, size));
        } else {
            result = queryRepository.findAllPaged(PageRequest.of(pg - 1, size));
        }
        List<AdminQueryListResponse.QueryItem> items = result.getContent().stream()
                .map(q -> toAdminItem(q, noteRepository.findByQueryId(q.getId())))
                .collect(Collectors.toList());
        int totalPages = (int) Math.max(1, Math.ceil((double) result.getTotalElements() / size));
        return new AdminQueryListResponse(pg, size, result.getTotalElements(), totalPages, items);
    }

    // ── Admin: query detail ───────────────────────────────────────────────────

    public AdminQueryDetailResponse getAdminQuery(Long queryId) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        return toAdminDetail(q, noteRepository.findByQueryId(q.getId()));
    }

    // ── Admin: resolve query ──────────────────────────────────────────────────

    @Transactional
    public ResolveQueryResponse adminResolveQuery(User admin, Long queryId, ResolveQueryRequest req) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        return doResolve(q, admin, req.resolutionNote());
    }

    // ── Admin: add note ───────────────────────────────────────────────────────

    @Transactional
    public AddNoteResponse adminAddQueryNote(User admin, Long queryId, AddNoteRequest req) {
        CustomerQuery q = queryRepository.findById(queryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Query not found"));
        if (q.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot add notes to a resolved query");
        }
        return writeNote(q, admin, req.note().trim());
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private ResolveQueryResponse doResolve(CustomerQuery q, User author, String resolutionNote) {
        if (q.getStatus() == SupportTicketStatus.OPEN) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Query must be claimed before resolution");
        }
        if (q.getStatus() == SupportTicketStatus.RESOLVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Query is already resolved");
        }
        // Write resolution note (XOR: query_id SET, complaint_id NULL).
        ComplaintNote note = new ComplaintNote();
        note.setQuery(q);
        note.setAuthor(author);
        note.setNoteText(resolutionNote.trim());
        note = noteRepository.save(note);

        q.setStatus(SupportTicketStatus.RESOLVED);
        q.setResolutionText(resolutionNote.trim());
        q.setResolvedAt(LocalDateTime.now());
        queryRepository.save(q);

        return new ResolveQueryResponse(q.getId(), q.getStatus().name(),
                note.getId(), q.getResolvedAt().toString());
    }

    private AddNoteResponse writeNote(CustomerQuery q, User author, String text) {
        ComplaintNote note = new ComplaintNote();
        note.setQuery(q);       // XOR: query_id SET
        // complaint_id left null (default) — XOR enforced application-side.
        note.setAuthor(author);
        note.setNoteText(text);
        note = noteRepository.save(note);
        return new AddNoteResponse(
                note.getId(), q.getId(), author.getId(), note.getNoteText(),
                note.getCreatedAt() != null ? note.getCreatedAt().toString() : null);
    }

    private CustomerQueryDetailResponse toCustomerDetail(CustomerQuery q) {
        return new CustomerQueryDetailResponse(
                q.getId(), q.getSubject(), q.getDescription(), q.getStatus().name(),
                q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
                q.getResolvedAt() != null ? q.getResolvedAt().toString() : null);
    }

    private AdminQueryDetailResponse toAdminDetail(CustomerQuery q, List<ComplaintNote> notes) {
        String staffName = staffName(q);
        return new AdminQueryDetailResponse(
                q.getId(), q.getCustomer().getId(), customerName(q),
                q.getSubject(), q.getDescription(), q.getStatus().name(),
                q.getPickedUpByStaff() != null ? q.getPickedUpByStaff().getId() : null,
                staffName,
                q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
                q.getResolvedAt() != null ? q.getResolvedAt().toString() : null,
                toNoteItems(notes));
    }

    private AdminQueryListResponse.QueryItem toAdminItem(CustomerQuery q, List<ComplaintNote> notes) {
        return new AdminQueryListResponse.QueryItem(
                q.getId(), q.getCustomer().getId(), customerName(q),
                q.getSubject(), q.getStatus().name(),
                q.getPickedUpByStaff() != null ? q.getPickedUpByStaff().getId() : null,
                staffName(q),
                q.getCreatedAt() != null ? q.getCreatedAt().toString() : null,
                q.getResolvedAt() != null ? q.getResolvedAt().toString() : null,
                toNoteItems(notes));
    }

    private List<AdminComplaintListResponse.NoteItem> toNoteItems(List<ComplaintNote> notes) {
        return notes.stream()
                .map(n -> new AdminComplaintListResponse.NoteItem(
                        n.getId(), n.getAuthor().getId(), n.getNoteText(),
                        n.getCreatedAt() != null ? n.getCreatedAt().toString() : null))
                .collect(Collectors.toList());
    }

    private String customerName(CustomerQuery q) {
        return customerProfileRepository.findById(q.getCustomer().getId())
                .map(CustomerProfile::getName).orElse("Unknown");
    }

    private String staffName(CustomerQuery q) {
        if (q.getPickedUpByStaff() == null) return null;
        return staffProfileRepository.findById(q.getPickedUpByStaff().getId())
                .map(StaffProfile::getName).orElse("Unknown");
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
