"""
End-to-end HTTP tests for all ADAL chat endpoints.

Hits the live server — make sure it's running before executing this.

Usage:
    python test_chat_endpoints.py
    python test_chat_endpoints.py --base-url http://localhost:9006  # custom port
"""

import sys
import json
import argparse
import requests
from datetime import datetime

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
parser = argparse.ArgumentParser()
parser.add_argument("--base-url", default="http://localhost:9006", help="Base URL of the running server")
args = parser.parse_args()

BASE = args.base_url.rstrip("/")
CHAT = f"{BASE}/api/chat"
HEADERS = {"Content-Type": "application/json"}

# Shared state across tests
state = {
    "conversation_id": None,
    "message_id": None,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
PASS = "✅"
FAIL = "❌"
results = []


def check(name, response, expected_status, validators=None):
    """Assert status code and run optional field validators against the JSON body."""
    ok = response.status_code == expected_status
    body = {}

    try:
        body = response.json()
    except Exception:
        body = {"raw": response.text}

    if ok and validators:
        for field, check_fn in validators.items():
            val = body.get(field)
            if not check_fn(val):
                ok = False
                print(f"  {FAIL} Field '{field}' failed validation. Got: {val!r}")
                break

    icon = PASS if ok else FAIL
    status_note = f"(got {response.status_code}, expected {expected_status})" if not ok else ""
    print(f"  {icon} {name} {status_note}")

    if not ok:
        print(f"     Response: {json.dumps(body, indent=6, default=str)[:400]}")

    results.append((name, ok))
    return body if ok else None


def section(title):
    print(f"\n{'─' * 55}")
    print(f"  {title}")
    print(f"{'─' * 55}")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_send_new_message():
    """POST /chat/send — no conversation_id → auto-creates one."""
    section("1. Send message (new conversation)")
    r = requests.post(f"{CHAT}/send", headers=HEADERS, json={
        "message": "What is Article 10-A of the Constitution of Pakistan?"
    })
    body = check("POST /chat/send creates conversation + returns response", r, 200, {
        "conversation_id": lambda v: isinstance(v, int) and v > 0,
        "message_id":      lambda v: isinstance(v, int) and v > 0,
        "response":        lambda v: isinstance(v, str) and len(v) > 10,
        "role":            lambda v: v == "assistant",
    })
    if body:
        state["conversation_id"] = body["conversation_id"]
        state["message_id"] = body["message_id"]
        print(f"     → conversation_id={state['conversation_id']}, message_id={state['message_id']}")
        print(f"     → response preview: {body['response'][:120]}...")


def test_send_followup_message():
    """POST /chat/send — with conversation_id → continues the conversation."""
    section("2. Send follow-up message (existing conversation)")
    if not state["conversation_id"]:
        print(f"  ⚠ Skipped — no conversation_id from previous test")
        return

    r = requests.post(f"{CHAT}/send", headers=HEADERS, json={
        "message": "Can you give me a one-sentence summary?",
        "conversation_id": state["conversation_id"],
    })
    check("POST /chat/send continues existing conversation", r, 200, {
        "conversation_id": lambda v: v == state["conversation_id"],
        "response":        lambda v: isinstance(v, str) and len(v) > 5,
        "role":            lambda v: v == "assistant",
    })


def test_list_conversations():
    """GET /chat/conversations — should include our conversation."""
    section("3. List conversations")
    r = requests.get(f"{CHAT}/conversations", headers=HEADERS)
    body = check("GET /chat/conversations returns a list", r, 200)
    if body is not None:
        assert isinstance(body, list), "Expected a list"
        ids = [c["id"] for c in body]
        found = state["conversation_id"] in ids
        icon = PASS if found else FAIL
        print(f"  {icon} Our conversation_id ({state['conversation_id']}) is in the list")
        results.append(("conversation appears in list", found))
        if body:
            print(f"     → {len(body)} conversation(s) returned")


def test_get_conversation():
    """GET /chat/conversations/{id} — fetch the specific conversation."""
    section("4. Get single conversation")
    if not state["conversation_id"]:
        print("  ⚠ Skipped")
        return

    r = requests.get(f"{CHAT}/conversations/{state['conversation_id']}", headers=HEADERS)
    check("GET /chat/conversations/{id} returns correct conversation", r, 200, {
        "id":             lambda v: v == state["conversation_id"],
        "total_messages": lambda v: isinstance(v, int) and v >= 2,  # user + assistant
    })


def test_get_conversation_not_found():
    """GET /chat/conversations/999999 — should 404."""
    section("5. Get non-existent conversation (expect 404)")
    r = requests.get(f"{CHAT}/conversations/999999", headers=HEADERS)
    check("GET /chat/conversations/999999 returns 404", r, 404)


def test_get_messages():
    """GET /chat/conversations/{id}/messages — should have at least 2 messages (user + assistant)."""
    section("6. Get message history")
    if not state["conversation_id"]:
        print("  ⚠ Skipped")
        return

    r = requests.get(f"{CHAT}/conversations/{state['conversation_id']}/messages", headers=HEADERS)
    body = check("GET /chat/conversations/{id}/messages returns message list", r, 200)
    if body is not None:
        assert isinstance(body, list), "Expected a list"
        print(f"     → {len(body)} message(s) in conversation")
        roles = [m["role"] for m in body]
        has_user      = "user" in roles
        has_assistant = "assistant" in roles
        print(f"  {'✅' if has_user else '❌'} Has user message(s)")
        print(f"  {'✅' if has_assistant else '❌'} Has assistant message(s)")
        results.append(("messages contain user role", has_user))
        results.append(("messages contain assistant role", has_assistant))

        # Check chronological order
        timestamps = [m["created_at"] for m in body]
        ordered = timestamps == sorted(timestamps)
        print(f"  {'✅' if ordered else '❌'} Messages in chronological order")
        results.append(("messages chronologically ordered", ordered))


def test_update_title():
    """PUT /chat/conversations/{id}/title — rename the conversation."""
    section("7. Rename conversation")
    if not state["conversation_id"]:
        print("  ⚠ Skipped")
        return

    new_title = f"ADAL Test — {datetime.utcnow().strftime('%H:%M:%S')}"
    r = requests.put(
        f"{CHAT}/conversations/{state['conversation_id']}/title",
        headers=HEADERS,
        json={"title": new_title},
    )
    body = check("PUT /chat/conversations/{id}/title updates title", r, 200, {
        "title": lambda v: v == new_title,
    })
    if body:
        print(f"     → new title: {body['title']}")


def test_create_blank_conversation():
    """POST /chat/conversations — explicit creation without sending a message."""
    section("8. Create blank conversation")
    r = requests.post(f"{CHAT}/conversations", headers=HEADERS, json={"title": "Blank Test Conv"})
    body = check("POST /chat/conversations creates blank conversation", r, 200, {
        "id":             lambda v: isinstance(v, int) and v > 0,
        "title":          lambda v: v == "Blank Test Conv",
        "total_messages": lambda v: v == 0,
    })
    if body:
        # Store for deletion test
        state["blank_conv_id"] = body["id"]
        print(f"     → created id={body['id']}")


def test_delete_blank_conversation():
    """DELETE /chat/conversations/{id} — delete the blank one we just made."""
    section("9. Delete blank conversation")
    conv_id = state.get("blank_conv_id")
    if not conv_id:
        print("  ⚠ Skipped")
        return

    r = requests.delete(f"{CHAT}/conversations/{conv_id}", headers=HEADERS)
    check("DELETE /chat/conversations/{id} returns success", r, 200)

    # Confirm it's gone
    r2 = requests.get(f"{CHAT}/conversations/{conv_id}", headers=HEADERS)
    gone = r2.status_code == 404
    print(f"  {'✅' if gone else '❌'} Deleted conversation now returns 404")
    results.append(("deleted conversation is gone (404)", gone))


def test_delete_main_conversation():
    """DELETE /chat/conversations/{id} — clean up the main test conversation."""
    section("10. Delete main test conversation (cleanup)")
    if not state["conversation_id"]:
        print("  ⚠ Skipped")
        return

    r = requests.delete(f"{CHAT}/conversations/{state['conversation_id']}", headers=HEADERS)
    check("DELETE main conversation succeeds", r, 200)

    # Messages should also be gone
    r2 = requests.get(
        f"{CHAT}/conversations/{state['conversation_id']}/messages", headers=HEADERS
    )
    msgs_gone = r2.status_code == 404
    print(f"  {'✅' if msgs_gone else '❌'} Messages also gone after conversation delete (404)")
    results.append(("messages gone after conversation delete", msgs_gone))


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def main():
    print(f"\n{'=' * 55}")
    print(f"  ADAL Chat Endpoint Tests")
    print(f"  Server: {BASE}")
    print(f"  Time:   {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"{'=' * 55}")

    # Check server is up first
    try:
        r = requests.get(f"{BASE}/api/health", timeout=5)
        print(f"\n  Server reachable ✅  (health: {r.status_code})")
    except requests.exceptions.ConnectionError:
        print(f"\n  ❌ Cannot reach server at {BASE}")
        print("     Make sure uvicorn is running before running this script.")
        sys.exit(1)

    # Run all tests in order
    test_send_new_message()
    test_send_followup_message()
    test_list_conversations()
    test_get_conversation()
    test_get_conversation_not_found()
    test_get_messages()
    test_update_title()
    test_create_blank_conversation()
    test_delete_blank_conversation()
    test_delete_main_conversation()

    # Summary
    total  = len(results)
    passed = sum(1 for _, ok in results if ok)
    failed = total - passed

    print(f"\n{'=' * 55}")
    print(f"  Results: {passed}/{total} passed", end="")
    if failed:
        print(f"  ({failed} failed)")
        print(f"\n  Failed tests:")
        for name, ok in results:
            if not ok:
                print(f"    ❌ {name}")
    else:
        print()
        print(f"\n  🎉 All chat endpoints working!")
    print(f"{'=' * 55}\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
