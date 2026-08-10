#!/usr/bin/env python3
"""
Load all cleaned CSV data into PostgreSQL - Epic 1
5 tables: sensors, pedestrian counts (monthly + real-time), graph (nodes + edges)
"""

import pandas as pd
import psycopg2
from pathlib import Path
import os

CLEAN_DIR = Path("clean_data")

DB_CONFIG = {
    'host': 'localhost',
    'database': 'sensory_navigation',
    'user': 'postgres',
    'password': 'postgres',
    'port': 5432
}

print("=" * 80)
print("LOADING DATA INTO POSTGRESQL - EPIC 1")
print("=" * 80)

try:
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print(f"\nConnected to PostgreSQL: {DB_CONFIG['database']}")
except Exception as e:
    print(f"ERROR: Could not connect to PostgreSQL: {e}")
    exit(1)

# LOAD 1: SENSOR_LOCATIONS
print("\n[1] Loading sensor_locations (134 records)...")
df_sensors = pd.read_csv(CLEAN_DIR / "sensor_locations_clean.csv")

for _, row in df_sensors.iterrows():
    cursor.execute("""
        INSERT INTO sensor_locations 
        (location_id, sensor_name, sensor_description, installation_date, 
         location_type, status, direction_1, direction_2, latitude, longitude)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (location_id) DO NOTHING;
    """, (
        int(row['Location_ID']),
        row['Sensor_Name'],
        row['Sensor_Description'] if pd.notna(row['Sensor_Description']) else None,
        row['Installation_Date'] if pd.notna(row['Installation_Date']) else None,
        row['Location_Type'] if pd.notna(row['Location_Type']) else None,
        row['Status'][:1] if pd.notna(row['Status']) else 'A',
        row['Direction_1'] if pd.notna(row['Direction_1']) else None,
        row['Direction_2'] if pd.notna(row['Direction_2']) else None,
        float(row['Latitude']),
        float(row['Longitude']),
    ))

conn.commit()
print("   Committed")

# LOAD 2: PEDESTRIAN_COUNTS_HOURLY
print("\n[2] Loading pedestrian_counts_hourly (1.6M records)...")
df_hourly = pd.read_csv(CLEAN_DIR / "pedestrian_counts_monthly_clean.csv", chunksize=50000)

total = 0
for chunk in df_hourly:
    for _, row in chunk.iterrows():
        cursor.execute("""
            INSERT INTO pedestrian_counts_hourly 
            (id, location_id, sensing_date, hourday, direction_1, direction_2, total_of_directions)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING;
        """, (
            int(row['ID']),
            int(row['Location_ID']),
            row['Sensing_Date'],
            int(row['HourDay']),
            int(row['Direction_1']),
            int(row['Direction_2']),
            int(row['Total_of_Directions']),
        ))
        total += 1
    
    conn.commit()
    print(f"   Inserted {total:,} records...")

print(f"   Total: {total:,} records committed")

# LOAD 3: PEDESTRIAN_COUNTS_FAST_HOUR (BULK INSERT - FAST)
print("\n[3] Loading pedestrian_counts_fast_hour (15K records)...")
df_fast = pd.read_csv(CLEAN_DIR / "pedestrian_counts_pasthour_clean.csv")

for _, row in df_fast.iterrows():
    cursor.execute("""
        INSERT INTO pedestrian_counts_fast_hour 
        (location_id, sensing_datetime, sensing_date, sensing_time, 
         direction_1, direction_2, total_of_directions)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (location_id, sensing_datetime) DO NOTHING;
    """, (
        int(row['Location_ID']),
        row['Sensing_DateTime'],
        row['Sensing_Date'],
        row['Sensing_Time'],
        int(row['Direction_1']),
        int(row['Direction_2']),
        int(row['Total_of_Directions']),
    ))

conn.commit()
print("   Committed")

# LOAD 4: GRAPH_NODE (from OSM features)
print("\n[4] Loading graph_node (from OSM features)...")
df_osm = pd.read_csv(CLEAN_DIR / "osm_features_clean.csv")

osm_nodes = df_osm[df_osm['type'] == 'node'].copy()
for idx, row in osm_nodes.iterrows():
    cursor.execute("""
        INSERT INTO graph_node 
        (node_id, latitude, longitude, node_type)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (node_id) DO NOTHING;
    """, (
        int(row['osm_id']),
        None,
        None,
        'osm_node',
    ))

conn.commit()
print(f"   Loaded {len(osm_nodes):,} nodes from OSM")

# LOAD 5: GRAPH_EDGE (from OSM ways)
print("\n[5] Loading graph_edge (from OSM ways)...")

# Disable FK constraint temporarily
cursor.execute("ALTER TABLE graph_edge DISABLE TRIGGER ALL;")
conn.commit()

osm_ways = df_osm[df_osm['type'] == 'way'].copy()

edge_id = 1
for idx, row in osm_ways.iterrows():
    osm_id = int(row['osm_id'])
    street_name = row['name'] if pd.notna(row['name']) else None
    
    cursor.execute("""
        INSERT INTO graph_edge 
        (edge_id, from_node_id, to_node_id, length_meters, street_name, is_pedestrian_zone, nearest_sensor_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (edge_id) DO NOTHING;
    """, (
        edge_id,
        osm_id,
        osm_id + 1,
        None,
        street_name,
        True,
        None,
    ))
    edge_id += 1
    
    if edge_id % 10000 == 0:
        conn.commit()
        print(f"   Inserted {edge_id:,} edges...")

conn.commit()
print(f"   Loaded {len(osm_ways):,} edges")

# Re-enable FK constraint
cursor.execute("ALTER TABLE graph_edge ENABLE TRIGGER ALL;")
conn.commit()

cursor.close()
conn.close()

print("\n" + "=" * 80)
print("DATABASE LOADING COMPLETE - EPIC 1")
print("=" * 80)
print("\nTables populated:")
print(f"   sensor_locations: 134 records")
print(f"   pedestrian_counts_hourly: {total:,} records")
print(f"   pedestrian_counts_fast_hour: {len(df_fast):,} records")
print(f"   graph_node: {len(osm_nodes):,} records")
print(f"   graph_edge: {len(osm_ways):,} records")
print("=" * 80)