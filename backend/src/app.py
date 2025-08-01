# C:\Exponiendo_Tacna\backend\src\app.py (Versión Final con Perfiles y Eliminación de Foto)

from flask import Flask, jsonify, request, send_from_directory, render_template
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

# --- Configuración de la Base de Datos ---
# --- CAMBIO IMPORTANTE: Configuración de la Base de Datos para Producción ---
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgres://exponiendo_tacna:aHvr7SXZ1dDAoOa@exponiendo-tacna-db.flycast:5432/exponiendo_tacna?sslmode=disable')
if DATABASE_URL is None:
    # Configuración para desarrollo local si la variable no está presente
    print("ADVERTENCIA: No se encontró DATABASE_URL, usando configuración local.")
# --- Configuración de la Base de Datos (Versión para Fly.io) ---
DATABASE_URL = os.environ.get("DATABASE_URL")

# La URL de Fly.io viene como 'postgres://...', pero SQLAlchemy prefiere 'postgresql://...'
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL:
    # Configuración para producción en Fly.io
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

# --- Configuración JWT ---
app.config["JWT_SECRET_KEY"] = "tu-clave-secreta-jwt-muy-larga-y-unica-para-produccion-12345"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
jwt = JWTManager(app)

# --- Configuración para Subida de Archivos ---
UPLOAD_FOLDER = os.path.join(app.root_path, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}

