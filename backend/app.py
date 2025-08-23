from flask import Flask, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import uuid
import json
from functools import wraps
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///spicechain.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    coordinate = db.Column(db.String(100))  # For location tracking
    user_type = db.Column(db.String(20), nullable=False)  # farmer, middleman, consumer, quality_officer
    phone = db.Column(db.String(15))
    address = db.Column(db.Text)
    license_number = db.Column(db.String(50))  # For farmers and middlemen
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class Spices(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    scientific_name = db.Column(db.String(100))
    category = db.Column(db.String(50))  # whole, ground, extract
    origin_region = db.Column(db.String(100))
    harvest_season = db.Column(db.String(50))
    shelf_life_months = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Batches(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(50), unique=True, nullable=False)
    farmer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    spice_id = db.Column(db.Integer, db.ForeignKey('spices.id'), nullable=False)
    quantity_kg = db.Column(db.Float, nullable=False)
    harvest_date = db.Column(db.DateTime, nullable=False)
    farm_location = db.Column(db.String(200))
    farming_method = db.Column(db.String(50))  # organic, conventional
    estimated_grade = db.Column(db.String(20))  # A, B, C
    current_owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='harvested')  # harvested, tested, sold, packaged, divided, pending_sale
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # NEW FIELD FOR BATCH DIVISION
    parent_batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=True)
    
    # Existing relationships
    farmer = db.relationship('User', foreign_keys=[farmer_id], backref='farmed_batches')
    current_owner = db.relationship('User', foreign_keys=[current_owner_id])
    spice = db.relationship('Spices', backref='batches')
    
    # NEW RELATIONSHIPS FOR PARENT-CHILD
    parent_batch = db.relationship('Batches', remote_side=[id], backref='sub_batches')


class Package(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.String(50), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False)
    packager_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    quantity_kg = db.Column(db.Float, nullable=False)
    package_date = db.Column(db.DateTime, default=datetime.utcnow)
    package_type = db.Column(db.String(50))  # retail, wholesale, export
    expiry_date = db.Column(db.DateTime)
    current_owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='packaged')  # packaged, shipped, delivered, sold
    qr_code = db.Column(db.String(100))
    
    batch = db.relationship('Batches', backref='packages')
    packager = db.relationship('User', foreign_keys=[packager_id])
    current_owner = db.relationship('User', foreign_keys=[current_owner_id])

class Transactions(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transaction_id = db.Column(db.String(50), unique=True, nullable=False)
    from_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    to_user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'))
    package_id = db.Column(db.Integer, db.ForeignKey('package.id'))
    quantity_kg = db.Column(db.Float, nullable=False)
    price_per_kg = db.Column(db.Float)
    total_amount = db.Column(db.Float)
    transaction_type = db.Column(db.String(20))  # sale, transfer, return
    payment_status = db.Column(db.String(20), default='pending')  # pending, completed, failed
    transaction_date = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text)
    
    from_user = db.relationship('User', foreign_keys=[from_user_id], backref='sent_transactions')
    to_user = db.relationship('User', foreign_keys=[to_user_id], backref='received_transactions')
    batch = db.relationship('Batches', backref='transactions')
    package = db.relationship('Package', backref='transactions')

class Timeline(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'))
    package_id = db.Column(db.Integer, db.ForeignKey('package.id'))
    event_type = db.Column(db.String(50), nullable=False)  # harvest, quality_test, package, sell, ship
    event_description = db.Column(db.Text)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    location = db.Column(db.String(200))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    event_metadata = db.Column(db.Text)  # JSON string for additional data
    
    batch = db.relationship('Batches', backref='timeline_events')
    package = db.relationship('Package', backref='timeline_events')
    user = db.relationship('User', backref='timeline_events')

class QATest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    test_id = db.Column(db.String(50), unique=True, nullable=False)
    batch_id = db.Column(db.Integer, db.ForeignKey('batches.id'), nullable=False)
    tester_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    test_date = db.Column(db.DateTime, default=datetime.utcnow)
    test_type = db.Column(db.String(50))  # moisture, purity, contamination, grade
    test_result = db.Column(db.String(20))  # pass, fail, conditional
    grade_assigned = db.Column(db.String(10))  # A, B, C
    moisture_content = db.Column(db.Float)
    purity_percentage = db.Column(db.Float)
    contamination_level = db.Column(db.String(20))
    notes = db.Column(db.Text)
    certificate_url = db.Column(db.String(200))
    
    batch = db.relationship('Batches', backref='qa_tests')
    tester = db.relationship('User', backref='conducted_tests')

class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50))  # batch, package, transaction, etc.
    resource_id = db.Column(db.String(50))
    old_values = db.Column(db.Text)  # JSON string
    new_values = db.Column(db.Text)  # JSON string
    ip_address = db.Column(db.String(45))
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='audit_logs')

