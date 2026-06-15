import os
import sys
from pathlib import Path

# Add project root to python path to allow importing app modules
backend_path = Path(__file__).resolve().parent.parent / "adal-backend"
sys.path.append(str(backend_path))

from app.database.database_manager import get_local_db
from app.models.template_model import Template
from sqlalchemy.orm import Session

def seed_templates():
    templates_dir = Path(__file__).resolve().parent.parent / "templates"
    if not templates_dir.exists() or not templates_dir.is_dir():
        print(f"Directory {templates_dir} does not exist.")
        return

    # Use existing DB connection logic
    db_gen = get_local_db()
    db: Session = next(db_gen)

    try:
        count = 0
        for html_file in templates_dir.glob("*.html"):
            title_with_ext = html_file.name
            title = html_file.stem
            
            with open(html_file, 'r', encoding='utf-8') as f:
                content_html = f.read()

            existing = db.query(Template).filter(Template.title == title).first()
            if existing:
                existing.content_html = content_html
                print(f"Updated: {title}")
            else:
                new_template = Template(
                    title=title,
                    description=f"{title} template",
                    content_html=content_html
                )
                db.add(new_template)
                print(f"Inserted: {title}")
            count += 1
        
        db.commit()
        print(f"Successfully seeded {count} templates.")
    except Exception as e:
        print(f"Error seeding templates: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_templates()
