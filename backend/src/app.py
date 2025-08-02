from flask import Flask, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import or_

from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- Configuración de la Base de Datos (Corregida y Simplificada) ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL:
    # Configuración para producción (Render/Supabase)
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    # Configuración para desarrollo local si la variable no está presente
    print("ADVERTENCIA: No se encontró DATABASE_URL, usando configuración local.")
    DB_USER = 'Exponiendo_Tacna_admin'
    DB_PASSWORD = 'pillito05122002'
    DB_HOST = 'localhost'
    DB_PORT = '5432'
    DB_NAME = 'Exponiendo_Tacna_db'
    app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Configuración JWT y de Subida de Archivos ---
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "tu-clave-secreta-de-desarrollo-muy-segura")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
jwt = JWTManager(app)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Modelos de Base de Datos ---
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    bio = db.Column(db.Text, nullable=True, default="¡Bienvenido a mi perfil!")
    profile_picture_path = db.Column(db.String(255), nullable=True)
    banner_image_path = db.Column(db.String(255), nullable=True)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    albums = db.relationship('Album', backref='owner', lazy=True, cascade="all, delete-orphan")
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Album(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    views_count = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    media = db.relationship('Media', backref='album', lazy=True, cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary='album_tags', backref=db.backref('albums', lazy='dynamic'))

class Media(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    thumbnail_path = db.Column(db.String(255), nullable=True)
    views_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    title = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    tags = db.relationship('Tag', secondary='media_tags', backref=db.backref('media_items', lazy='dynamic'))

media_tags = db.Table('media_tags', db.Column('media_id', db.Integer, db.ForeignKey('media.id'), primary_key=True), db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True))
album_tags = db.Table('album_tags', db.Column('album_id', db.Integer, db.ForeignKey('album.id'), primary_key=True), db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True))
class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

# --- Creación de Tablas ---
with app.app_context():
    db.create_all()

# --- Rutas de API ---

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)
    
## Rutas de Autenticación y Perfil
@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    if not all(key in data for key in ['username', 'email', 'password']):
        return jsonify({'error': 'Faltan datos de registro'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El nombre de usuario ya existe'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'El email ya está registrado'}), 409
    
    new_user = User(username=data['username'], email=data['email'])
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'Usuario registrado exitosamente'}), 201

@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        access_token = create_access_token(identity=str(user.id))
        return jsonify(access_token=access_token, username=user.username), 200
    return jsonify({"error": "Usuario o contraseña inválidos"}), 401

@app.route('/api/me', methods=['GET'])
@jwt_required()
def get_my_profile():
    user = User.query.get(int(get_jwt_identity()))
    if not user: return jsonify({"error": "Usuario no encontrado"}), 404
    return jsonify({"id": user.id, "username": user.username, "email": user.email, "is_admin": user.is_admin}), 200

@app.route('/api/profiles/<username>', methods=['GET'])
def get_user_profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    user_albums = Album.query.filter_by(user_id=user.id).order_by(Album.created_at.desc()).all()
    albums_list = []
    for album in user_albums:
        first_media = Media.query.filter_by(album_id=album.id).order_by(Media.created_at.asc()).first()
        albums_list.append({'id': album.id, 'title': album.title, 'thumbnail_url': f'/uploads/{first_media.file_path}' if first_media else None, 'views_count': album.views_count})
    return jsonify({'id': user.id, 'username': user.username, 'bio': user.bio, 'profile_picture_url': f'/uploads/{user.profile_picture_path}' if user.profile_picture_path else None, 'banner_image_url': f'/uploads/{user.banner_image_path}' if user.banner_image_path else None, 'albums': albums_list})

@app.route('/api/my-profile', methods=['PUT'])
@jwt_required()
def update_my_profile():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json()
    if 'bio' in data: user.bio = data['bio']
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado'})

def handle_profile_image_upload(user, file, image_type):
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{user.username}_{image_type}_{datetime.now().strftime('%Y%m%d%H%M%S')}{os.path.splitext(filename)[1]}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        old_image_path_str = None
        if image_type == 'avatar' and user.profile_picture_path:
            old_image_path_str = user.profile_picture_path
        elif image_type == 'banner' and user.banner_image_path:
            old_image_path_str = user.banner_image_path
        
        if old_image_path_str:
            old_image_path = os.path.join(app.config['UPLOAD_FOLDER'], old_image_path_str)
            if os.path.exists(old_image_path):
                os.remove(old_image_path)
        return unique_filename
    return None

@app.route('/api/my-profile/picture', methods=['POST', 'DELETE'])
@jwt_required()
def handle_profile_picture():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if request.method == 'POST':
        if 'file' not in request.files: return jsonify({'error': 'No se encontró el archivo'}), 400
        file = request.files['file']
        new_filename = handle_profile_image_upload(user, file, 'avatar')
        if new_filename:
            user.profile_picture_path = new_filename
            db.session.commit()
            return jsonify({'message': 'Foto de perfil actualizada', 'profile_picture_url': f'/uploads/{new_filename}'}), 200
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        if user.profile_picture_path:
            file_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], user.profile_picture_path)
            if os.path.exists(file_to_delete):
                os.remove(file_to_delete)
            user.profile_picture_path = None
            db.session.commit()
            return jsonify({'message': 'Foto de perfil eliminada exitosamente'}), 200
        return jsonify({'message': 'No hay foto de perfil para eliminar'}), 200

