from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import os
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from sqlalchemy import or_

from flask_jwt_extended import create_access_token, jwt_required, JWTManager, get_jwt_identity, decode_token
from flask_cors import CORS
from supabase import create_client, Client
from flask_migrate import Migrate


app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}) # Permite todas las origins para depurar

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
migrate = Migrate(app, db)

# --- Configuración JWT y Supabase Storage ---
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "tu-clave-secreta-de-desarrollo-muy-segura")
jwt = JWTManager(app)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
BUCKET_NAME = "database"

def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}
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
    albums = db.relationship('Album', backref='owner', lazy=True, cascade="all, delete-orphan")
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Album(db.Model):
    # --- Columnas Originales ---
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    views_count = db.Column(db.Integer, default=0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    # --- Nuevas Columnas (Contadores) ---
    likes_count = db.Column(db.Integer, default=0, nullable=False)
    saves_count = db.Column(db.Integer, default=0, nullable=False)
    shares_count = db.Column(db.Integer, default=0, nullable=False)

    # --- Relaciones ---
    media = db.relationship('Media', backref='album', lazy=True, cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary='album_tags', backref=db.backref('albums', lazy='dynamic'))
    comments = db.relationship('Comment', backref='album', lazy=True, cascade="all, delete-orphan")
    likes = db.relationship('AlbumLike', backref='album', lazy=True, cascade="all, delete-orphan")
    saved_by = db.relationship('SavedAlbum', backref='album', lazy=True, cascade="all, delete-orphan")

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

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)

    # Relaciones para acceder fácilmente a los objetos
    author = db.relationship('User', backref='comments')
 
 # Modelo para "Seguir" usuarios
class Follow(db.Model):
    __tablename__ = 'follows'
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    followed_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    follower = db.relationship('User', foreign_keys=[follower_id], backref=db.backref('following', lazy='dynamic'))
    followed = db.relationship('User', foreign_keys=[followed_id], backref=db.backref('followers', lazy='dynamic'))

# Modelo para "Likes" de álbumes
class AlbumLike(db.Model):
    __tablename__ = 'album_likes'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Modelo para "Álbumes Guardados"
class SavedAlbum(db.Model):
    __tablename__ = 'saved_albums'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Modelo para "Reportes"
class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Puede ser anónimo si quieres
    reason = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default='pending') # pending, resolved, rejected

    album = db.relationship('Album', backref='reports')
    reporter = db.relationship('User', backref='reported_items')

    # Nuevas relaciones
    likes = db.relationship('AlbumLike', backref='album', lazy=True, cascade="all, delete-orphan")
    saved_by = db.relationship('SavedAlbum', backref='album', lazy=True, cascade="all, delete-orphan")

# Añadir columna de perfil_picture_url a User para el avatar en el header
class User(db.Model):
    # ... (otras columnas existentes) ...
    profile_picture_path = db.Column(db.String(255), nullable=True) # Ruta en Supabase Storage
    banner_image_path = db.Column(db.String(255), nullable=True)   # Ruta en Supabase Storage

# --- Creación de Tablas ---
with app.app_context():
    db.create_all()

# --- Rutas de API ---
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

@app.route('/api/albums', methods=['POST'])
@jwt_required()
def create_album():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or 'title' not in data: return jsonify({'error': 'Faltan datos de álbum (title)'}), 400
    new_album = Album(title=data['title'], description=data.get('description'), user_id=user_id)
    db.session.add(new_album)
    db.session.commit()
    return jsonify({'message': 'Álbum creado exitosamente', 'album': {'id': new_album.id}}), 201

