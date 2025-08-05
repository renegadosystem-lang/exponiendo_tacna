from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import or_

from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity
from flask_cors import CORS
# --- Importaciones de Supabase ---
from supabase import create_client, Client

app = Flask(__name__)
CORS(app)

# --- Configuración de la Base de Datos (Corregida y Simplificada) ---
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL:
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
else:
    print("ADVERTENCIA: No se encontró DATABASE_URL, usando configuración local.")
    DB_USER = 'Exponiendo_Tacna_admin'
    DB_PASSWORD = 'pillito05122002'
    DB_HOST = 'localhost'
    DB_NAME = 'Exponiendo_Tacna_db'
    app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# --- Configuración JWT y Supabase ---
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "tu-clave-secreta-de-desarrollo-muy-segura")
jwt = JWTManager(app)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
BUCKET_NAME = "database" # El nombre de tu bucket en Supabase

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Modelos de Base de Datos (sin cambios) ---
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

## Rutas de Autenticación y Perfil
@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    if not all(key in data for key in ['username', 'email', 'password']):
        return jsonify({'error': 'Faltan datos de registro'}), 400
    if User.query.filter_by(username=data['username']).first() or User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'El usuario o email ya existe'}), 409
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
    profile_pic_url = supabase.storage.from_(BUCKET_NAME).get_public_url(user.profile_picture_path) if user.profile_picture_path and supabase else None
    banner_url = supabase.storage.from_(BUCKET_NAME).get_public_url(user.banner_image_path) if user.banner_image_path and supabase else None
    
    user_albums = Album.query.filter_by(user_id=user.id).order_by(Album.created_at.desc()).all()
    albums_list = []
    for album in user_albums:
        first_media = Media.query.filter_by(album_id=album.id).order_by(Media.created_at.asc()).first()
        thumbnail_url = supabase.storage.from_(BUCKET_NAME).get_public_url(first_media.file_path) if first_media and supabase else None
        albums_list.append({'id': album.id, 'title': album.title, 'thumbnail_url': thumbnail_url, 'views_count': album.views_count})
    return jsonify({'id': user.id, 'username': user.username, 'bio': user.bio, 'profile_picture_url': profile_pic_url, 'banner_image_url': banner_url, 'albums': albums_list})

@app.route('/api/my-profile', methods=['PUT'])
@jwt_required()
def update_my_profile():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json()
    if 'bio' in data: user.bio = data['bio']
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado'})

def handle_supabase_upload(user, file, image_type):
    if file and allowed_file(file.filename) and supabase:
        file_content = file.read()
        filename = secure_filename(file.filename)
        unique_filename = f"{user.username}/{image_type}/{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        
        old_path = None
        if image_type == 'avatar' and user.profile_picture_path: old_path = user.profile_picture_path
        elif image_type == 'banner' and user.banner_image_path: old_path = user.banner_image_path
        
        if old_path:
            try: supabase.storage.from_(BUCKET_NAME).remove([old_path])
            except Exception as e: print(f"Error al eliminar archivo antiguo: {e}")

        supabase.storage.from_(BUCKET_NAME).upload(file=file_content, path=unique_filename, file_options={"content-type": file.content_type})
        return unique_filename
    return None

@app.route('/api/my-profile/picture', methods=['POST', 'DELETE'])
@jwt_required()
def handle_profile_picture():
    user = User.query.get(int(get_jwt_identity()))
    if request.method == 'POST':
        file = request.files.get('file')
        if not file: return jsonify({'error': 'No se encontró el archivo'}), 400
        new_path = handle_supabase_upload(user, file, 'avatar')
        if new_path:
            user.profile_picture_path = new_path
            db.session.commit()
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(new_path)
            return jsonify({'message': 'Foto de perfil actualizada', 'profile_picture_url': public_url})
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        if user.profile_picture_path and supabase:
            supabase.storage.from_(BUCKET_NAME).remove([user.profile_picture_path])
            user.profile_picture_path = None
            db.session.commit()
        return jsonify({'message': 'Foto de perfil eliminada'})