def allowed_file(filename):
    """Verifica si la extensión del archivo está permitida."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Modelos de Base de Datos ---

class User(db.Model):
    """Define el modelo de usuario."""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    bio = db.Column(db.Text, nullable=True, default="¡Bienvenido a mi perfil!")
    profile_picture_path = db.Column(db.String(255), nullable=True)
    banner_image_path = db.Column(db.String(255), nullable=True)
    albums = db.relationship('Album', backref='owner', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<User {self.username}>'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Album(db.Model):
    """Define el modelo de álbum."""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    views_count = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    media = db.relationship('Media', backref='album', lazy=True, cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary='album_tags', backref=db.backref('albums', lazy='dynamic'))

    def __repr__(self):
        return f'<Album {self.title}>'

class Media(db.Model):
    """Define el modelo de contenido multimedia (fotos/videos)."""
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    thumbnail_path = db.Column(db.String(255), nullable=True)
    views_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    title = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<Media {self.file_path}>'

media_tags = db.Table('media_tags',
    db.Column('media_id', db.Integer, db.ForeignKey('media.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

album_tags = db.Table('album_tags',
    db.Column('album_id', db.Integer, db.ForeignKey('album.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class Tag(db.Model):
    """Define el modelo de Tag (Etiqueta)."""
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def __repr__(self):
        return f'<Tag {self.name}>'

Media.tags = db.relationship('Tag', secondary=media_tags, backref=db.backref('media_items', lazy='dynamic'))

# --- Rutas de la App (Vistas HTML) ---

@app.route('/')
def serve_frontend():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/profile/<username>')
def profile_page(username):
    return render_template('profile.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# --- Rutas de API ---

## Rutas de Autenticación

@app.route('/api/register', methods=['POST'])
def register_user():
    data = request.get_json()
    if not data or not 'username' in data or not 'email' in data or not 'password' in data:
        return jsonify({'error': 'Faltan datos de registro (username, email, password)'}), 400
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'El nombre de usuario ya existe'}), 409
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'El email ya está registrado'}), 409
    try:
        new_user = User(username=data['username'], email=data['email'])
        new_user.set_password(data['password'])
        db.session.add(new_user)
        db.session.commit()
        return jsonify({'message': 'Usuario registrado exitosamente', 'user_id': new_user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login_user():
    data = request.get_json()
    username = data.get('username', None)
    password = data.get('password', None)
    user = User.query.filter_by(username=username).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=str(user.id))
        # --- CAMBIO IMPORTANTE: Devolvemos el username para usarlo en el frontend ---
        return jsonify(access_token=access_token, username=user.username), 200
    else:
        return jsonify({"error": "Usuario o contraseña inválidos"}), 401

## Rutas de Perfil

@app.route('/api/profiles/<username>', methods=['GET'])
def get_user_profile(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    user_albums = Album.query.filter_by(user_id=user.id).order_by(Album.created_at.desc()).all()
    albums_list = []
    for album in user_albums:
        first_media = Media.query.filter_by(album_id=album.id).order_by(Media.created_at.asc()).first()
        albums_list.append({
            'id': album.id,
            'title': album.title,
            'thumbnail_url': f'/uploads/{first_media.file_path}' if first_media else None,
            'views_count': album.views_count
        })

    return jsonify({
        'id': user.id,
        'username': user.username,
        'bio': user.bio,
        'profile_picture_url': f'/uploads/{user.profile_picture_path}' if user.profile_picture_path else None,
        'banner_image_url': f'/uploads/{user.banner_image_path}' if user.banner_image_path else None,
        'albums': albums_list
    }), 200

@app.route('/api/my-profile', methods=['PUT'])
@jwt_required()
def update_my_profile():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    data = request.get_json()
    if 'bio' in data:
        user.bio = data['bio']
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado exitosamente'}), 200

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

@app.route('/api/my-profile/picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if 'file' not in request.files: return jsonify({'error': 'No se encontró el archivo'}), 400
    file = request.files['file']
    new_filename = handle_profile_image_upload(user, file, 'avatar')
    if new_filename:
        user.profile_picture_path = new_filename
        db.session.commit()
        return jsonify({'message': 'Foto de perfil actualizada', 'profile_picture_url': f'/uploads/{new_filename}'}), 200
    return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    return jsonify({'message': 'No hay foto de perfil para eliminar'}), 200
# --- FIN DE LA NUEVA RUTA DELETE ---

@app.route('/api/my-profile/banner', methods=['POST'])
@jwt_required()
def upload_banner_image():
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if 'file' not in request.files: return jsonify({'error': 'No se encontró el archivo'}), 400
    file = request.files['file']
    new_filename = handle_profile_image_upload(user, file, 'banner')
    if new_filename:
        user.banner_image_path = new_filename
        db.session.commit()
        return jsonify({'message': 'Banner actualizado', 'banner_image_url': f'/uploads/{new_filename}'}), 200
    return jsonify({'error': 'Tipo de archivo no permitido'}), 400
# --- INICIO DE LAS NUEVAS RUTAS DELETE ---
@app.route('/api/my-profile/picture', methods=['DELETE'])
@jwt_required()
def delete_profile_picture():
    """Elimina la foto de perfil del usuario y la revierte a la predeterminada."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    if user.profile_picture_path:
        file_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], user.profile_picture_path)
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)
        
        user.profile_picture_path = None
        db.session.commit()
        return jsonify({'message': 'Foto de perfil eliminada exitosamente'}), 200
    
    return jsonify({'message': 'No hay foto de perfil para eliminar'}), 200

