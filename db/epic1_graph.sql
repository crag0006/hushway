-- EPIC-1: routable graph, CBD landmarks, and pre-aggregated hourly profile.
-- Safe to re-run. Replaces the unusable OSM-derived graph.

DROP TABLE IF EXISTS graph_edge CASCADE;
DROP TABLE IF EXISTS graph_node CASCADE;

-- Graph nodes are sensor locations, so every node carries real coordinates.
CREATE TABLE graph_node (
    node_id     BIGINT PRIMARY KEY,
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL,
    node_type   VARCHAR(50) NOT NULL DEFAULT 'sensor',
    sensor_id   INT NOT NULL REFERENCES sensor_locations(location_id),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_graph_node_coords ON graph_node(latitude, longitude);

CREATE TABLE graph_edge (
    edge_id            BIGSERIAL PRIMARY KEY,
    from_node_id       BIGINT NOT NULL REFERENCES graph_node(node_id),
    to_node_id         BIGINT NOT NULL REFERENCES graph_node(node_id),
    length_meters      FLOAT NOT NULL,
    street_name        VARCHAR(255),
    is_pedestrian_zone BOOLEAN DEFAULT TRUE,
    nearest_sensor_id  INT REFERENCES sensor_locations(location_id),
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_graph_edge_pair UNIQUE (from_node_id, to_node_id)
);

CREATE INDEX idx_graph_edge_from ON graph_edge(from_node_id);
CREATE INDEX idx_graph_edge_to   ON graph_edge(to_node_id);

-- Named CBD places used for origin/destination selection.
CREATE TABLE IF NOT EXISTS cbd_landmark (
    landmark_id SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,
    kind        VARCHAR(50)  NOT NULL,
    latitude    FLOAT NOT NULL,
    longitude   FLOAT NOT NULL
);

-- Average pedestrian count per sensor per weekday-hour.
-- dow follows PostgreSQL EXTRACT(DOW): 0 = Sunday .. 6 = Saturday.
CREATE TABLE IF NOT EXISTS sensor_hourly_profile (
    location_id  INT NOT NULL REFERENCES sensor_locations(location_id),
    dow          INT NOT NULL CHECK (dow BETWEEN 0 AND 6),
    hourday      INT NOT NULL CHECK (hourday BETWEEN 0 AND 23),
    avg_count    INT NOT NULL,
    sample_count INT NOT NULL,
    PRIMARY KEY (location_id, dow, hourday)
);

CREATE INDEX idx_profile_lookup ON sensor_hourly_profile(dow, hourday);