@app.route('/api/my-profile/banner', methods=['POST', 'DELETE'])
@jwt_required()
def handle_banner_image():
    user = User.query.get(int(get_jwt_identity()))
    if request.method == 'POST':
        file = request.files.get('file')
        if not file: return jsonify({'error': 'No se encontró el archivo'}), 400
        new_path = handle_supabase_upload(user, file, 'banner')
        if new_path:
            user.banner_image_path = new_path
            db.session.commit()
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(new_path)
            return jsonify({'message': 'Banner actualizado', 'banner_image_url': public_url})
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        if user.banner_image_path and supabase:
            supabase.storage.from_(BUCKET_NAME).remove([user.banner_image_path])
            user.banner_image_path = None
            db.session.commit()
        return jsonify({'message': 'Banner eliminado'})

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
        # Primero eliminar archivos de Supabase
        if supabase:
            try:
                # Eliminar avatares y banners
                paths_to_delete = []
                if user_to_delete.profile_picture_path: paths_to_delete.append(user_to_delete.profile_picture_path)
                if user_to_delete.banner_image_path: paths_to_delete.append(user_to_delete.banner_image_path)
                if paths_to_delete: supabase.storage.from_(BUCKET_NAME).remove(paths_to_delete)
                # Eliminar contenido de álbumes
                supabase.storage.from_(BUCKET_NAME).remove([f"{user_to_delete.username}/"])
            except Exception as e:
                print(f"Error al eliminar archivos del usuario {user_to_delete.username} de Supabase: {e}")

        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({'message': 'Usuario y su contenido han sido eliminados'}), 200
    else:
        return jsonify({'error': 'No tienes permiso para eliminar este usuario'}), 403

## Rutas de Álbumes y Media
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

@app.route('/api/albums/<int:album_id>/media', methods=['POST'])
@jwt_required()
def upload_media(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify(error="No tienes permiso para subir a este álbum"), 403
    
    file = request.files.get('file')
    if not file: return jsonify(error="No se encontró el archivo"), 400

    if allowed_file(file.filename) and supabase:
        file_content = file.read()
        filename = secure_filename(file.filename)
        unique_filename = f"{album.owner.username}/{album.id}/{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{filename}"
        
        supabase.storage.from_(BUCKET_NAME).upload(file=file_content, path=unique_filename, file_options={"content-type": file.content_type})

        new_media = Media(album_id=album.id, file_path=unique_filename, file_type=file.content_type, title=request.form.get('title'), description=request.form.get('description'))
        db.session.add(new_media)
        db.session.commit()
        return jsonify(message="Archivo subido exitosamente"), 201
    return jsonify(error="Tipo de archivo no permitido"), 400

@app.route('/api/media/<int:media_id>', methods=['DELETE'])
@jwt_required()
def delete_media(media_id):
    user_id = int(get_jwt_identity())
    media = Media.query.get_or_404(media_id)
    current_user = User.query.get(user_id)
    
    if media.album.user_id != user_id and not current_user.is_admin:
        return jsonify(error="No tienes permiso"), 403
    
    if supabase:
        try: supabase.storage.from_(BUCKET_NAME).remove([media.file_path])
        except Exception as e: print(f"Error al eliminar de Supabase: {e}")

    db.session.delete(media)
    db.session.commit()
    return jsonify(message="Archivo multimedia eliminado")

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
        thumbnail_url = supabase.storage.from_(BUCKET_NAME).get_public_url(first_media.file_path) if first_media and supabase else None
        albums_list.append({'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.owner.id, 'created_at': album.created_at.isoformat(), 'views_count': album.views_count, 'owner_username': album.owner.username, 'thumbnail_url': thumbnail_url})
    return jsonify({'albums': albums_list, 'total_pages': pagination.pages, 'current_page': pagination.page, 'has_next': pagination.has_next, 'has_prev': pagination.has_prev, 'next_page': pagination.next_num, 'prev_page': pagination.prev_num})

@app.route('/api/albums/<int:album_id>', methods=['GET'])
def get_album(album_id):
    album = Album.query.get_or_404(album_id)
    album.views_count += 1
    db.session.commit()
    media_list = []
    for item in album.media:
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(item.file_path) if supabase else None
        media_list.append({'id': item.id, 'file_path': public_url, 'file_type': item.file_type})
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
        if supabase:
            files_to_delete = [media.file_path for media in album.media]
            if files_to_delete:
                try: supabase.storage.from_(BUCKET_NAME).remove(files_to_delete)
                except Exception as e: print(f"Error eliminando archivos de Supabase: {e}")
        
        db.session.delete(album)
        db.session.commit()
        return jsonify({'message': 'Álbum eliminado exitosamente'})

if __name__ == '__main__':
    app.run(debug=True)
