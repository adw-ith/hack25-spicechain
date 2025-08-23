import os
import json
import datetime
from functools import wraps
from uuid import UUID
from flask_cors import CORS

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

# ---------------------------------------
# Flask & Database Config
# ---------------------------------------
app = Flask(__name__)
CORS(app)

# REQUIRED ENV VARS:
#   SECRET_KEY
#   DATABASE_URL (Supabase "Connection string" > URI)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "change-me-in-prod")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ---------------------------------------
# Local Auth Table (separate from participants)
# ---------------------------------------
class User(db.Model):
    __tablename__ = "auth_users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

# ---------------------------------------
# Helpers
# ---------------------------------------
def rows_to_dicts(rows):
    # Works with SQLAlchemy Row objects
    return [dict(r._mapping) for r in rows]

def row_to_dict(row):
    return dict(row._mapping) if row else None

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("x-access-token") or request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return jsonify({"error": "Token missing"}), 401
        try:
            data = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            current_user = db.session.get(User, data["id"])
            if not current_user:
                return jsonify({"error": "User not found"}), 401
        except Exception as e:
            return jsonify({"error": "Invalid token", "detail": str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def validate_uuid(u):
    try:
        UUID(str(u))
        return True
    except Exception:
        return False

# ---------------------------------------
# Auth Routes
# ---------------------------------------
@app.post("/signup")
def signup():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already in use"}), 409
    hashed_pw = generate_password_hash(password, method="pbkdf2:sha256")
    user = User(email=email, password_hash=hashed_pw)
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "user created"}), 201

