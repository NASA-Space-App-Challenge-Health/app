CREATE TABLE reference_ranges (
    id bigserial PRIMARY KEY,
    analyte text NOT NULL,
    unit text NOT NULL,
    ref_low double precision,
    ref_high double precision,
    panel text NOT NULL
);

CREATE UNIQUE INDEX reference_ranges_natural
    ON reference_ranges (analyte, unit, panel, ref_low, ref_high) NULLS NOT DISTINCT;

CREATE TABLE dataset_catalog (
    dataset_id text PRIMARY KEY,
    title text NOT NULL,
    official_url text,
    files text,
    size_bytes bigint,
    what_it_contains text,
    license_access text
);
