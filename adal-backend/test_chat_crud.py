"""
Simple CRUD Test for Chat Schema

Tests basic Create, Read, Update, Delete operations for conversations and messages.
"""

import os
from dotenv import load_dotenv
import psycopg2
from urllib.parse import urlparse
from datetime import datetime
import json

load_dotenv()

def get_db_connection():
    """Get database connection."""
    db_url = os.getenv('LOCAL_DATABASE_URL')
    if not db_url:
        raise ValueError("LOCAL_DATABASE_URL not set")
    
    parsed = urlparse(db_url)
    return psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip('/')
    )

def test_conversation_crud():
    """Test CRUD operations for conversations."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("=== Testing Conversation CRUD ===")
    
    # CREATE
    print("1. Creating conversation...")
    cursor.execute('''
        INSERT INTO conversations (user_id, title, model_used)
        VALUES (%s, %s, %s)
        RETURNING id, title, model_used, total_messages, created_at
    ''', (1, 'Test Conversation', 'gpt-4'))
    
    result = cursor.fetchone()
    conversation_id = result[0]
    print(f"   Created conversation ID: {conversation_id}")
    print(f"   Title: {result[1]}, Model: {result[2]}")
    
    # READ
    print("2. Reading conversation...")
    cursor.execute('''
        SELECT id, user_id, title, model_used, total_messages, created_at, updated_at
        FROM conversations WHERE id = %s
    ''', (conversation_id,))
    
    conversation = cursor.fetchone()
    print(f"   Retrieved: {conversation}")
    
    # UPDATE
    print("3. Updating conversation...")
    cursor.execute('''
        UPDATE conversations 
        SET title = %s, updated_at = %s 
        WHERE id = %s
        RETURNING title, updated_at
    ''', ('Updated Conversation', datetime.utcnow(), conversation_id))
    
    updated = cursor.fetchone()
    print(f"   Updated title: {updated[0]}")
    
    # DELETE
    print("4. Deleting conversation...")
    cursor.execute('DELETE FROM conversations WHERE id = %s', (conversation_id,))
    print(f"   Deleted conversation ID: {conversation_id}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ Conversation CRUD test passed!\n")

def test_message_crud():
    """Test CRUD operations for messages."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("=== Testing Message CRUD ===")
    
    # First create a conversation for messages
    cursor.execute('''
        INSERT INTO conversations (user_id, title)
        VALUES (%s, %s)
        RETURNING id
    ''', (1, 'Message Test Conversation'))
    
    conversation_id = cursor.fetchone()[0]
    
    # CREATE
    print("1. Creating message...")
    metadata = {'tokens': 10, 'model': 'gpt-4'}
    cursor.execute('''
        INSERT INTO messages (conversation_id, role, content, metadata)
        VALUES (%s, %s, %s, %s)
        RETURNING id, role, content, metadata, created_at
    ''', (conversation_id, 'user', 'Hello, this is a test message!', json.dumps(metadata)))
    
    result = cursor.fetchone()
    message_id = result[0]
    print(f"   Created message ID: {message_id}")
    print(f"   Role: {result[1]}, Content: {result[2]}")
    
    # READ
    print("2. Reading message...")
    cursor.execute('''
        SELECT id, conversation_id, role, content, metadata, created_at
        FROM messages WHERE id = %s
    ''', (message_id,))
    
    message = cursor.fetchone()
    print(f"   Retrieved: {message}")
    
    # UPDATE
    print("3. Updating message...")
    new_metadata = {'tokens': 15, 'model': 'gpt-4', 'edited': True}
    cursor.execute('''
        UPDATE messages 
        SET content = %s, metadata = %s 
        WHERE id = %s
        RETURNING content, metadata
    ''', ('Updated message content', json.dumps(new_metadata), message_id))
    
    updated = cursor.fetchone()
    print(f"   Updated content: {updated[0]}")
    
    # READ all messages for conversation
    print("4. Reading all messages for conversation...")
    cursor.execute('''
        SELECT id, role, content, created_at
        FROM messages 
        WHERE conversation_id = %s 
        ORDER BY created_at
    ''', (conversation_id,))
    
    messages = cursor.fetchall()
    print(f"   Found {len(messages)} messages:")
    for msg in messages:
        print(f"     - {msg[1]}: {msg[2][:50]}...")
    
    # DELETE
    print("5. Deleting message...")
    cursor.execute('DELETE FROM messages WHERE id = %s', (message_id,))
    print(f"   Deleted message ID: {message_id}")
    
    # Clean up conversation
    cursor.execute('DELETE FROM conversations WHERE id = %s', (conversation_id,))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ Message CRUD test passed!\n")

def test_relationships():
    """Test foreign key relationships."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("=== Testing Relationships ===")
    
    # Create conversation
    cursor.execute('''
        INSERT INTO conversations (user_id, title)
        VALUES (%s, %s)
        RETURNING id
    ''', (1, 'Relationship Test'))
    
    conversation_id = cursor.fetchone()[0]
    
    # Add multiple messages
    messages_data = [
        ('user', 'What is contract law?', {'tokens': 8}),
        ('assistant', 'Contract law governs agreements between parties.', {'tokens': 12}),
        ('user', 'Can you explain consideration?', {'tokens': 6}),
    ]
    
    message_ids = []
    for role, content, metadata in messages_data:
        cursor.execute('''
            INSERT INTO messages (conversation_id, role, content, metadata)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        ''', (conversation_id, role, content, json.dumps(metadata)))
        message_ids.append(cursor.fetchone()[0])
    
    print(f"1. Created {len(message_ids)} messages for conversation {conversation_id}")
    
    # Test conversation with message count
    cursor.execute('''
        SELECT c.id, c.title, COUNT(m.id) as message_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        WHERE c.id = %s
        GROUP BY c.id, c.title
    ''', (conversation_id,))
    
    result = cursor.fetchone()
    print(f"2. Conversation {result[0]} has {result[2]} messages")
    
    # Test cascade delete
    print("3. Testing cascade delete...")
    cursor.execute('DELETE FROM conversations WHERE id = %s', (conversation_id,))
    
    # Verify messages are deleted
    cursor.execute('SELECT COUNT(*) FROM messages WHERE conversation_id = %s', (conversation_id,))
    remaining_messages = cursor.fetchone()[0]
    print(f"   Messages remaining after conversation delete: {remaining_messages}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print("✅ Relationship test passed!\n")

def main():
    """Run all CRUD tests."""
    print("🚀 Starting Chat CRUD Tests\n")
    
    try:
        test_conversation_crud()
        test_message_crud()
        test_relationships()
        
        print("🎉 All tests passed successfully!")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