@app.post("/login")
def login():
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401
    token = jwt.encode(
        {"id": user.id, "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=12)},
        app.config["SECRET_KEY"], algorithm="HS256"
    )
    return jsonify({"token": token})

# ---------------------------------------
# Participants
# ---------------------------------------
@app.post("/participants")
@token_required
def add_participant(current_user):
    data = request.get_json(force=True)
    sql = """
      INSERT INTO participants (name, role, contact_info)
      VALUES (%s, %s, %s)
      RETURNING id, name, role, contact_info, created_at;
    """
    res = db.session.execute(sql, (
        data["name"], data["role"], json.dumps(data.get("contact_info", {}))
    )).fetchone()
    db.session.commit()
    return jsonify(row_to_dict(res)), 201

@app.get("/participants")
@token_required
def list_participants(current_user):
    res = db.session.execute("""
      SELECT id, name, role, contact_info, created_at
      FROM participants
      ORDER BY id DESC;
    """).fetchall()
    return jsonify(rows_to_dicts(res))

# ---------------------------------------
# Batches
# ---------------------------------------
@app.post("/batches")
@token_required
def create_batch(current_user):
    data = request.get_json(force=True)
    # Required: spice_id, origin_participant_id, current_owner_id, initial_qty_g
    sql = """
      INSERT INTO batches (spice_id, origin_location_id, origin_participant_id,
                           harvest_date, current_owner_id)
      VALUES (%s, %s, %s, %s, %s)
      RETURNING id;
    """
    res = db.session.execute(sql, (
        data["spice_id"],
        data.get("origin_location_id"),
        data["origin_participant_id"],
        data.get("harvest_date"),
        data["current_owner_id"]
    )).fetchone()
    batch_id = res[0]

    # Initialize stock in grams
    db.session.execute(
        "INSERT INTO batch_stock (batch_id, qty_g_available) VALUES (%s, %s);",
        (batch_id, data["initial_qty_g"])
    )
    # Optional: emit BATCH_CREATED event (manual explicit insert)
    db.session.execute(
        """
        INSERT INTO batch_events (batch_id, event_type, actor_id, details, qty_g_delta)
        VALUES (%s, 'BATCH_CREATED', %s, %s, %s);
        """,
        (batch_id, data["current_owner_id"], json.dumps({"note": "initial creation"}), data["initial_qty_g"])
    )
    db.session.commit()
    return jsonify({"batch_id": str(batch_id)}), 201

@app.get("/batches")
@token_required
def list_batches(current_user):
    res = db.session.execute("""
      SELECT b.id, b.spice_id, b.origin_location_id, b.origin_participant_id,
             b.harvest_date, b.created_at, b.current_owner_id, b.status,
             s.qty_g_available
      FROM batches b
      JOIN batch_stock s ON s.batch_id = b.id
      ORDER BY b.created_at DESC;
    """).fetchall()
    return jsonify(rows_to_dicts(res))

@app.get("/batches/<batch_id>/timeline")
@token_required
def get_batch_timeline(current_user, batch_id):
    if not validate_uuid(batch_id):
        return jsonify({"error": "invalid batch_id"}), 400
    events = db.session.execute("""
      SELECT id, event_time, event_type::text AS event_type, actor_id,
             from_participant_id, to_participant_id, qty_g_delta,
             details, encode(event_hash, 'hex') AS event_hash,
             encode(prev_event_hash, 'hex') AS prev_event_hash
      FROM batch_events
      WHERE batch_id = %s
      ORDER BY event_time ASC, id ASC;
    """, (batch_id,)).fetchall()
    return jsonify(rows_to_dicts(events))

@app.post("/batches/<batch_id>/events")
@token_required
def add_batch_event(current_user, batch_id):
    if not validate_uuid(batch_id):
        return jsonify({"error": "invalid batch_id"}), 400
    data = request.get_json(force=True)
    # event_type must be valid per ENUM
    res = db.session.execute("""
      INSERT INTO batch_events (
        batch_id, event_type, actor_id, at_location_id,
        details, from_participant_id, to_participant_id, qty_g_delta
      )
      VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
      RETURNING id, event_time, encode(event_hash,'hex') AS event_hash;
    """, (
        batch_id, data["event_type"], data["actor_id"], data.get("at_location_id"),
        json.dumps(data.get("details", {})),
        data.get("from_participant_id"), data.get("to_participant_id"),
        data.get("qty_g_delta")
    )).fetchone()
    db.session.commit()
    return jsonify(row_to_dict(res)), 201

# ---------------------------------------
# Transfers (batch-level ownership movement)
# DB triggers should enforce stock & update events; here we only insert
# ---------------------------------------
@app.post("/transfers")
@token_required
def create_transfer(current_user):
    data = request.get_json(force=True)
    res = db.session.execute("""
      INSERT INTO transfers (batch_id, from_user_id, to_user_id, qty_g, price_per_kg, meta)
      VALUES (%s, %s, %s, %s, %s, %s)
      RETURNING id, transaction_time;
    """, (
        data["batch_id"], data["from_user_id"], data["to_user_id"],
        data["qty_g"], data.get("price_per_kg"), json.dumps(data.get("meta", {}))
    )).fetchone()
    db.session.commit()
    return jsonify(row_to_dict(res)), 201

# ---------------------------------------
# Packages
# ---------------------------------------
@app.post("/packages")
@token_required
def create_package(current_user):
    data = request.get_json(force=True)
    # contents: [{batch_id, qty_g_from_batch}, ...]
    res = db.session.execute("""
      INSERT INTO packages (label_code, net_qty_g, packager_id, current_owner_id)
      VALUES (%s, %s, %s, %s)
      RETURNING id;
    """, (
        data["label_code"], data["net_qty_g"], data["packager_id"], data["current_owner_id"]
    )).fetchone()
    package_id = res[0]

    # Insert contents (debited by DB stock triggers if you added them; otherwise ensure you call enforce fn)
    for c in data["contents"]:
        db.session.execute("""
          INSERT INTO package_contents (package_id, batch_id, qty_g_from_batch)
          VALUES (%s, %s, %s);
        """, (package_id, c["batch_id"], c["qty_g_from_batch"]))

        # Optional: emit one batch event per contributing batch (explicit)
        db.session.execute("""
          INSERT INTO batch_events (batch_id, event_type, actor_id, details, qty_g_delta)
          VALUES (%s, 'PACKAGE_CREATED', %s, %s, %s);
        """, (
            c["batch_id"], data["packager_id"],
            json.dumps({"package_id": str(package_id), "label_code": data["label_code"]}),
            -abs(c["qty_g_from_batch"])
        ))

    # Also emit a package event
    db.session.execute("""
      INSERT INTO package_events (package_id, event_type, actor_id, details)
      VALUES (%s, 'PACKAGE_CREATED', %s, %s);
    """, (package_id, data["packager_id"], json.dumps({"label_code": data["label_code"]})))

    db.session.commit()
    return jsonify({"package_id": str(package_id)}), 201

@app.post("/packages/<package_id>/events")
@token_required
def add_package_event(current_user, package_id):
    if not validate_uuid(package_id):
        return jsonify({"error": "invalid package_id"}), 400
    data = request.get_json(force=True)
    res = db.session.execute("""
      INSERT INTO package_events (package_id, event_type, actor_id, details)
      VALUES (%s, %s, %s, %s)
      RETURNING id, event_time, encode(event_hash,'hex') AS event_hash;
    """, (package_id, data["event_type"], data["actor_id"], json.dumps(data.get("details", {})))).fetchone()
    db.session.commit()
    return jsonify(row_to_dict(res)), 201

@app.get("/packages/<package_id>/timeline")
@token_required
def get_package_timeline_by_uuid(current_user, package_id):
    if not validate_uuid(package_id):
        return jsonify({"error": "invalid package_id"}), 400
    res = db.session.execute("""
      SELECT id, event_time, event_type::text AS event_type, actor_id,
             details, encode(event_hash,'hex') AS event_hash,
             encode(prev_event_hash,'hex') AS prev_event_hash
      FROM package_events
      WHERE package_id = %s
      ORDER BY event_time ASC, id ASC;
    """, (package_id,)).fetchall()
    return jsonify(rows_to_dicts(res))

@app.get("/packages/label/<label_code>/timeline")
@token_required
def get_package_timeline_by_label(current_user, label_code):
    res = db.session.execute("""
      SELECT pe.id, pe.event_time, pe.event_type::text AS event_type, pe.actor_id,
             pe.details, encode(pe.event_hash,'hex') AS event_hash,
             encode(pe.prev_event_hash,'hex') AS prev_event_hash
      FROM package_events pe
      JOIN packages p ON p.id = pe.package_id
      WHERE p.label_code = %s
      ORDER BY pe.event_time ASC, pe.id ASC;
    """, (label_code,)).fetchall()
    return jsonify(rows_to_dicts(res))

# Trace: label_code → source batches → origins
@app.get("/packages/<label_code>/trace")
@token_required
def trace_package(current_user, label_code):
    res = db.session.execute("""
      WITH RECURSIVE src_batches AS (
        SELECT pc.batch_id, NULL::UUID AS parent
        FROM packages p
        JOIN package_contents pc ON pc.package_id = p.id
        WHERE p.label_code = %s
        UNION ALL
        SELECT bc.source_batch_id, bc.child_batch_id
        FROM batch_compositions bc
        JOIN src_batches sb ON sb.batch_id = bc.child_batch_id
      )
      SELECT DISTINCT b.id AS batch_id, b.origin_participant_id, b.origin_location_id
      FROM src_batches sb
      JOIN batches b ON b.id = sb.batch_id;
    """, (label_code,)).fetchall()
    return jsonify(rows_to_dicts(res))

# ---------------------------------------
# QA Tests
# ---------------------------------------
@app.post("/qa")
@token_required
def add_qa_test(current_user):
    data = request.get_json(force=True)
    res = db.session.execute("""
      INSERT INTO qa_tests (batch_id, package_id, test_type, result, tested_by_id)
      VALUES (%s, %s, %s, %s, %s)
      RETURNING id, tested_at;
    """, (
        data.get("batch_id"), data.get("package_id"),
        data["test_type"], json.dumps(data["result"]), data.get("tested_by_id")
    )).fetchone()
    db.session.commit()
    return jsonify(row_to_dict(res)), 201

# ---------------------------------------
# Health check
# ---------------------------------------
@app.get("/healthz")
def health():
    try:
        db.session.execute("SELECT 1;")
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ---------------------------------------
# Run
# ---------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
