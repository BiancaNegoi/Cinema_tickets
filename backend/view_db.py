import sqlite3

# Conectează-te la baza de date
conn = sqlite3.connect("tickets.db")
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Afișează toate evenimentele
print("Evenimente:")
cursor.execute("SELECT * FROM events")
for row in cursor.fetchall():
    print(dict(row))

# Afișează toate biletele
print("\nBilete:")
cursor.execute("SELECT * FROM tickets")
for row in cursor.fetchall():
    print(dict(row))

conn.close()
