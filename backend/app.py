import os
import json
import datetime
from functools import wraps
from uuid import UUID

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text, exc
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
from decimal import Decimal

# ---------------------------------------
# Flask & Database Config
# ---------------------------------------
app = Flask(__name__)
CORS(app)

# REQUIRED ENV VARS:
#   SECRET_KEY
#   DATABASE_URL (Supabase "Connection string" > URI)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "a-very-secret-key-for-dev")
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/postgres" # Default for local dev
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ECHO"] = False # Set to True to see generated SQL

db = SQLAlchemy(app)

# ---------------------------------------
# Helper Functions & Custom JSON Encoder
# ---------------------------------------
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, bytes):
            return obj.hex()
        return super().default(self, obj)

app.json_encoder = CustomJSONEncoder

def rows_to_dicts(rows):
    return [dict(r._mapping) for r in rows]

# ---------------------------------------
# SQLAlchemy Models (Reflecting your schema)
# ---------------------------------------
class Participant(db.Model):
    __tablename__ = 'participants'
    id = db.Column(db.BigInteger, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True)
    password_hash = db.Column(db.Text)
    role = db.Column(db.String(50), nullable=False)

class Batch(db.Model):
    __tablename__ = 'batches'
    id = db.Column(db.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    spice_id = db.Column(db.BigInteger, db.ForeignKey('spices.id'), nullable=False)
    current_owner_id = db.Column(db.BigInteger, db.ForeignKey('participants.id'), nullable=False)
    stock = db.relationship('BatchStock', backref='batch', uselist=False, cascade="all, delete-orphan")
    owner = db.relationship('Participant', foreign_keys=[current_owner_id])

class BatchStock(db.Model):
    __tablename__ = 'batch_stock'
    batch_id = db.Column(db.dialects.postgresql.UUID(as_uuid=True), db.ForeignKey('batches.id'), primary_key=True)
    qty_g_available = db.Column(db.Numeric(18, 3), nullable=False)

class Transfer(db.Model):
    __tablename__ = 'transfers'
    id = db.Column(db.BigInteger, primary_key=True)
    batch_id = db.Column(db.dialects.postgresql.UUID(as_uuid=True), db.ForeignKey('batches.id'), nullable=False)
    from_participant_id = db.Column(db.BigInteger, db.ForeignKey('participants.id'), nullable=False)
    to_participant_id = db.Column(db.BigInteger, db.ForeignKey('participants.id'), nullable=False)
    qty_g = db.Column(db.Numeric(18, 3), nullable=False)
    price_per_kg = db.Column(db.Numeric(12, 2))

class BatchComposition(db.Model):
    __tablename__ = 'batch_compositions'
    id = db.Column(db.BigInteger, primary_key=True)
    child_batch_id = db.Column(db.dialects.postgresql.UUID(as_uuid=True), db.ForeignKey('batches.id'), nullable=False)
    source_batch_id = db.Column(db.dialects.postgresql.UUID(as_uuid=True), db.ForeignKey('batches.id'), nullable=False)
    qty_g_used = db.Column(db.Numeric(18, 3), nullable=False)

# Other models can be added as needed (Spices, Locations, etc.)

# ---------------------------------------
# Auth Decorator & Routes
# ---------------------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('x-access-token')
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = Participant.query.get(data['id'])
            if not current_user:
                 return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!', 'error': str(e)}), 401
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not all(k in data for k in ['name', 'email', 'password', 'role']):
        return jsonify({'message': 'Missing required fields'}), 400
    hashed_password = generate_password_hash(data['password'])
    new_user = Participant(name=data['name'], email=data['email'], password_hash=hashed_password, role=data['role'])
    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'New participant registered!'}), 201
    except exc.IntegrityError:
        db.session.rollback()
        return jsonify({'message': 'Email already exists.'}), 409
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Could not register.', 'error': str(e)}), 500

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Could not verify'}), 401
    user = Participant.query.filter_by(email=data['email']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({'message': 'Invalid email or password'}), 401
    token = jwt.encode({
        'id': user.id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
    }, app.config['SECRET_KEY'], "HS256")
    return jsonify({'token': token})

# ---------------------------------------
# Core Logic: Batches & Transactions
# ---------------------------------------

@app.route('/batches', methods=['POST'])
@token_required
def create_batch(current_user):
    """(Farmer only) Create a new origin batch."""
    if current_user.role != 'Farmer':
        return jsonify({'message': 'Only Farmers can create origin batches.'}), 403
    data = request.get_json()
    if not all(k in data for k in ['spice_id', 'quantity_g', 'harvest_date']):
        return jsonify({'message': 'Missing fields: spice_id, quantity_g, harvest_date'}), 400

    try:
        new_batch = Batch(spice_id=data['spice_id'], origin_participant_id=current_user.id, current_owner_id=current_user.id, harvest_date=data['harvest_date'])
        new_batch.stock = BatchStock(qty_g_available=data['quantity_g'])
        db.session.add(new_batch)
        db.session.flush()

        # Manually create the BATCH_CREATED event
        event_sql = text("""
            INSERT INTO batch_events (batch_id, event_type, actor_id, details)
            VALUES (:b_id, 'BATCH_CREATED', :a_id, :details)
        """)
        db.session.execute(event_sql, {'b_id': new_batch.id, 'a_id': current_user.id, 'details': json.dumps({'initial_qty_g': data['quantity_g'], 'harvest_date': data['harvest_date']})})
        db.session.commit()
        return jsonify({'message': 'Batch created successfully', 'batch_id': new_batch.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to create batch', 'error': str(e)}), 500

@app.route('/batches/transfer', methods=['POST'])
@token_required
def transfer_batch(current_user):
    """Transfer a quantity of a batch to another participant."""
    data = request.get_json()
    if not all(k in data for k in ['batch_id', 'to_participant_id', 'quantity_g']):
        return jsonify({'message': 'Missing fields: batch_id, to_participant_id, quantity_g'}), 400

    batch = Batch.query.get(data['batch_id'])
    if not batch or batch.current_owner_id != current_user.id:
        return jsonify({'message': 'Batch not found or you are not the owner.'}), 404

    if batch.stock.qty_g_available < Decimal(data['quantity_g']):
        return jsonify({'message': 'Insufficient quantity available for transfer.'}), 400

    try:
        # The DB trigger 'trigger_update_batch_stock_on_transfer' handles all logic.
        # We just need to insert into the transfers table.
        new_transfer = Transfer(
            batch_id=data['batch_id'],
            from_participant_id=current_user.id,
            to_participant_id=data['to_participant_id'],
            qty_g=data['quantity_g'],
            price_per_kg=data.get('price_per_kg')
        )
        db.session.add(new_transfer)
        # Note: The trigger also updates batch owner if quantity becomes zero.
        # We must manually update the owner on the new partial batch.
        new_owner_batch = Batch(
             spice_id=batch.spice_id,
             origin_participant_id=batch.origin_participant_id,
             current_owner_id=data['to_participant_id'],
             harvest_date=batch.harvest_date
        )
        new_owner_batch.stock = BatchStock(qty_g_available=data['quantity_g'])
        db.session.add(new_owner_batch)
        db.session.flush()

        # Record composition
        composition = BatchComposition(child_batch_id=new_owner_batch.id, source_batch_id=batch.id, qty_g_used=data['quantity_g'])
        db.session.add(composition)
        db.session.commit()
        return jsonify({'message': 'Transfer recorded successfully.'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to record transfer', 'error': str(e)}), 500


@app.route('/batches/split', methods=['POST'])
@token_required
def split_batch(current_user):
    """Split a source batch into multiple new child batches."""
    data = request.get_json()
    if not all(k in data for k in ['source_batch_id', 'child_batches']):
        return jsonify({'message': 'Missing fields: source_batch_id, child_batches'}), 400
    if not isinstance(data['child_batches'], list) or not data['child_batches']:
        return jsonify({'message': 'child_batches must be a non-empty list.'}), 400

    source_batch = Batch.query.get(data['source_batch_id'])
    if not source_batch or source_batch.current_owner_id != current_user.id:
        return jsonify({'message': 'Source batch not found or you are not the owner.'}), 404

    total_split_qty = sum(Decimal(c.get('quantity_g', 0)) for c in data['child_batches'])
    if total_split_qty > source_batch.stock.qty_g_available:
        return jsonify({'message': 'Total split quantity exceeds available stock.'}), 400

    try:
        # 1. Deduct stock from source
        source_batch.stock.qty_g_available -= total_split_qty
        
        # 2. Create child batches and compositions
        for child_data in data['child_batches']:
            qty = Decimal(child_data['quantity_g'])
            new_batch = Batch(spice_id=source_batch.spice_id, origin_participant_id=source_batch.origin_participant_id, current_owner_id=current_user.id, harvest_date=source_batch.harvest_date)
            new_batch.stock = BatchStock(qty_g_available=qty)
            db.session.add(new_batch)
            db.session.flush() # Get the new_batch.id
            
            composition = BatchComposition(child_batch_id=new_batch.id, source_batch_id=source_batch.id, qty_g_used=qty)
            db.session.add(composition)

        # 3. Create a SPLIT event
        event_sql = text("""
            INSERT INTO batch_events (batch_id, event_type, actor_id, details, qty_g_delta)
            VALUES (:b_id, 'SPLIT', :a_id, :details, :delta)
        """)
        db.session.execute(event_sql, {'b_id': source_batch.id, 'a_id': current_user.id, 'details': json.dumps({'children': [c for c in data['child_batches']]}), 'delta': -total_split_qty})

        db.session.commit()
        return jsonify({'message': 'Batch split successfully.'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to split batch', 'error': str(e)}), 500

@app.route('/packages', methods=['POST'])
@token_required
def create_package(current_user):
    """Create a final consumer package from one or more batches."""
    data = request.get_json()
    if not all(k in data for k in ['label_code', 'net_qty_g', 'contents']):
        return jsonify({'message': 'Missing fields: label_code, net_qty_g, contents'}), 400

    try:
        # Start transaction
        package_sql = text("""
            INSERT INTO packages (label_code, net_qty_g, packager_id, current_owner_id)
            VALUES (:lc, :n_qty, :p_id, :o_id) RETURNING id;
        """)
        result = db.session.execute(package_sql, {'lc': data['label_code'], 'n_qty': data['net_qty_g'], 'p_id': current_user.id, 'o_id': current_user.id})
        package_id = result.scalar_one()

        for content in data['contents']:
            # The trigger 'trigger_update_batch_stock_on_package' handles stock deduction
            content_sql = text("""
                INSERT INTO package_contents (package_id, batch_id, qty_g_from_batch)
                VALUES (:p_id, :b_id, :qty);
            """)
            db.session.execute(content_sql, {'p_id': package_id, 'b_id': content['batch_id'], 'qty': content['qty_g_from_batch']})
            # Also create a PACKAGE_CREATED event for the source batch
            event_sql = text("""
                INSERT INTO batch_events (batch_id, event_type, actor_id, details, qty_g_delta)
                VALUES (:b_id, 'PACKAGE_CREATED', :a_id, :details, :delta);
            """)
            db.session.execute(event_sql, {'b_id': content['batch_id'], 'a_id': current_user.id, 'details': json.dumps({'package_id': str(package_id), 'label_code': data['label_code']}), 'delta': -Decimal(content['qty_g_from_batch'])})

        db.session.commit()
        return jsonify({'message': 'Package created successfully', 'package_id': package_id}), 201
    except exc.IntegrityError as e:
        db.session.rollback()
        if 'package_contents_batch_id_fkey' in str(e.orig):
            return jsonify({'message': 'One or more source batches do not exist.'}), 404
        if 'packages_label_code_key' in str(e.orig):
            return jsonify({'message': 'This label code is already in use.'}), 409
        return jsonify({'message': 'Database integrity error.', 'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': 'Failed to create package', 'error': str(e)}), 500


# ---------------------------------------
# Public Verification Route
# ---------------------------------------
@app.route('/verify/<label_code>', methods=['GET'])
def verify_package_history(label_code):
    """Public endpoint to get the full farm-to-consumer history of a package."""
    sql = text("""
    WITH RECURSIVE full_lineage AS (
        -- Anchor: Start with the batches directly in the package
        SELECT 
            pc.batch_id as lineage_batch_id,
            1 as depth
        FROM packages p
        JOIN package_contents pc ON p.id = pc.package_id
        WHERE p.label_code = :label_code

        UNION ALL

        -- Recursive step: Find all parent batches
        SELECT
            bc.source_batch_id as lineage_batch_id,
            fl.depth + 1
        FROM full_lineage fl
        JOIN batch_compositions bc ON fl.lineage_batch_id = bc.child_batch_id
    )
    -- Final SELECT: Get all events for all batches in the entire lineage
    SELECT 
        -- Event Details
        be.event_time,
        be.event_type,
        be.details,
        be.qty_g_delta,
        
        -- Batch Details
        b.id as batch_id,
        b.harvest_date,
        s.name as spice_name,
        s.varietal as spice_varietal,

        -- Actor Details
        actor.name as actor_name,
        actor.role as actor_role,
        
        -- Location Details
        loc.name as location_name
    FROM full_lineage fl
    JOIN batch_events be ON fl.lineage_batch_id = be.batch_id
    JOIN batches b ON be.batch_id = b.id
    JOIN spices s ON b.spice_id = s.id
    JOIN participants actor ON be.actor_id = actor.id
    LEFT JOIN locations loc ON be.at_location_id = loc.id
    ORDER BY be.event_time ASC;
    """)

    package_info_sql = text("""
        SELECT p.packaged_at, p.net_qty_g, pr.name as packager_name
        FROM packages p
        JOIN participants pr ON p.packager_id = pr.id
        WHERE p.label_code = :label_code;
    """)

    try:
        package_res = db.session.execute(package_info_sql, {'label_code': label_code}).first()
        if not package_res:
            return jsonify({'message': 'Package with this label code not found.'}), 404
        
        history_res = db.session.execute(sql, {'label_code': label_code}).fetchall()
        
        response = {
            'label_code': label_code,
            'packaged_at': package_res.packaged_at,
            'packager': package_res.packager_name,
            'net_quantity_g': package_res.net_qty_g,
            'spice': history_res[0].spice_name if history_res else 'N/A',
            'history': rows_to_dicts(history_res)
        }
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'message': 'An error occurred during verification', 'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)