# Helper functions
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def log_action(user_id, action, resource_type, resource_id, old_values=None, new_values=None):
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=request.remote_addr
    )
    db.session.add(log_entry)
    db.session.commit()

def add_timeline_event(batch_id=None, package_id=None, event_type=None, description=None, user_id=None, location=None, event_metadata=None):
    event = Timeline(
        batch_id=batch_id,
        package_id=package_id,
        event_type=event_type,
        event_description=description,
        user_id=user_id,
        location=location,
        event_metadata=json.dumps(event_metadata) if event_metadata else None
    )
    db.session.add(event)
    db.session.commit()

# Routes

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['username', 'email', 'password', 'user_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Validate user type
    valid_user_types = ['farmer', 'middleman', 'consumer', 'quality_officer']
    if data['user_type'] not in valid_user_types:
        return jsonify({'error': 'Invalid user type'}), 400
    
    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        password_hash=generate_password_hash(data['password']),
        user_type=data['user_type'],
        phone=data.get('phone'),
        address=data.get('address'),
        license_number=data.get('license_number'),
        coordinate=data.get('coordinate')
    )
    
    db.session.add(user)
    db.session.commit()
    
    log_action(user.id, 'USER_CREATED', 'user', str(user.id))
    
    return jsonify({
        'message': 'User created successfully',
        'user_id': user.id,
        'user_type': user.user_type
    }), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data.get('username') or not data.get('password'):
        return jsonify({'error': 'Username and password are required'}), 400
    
    user = User.query.filter_by(username=data['username']).first()
    
    if user and check_password_hash(user.password_hash, data['password']) and user.is_active:
        session['user_id'] = user.id
        session['user_type'] = user.user_type
        
        log_action(user.id, 'USER_LOGIN', 'user', str(user.id))
        
        return jsonify({
            'message': 'Login successful',
            'user_id': user.id,
            'user_type': user.user_type
        }), 200
    
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    user_id = session['user_id']
    log_action(user_id, 'USER_LOGOUT', 'user', str(user_id))
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200

@app.route('/api/registerbatch', methods=['POST'])
@login_required
def register_batch():
    if session['user_type'] != 'farmer':
        return jsonify({'error': 'Only farmers can register batches'}), 403
    
    data = request.get_json()
    required_fields = ['spice_id', 'quantity_kg', 'harvest_date', 'farm_location']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Generate unique batch ID
    batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
    
    batch = Batches(
        batch_id=batch_id,
        farmer_id=session['user_id'],
        spice_id=data['spice_id'],
        quantity_kg=data['quantity_kg'],
        harvest_date=datetime.fromisoformat(data['harvest_date'].replace('Z', '+00:00')),
        farm_location=data['farm_location'],
        farming_method=data.get('farming_method', 'conventional'),
        estimated_grade=data.get('estimated_grade', 'B'),
        current_owner_id=session['user_id']
    )
    
    db.session.add(batch)
    db.session.commit()
    
    # Add timeline event
    add_timeline_event(
        batch_id=batch.id,
        event_type='harvest',
        description=f'Batch harvested at {data["farm_location"]}',
        user_id=session['user_id'],
        location=data['farm_location'],
        event_metadata={'quantity_kg': data['quantity_kg']}
    )
    
    log_action(session['user_id'], 'BATCH_CREATED', 'batch', batch_id)
    
    return jsonify({
        'message': 'Batch registered successfully',
        'batch_id': batch_id,
        'id': batch.id
    }), 201

