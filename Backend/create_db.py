print("SCRIPT STARTED")

import sqlite3
import os
print("current folder:",os.getcwd())

# Create database file
conn = sqlite3.connect("contacts.db")

# Create cursor
cursor = conn.cursor()

# Create table
cursor.execute("""CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,phone TEXT NOT NULL UNIQUE)""")

conn.commit()
conn.close()

print("Database created successfully!")