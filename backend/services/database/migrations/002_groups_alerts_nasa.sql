CREATE TABLE crew_groups (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'crew',
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT crew_groups_kind_known CHECK (kind IN ('crew', 'family')),
    CONSTRAINT crew_groups_name_present CHECK (length(btrim(name)) > 0)
);

ALTER TABLE crew_members ADD COLUMN group_id uuid REFERENCES crew_groups (id);
ALTER TABLE crew_members ADD COLUMN share_mode text NOT NULL DEFAULT 'full';
ALTER TABLE crew_members ADD CONSTRAINT crew_members_share_mode_known
    CHECK (share_mode IN ('full', 'alerts_only'));

ALTER TABLE health_readings DROP CONSTRAINT health_readings_source_known;
ALTER TABLE health_readings ADD CONSTRAINT health_readings_source_known
    CHECK (source IN ('simulated', 'manual', 'upload'));
ALTER TABLE health_readings ADD COLUMN origin text NOT NULL DEFAULT 'simulated';
ALTER TABLE health_readings ADD CONSTRAINT health_readings_origin_known
    CHECK (origin IN ('simulated', 'real'));

CREATE TABLE lab_results (
    id uuid PRIMARY KEY,
    crew_member_id uuid NOT NULL REFERENCES crew_members (id) ON DELETE CASCADE,
    timepoint text NOT NULL,
    days_from_launch integer NOT NULL,
    panel text NOT NULL,
    analyte text NOT NULL,
    value_numeric double precision,
    unit text NOT NULL,
    ref_low double precision,
    ref_high double precision,
    flag text,
    source_study text NOT NULL,
    origin text NOT NULL DEFAULT 'real',
    CONSTRAINT lab_results_origin_real CHECK (origin = 'real'),
    CONSTRAINT lab_results_flag_known CHECK (flag IS NULL OR flag IN ('low', 'normal', 'high')),
    CONSTRAINT lab_results_unique UNIQUE (crew_member_id, timepoint, panel, analyte, source_study)
);

CREATE INDEX lab_results_crew_analyte_idx
    ON lab_results (crew_member_id, analyte, days_from_launch);

CREATE TABLE radiation_readings (
    recorded_at timestamptz NOT NULL,
    instrument_id text NOT NULL,
    absorbed_dose_rate double precision NOT NULL,
    dose_equivalent_rate double precision,
    origin text NOT NULL DEFAULT 'real',
    CONSTRAINT radiation_readings_origin_real CHECK (origin = 'real'),
    CONSTRAINT radiation_readings_pk PRIMARY KEY (recorded_at, instrument_id)
);

CREATE TABLE space_weather_events (
    sep_id text PRIMARY KEY,
    event_time timestamptz NOT NULL,
    instruments text NOT NULL,
    link text NOT NULL,
    linked_events text,
    origin text NOT NULL DEFAULT 'real',
    CONSTRAINT space_weather_events_origin_real CHECK (origin = 'real')
);

CREATE TABLE dataset_loads (
    filename text PRIMARY KEY,
    row_count integer NOT NULL,
    loaded_at timestamptz NOT NULL DEFAULT now()
);