@app.route('/api/transaction', methods=['POST'])
@login_required
def create_transaction():
    data = request.get_json()
    required_fields = ['to_user_id', 'quantity_kg', 'price_per_kg']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Check if batch_id or package_id is provided
    if not data.get('batch_id') and not data.get('package_id'):
        return jsonify({'error': 'Either batch_id or package_id is required'}), 400
    
    # Verify ownership
    if data.get('batch_id'):
        batch = Batches.query.filter_by(id=data['batch_id'], current_owner_id=session['user_id']).first()
        if not batch:
            return jsonify({'error': 'Batch not found or not owned by user'}), 404
    
    if data.get('package_id'):
        package = Package.query.filter_by(id=data['package_id'], current_owner_id=session['user_id']).first()
        if not package:
            return jsonify({'error': 'Package not found or not owned by user'}), 404
    
    # Generate transaction ID
    transaction_id = f"TXN_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
    
    total_amount = data['quantity_kg'] * data['price_per_kg']
    
    transaction = Transactions(
        transaction_id=transaction_id,
        from_user_id=session['user_id'],
        to_user_id=data['to_user_id'],
        batch_id=data.get('batch_id'),
        package_id=data.get('package_id'),
        quantity_kg=data['quantity_kg'],
        price_per_kg=data['price_per_kg'],
        total_amount=total_amount,
        transaction_type=data.get('transaction_type', 'sale'),
        notes=data.get('notes')
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    # Add timeline event
    resource_type = 'batch' if data.get('batch_id') else 'package'
    resource_id = data.get('batch_id') or data.get('package_id')
    
    add_timeline_event(
        batch_id=data.get('batch_id'),
        package_id=data.get('package_id'),
        event_type='transaction_created',
        description=f'Transaction initiated for {resource_type}',
        user_id=session['user_id'],
        event_metadata={'transaction_id': transaction_id, 'total_amount': total_amount}
    )
    
    log_action(session['user_id'], 'TRANSACTION_CREATED', 'transaction', transaction_id)
    
    return jsonify({
        'message': 'Transaction created successfully',
        'transaction_id': transaction_id,
        'total_amount': total_amount
    }), 201

@app.route('/api/transaction/<transaction_id>/complete', methods=['POST'])
@login_required
def complete_transaction(transaction_id):
    transaction = Transactions.query.filter_by(transaction_id=transaction_id).first()
    
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    
    if transaction.to_user_id != session['user_id']:
        return jsonify({'error': 'Not authorized to complete this transaction'}), 403
    
    if transaction.payment_status == 'completed':
        return jsonify({'error': 'Transaction already completed'}), 400
    
    # Update ownership
    if transaction.batch_id:
        batch = Batches.query.get(transaction.batch_id)
        batch.current_owner_id = transaction.to_user_id
        batch.status = 'sold'
    
    if transaction.package_id:
        package = Package.query.get(transaction.package_id)
        package.current_owner_id = transaction.to_user_id
        package.status = 'sold'
    
    transaction.payment_status = 'completed'
    db.session.commit()
    
    # Add timeline event
    add_timeline_event(
        batch_id=transaction.batch_id,
        package_id=transaction.package_id,
        event_type='transaction_completed',
        description=f'Ownership transferred to user {transaction.to_user_id}',
        user_id=session['user_id'],
        event_metadata={'transaction_id': transaction_id}
    )
    
    log_action(session['user_id'], 'TRANSACTION_COMPLETED', 'transaction', transaction_id)
    
    return jsonify({'message': 'Transaction completed successfully'}), 200

@app.route('/api/package', methods=['POST'])
@login_required
def create_package():
    if session['user_type'] not in ['farmer', 'middleman']:
        return jsonify({'error': 'Only farmers and middlemen can create packages'}), 403
    
    data = request.get_json()
    required_fields = ['batch_id', 'quantity_kg', 'package_type']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Verify batch ownership
    batch = Batches.query.filter_by(id=data['batch_id'], current_owner_id=session['user_id']).first()
    if not batch:
        return jsonify({'error': 'Batch not found or not owned by user'}), 404
    
    # Generate package ID and QR code
    package_id = f"PKG_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
    qr_code = f"QR_{package_id}"
    
    # Calculate expiry date based on spice shelf life
    expiry_date = None
    if batch.spice.shelf_life_months:
        from dateutil.relativedelta import relativedelta
        expiry_date = datetime.utcnow() + relativedelta(months=batch.spice.shelf_life_months)
    
    package = Package(
        package_id=package_id,
        batch_id=data['batch_id'],
        packager_id=session['user_id'],
        quantity_kg=data['quantity_kg'],
        package_type=data['package_type'],
        expiry_date=expiry_date,
        current_owner_id=session['user_id'],
        qr_code=qr_code
    )
    
    db.session.add(package)
    
    # Update batch status
    batch.status = 'packaged'
    db.session.commit()
    
    # Add timeline event
    add_timeline_event(
        batch_id=data['batch_id'],
        package_id=package.id,
        event_type='package',
        description=f'Package created from batch',
        user_id=session['user_id'],
        event_metadata={
            'package_id': package_id,
            'quantity_kg': data['quantity_kg'],
            'package_type': data['package_type']
        }
    )
    
    log_action(session['user_id'], 'PACKAGE_CREATED', 'package', package_id)
    
    return jsonify({
        'message': 'Package created successfully',
        'package_id': package_id,
        'qr_code': qr_code,
        'expiry_date': expiry_date.isoformat() if expiry_date else None
    }), 201

@app.route('/api/fetchhistory/<package_id>', methods=['GET'])
def fetch_history(package_id):
    package = Package.query.filter_by(package_id=package_id).first()
    
    if not package:
        return jsonify({'error': 'Package not found'}), 404
    
    # Get timeline events for both batch and package
    batch_events = Timeline.query.filter_by(batch_id=package.batch_id).all()
    package_events = Timeline.query.filter_by(package_id=package.id).all()
    
    # Combine and sort events
    all_events = batch_events + package_events
    all_events.sort(key=lambda x: x.timestamp)
    
    history = []
    for event in all_events:
        event_data = {
            'timestamp': event.timestamp.isoformat(),
            'event_type': event.event_type,
            'description': event.event_description,
            'location': event.location,
            'user': event.user.username if event.user else None
        }
        
        if event.event_metadata:
            event_data['metadata'] = json.loads(event.event_metadata)
        
        history.append(event_data)
    
    # Get package and batch details
    package_info = {
        'package_id': package.package_id,
        'quantity_kg': package.quantity_kg,
        'package_type': package.package_type,
        'package_date': package.package_date.isoformat(),
        'expiry_date': package.expiry_date.isoformat() if package.expiry_date else None,
        'status': package.status,
        'batch': {
            'batch_id': package.batch.batch_id,
            'harvest_date': package.batch.harvest_date.isoformat(),
            'farm_location': package.batch.farm_location,
            'farming_method': package.batch.farming_method,
            'spice': package.batch.spice.name,
            'farmer': package.batch.farmer.username
        }
    }
    
    return jsonify({
        'package_info': package_info,
        'history': history
    }), 200

@app.route('/api/qatest', methods=['POST'])
@login_required
def create_qa_test():
    if session['user_type'] != 'quality_officer':
        return jsonify({'error': 'Only quality officers can create QA tests'}), 403
    
    data = request.get_json()
    required_fields = ['batch_id', 'test_type', 'test_result']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Generate test ID
    test_id = f"QA_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
    
    qa_test = QATest(
        test_id=test_id,
        batch_id=data['batch_id'],
        tester_id=session['user_id'],
        test_type=data['test_type'],
        test_result=data['test_result'],
        grade_assigned=data.get('grade_assigned'),
        moisture_content=data.get('moisture_content'),
        purity_percentage=data.get('purity_percentage'),
        contamination_level=data.get('contamination_level'),
        notes=data.get('notes'),
        certificate_url=data.get('certificate_url')
    )
    
    db.session.add(qa_test)
    
    # Update batch status and grade
    batch = Batches.query.get(data['batch_id'])
    if batch:
        batch.status = 'tested'
        if data.get('grade_assigned'):
            batch.estimated_grade = data['grade_assigned']
    
    db.session.commit()
    
    # Add timeline event
    add_timeline_event(
        batch_id=data['batch_id'],
        event_type='quality_test',
        description=f'Quality test conducted: {data["test_result"]}',
        user_id=session['user_id'],
        event_metadata={
            'test_id': test_id,
            'test_type': data['test_type'],
            'test_result': data['test_result']
        }
    )
    
    log_action(session['user_id'], 'QA_TEST_CREATED', 'qa_test', test_id)
    
    return jsonify({
        'message': 'QA test created successfully',
        'test_id': test_id
    }), 201

@app.route('/api/spices', methods=['GET'])
def get_spices():
    spices = Spices.query.all()
    spices_list = []
    
    for spice in spices:
        spices_list.append({
            'id': spice.id,
            'name': spice.name,
            'scientific_name': spice.scientific_name,
            'category': spice.category,
            'origin_region': spice.origin_region,
            'harvest_season': spice.harvest_season,
            'shelf_life_months': spice.shelf_life_months
        })
    
    return jsonify({'spices': spices_list}), 200

@app.route('/api/mybatches', methods=['GET'])
@login_required
def get_my_batches():
    batches = Batches.query.filter_by(current_owner_id=session['user_id']).all()
    batches_list = []
    
    for batch in batches:
        batches_list.append({
            'id': batch.id,
            'batch_id': batch.batch_id,
            'spice_name': batch.spice.name,
            'quantity_kg': batch.quantity_kg,
            'harvest_date': batch.harvest_date.isoformat(),
            'status': batch.status,
            'estimated_grade': batch.estimated_grade
        })
    
    return jsonify({'batches': batches_list}), 200

@app.route('/api/mypackages', methods=['GET'])
@login_required
def get_my_packages():
    packages = Package.query.filter_by(current_owner_id=session['user_id']).all()
    packages_list = []
    
    for package in packages:
        packages_list.append({
            'id': package.id,
            'package_id': package.package_id,
            'spice_name': package.batch.spice.name,
            'quantity_kg': package.quantity_kg,
            'package_type': package.package_type,
            'status': package.status,
            'package_date': package.package_date.isoformat()
        })
    
    return jsonify({'packages': packages_list}), 200

# Initialize database function
def init_database():
    """Initialize database and add default data"""
    db.create_all()
    
    # Add some default spices if none exist
    if Spices.query.count() == 0:
        default_spices = [
            {'name': 'Black Pepper', 'scientific_name': 'Piper nigrum', 'category': 'whole', 
             'origin_region': 'Idukki, Kerala', 'harvest_season': 'November-February', 'shelf_life_months': 36},
            {'name': 'Cardamom', 'scientific_name': 'Elettaria cardamomum', 'category': 'whole',
             'origin_region': 'Idukki, Kerala', 'harvest_season': 'October-December', 'shelf_life_months': 24},
            {'name': 'Cinnamon', 'scientific_name': 'Cinnamomum verum', 'category': 'whole',
             'origin_region': 'Kollam, Kerala', 'harvest_season': 'May-July', 'shelf_life_months': 48},
            {'name': 'Cloves', 'scientific_name': 'Syzygium aromaticum', 'category': 'whole',
             'origin_region': 'Kottayam, Kerala', 'harvest_season': 'September-December', 'shelf_life_months': 36},
            {'name': 'Nutmeg', 'scientific_name': 'Myristica fragrans', 'category': 'whole',
             'origin_region': 'Thrissur, Kerala', 'harvest_season': 'June-August', 'shelf_life_months': 48},
            {'name': 'Turmeric', 'scientific_name': 'Curcuma longa', 'category': 'ground',
             'origin_region': 'Erode, Kerala', 'harvest_season': 'January-March', 'shelf_life_months': 24},
            {'name': 'Ginger', 'scientific_name': 'Zingiber officinale', 'category': 'whole',
             'origin_region': 'Kozhikode, Kerala', 'harvest_season': 'December-February', 'shelf_life_months': 12}
        ]
        
        for spice_data in default_spices:
            spice = Spices(**spice_data)
            db.session.add(spice)
        
        db.session.commit()
        print("Default spices added to database")

@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    user_id = session['user_id']
    user_type = session['user_type']
    
    dashboard_data = {
        'user_type': user_type,
        'summary': {}
    }
    
    if user_type == 'farmer':
        batch_count = Batches.query.filter_by(farmer_id=user_id).count()
        active_batches = Batches.query.filter_by(farmer_id=user_id, status='harvested').count()
        dashboard_data['summary'] = {
            'total_batches': batch_count,
            'active_batches': active_batches,
            'recent_transactions': Transactions.query.filter_by(from_user_id=user_id).count()
        }
    
    elif user_type == 'middleman':
        owned_batches = Batches.query.filter_by(current_owner_id=user_id).count()
        owned_packages = Package.query.filter_by(current_owner_id=user_id).count()
        dashboard_data['summary'] = {
            'owned_batches': owned_batches,
            'owned_packages': owned_packages,
            'transactions_count': Transactions.query.filter(
                (Transactions.from_user_id == user_id) | (Transactions.to_user_id == user_id)
            ).count()
        }
    
    elif user_type == 'quality_officer':
        tests_conducted = QATest.query.filter_by(tester_id=user_id).count()
        pending_tests = Batches.query.filter_by(status='harvested').count()
        dashboard_data['summary'] = {
            'tests_conducted': tests_conducted,
            'pending_tests': pending_tests
        }
    
    elif user_type == 'consumer':
        purchased_packages = Transactions.query.filter_by(
            to_user_id=user_id, transaction_type='sale', payment_status='completed'
        ).count()
        dashboard_data['summary'] = {
            'purchased_packages': purchased_packages
        }
    
    return jsonify(dashboard_data), 200

@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    user_id = session['user_id']
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    transactions = Transactions.query.filter(
        (Transactions.from_user_id == user_id) | (Transactions.to_user_id == user_id)
    ).order_by(Transactions.transaction_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    transactions_list = []
    for txn in transactions.items:
        txn_data = {
            'transaction_id': txn.transaction_id,
            'from_user': txn.from_user.username,
            'to_user': txn.to_user.username,
            'quantity_kg': txn.quantity_kg,
            'total_amount': txn.total_amount,
            'transaction_type': txn.transaction_type,
            'payment_status': txn.payment_status,
            'transaction_date': txn.transaction_date.isoformat(),
            'direction': 'sent' if txn.from_user_id == user_id else 'received'
        }
        
        if txn.batch_id:
            txn_data['item_type'] = 'batch'
            txn_data['item_id'] = txn.batch.batch_id
            txn_data['spice_name'] = txn.batch.spice.name
        elif txn.package_id:
            txn_data['item_type'] = 'package'
            txn_data['item_id'] = txn.package.package_id
            txn_data['spice_name'] = txn.package.batch.spice.name
        
        transactions_list.append(txn_data)
    
    return jsonify({
        'transactions': transactions_list,
        'total': transactions.total,
        'pages': transactions.pages,
        'current_page': page
    }), 200

@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '')
    search_type = request.args.get('type', 'all')  # batch, package, user, all
    
    if not query or len(query) < 3:
        return jsonify({'error': 'Query must be at least 3 characters long'}), 400
    
    results = {}
    
    if search_type in ['batch', 'all']:
        batches = Batches.query.filter(
            Batches.batch_id.contains(query) |
            Batches.farm_location.contains(query)
        ).limit(10).all()
        
        results['batches'] = [{
            'batch_id': b.batch_id,
            'spice_name': b.spice.name,
            'farmer': b.farmer.username,
            'quantity_kg': b.quantity_kg,
            'status': b.status
        } for b in batches]
    
    if search_type in ['package', 'all']:
        packages = Package.query.filter(
            Package.package_id.contains(query)
        ).limit(10).all()
        
        results['packages'] = [{
            'package_id': p.package_id,
            'spice_name': p.batch.spice.name,
            'quantity_kg': p.quantity_kg,
            'status': p.status,
            'package_type': p.package_type
        } for p in packages]
    
    if search_type in ['user', 'all']:
        users = User.query.filter(
            User.username.contains(query) &
            User.is_active == True
        ).limit(10).all()
        
        results['users'] = [{
            'id': u.id,
            'username': u.username,
            'user_type': u.user_type
        } for u in users]
    
    return jsonify(results), 200

@app.route('/api/analytics/spice/<int:spice_id>', methods=['GET'])
@login_required
def spice_analytics(spice_id):
    spice = Spices.query.get(spice_id)
    if not spice:
        return jsonify({'error': 'Spice not found'}), 404
    
    # Get batches for this spice
    batches = Batches.query.filter_by(spice_id=spice_id).all()
    
    # Calculate analytics
    total_quantity = sum(b.quantity_kg for b in batches)
    avg_price = db.session.query(db.func.avg(Transactions.price_per_kg)).filter(
        Transactions.batch_id.in_([b.id for b in batches])
    ).scalar() or 0
    
    # Grade distribution
    grade_distribution = {}
    for batch in batches:
        grade = batch.estimated_grade or 'Unknown'
        grade_distribution[grade] = grade_distribution.get(grade, 0) + 1
    
    # Monthly harvest data (last 12 months)
    from dateutil.relativedelta import relativedelta
    monthly_data = []
    current_date = datetime.now()
    
    for i in range(12):
        month_start = current_date - relativedelta(months=i+1)
        month_end = current_date - relativedelta(months=i)
        
        monthly_batches = [b for b in batches if month_start <= b.harvest_date < month_end]
        monthly_quantity = sum(b.quantity_kg for b in monthly_batches)
        
        monthly_data.append({
            'month': month_start.strftime('%Y-%m'),
            'quantity_kg': monthly_quantity,
            'batch_count': len(monthly_batches)
        })
    
    return jsonify({
        'spice_name': spice.name,
        'total_quantity_kg': total_quantity,
        'total_batches': len(batches),
        'average_price_per_kg': round(avg_price, 2),
        'grade_distribution': grade_distribution,
        'monthly_harvest': list(reversed(monthly_data))
    }), 200

@app.route('/api/qr/<package_id>', methods=['GET'])
def qr_lookup(package_id):
    """Public endpoint for QR code scanning"""
    package = Package.query.filter_by(package_id=package_id).first()
    
    if not package:
        return jsonify({'error': 'Package not found'}), 404
    
    # Basic package info for consumers
    package_info = {
        'package_id': package.package_id,
        'spice_name': package.batch.spice.name,
        'quantity_kg': package.quantity_kg,
        'package_date': package.package_date.isoformat(),
        'expiry_date': package.expiry_date.isoformat() if package.expiry_date else None,
        'farm_location': package.batch.farm_location,
        'farming_method': package.batch.farming_method,
        'estimated_grade': package.batch.estimated_grade
    }
    
    # Get latest QA test results
    latest_qa = QATest.query.filter_by(batch_id=package.batch_id).order_by(
        QATest.test_date.desc()
    ).first()
    
    if latest_qa:
        package_info['quality_info'] = {
            'test_result': latest_qa.test_result,
            'grade_assigned': latest_qa.grade_assigned,
            'test_date': latest_qa.test_date.isoformat(),
            'moisture_content': latest_qa.moisture_content,
            'purity_percentage': latest_qa.purity_percentage
        }
    
    return jsonify(package_info), 200


# Additional API endpoint for batch division
@app.route('/api/batch/divide', methods=['POST'])
@login_required
def divide_batch():
    """
    Divide a batch into multiple sub-batches. Each division can be:
    - Sold immediately (if buyer_id provided)
    - Kept for later sale (if no buyer_id)
    """
    data = request.get_json()
    required_fields = ['batch_id', 'divisions']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Verify batch ownership
    original_batch = Batches.query.filter_by(
        id=data['batch_id'], 
        current_owner_id=session['user_id']
    ).first()
    
    if not original_batch:
        return jsonify({'error': 'Batch not found or not owned by user'}), 404
    
    # Validate divisions
    divisions = data['divisions']
    total_divided_quantity = sum(div['quantity_kg'] for div in divisions)
    
    if total_divided_quantity > original_batch.quantity_kg:
        return jsonify({'error': 'Total divided quantity exceeds batch quantity'}), 400
    
    if len(divisions) < 1:
        return jsonify({'error': 'At least 1 division required'}), 400
    
    try:
        new_batches = []
        transactions_created = []
        
        # Create new sub-batches
        for i, division in enumerate(divisions):
            # Generate new batch ID for sub-batch
            sub_batch_id = f"{original_batch.batch_id}_DIV{i+1}_{str(uuid.uuid4())[:4].upper()}"
            
            # Determine initial owner - if buyer_id provided, they become owner after transaction
            initial_owner_id = session['user_id']
            
            sub_batch = Batches(
                batch_id=sub_batch_id,
                farmer_id=original_batch.farmer_id,  # Keep original farmer
                spice_id=original_batch.spice_id,
                quantity_kg=division['quantity_kg'],
                harvest_date=original_batch.harvest_date,
                farm_location=original_batch.farm_location,
                farming_method=original_batch.farming_method,
                estimated_grade=original_batch.estimated_grade,
                current_owner_id=initial_owner_id,
                status='divided' if not division.get('buyer_id') else 'pending_sale',
                parent_batch_id=original_batch.id  # Link to parent batch
            )
            
            db.session.add(sub_batch)
            db.session.flush()  # Get the ID
            
            batch_info = {
                'batch_id': sub_batch_id,
                'id': sub_batch.id,
                'quantity_kg': division['quantity_kg'],
                'status': 'available' if not division.get('buyer_id') else 'sold'
            }
            
            # If buyer specified, create transaction immediately
            if division.get('buyer_id') and division.get('price_per_kg'):
                transaction_id = f"TXN_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
                total_amount = division['quantity_kg'] * division['price_per_kg']
                
                transaction = Transactions(
                    transaction_id=transaction_id,
                    from_user_id=session['user_id'],
                    to_user_id=division['buyer_id'],
                    batch_id=sub_batch.id,
                    quantity_kg=division['quantity_kg'],
                    price_per_kg=division['price_per_kg'],
                    total_amount=total_amount,
                    transaction_type='sale',
                    payment_status='pending',
                    notes=f"Sale of divided batch {sub_batch_id}"
                )
                
                db.session.add(transaction)
                
                batch_info['transaction_id'] = transaction_id
                batch_info['buyer_id'] = division['buyer_id']
                batch_info['total_amount'] = total_amount
                
                transactions_created.append({
                    'transaction_id': transaction_id,
                    'batch_id': sub_batch_id,
                    'buyer_id': division['buyer_id'],
                    'total_amount': total_amount,
                    'status': 'pending'
                })
                
                # Add transaction timeline event
                add_timeline_event(
                    batch_id=sub_batch.id,
                    event_type='sale_initiated',
                    description=f'Sale initiated to buyer {division["buyer_id"]}',
                    user_id=session['user_id'],
                    location=original_batch.farm_location,
                    event_metadata={
                        'transaction_id': transaction_id,
                        'price_per_kg': division['price_per_kg'],
                        'total_amount': total_amount
                    }
                )
            
            new_batches.append(batch_info)
            
            # Add timeline event for division
            add_timeline_event(
                batch_id=sub_batch.id,
                event_type='batch_divided',
                description=f'Sub-batch created from {original_batch.batch_id} ({division["quantity_kg"]}kg)',
                user_id=session['user_id'],
                location=original_batch.farm_location,
                event_metadata={
                    'parent_batch_id': original_batch.batch_id,
                    'division_number': i+1,
                    'quantity_kg': division['quantity_kg'],
                    'has_buyer': bool(division.get('buyer_id'))
                }
            )
        
        # Update original batch status
        original_batch.status = 'divided'
        original_batch.quantity_kg = original_batch.quantity_kg - total_divided_quantity  # Remaining quantity
        
        # If entire batch was divided, mark as fully divided
        if original_batch.quantity_kg == 0:
            original_batch.status = 'fully_divided'
        
        # Add timeline event to original batch
        add_timeline_event(
            batch_id=original_batch.id,
            event_type='batch_divided',
            description=f'Batch divided into {len(divisions)} sub-batches',
            user_id=session['user_id'],
            location=original_batch.farm_location,
            event_metadata={
                'total_divisions': len(divisions),
                'total_divided_quantity': total_divided_quantity,
                'remaining_quantity': original_batch.quantity_kg
            }
        )
        
        db.session.commit()
        
        log_action(session['user_id'], 'BATCH_DIVIDED', 'batch', original_batch.batch_id)
        
        return jsonify({
            'message': 'Batch divided successfully',
            'original_batch_remaining': original_batch.quantity_kg,
            'new_batches': new_batches,
            'transactions_created': transactions_created,
            'summary': {
                'total_divisions': len(divisions),
                'immediately_sold': len(transactions_created),
                'kept_for_later': len(divisions) - len(transactions_created)
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Endpoint to sell individual divisions later
@app.route('/api/batch/<int:batch_id>/sell', methods=['POST'])
@login_required
def sell_individual_batch(batch_id):
    """
    Sell an individual batch (including divided sub-batches) to a specific buyer
    """
    data = request.get_json()
    required_fields = ['buyer_id', 'price_per_kg']
    
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400
    
    # Verify batch ownership
    batch = Batches.query.filter_by(
        id=batch_id,
        current_owner_id=session['user_id']
    ).first()
    
    if not batch:
        return jsonify({'error': 'Batch not found or not owned by user'}), 404
    
    if batch.status in ['sold', 'pending_sale']:
        return jsonify({'error': 'Batch is already sold or pending sale'}), 400
    
    try:
        # Create transaction
        transaction_id = f"TXN_{datetime.now().strftime('%Y%m%d')}_{str(uuid.uuid4())[:8].upper()}"
        total_amount = batch.quantity_kg * data['price_per_kg']
        
        transaction = Transactions(
            transaction_id=transaction_id,
            from_user_id=session['user_id'],
            to_user_id=data['buyer_id'],
            batch_id=batch.id,
            quantity_kg=batch.quantity_kg,
            price_per_kg=data['price_per_kg'],
            total_amount=total_amount,
            transaction_type='sale',
            payment_status='pending',
            notes=data.get('notes', f'Sale of batch {batch.batch_id}')
        )
        
        db.session.add(transaction)
        
        # Update batch status
        batch.status = 'pending_sale'
        
        # Add timeline event
        add_timeline_event(
            batch_id=batch.id,
            event_type='sale_initiated',
            description=f'Sale initiated to buyer {data["buyer_id"]}',
            user_id=session['user_id'],
            location=batch.farm_location,
            event_metadata={
                'transaction_id': transaction_id,
                'price_per_kg': data['price_per_kg'],
                'total_amount': total_amount
            }
        )
        
        db.session.commit()
        
        log_action(session['user_id'], 'BATCH_SALE_INITIATED', 'batch', batch.batch_id)
        
        return jsonify({
            'message': 'Sale initiated successfully',
            'transaction_id': transaction_id,
            'batch_id': batch.batch_id,
            'total_amount': total_amount,
            'status': 'pending_buyer_confirmation'
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Get available (unsold) batches for a user
@app.route('/api/mybatches/available', methods=['GET'])
@login_required
def get_available_batches():
    """
    Get all batches owned by user that are available for sale
    """
    available_batches = Batches.query.filter_by(
        current_owner_id=session['user_id']
    ).filter(
        Batches.status.in_(['harvested', 'tested', 'divided', 'packaged'])
    ).all()
    
    batches_list = []
    
    for batch in available_batches:
        batch_data = {
            'id': batch.id,
            'batch_id': batch.batch_id,
            'spice_name': batch.spice.name,
            'quantity_kg': batch.quantity_kg,
            'harvest_date': batch.harvest_date.isoformat(),
            'status': batch.status,
            'estimated_grade': batch.estimated_grade,
            'is_division': batch.parent_batch_id is not None
        }
        
        # If it's a division, show parent info
        if batch.parent_batch_id:
            batch_data['parent_batch_id'] = batch.parent_batch.batch_id
            batch_data['division_info'] = f'Divided from {batch.parent_batch.batch_id}'
        
        batches_list.append(batch_data)
    
    return jsonify({
        'available_batches': batches_list,
        'total_count': len(batches_list)
    }), 200

@app.route('/api/batch/<int:batch_id>/history', methods=['GET'])
def get_batch_family_history(batch_id):
    """
    Get complete history including parent and child batches
    """
    batch = Batches.query.get(batch_id)
    if not batch:
        return jsonify({'error': 'Batch not found'}), 404
    
    # Get root batch (original parent)
    root_batch = batch
    while root_batch.parent_batch_id:
        root_batch = root_batch.parent_batch
    
    # Get all related batches (siblings and children)
    family_batches = [root_batch]
    family_batches.extend(root_batch.sub_batches)
    
    # Get timeline for all related batches
    batch_ids = [b.id for b in family_batches]
    timeline_events = Timeline.query.filter(
        Timeline.batch_id.in_(batch_ids)
    ).order_by(Timeline.timestamp).all()
    
    # Format response
    family_tree = {
        'root_batch': {
            'batch_id': root_batch.batch_id,
            'original_quantity': root_batch.quantity_kg,
            'status': root_batch.status
        },
        'divisions': [{
            'batch_id': sub.batch_id,
            'quantity_kg': sub.quantity_kg,
            'current_owner': sub.current_owner.username,
            'status': sub.status
        } for sub in root_batch.sub_batches],
        'timeline': [{
            'timestamp': event.timestamp.isoformat(),
            'event_type': event.event_type,
            'description': event.event_description,
            'batch_id': event.batch.batch_id if event.batch else None
        } for event in timeline_events]
    }
    
    return jsonify(family_tree), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    with app.app_context():
        init_database()
    
    app.run(debug=True, host='0.0.0.0', port=5000)