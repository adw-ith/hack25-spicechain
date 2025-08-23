import os
import uuid
from functools import wraps
from flask import Flask, request, jsonify
from supabase import create_client, Client
from dotenv import load_dotenv
from flask_cors import CORS

# --- INITIALIZATION ---
load_dotenv()

app = Flask(__name__)
CORS(app) 

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# --- AUTH DECORATOR ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'authorization' in request.headers:
            token = request.headers['authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401

        try:
            user_response = supabase.auth.get_user(token)
            current_user = user_response.user
            if not current_user:
                return jsonify({'message': 'Token is invalid!'}), 401
        except Exception as e:
            return jsonify({'message': f'Token error: {str(e)}'}), 401
        
        return f(current_user, *args, **kwargs)

    return decorated

# --- AUTHENTICATION ROUTES (Unchanged) ---

@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    try:
        res = supabase.auth.sign_up({"email": email, "password": password})
        # HACKATHON NOTE: After signup, you'd typically have a second step 
        # for the user to create their 'farmers' or 'aggregators' profile.
        return jsonify({'message': 'Signup successful! Please verify your email.', 'user_id': res.user.id}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 400

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email and password are required.'}), 400

    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return jsonify({
            'message': 'Login successful!',
            'access_token': res.session.access_token,
            'user_id': res.user.id
        }), 200
    except Exception as e:
        return jsonify({'message': 'Invalid credentials.'}), 401


# --- FARMER & PROCESSOR ROUTES (Unchanged) ---

@app.route('/batches', methods=['POST'])
@token_required
def create_batch(current_user):
    data = request.get_json()
    farmer_id = current_user.id 
    
    try:
        batch_res = supabase.table('batches').insert({
            'farmer_id': farmer_id,
            'spice_type': data['spice_type'],
            'harvest_date': data['harvest_date'],
            'quantity_kg': data['quantity_kg']
        }).execute()
        
        new_batch = batch_res.data[0]
        
        supabase.table('timeline_events').insert({
            'batch_id': new_batch['id'],
            'event_name': 'Harvested',
            'description': f"Harvested {data['quantity_kg']}kg of {data['spice_type']}.",
            'actor_name': 'Farmer'
        }).execute()

        return jsonify({'message': 'Batch created successfully', 'batch': new_batch}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/timeline_events', methods=['POST'])
@token_required
def add_timeline_event(current_user):
    data = request.get_json()
    try:
        event_res = supabase.table('timeline_events').insert({
            'batch_id': data['batch_id'],
            'event_name': data['event_name'],
            'description': data['description'],
            'actor_name': data['actor_name']
        }).execute()
        return jsonify({'message': 'Timeline event added.', 'event': event_res.data[0]}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# --- MIDDLEMAN (AGGREGATOR) ROUTES (New) ---

@app.route('/lots', methods=['POST'])
@token_required
def create_aggregated_lot(current_user):
    """
    Creates an aggregated lot from a list of batch IDs.
    """
    data = request.get_json()
    aggregator_id = current_user.id
    batch_ids = data.get('batch_ids', [])

    if not batch_ids:
        return jsonify({'message': 'At least one batch_id is required.'}), 400

    try:
        # Step 1: Create the main lot record
        lot_res = supabase.table('aggregated_lots').insert({
            'aggregator_id': aggregator_id,
            'lot_name': data.get('lot_name'),
            'description': data.get('description')
        }).execute()
        new_lot = lot_res.data[0]
        
        # Step 2: Link the batches to this new lot
        lot_components = [{'lot_id': new_lot['id'], 'batch_id': batch_id} for batch_id in batch_ids]
        supabase.table('lot_components').insert(lot_components).execute()

        return jsonify({'message': 'Aggregated lot created successfully', 'lot': new_lot}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# --- PACKAGING ROUTE (Updated) ---

@app.route('/packages', methods=['POST'])
@token_required
def create_package(current_user):
    """
    Creates a final package from EITHER a single batch OR an aggregated lot.
    """
    data = request.get_json()
    batch_id = data.get('batch_id')
    lot_id = data.get('lot_id')

    if not (batch_id or lot_id):
        return jsonify({'message': 'Either a batch_id or a lot_id is required.'}), 400
    if batch_id and lot_id:
        return jsonify({'message': 'Cannot provide both a batch_id and a lot_id.'}), 400

    package_uid = f"KSPICE-{str(uuid.uuid4())[:8].upper()}"
    
    package_data = {
        'package_uid': package_uid,
        'batch_id': batch_id,
        'lot_id': lot_id
    }

    try:
        package_res = supabase.table('packages').insert(package_data).execute()

        # Log a "Packaged" event only for single batches for simplicity
        if batch_id:
            supabase.table('timeline_events').insert({
                'batch_id': batch_id,
                'event_name': 'Packaged',
                'description': 'Product sealed and ready for distribution.',
                'actor_name': 'Packaging Unit'
            }).execute()
        
        return jsonify({'message': 'Package created.', 'package': package_res.data[0]}), 201
    except Exception as e:
        return jsonify({'message': str(e)}), 500


# --- PUBLIC TRACE ROUTE (Updated) ---

@app.route('/trace/<string:package_uid>', methods=['GET'])
def trace_package(package_uid):
    """
    Fetches the entire journey of a package.
    Handles both single-batch and aggregated-lot packages.
    """
    try:
        # First, get the package to see if it's linked to a batch or a lot
        package_query = supabase.table('packages').select('batch_id, lot_id').eq('package_uid', package_uid).single().execute()
        
        if not package_query.data:
            return jsonify({'message': 'Package not found.'}), 404
        
        package_info = package_query.data

        # CASE 1: Package is from a single batch
        if package_info.get('batch_id'):
            query = supabase.table('packages').select(
                'package_uid, packaged_at, batches(*, farmers(*), timeline_events(*))'
            ).eq('package_uid', package_uid).single().execute()
            return jsonify(query.data), 200

        # CASE 2: Package is from an aggregated lot
        elif package_info.get('lot_id'):
            # This is a more complex query to get the lot, and through it, all its component batches and their farmers.
            query = supabase.table('packages').select(
                'package_uid, packaged_at, aggregated_lots(*, aggregators:aggregators(company_name), lot_components!inner(batches(*, farmers(*))))'
            ).eq('package_uid', package_uid).single().execute()
            return jsonify(query.data), 200
        
        else:
            return jsonify({'message': 'Package record is invalid.'}), 500

    except Exception as e:
        return jsonify({'message': str(e)}), 500


# --- RUN THE APP ---
if __name__ == '__main__':
    app.run(debug=True, port=5001)