@app.route('/api/albums/<int:album_id>/media', methods=['POST'])
@jwt_required()
def upload_media(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify(error="No tienes permiso"), 403
    
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
    
    if media.album.user_id != user_id:
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
# Ruta para OBTENER comentarios (modificamos la existente)
@app.route('/api/albums/<int:album_id>', methods=['GET'])
def get_album(album_id):
    album = Album.query.get_or_404(album_id)
    album.views_count += 1
    db.session.commit()

    # Contadores de media
    photos_count = Media.query.filter_by(album_id=album.id, file_type='image').count()
    videos_count = Media.query.filter_by(album_id=album.id, file_type='video').count()

    media_list = []
    for item in sorted(album.media, key=lambda m: m.created_at):
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(item.file_path) if supabase else None
        media_list.append({'id': item.id, 'file_path': public_url, 'file_type': item.file_type})

    comments_list = []
    for comment in sorted(album.comments, key=lambda c: c.created_at, reverse=True):
        comments_list.append({
            'id': comment.id,
            'text': comment.text,
            'author_username': comment.author.username,
            'created_at': comment.created_at.isoformat()
        })
    tags_list = [tag.name for tag in album.tags]

    # Endpoint para seguir/dejar de seguir a un usuario
@app.route('/api/users/<int:user_id>/follow', methods=['POST'])
@jwt_required()
def toggle_follow(user_id):
    follower_id = int(get_jwt_identity())
    if follower_id == user_id:
        return jsonify({'error': 'No puedes seguirte a ti mismo.'}), 400

    followed_user = User.query.get_or_404(user_id)

    follow = Follow.query.filter_by(follower_id=follower_id, followed_id=user_id).first()
    if follow:
        db.session.delete(follow)
        message = 'Has dejado de seguir a este usuario.'
        is_followed = False
    else:
        new_follow = Follow(follower_id=follower_id, followed_id=user_id)
        db.session.add(new_follow)
        message = 'Ahora sigues a este usuario.'
        is_followed = True

    db.session.commit()
    return jsonify({'message': message, 'is_followed': is_followed}), 200

# Endpoint para dar "Me gusta"/quitar "Me gusta" a un álbum
@app.route('/api/albums/<int:album_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)

    like = AlbumLike.query.filter_by(user_id=user_id, album_id=album_id).first()
    if like:
        db.session.delete(like)
        album.likes_count -= 1
        message = 'Se ha quitado el "Me gusta".'
        is_liked = False
    else:
        new_like = AlbumLike(user_id=user_id, album_id=album_id)
        db.session.add(new_like)
        album.likes_count += 1
        message = '¡Me gusta añadido!'
        is_liked = True

    db.session.commit()
    return jsonify({'message': message, 'is_liked': is_liked, 'likes_count': album.likes_count}), 200

# Endpoint para guardar/quitar un álbum de guardados
@app.route('/api/albums/<int:album_id>/save', methods=['POST'])
@jwt_required()
def toggle_save(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)

    saved = SavedAlbum.query.filter_by(user_id=user_id, album_id=album_id).first()
    if saved:
        db.session.delete(saved)
        album.saves_count -= 1
        message = 'Álbum quitado de guardados.'
        is_saved = False
    else:
        new_save = SavedAlbum(user_id=user_id, album_id=album_id)
        db.session.add(new_save)
        album.saves_count += 1
        message = 'Álbum guardado.'
        is_saved = True

    db.session.commit()
    return jsonify({'message': message, 'is_saved': is_saved, 'saves_count': album.saves_count}), 200

# Endpoint para reportar un álbum
@app.route('/api/albums/<int:album_id>/report', methods=['POST'])
@jwt_required()
def report_album(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    data = request.get_json()

    reason = data.get('reason')
    description = data.get('description')

    if not reason:
        return jsonify({'error': 'La razón del reporte es obligatoria.'}), 400

    # Opcional: Evitar múltiples reportes del mismo usuario por el mismo álbum
    existing_report = Report.query.filter_by(user_id=user_id, album_id=album_id, status='pending').first()
    if existing_report:
        return jsonify({'message': 'Ya has reportado este álbum. Se encuentra en revisión.'}), 409

    new_report = Report(album_id=album_id, user_id=user_id, reason=reason, description=description)
    db.session.add(new_report)
    db.session.commit()

    return jsonify({'message': 'Álbum reportado. Gracias por tu ayuda.'}), 201

    # --- NUEVA LÓGICA PARA EL ESTADO DEL USUARIO (si está logueado) ---
    user_is_logged_in = False
    is_followed = False
    is_liked = False
    is_saved = False
    current_user_id = None
    current_user_profile_picture = None

    if 'Authorization' in request.headers:
        try:
            auth_header = request.headers['Authorization']
            token_type, token = auth_header.split(None, 1) # Separar "Bearer" del token
            if token_type.lower() == 'bearer':
                # Decodificar el token para obtener el user_id (sub)
                decoded_token = decode_token(token)
                current_user_id = decoded_token['sub']
                user_is_logged_in = True

                # Verificar si el usuario sigue al dueño del álbum
                if Follow.query.filter_by(follower_id=current_user_id, followed_id=album.user_id).first():
                    is_followed = True

                # Verificar si el usuario ha dado "Me gusta"
                if AlbumLike.query.filter_by(user_id=current_user_id, album_id=album.id).first():
                    is_liked = True

                # Verificar si el usuario ha guardado el álbum
                if SavedAlbum.query.filter_by(user_id=current_user_id, album_id=album.id).first():
                    is_saved = True

                current_user_obj = User.query.get(current_user_id)
                current_user_profile_picture = supabase.storage.from_(BUCKET_NAME).get_public_url(current_user_obj.profile_picture_url) if current_user_obj and current_user_obj.profile_picture_url else None
        except Exception as e:
            # Si el token es inválido o expira, simplemente tratamos al usuario como no logueado
            print(f"Error al decodificar token o buscar estado de usuario: {e}")
            user_is_logged_in = False

    owner_profile_picture = supabase.storage.from_(BUCKET_NAME).get_public_url(album.owner.profile_picture_url) if album.owner.profile_picture_url else None

    return jsonify({
        'id': album.id, 
        'title': album.title, 
        'description': album.description, 
        'user_id': album.user_id, 
        'owner_username': album.owner.username, 
        'owner_profile_picture': owner_profile_picture, # <-- Avatar del dueño
        'media': media_list,
        'comments': comments_list,
        'tags': tags_list,
        'views_count': album.views_count,
        'photos_count': photos_count, # <-- Conteo de fotos
        'videos_count': videos_count, # <-- Conteo de videos
        'likes_count': album.likes_count, # <-- Conteo de likes
        'saves_count': album.saves_count, # <-- Conteo de guardados
        'shares_count': album.shares_count, # <-- Conteo de compartidos

        # Estado del usuario actual
        'user_is_logged_in': user_is_logged_in,
        'is_followed': is_followed,
        'is_liked': is_liked,
        'is_saved': is_saved,
        'current_user_profile_picture': current_user_profile_picture # Avatar del usuario actual para el comentario
    })
    # --- INICIO DE CÓDIGO NUEVO ---
    tags_list = [tag.name for tag in album.tags]
    # --- FIN DE CÓDIGO NUEVO ---
    
    # <-- INICIO: CÓDIGO NUEVO -->
    comments_list = []
    # Ordenamos los comentarios, los más nuevos primero
    for comment in sorted(album.comments, key=lambda c: c.created_at, reverse=True):
        comments_list.append({
            'id': comment.id,
            'text': comment.text,
            'author_username': comment.author.username,
            'created_at': comment.created_at.isoformat()
        })
    # <-- FIN: CÓDIGO NUEVO -->
    return jsonify({'id': album.id, 'title': album.title, 'description': album.description, 'created_at': album.created_at.isoformat(), 'views_count': album.views_count, 'user_id': album.owner.id, 'owner_username': album.owner.username, 'media': media_list, 'comments': comments_list, 'tags': tags_list}) # <-- INCLUIMOS comments_list EN LA RESPUESTA

# Ruta para PUBLICAR un nuevo comentario (requiere login)
@app.route('/api/albums/<int:album_id>/comments', methods=['POST'])
@jwt_required()
def post_comment(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    data = request.get_json()

    if not data or 'text' not in data or not data['text'].strip():
        return jsonify({'error': 'El comentario no puede estar vacío'}), 400

    new_comment = Comment(text=data['text'], user_id=user_id, album_id=album.id)
    db.session.add(new_comment)
    db.session.commit()

    return jsonify({
        'message': 'Comentario añadido', 
        'comment': {
            'id': new_comment.id,
            'text': new_comment.text,
            'author_username': new_comment.author.username,
            'created_at': new_comment.created_at.isoformat()
        }
    }), 201
@app.route('/api/albums/<int:album_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_album_update_delete(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)

    if album.user_id != user_id:
        return jsonify({'error': 'No tienes permiso para esta acción'}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if 'title' in data: album.title = data['title']
        if 'description' in data: album.description = data['description']
        db.session.commit()
        return jsonify({'message': 'Álbum actualizado'})
    
    if request.method == 'DELETE':
        if supabase:
            files_to_delete = [media.file_path for media in album.media]
            if files_to_delete:
                try: supabase.storage.from_(BUCKET_NAME).remove(files_to_delete)
                except Exception as e: print(f"Error eliminando archivos de Supabase: {e}")
        
        db.session.delete(album)
        db.session.commit()
        return jsonify({'message': 'Álbum eliminado'})

if __name__ == '__main__':
    app.run(debug=True)
