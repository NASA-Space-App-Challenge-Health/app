ALTER TABLE crew_members ADD COLUMN is_cmo boolean NOT NULL DEFAULT false;

CREATE TABLE indicator_shares (
    crew_member_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    indicator text NOT NULL,
    PRIMARY KEY (crew_member_id, indicator)
);

CREATE TABLE clinical_notes (
    id uuid PRIMARY KEY,
    crew_member_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    kind text NOT NULL,
    body_region text,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT clinical_notes_kind_known CHECK (
        kind IN ('symptom', 'space_sickness', 'eva', 'noise', 'exercise')
    )
);

CREATE TABLE imaging_queue (
    id uuid PRIMARY KEY,
    crew_member_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    body_region text NOT NULL,
    stored_name text NOT NULL,
    note text,
    status text NOT NULL DEFAULT 'queued',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT imaging_queue_status_known CHECK (status = 'queued')
);
