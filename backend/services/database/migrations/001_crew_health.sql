CREATE TABLE crew_members (
    id uuid PRIMARY KEY,
    call_sign text NOT NULL UNIQUE,
    full_name text NOT NULL,
    role text NOT NULL,
    mission text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crew_members_call_sign_present CHECK (length(btrim(call_sign)) > 0),
    CONSTRAINT crew_members_full_name_present CHECK (length(btrim(full_name)) > 0),
    CONSTRAINT crew_members_role_present CHECK (length(btrim(role)) > 0),
    CONSTRAINT crew_members_mission_present CHECK (length(btrim(mission)) > 0)
);

CREATE TABLE health_readings (
    id uuid PRIMARY KEY,
    crew_member_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    indicator text NOT NULL,
    value_numeric double precision NOT NULL,
    unit text NOT NULL,
    recorded_at timestamptz NOT NULL,
    source text NOT NULL,
    risk_band text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT health_readings_value_finite CHECK (
        value_numeric = value_numeric
        AND value_numeric > '-Infinity'::double precision
        AND value_numeric < 'Infinity'::double precision
    ),
    CONSTRAINT health_readings_source_known CHECK (source IN ('simulated', 'manual')),
    CONSTRAINT health_readings_risk_known CHECK (risk_band IN ('nominal', 'watch', 'concern')),
    CONSTRAINT health_readings_unit_present CHECK (length(btrim(unit)) > 0)
);

CREATE INDEX health_readings_latest_idx
    ON health_readings (crew_member_id, indicator, recorded_at DESC);