@app.route('/api/my-profile/banner', methods=['POST', 'DELETE'])
@jwt_required()
def handle_banner_image():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if request.method == 'POST':
        if 'file' not in request.files: return jsonify({'error': 'No se encontró el archivo'}), 400
        file = request.files['file']
        new_filename = handle_profile_image_upload(user, file, 'banner')
        if new_filename:
            user.banner_image_path = new_filename
            db.session.commit()
            return jsonify({'message': 'Banner actualizado', 'banner_image_url': f'/uploads/{new_filename}'}), 200
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        if user.banner_image_path:
            file_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], user.banner_image_path)
            if os.path.exists(file_to_delete):
                os.remove(file_to_delete)
            user.banner_image_path = None
            db.session.commit()
            return jsonify({'message': 'Banner eliminado exitosamente'}), 200
        return jsonify({'message': 'No hay banner para eliminar'}), 200

## Rutas de Usuarios
@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = User.query.get(int(get_jwt_identity()))
    if not current_user.is_admin:
        return jsonify({'error': 'Acceso denegado'}), 403
    users = User.query.all()
    users_list = [{'id': user.id, 'username': user.username, 'email': user.email} for user in users]
    return jsonify(users_list)

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user = User.query.get(int(get_jwt_identity()))
    user_to_delete = User.query.get(user_id)
    if not user_to_delete: return jsonify({'error': 'Usuario no encontrado'}), 404
    
    if (current_user.is_admin and current_user.id != user_to_delete.id) or (current_user.id == user_to_delete.id):
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({'message': 'Usuario eliminado exitosamente'}), 200
    else:
        return jsonify({'error': 'No tienes permiso para eliminar este usuario'}), 403

## Rutas de Álbumes
@app.route('/api/albums', methods=['POST'])
@jwt_required()
def create_album():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or 'title' not in data: return jsonify({'error': 'Faltan datos de álbum (title)'}), 400
    new_album = Album(title=data['title'], description=data.get('description'), user_id=current_user_id)
    db.session.add(new_album)
    db.session.commit()
    return jsonify({'message': 'Álbum creado exitosamente', 'album': {'id': new_album.id}}), 201

@app.route('/api/albums', methods=['GET'])
def get_all_albums():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    albums_query = Album.query.order_by(Album.created_at.desc())
    pagination = albums_query.paginate(page=page, per_page=per_page, error_out=False)
    albums = pagination.items
    albums_list = []
    for album in albums:
        first_media = Media.query.filter_by(album_id=album.id).order_by(Media.created_at.asc()).first()
        thumbnail_url = f'/uploads/{first_media.file_path}' if first_media else None
        albums_list.append({'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.owner.id, 'created_at': album.created_at.isoformat(), 'views_count': album.views_count, 'owner_username': album.owner.username, 'thumbnail_url': thumbnail_url})
    return jsonify({'albums': albums_list, 'total_pages': pagination.pages, 'current_page': pagination.page, 'has_next': pagination.has_next, 'has_prev': pagination.has_prev, 'next_page': pagination.next_num, 'prev_page': pagination.prev_num})

@app.route('/api/albums/<int:album_id>', methods=['GET'])
def get_album(album_id):
    album = Album.query.get_or_404(album_id)
    album.views_count += 1
    db.session.commit()
    media_list = [{'id': item.id, 'file_path': item.file_path, 'file_type': item.file_type} for item in album.media]
    return jsonify({'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.user_id, 'owner_username': album.owner.username, 'media': media_list})

@app.route('/api/albums/<int:album_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_album_update_delete(album_id):
    current_user = User.query.get(int(get_jwt_identity()))
    album = Album.query.get_or_404(album_id)

    if album.user_id != current_user.id and not current_user.is_admin:
        return jsonify({'error': 'No tienes permiso para realizar esta acción'}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if 'title' in data: album.title = data['title']
        if 'description' in data: album.description = data['description']
        db.session.commit()
        return jsonify({'message': 'Álbum actualizado exitosamente'})
    
    if request.method == 'DELETE':
        db.session.delete(album)
        db.session.commit()
        return jsonify({'message': 'Álbum eliminado exitosamente'})

## Rutas de Media
@app.route('/api/albums/<int:album_id>/media', methods=['POST'])
@jwt_required()
def upload_media(album_id):
    current_user = User.query.get(int(get_jwt_identity()))
    album = Album.query.get_or_404(album_id)
    
    if album.user_id != current_user.id:
        return jsonify(error="No tienes permiso para subir a este álbum"), 403

    if 'file' not in request.files: return jsonify(error="No se encontró el archivo"), 400
    file = request.files['file']
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        unique_filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], unique_filename))
        media_type = 'image' if file.content_type.startswith('image/') else 'video'
        new_media = Media(file_path=unique_filename, file_type=media_type, album_id=album_id, title=request.form.get('title'), description=request.form.get('description'))
        db.session.add(new_media)
        db.session.commit()
        return jsonify(message="Archivo subido exitosamente", media_id=new_media.id), 201
    return jsonify(error="Tipo de archivo no permitido"), 400

@app.route('/api/media/<int:media_id>', methods=['DELETE'])
@jwt_required()
def delete_media(media_id):
    current_user = User.query.get(int(get_jwt_identity()))
    media = Media.query.get_or_404(media_id)

    if media.album.user_id != current_user.id and not current_user.is_admin:
        return jsonify(error="No tienes permiso para eliminar este archivo"), 403

    try:
        os.remove(os.path.join(app.config['UPLOAD_FOLDER'], media.file_path))
    except OSError as e:
        print(f"Error eliminando archivo físico (puede que ya no exista): {e}")
    db.session.delete(media)
    db.session.commit()
    return jsonify(message="Archivo multimedia eliminado"), 200

# --- Punto de Entrada ---
if __name__ == '__main__':
    app.run(debug=True)
