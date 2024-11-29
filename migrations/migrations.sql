create table
  public.pins (
    id serial,
    user_id uuid not null,
    x double precision not null,
    y double precision not null,
    created_at timestamp without time zone null default now(),
    constraint pins_pkey primary key (id)
  ) tablespace pg_default;

ALTER TABLE public.pins
ADD COLUMN geom geometry(Point, 4326);

CREATE OR REPLACE FUNCTION set_geom_from_coordinates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geom := ST_SetSRID(ST_MakePoint(NEW.x, NEW.y), 4326);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = extensions, public;

CREATE TRIGGER pins_geom_trigger
BEFORE INSERT ON public.pins
FOR EACH ROW
EXECUTE FUNCTION set_geom_from_coordinates();

UPDATE public.pins
SET geom = ST_SetSRID(ST_MakePoint(x, y), 4326);

CREATE INDEX pins_geom_idx
ON public.pins
USING GIST (geom);
