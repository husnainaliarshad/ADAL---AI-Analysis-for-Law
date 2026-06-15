"""
Export Neon Data via Application Code
This bypasses pg_dump and uses your existing database connection
to export data in smaller chunks, avoiding transfer quota issues
"""
import os
import json
import csv
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker

load_dotenv()

def export_table_to_json(db_session, table_name, output_file, batch_size=1000):
    """Export a table to JSON file in batches"""
    print(f"  Exporting {table_name}...")
    
    try:
        # Get total count
        count_result = db_session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        total_rows = count_result.scalar()
        print(f"    Total rows: {total_rows}")
        
        if total_rows == 0:
            print(f"    [SKIP] Table is empty")
            return True
        
        # Export in batches
        exported = 0
        all_data = []
        
        offset = 0
        while offset < total_rows:
            query = text(f"SELECT * FROM {table_name} LIMIT {batch_size} OFFSET {offset}")
            result = db_session.execute(query)
            
            # Convert rows to dictionaries
            batch_data = []
            for row in result:
                row_dict = {}
                for key, value in row._mapping.items():
                    # Handle datetime and other non-serializable types
                    if hasattr(value, 'isoformat'):
                        row_dict[key] = value.isoformat()
                    elif value is None:
                        row_dict[key] = None
                    else:
                        row_dict[key] = str(value)
                batch_data.append(row_dict)
            
            all_data.extend(batch_data)
            exported += len(batch_data)
            offset += batch_size
            
            print(f"    Progress: {exported}/{total_rows} rows ({exported*100//total_rows if total_rows > 0 else 0}%)")
            
            if len(batch_data) < batch_size:
                break
        
        # Write to JSON file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, indent=2, ensure_ascii=False)
        
        file_size = os.path.getsize(output_file) / (1024 * 1024)
        print(f"    [OK] Exported {exported} rows to {output_file.name} ({file_size:.2f} MB)")
        return True
        
    except Exception as e:
        print(f"    [ERROR] Failed to export {table_name}: {e}")
        return False

def export_table_schema(db_session, table_name, output_file):
    """Export table schema (CREATE TABLE statement)"""
    try:
        # Get table schema
        query = text(f"""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = :table_name
            AND table_schema = 'public'
            ORDER BY ordinal_position
        """)
        
        result = db_session.execute(query, {"table_name": table_name})
        columns = result.fetchall()
        
        if not columns:
            return False
        
        # Build CREATE TABLE statement (simplified)
        schema_lines = [f"-- Table: {table_name}\n"]
        schema_lines.append(f"CREATE TABLE IF NOT EXISTS {table_name} (\n")
        
        col_defs = []
        for col in columns:
            col_name = col[0]
            col_type = col[1]
            max_length = col[2]
            nullable = col[3]
            default = col[4]
            
            # Build column definition
            if max_length:
                col_def = f"    {col_name} {col_type}({max_length})"
            else:
                col_def = f"    {col_name} {col_type}"
            
            if nullable == 'NO':
                col_def += " NOT NULL"
            
            if default:
                col_def += f" DEFAULT {default}"
            
            col_defs.append(col_def)
        
        schema_lines.append(",\n".join(col_defs))
        schema_lines.append("\n);\n")
        
        # Append to schema file
        with open(output_file, 'a', encoding='utf-8') as f:
            f.write("\n".join(schema_lines))
        
        return True
        
    except Exception as e:
        print(f"    [ERROR] Failed to export schema for {table_name}: {e}")
        return False

def get_all_tables(db_session):
    """Get list of all tables in the database"""
    try:
        query = text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        result = db_session.execute(query)
        return [row[0] for row in result]
    except Exception as e:
        print(f"[ERROR] Failed to get table list: {e}")
        return []

def main():
    """Main export function"""
    print("="*60)
    print("  Neon Data Export via Application")
    print("  (Bypasses transfer quota by using existing connection)")
    print("="*60)
    print()
    
    # Get Neon connection string
    neon_url = os.getenv("DATABASE_URL") or os.getenv("NEON_DATABASE_URL")
    
    if not neon_url or "neon.tech" not in neon_url:
        print("[ERROR] Neon connection string not found in DATABASE_URL or NEON_DATABASE_URL")
        print("Please set DATABASE_URL in your .env file")
        return
    
    print(f"Connecting to Neon database...")
    
    try:
        # Create engine and session
        engine = create_engine(neon_url, pool_pre_ping=True)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        
        print("[OK] Connected to Neon database\n")
        
        # Create backup directory
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path("backups") / f"neon_export_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        print(f"Backup directory: {backup_dir.absolute()}\n")
        
        # Get all tables
        print("Discovering tables...")
        tables = get_all_tables(db)
        print(f"[OK] Found {len(tables)} tables\n")
        
        if not tables:
            print("[WARNING] No tables found in database")
            return
        
        # Export schema
        schema_file = backup_dir / "schema.sql"
        print(f"[1/2] Exporting schemas to {schema_file.name}...")
        with open(schema_file, 'w', encoding='utf-8') as f:
            f.write("-- Neon Database Schema Export\n")
            f.write(f"-- Exported: {datetime.now().isoformat()}\n\n")
        
        schema_count = 0
        for table in tables:
            if export_table_schema(db, table, schema_file):
                schema_count += 1
        
        print(f"[OK] Exported {schema_count}/{len(tables)} table schemas\n")
        
        # Export data
        print(f"[2/2] Exporting data...")
        data_dir = backup_dir / "data"
        data_dir.mkdir(exist_ok=True)
        
        success_count = 0
        for table in tables:
            data_file = data_dir / f"{table}.json"
            if export_table_to_json(db, table, data_file):
                success_count += 1
            print()  # Blank line between tables
        
        # Summary
        print("="*60)
        print("  Export Summary")
        print("="*60)
        print(f"\nTables found: {len(tables)}")
        print(f"Schemas exported: {schema_count}")
        print(f"Data exported: {success_count}")
        print(f"\nBackup directory: {backup_dir.absolute()}")
        print("\nFiles created:")
        print(f"  - schema.sql (all table definitions)")
        print(f"  - data/ (JSON files for each table)")
        
        print("\n" + "="*60)
        print("Next Steps:")
        print("1. Review exported files")
        print("2. Import to Supabase or local PostgreSQL")
        print("3. Use the JSON files to restore data")
        print("="*60)
        
        db.close()
        
    except Exception as e:
        print(f"\n[ERROR] Export failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nExport cancelled by user")
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()

