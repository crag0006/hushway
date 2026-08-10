#!/usr/bin/env python3
"""
Load all cleaned CSV data into PostgreSQL - Epic 1
5 tables: sensors, pedestrian counts (monthly + real-time), graph (nodes + edges)
"""

import pandas as pd
import psycopg2
from pathlib import Path
import os

# Anchored to this file's directory so the script works from any working directory
CLEAN_DIR = Path(__file__).resolve().parent / "clean_data"

DB_CONFIG = {
    'host': os.environ.get('HUSHWAY_DB_HOST', 'localhost'),
    'database': os.environ.get('HUSHWAY_DB_NAME', 'postgres'),
    'user': os.environ.get('HUSHWAY_DB_USER', 'postgres'),
    'password': os.environ.get('HUSHWAY_DB_PASSWORD', ''),
    'port': int(os.environ.get('HUSHWAY_DB_PORT', '5432')),
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

# Graph loading moved to scripts/build_graph.py.
#
# The OSM export in clean_data/ has only osm_sequence_id, type, osm_id and name
# columns: no coordinates and no way-to-node membership. It therefore cannot
# produce a routable graph, and the code that used to live here inserted NULL
# coordinates and fabricated edges as (osm_id -> osm_id + 1), which connected
# nothing. build_graph.py derives a real, connected graph from the 134 sensor
# locations instead. See docs/superpowers/specs/2026-08-10-epic1-backend-design.md
print("\n[4] Graph: run `python scripts/build_graph.py` after this script.")

cursor.close()
conn.close()

print("\n" + "=" * 80)
print("DATABASE LOADING COMPLETE - EPIC 1")
print("=" * 80)
print("\nTables populated:")
print(f"   sensor_locations: 134 records")
print(f"   pedestrian_counts_hourly: {total:,} records")
print(f"   pedestrian_counts_fast_hour: {len(df_fast):,} records")
print("\nNext: python scripts/build_graph.py   (graph, landmarks, hourly profile)")
print("=" * 80)