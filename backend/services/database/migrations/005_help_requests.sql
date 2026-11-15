-- Help loop: a crew member asks for assistance and another crew member accepts.
-- Unlike alerts (computed per request), help requests are persisted rows with a
-- status, timestamps and an assignee. Free-text reason is private to the CMO,
-- the flight surgeon and the requester.

CREATE TABLE help_requests (
    id uuid PRIMARY KEY,
    requester_crew_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    requester_module text NOT NULL,
    reason_code text NOT NULL,
    reason_text text,
    severity text NOT NULL DEFAULT 'assist',
    status text NOT NULL DEFAULT 'requested',
    accepted_by_crew_id uuid REFERENCES crew_members (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    closed_at timestamptz,
    expires_at timestamptz NOT NULL,
    CONSTRAINT help_requests_status_known CHECK (
        status IN ('requested', 'accepted', 'closed', 'escalated')
    ),
    CONSTRAINT help_requests_severity_known CHECK (
        severity IN ('assist', 'emergency')
    ),
    CONSTRAINT help_requests_reason_known CHECK (
        reason_code IN (
            'injury', 'chest_discomfort', 'breathing', 'dizziness',
            'illness', 'radiation', 'other'
        )
    ),
    CONSTRAINT help_requests_module_len CHECK (
        char_length(requester_module) BETWEEN 1 AND 40
    ),
    CONSTRAINT help_requests_accept_consistency CHECK (
        (status = 'accepted' AND accepted_at IS NOT NULL AND accepted_by_crew_id IS NOT NULL)
        OR status <> 'accepted'
    )
);

CREATE INDEX help_requests_active_idx
    ON help_requests (created_at DESC)
    WHERE status IN ('requested', 'accepted', 'escalated');

CREATE INDEX help_requests_requester_idx
    ON help_requests (requester_crew_id, created_at DESC);
