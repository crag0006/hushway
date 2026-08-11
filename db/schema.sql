-- Sensory-Friendly Navigation - Epic 1 Schema
-- 5 tables: sensors, pedestrian counts (monthly + real-time), graph (nodes + edges)

DROP TABLE IF EXISTS graph_edge CASCADE;
DROP TABLE IF EXISTS graph_node CASCADE;
DROP TABLE IF EXISTS pedestrian_counts_fast_hour CASCADE;
DROP TABLE IF EXISTS pedestrian_counts_hourly CASCADE;
DROP TABLE IF EXISTS sensor_locations CASCADE;

-- TABLE 1: SENSOR_LOCATIONS (Static reference)
CREATE TABLE sensor_locations (
    location_id INT PRIMARY KEY,
    sensor_name VARCHAR(255) NOT NULL,
    sensor_description TEXT,
    installation_date DATE,
    location_type VARCHAR(50),
    status CHAR(1),
    direction_1 VARCHAR(100),
    direction_2 VARCHAR(100),
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sensor_locations_coords ON sensor_locations(latitude, longitude);
CREATE INDEX idx_sensor_locations_type ON sensor_locations(location_type);

-- TABLE 2: PEDESTRIAN_COUNTS_HOURLY (Historical hourly data)
CREATE TABLE pedestrian_counts_hourly (
    id BIGINT PRIMARY KEY,
    location_id INT NOT NULL,
    sensing_date DATE NOT NULL,
    hourday INT NOT NULL CHECK (hourday >= 0 AND hourday <= 23),
    direction_1 INT NOT NULL,
    direction_2 INT NOT NULL,
    total_of_directions INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES sensor_locations(location_id)
);

CREATE INDEX idx_pedestrian_hourly_location ON pedestrian_counts_hourly(location_id);
CREATE INDEX idx_pedestrian_hourly_date ON pedestrian_counts_hourly(sensing_date);
CREATE INDEX idx_pedestrian_hourly_hour ON pedestrian_counts_hourly(hourday);
CREATE INDEX idx_pedestrian_hourly_location_date ON pedestrian_counts_hourly(location_id, sensing_date);

-- TABLE 3: PEDESTRIAN_COUNTS_FAST_HOUR (Real-time minute data)
CREATE TABLE pedestrian_counts_fast_hour (
    location_id INT NOT NULL,
    sensing_datetime TIMESTAMP NOT NULL,
    sensing_date DATE NOT NULL,
    sensing_time TIME NOT NULL,
    direction_1 INT NOT NULL,
    direction_2 INT NOT NULL,
    total_of_directions INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (location_id, sensing_datetime),
    FOREIGN KEY (location_id) REFERENCES sensor_locations(location_id)
);

CREATE INDEX idx_pedestrian_fast_hour_location ON pedestrian_counts_fast_hour(location_id);
CREATE INDEX idx_pedestrian_fast_hour_datetime ON pedestrian_counts_fast_hour(sensing_datetime);
CREATE INDEX idx_pedestrian_fast_hour_date ON pedestrian_counts_fast_hour(sensing_date);

-- TABLE 4: GRAPH_NODE (Street nodes from OSM)
CREATE TABLE graph_node (
    node_id BIGINT PRIMARY KEY,
    latitude FLOAT,
    longitude FLOAT,
    node_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_graph_node_coords ON graph_node(latitude, longitude);
CREATE INDEX idx_graph_node_type ON graph_node(node_type);

CREATE TABLE graph_edge (
    edge_id BIGINT PRIMARY KEY,
    from_node_id BIGINT NOT NULL,
    to_node_id BIGINT NOT NULL,
    length_meters FLOAT,
    street_name VARCHAR(255),
    is_pedestrian_zone BOOLEAN,
    nearest_sensor_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_node_id) REFERENCES graph_node(node_id),
    FOREIGN KEY (to_node_id) REFERENCES graph_node(node_id),
    FOREIGN KEY (nearest_sensor_id) REFERENCES sensor_locations(location_id)
);

CREATE INDEX idx_graph_edge_from ON graph_edge(from_node_id);
CREATE INDEX idx_graph_edge_to ON graph_edge(to_node_id);
CREATE INDEX idx_graph_edge_sensor ON graph_edge(nearest_sensor_id);
CREATE INDEX idx_graph_edge_pedestrian ON graph_edge(is_pedestrian_zone);

-- EPIC 1 SUMMARY
-- Tables: 5
-- Relationships:
--   SENSOR_LOCATIONS 1:N PEDESTRIAN_COUNTS_HOURLY
--   SENSOR_LOCATIONS 1:N PEDESTRIAN_COUNTS_FAST_HOUR
--   GRAPH_NODE 1:N GRAPH_EDGE (from/to)
--   GRAPH_EDGE (optional) N:1 SENSOR_LOCATIONS (nearest_sensor)
--
-- Features:
--   1. Show crowded streets (sensors + pedestrian counts)
--   2. Allow route selection (graph nodes + edges)
--   3. Real-time sensory load heatmap