@app.route('/api/my-profile/banner', methods=['DELETE'])
@jwt_required()
def delete_banner_image():
    """Elimina el banner del usuario y lo revierte al predeterminado."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.banner_image_path:
        file_to_delete = os.path.join(app.config['UPLOAD_FOLDER'], user.banner_image_path)
        if os.path.exists(file_to_delete):
            os.remove(file_to_delete)
        
        user.banner_image_path = None
        db.session.commit()
        return jsonify({'message': 'Banner eliminado exitosamente'}), 200
    
    return jsonify({'message': 'No hay banner para eliminar'}), 200
# --- FIN DE LAS NUEVAS RUTAS DELETE ---

## Rutas de Usuarios
@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    users = User.query.all()
    users_list = [{'id': user.id, 'username': user.username, 'email': user.email} for user in users]
    return jsonify(users_list)

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user_id = int(get_jwt_identity())
    user_to_delete = User.query.get(user_id)
    if not user_to_delete:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    if current_user_id != user_to_delete.id:
        return jsonify({'error': 'No tienes permiso para eliminar este usuario'}), 403
    try:
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify({'message': 'Usuario eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

## Rutas de Álbumes
@app.route('/api/albums', methods=['POST'])
@jwt_required()
def create_album():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not 'title' in data:
        return jsonify({'error': 'Faltan datos de álbum (title)'}), 400
    try:
        new_album = Album(title=data['title'], description=data.get('description'), user_id=current_user_id)
        db.session.add(new_album)
        db.session.commit()
        return jsonify({'message': 'Álbum creado exitosamente', 'album': {'id': new_album.id, 'title': new_album.title, 'description': new_album.description, 'user_id': new_album.user_id, 'created_at': new_album.created_at.isoformat()}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/albums', methods=['GET'])
def get_all_albums():
    search_query = request.args.get('q')
    tag_ids_str = request.args.get('tags')
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    albums_query = Album.query
    if search_query:
        search_pattern = f"%{search_query}%"
        albums_query = albums_query.filter(or_(Album.title.ilike(search_pattern), Album.description.ilike(search_pattern)))
    if tag_ids_str:
        try:
            tag_ids = [int(tid) for tid in tag_ids_str.split(',')]
            albums_query = albums_query.join(Album.tags).filter(Tag.id.in_(tag_ids))
        except ValueError:
            return jsonify({'error': 'Los IDs de los tags deben ser números enteros separados por comas.'}), 400
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            albums_query = albums_query.filter(Album.created_at >= start_date)
        except ValueError:
            return jsonify({'error': 'Formato de fecha de inicio inválido. Use YYYY-MM-DD.'}), 400
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1) - timedelta(microseconds=1)
            albums_query = albums_query.filter(Album.created_at <= end_date)
        except ValueError:
            return jsonify({'error': 'Formato de fecha de fin inválido. Use YYYY-MM-DD.'}), 400
    order_logic = {'created_at': Album.created_at, 'views_count': Album.views_count, 'title': Album.title}
    order_column = order_logic.get(sort_by, Album.created_at)
    if sort_order == 'asc':
        albums_query = albums_query.order_by(order_column.asc())
    else:
        albums_query = albums_query.order_by(order_column.desc())
    pagination = albums_query.paginate(page=page, per_page=per_page, error_out=False)
    albums = pagination.items
    albums_list = []
    for album in albums:
        first_media = Media.query.filter_by(album_id=album.id).order_by(Media.created_at.asc()).first()
        thumbnail_url = f'/uploads/{first_media.file_path}' if first_media else None
        albums_list.append({'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.user_id, 'created_at': album.created_at.isoformat(), 'views_count': album.views_count, 'owner_username': album.owner.username if album.owner else None, 'tags': [{'id': tag.id, 'name': tag.name} for tag in album.tags], 'thumbnail_url': thumbnail_url})
    return jsonify({'albums': albums_list, 'total_items': pagination.total, 'total_pages': pagination.pages, 'current_page': pagination.page, 'has_next': pagination.has_next, 'has_prev': pagination.has_prev, 'next_page': pagination.next_num if pagination.has_next else None, 'prev_page': pagination.prev_num if pagination.has_prev else None})

@app.route('/api/albums/<int:album_id>', methods=['GET'])
def get_album(album_id):
    album = Album.query.get(album_id)
    if not album:
        return jsonify({'error': 'Álbum no encontrado'}), 404
    album.views_count += 1
    db.session.commit()
    media_list = [{'id': item.id, 'file_path': item.file_path, 'file_type': item.file_type, 'thumbnail_path': item.thumbnail_path, 'views_count': item.views_count, 'created_at': item.created_at.isoformat(), 'title': item.title, 'description': item.description, 'tags': [{'id': tag.id, 'name': tag.name} for tag in item.tags]} for item in album.media]
    return jsonify({'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.user_id, 'created_at': album.created_at.isoformat(), 'views_count': album.views_count, 'owner_username': album.owner.username if album.owner else None, 'tags': [{'id': tag.id, 'name': tag.name} for tag in album.tags], 'media': media_list})

@app.route('/api/albums/<int:album_id>', methods=['PUT'])
@jwt_required()
def update_album(album_id):
    current_user_id = int(get_jwt_identity())
    album = Album.query.get(album_id)
    if not album: return jsonify({'error': 'Álbum no encontrado'}), 404
    if album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para actualizar este álbum'}), 403
    data = request.get_json()
    if not data: return jsonify({'error': 'No hay datos proporcionados para actualizar'}), 400
    try:
        if 'title' in data: album.title = data['title']
        if 'description' in data: album.description = data['description']
        db.session.commit()
        return jsonify({'message': 'Álbum actualizado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/albums/<int:album_id>', methods=['DELETE'])
@jwt_required()
def delete_album(album_id):
    current_user_id = int(get_jwt_identity())
    album = Album.query.get(album_id)
    if not album: return jsonify({'error': 'Álbum no encontrado'}), 404
    if album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para eliminar este álbum'}), 403
    try:
        db.session.delete(album)
        db.session.commit()
        return jsonify({'message': 'Álbum eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

## Rutas de Media
@app.route('/api/albums/<int:album_id>/media', methods=['POST'])
@jwt_required()
def upload_media(album_id):
    current_user_id = int(get_jwt_identity())
    album = Album.query.get(album_id)
    if not album: return jsonify({'error': 'Álbum no encontrado'}), 404
    if album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para subir media a este álbum'}), 403
    if 'file' not in request.files: return jsonify({'error': 'No se encontró el archivo en la petición'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'Nombre de archivo no válido'}), 400
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filename_base, file_extension = os.path.splitext(filename)
        unique_filename = f"{filename_base}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}{file_extension}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        media_type = 'other'
        if file_extension.lower() in {'.png', '.jpg', '.jpeg', '.gif'}: media_type = 'image'
        elif file_extension.lower() in {'.mp4', '.avi', '.mov'}: media_type = 'video'
        media_title, media_description, tag_names_str = request.form.get('title'), request.form.get('description'), request.form.get('tags')
        try:
            new_media = Media(album_id=album.id, file_path=unique_filename, file_type=media_type, title=media_title, description=media_description)
            if tag_names_str:
                for name in [name.strip() for name in tag_names_str.split(',') if name.strip()]:
                    tag = Tag.query.filter_by(name=name).first()
                    if not tag: tag = Tag(name=name); db.session.add(tag)
                    new_media.tags.append(tag)
            db.session.add(new_media)
            db.session.commit()
            return jsonify({'message': 'Archivo subido y media registrada exitosamente', 'media': {'id': new_media.id, 'file_path': new_media.file_path, 'file_type': new_media.file_type, 'album_id': new_media.album_id, 'created_at': new_media.created_at.isoformat(), 'title': new_media.title, 'description': new_media.description, 'tags': [{'id': tag.id, 'name': tag.name} for tag in new_media.tags]}}), 201
        except Exception as e:
            db.session.rollback()
            if os.path.exists(file_path): os.remove(file_path)
            return jsonify({'error': str(e)}), 500
    else: return jsonify({'error': 'Tipo de archivo no permitido'}), 400

@app.route('/api/media/<int:media_id>', methods=['GET'])
def get_media(media_id):
    media_item = Media.query.get(media_id)
    if not media_item: return jsonify({'error': 'Contenido multimedia no encontrado'}), 404
    media_item.views_count += 1
    db.session.commit()
    return jsonify({'id': media_item.id, 'file_path': media_item.file_path, 'file_type': media_item.file_type, 'album_id': media_item.album_id, 'views_count': media_item.views_count, 'created_at': media_item.created_at.isoformat(), 'title': media_item.title, 'description': media_item.description, 'tags': [{'id': tag.id, 'name': tag.name} for tag in media_item.tags]})

@app.route('/api/media/<int:media_id>', methods=['DELETE'])
@jwt_required()
def delete_media(media_id):
    current_user_id = int(get_jwt_identity())
    media_item = Media.query.get(media_id)
    if not media_item: return jsonify({'error': 'Contenido multimedia no encontrado'}), 404
    album = Album.query.get(media_item.album_id)
    if not album or album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para eliminar este contenido multimedia'}), 403
    try:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], media_item.file_path)
        if os.path.exists(file_path): os.remove(file_path)
        db.session.delete(media_item)
        db.session.commit()
        return jsonify({'message': 'Contenido multimedia eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/media/search', methods=['GET'])
def search_media():
    search_query, file_type, tag_ids_str, start_date_str, end_date_str, sort_by, sort_order = request.args.get('q'), request.args.get('file_type'), request.args.get('tags'), request.args.get('start_date'), request.args.get('end_date'), request.args.get('sort_by', 'created_at'), request.args.get('sort_order', 'desc')
    page, per_page = request.args.get('page', 1, type=int), request.args.get('per_page', 10, type=int)
    media_query = Media.query
    if search_query: media_query = media_query.filter(or_(Media.title.ilike(f"%{search_query}%"), Media.description.ilike(f"%{search_query}%")))
    if file_type and file_type.lower() in ['image', 'video', 'other']: media_query = media_query.filter(Media.file_type == file_type.lower())
    if tag_ids_str:
        try:
            media_query = media_query.join(Media.tags).filter(Tag.id.in_([int(tid) for tid in tag_ids_str.split(',')]))
        except ValueError: return jsonify({'error': 'Los IDs de los tags deben ser números enteros separados por comas.'}), 400
    if start_date_str:
        try: media_query = media_query.filter(Media.created_at >= datetime.strptime(start_date_str, '%Y-%m-%d'))
        except ValueError: return jsonify({'error': 'Formato de fecha de inicio inválido. Use YYYY-MM-DD.'}), 400
    if end_date_str:
        try: media_query = media_query.filter(Media.created_at <= datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1) - timedelta(microseconds=1))
        except ValueError: return jsonify({'error': 'Formato de fecha de fin inválido. Use YYYY-MM-DD.'}), 400
    order_map = {'created_at': Media.created_at, 'views_count': Media.views_count, 'title': Media.title}
    order_col = order_map.get(sort_by, Media.created_at)
    media_query = media_query.order_by(order_col.asc() if sort_order == 'asc' else order_col.desc())
    pagination = media_query.paginate(page=page, per_page=per_page, error_out=False)
    results_list = [{'id': item.id, 'file_path': item.file_path, 'file_type': item.file_type, 'album_id': item.album_id, 'title': item.title, 'description': item.description, 'created_at': item.created_at.isoformat(), 'tags': [{'id': tag.id, 'name': tag.name} for tag in item.tags]} for item in pagination.items]
    return jsonify({'media': results_list, 'total_items': pagination.total, 'total_pages': pagination.pages, 'current_page': pagination.page, 'has_next': pagination.has_next, 'has_prev': pagination.has_prev, 'next_page': pagination.next_num, 'prev_page': pagination.prev_num})

## Rutas para gestionar Tags
@app.route('/api/tags', methods=['POST'])
@jwt_required()
def create_tag():
    data = request.get_json()
    if not data or not 'name' in data: return jsonify({'error': 'Falta el nombre del tag'}), 400
    name = data['name'].strip().lower()
    if Tag.query.filter_by(name=name).first(): return jsonify({'error': f'El tag "{name}" ya existe'}), 409
    try:
        new_tag = Tag(name=name)
        db.session.add(new_tag)
        db.session.commit()
        return jsonify({'message': 'Tag creado exitosamente', 'tag': {'id': new_tag.id, 'name': new_tag.name}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags', methods=['GET'])
def get_all_tags():
    tags = Tag.query.all()
    return jsonify({'tags': [{'id': tag.id, 'name': tag.name} for tag in tags]})

@app.route('/api/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def delete_tag(tag_id):
    tag = Tag.query.get(tag_id)
    if not tag: return jsonify({'error': 'Tag no encontrado'}), 404
    try:
        db.session.delete(tag)
        db.session.commit()
        return jsonify({'message': 'Tag eliminado exitosamente'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/media/<int:media_id>/tags', methods=['POST'])
@jwt_required()
def add_tags_to_media(media_id):
    current_user_id = int(get_jwt_identity())
    media_item = Media.query.get(media_id)
    if not media_item: return jsonify({'error': 'Contenido multimedia no encontrado'}), 404
    album = Album.query.get(media_item.album_id)
    if not album or album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para modificar este contenido multimedia'}), 403
    data = request.get_json()
    if not data or not 'tag_names' in data or not isinstance(data['tag_names'], list): return jsonify({'error': 'Faltan nombres de tags (lista de strings) o formato incorrecto'}), 400
    added_tags = []
    try:
        for tag_name in data['tag_names']:
            tag_name_normalized = tag_name.strip().lower()
            tag = Tag.query.filter_by(name=tag_name_normalized).first()
            if not tag: tag = Tag(name=tag_name_normalized); db.session.add(tag)
            if tag not in media_item.tags: media_item.tags.append(tag); added_tags.append({'id': tag.id, 'name': tag.name})
        db.session.commit()
        return jsonify({'message': 'Tags añadidos exitosamente al contenido multimedia', 'added_tags': added_tags}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/media/<int:media_id>/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def remove_tag_from_media(media_id, tag_id):
    current_user_id = int(get_jwt_identity())
    media_item = Media.query.get(media_id)
    if not media_item: return jsonify({'error': 'Contenido multimedia no encontrado'}), 404
    album = Album.query.get(media_item.album_id)
    if not album or album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para modificar este contenido multimedia'}), 403
    tag = Tag.query.get(tag_id)
    if not tag: return jsonify({'error': 'Tag no encontrado'}), 404
    try:
        if tag in media_item.tags:
            media_item.tags.remove(tag)
            db.session.commit()
            return jsonify({'message': 'Tag eliminado del contenido multimedia exitosamente'}), 200
        else: return jsonify({'error': 'El tag no está asociado a este contenido multimedia'}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/albums/<int:album_id>/tags', methods=['POST'])
@jwt_required()
def add_tags_to_album(album_id):
    current_user_id = int(get_jwt_identity())
    album = Album.query.get(album_id)
    if not album: return jsonify({'error': 'Álbum no encontrado'}), 404
    if album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para modificar este álbum'}), 403
    data = request.get_json()
    if not data or not 'tag_names' in data or not isinstance(data['tag_names'], list): return jsonify({'error': 'Faltan nombres de tags (lista de strings) o formato incorrecto'}), 400
    added_tags = []
    try:
        for tag_name in data['tag_names']:
            tag_name_normalized = tag_name.strip().lower()
            tag = Tag.query.filter_by(name=tag_name_normalized).first()
            if not tag: tag = Tag(name=tag_name_normalized); db.session.add(tag)
            if tag not in album.tags: album.tags.append(tag); added_tags.append({'id': tag.id, 'name': tag.name})
        db.session.commit()
        return jsonify({'message': 'Tags añadidos exitosamente al álbum', 'added_tags': added_tags}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/albums/<int:album_id>/tags/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def remove_tag_from_album(album_id, tag_id):
    current_user_id = int(get_jwt_identity())
    album = Album.query.get(album_id)
    if not album: return jsonify({'error': 'Álbum no encontrado'}), 404
    if album.user_id != current_user_id: return jsonify({'error': 'No tienes permiso para modificar este álbum'}), 403
    tag = Tag.query.get(tag_id)
    if not tag: return jsonify({'error': 'Tag no encontrado'}), 404
    try:
        if tag in album.tags:
            album.tags.remove(tag)
            db.session.commit()
            return jsonify({'message': 'Tag eliminado del álbum exitosamente'}), 200
        else: return jsonify({'error': 'El tag no está asociado a este álbum'}), 404
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/contact', methods=['POST'])
def contact_form_submission():
    data = request.get_json()
    if not data or not 'name' in data or not 'email' in data or not 'message' in data:
        return jsonify({'error': 'Faltan datos en el formulario de contacto (nombre, email, mensaje)'}), 400
    name, email, message = data.get('name'), data.get('email'), data.get('message')
    print(f"Mensaje de contacto recibido de {name} ({email}): {message}")
    return jsonify({"message": "Mensaje de contacto recibido con éxito"}), 200

# --- Punto de Entrada para Ejecutar la Aplicación ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        print("Tablas de la base de datos creadas/verificadas.")
    app.run(debug=True)