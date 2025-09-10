# =========================================================================
#  app.py (Versión Final, Estable y Completa)
# =========================================================================
import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, jwt_required, create_access_token, 
    get_jwt_identity, decode_token
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from supabase import create_client, Client

# --- 1. Inicialización de la Aplicación y Extensiones ---
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- 2. Configuración ---
DATABASE_URL = os.environ.get("DATABASE_URL", "").replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL or f"postgresql://{os.environ.get('DB_USER', 'postgres')}:{os.environ.get('DB_PASSWORD', 'postgres')}@{os.environ.get('DB_HOST', 'localhost')}/{os.environ.get('DB_NAME', 'postgres')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "desarrollo-super-secreto-cambiar-en-prod")

db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
BUCKET_NAME = "database"

# --- 3. Modelos de la Base de Datos ---
album_tags = db.Table('album_tags',
    db.Column('album_id', db.Integer, db.ForeignKey('album.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tag.id'), primary_key=True)
)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    bio = db.Column(db.Text, nullable=True)
    profile_picture_path = db.Column(db.String(255), nullable=True)
    banner_image_path = db.Column(db.String(255), nullable=True)
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
    likes_count = db.Column(db.Integer, default=0, nullable=False)
    saves_count = db.Column(db.Integer, default=0, nullable=False)
    shares_count = db.Column(db.Integer, default=0, nullable=False)
    thumbnail_path = db.Column(db.String(255), nullable=True)
    media = db.relationship('Media', backref='album', lazy='dynamic', cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary=album_tags, backref='albums')
    comments = db.relationship('Comment', backref='album', lazy='dynamic', cascade="all, delete-orphan")
    likes = db.relationship('AlbumLike', backref='album', lazy=True, cascade="all, delete-orphan")
    saved_by = db.relationship('SavedAlbum', backref='album', lazy=True, cascade="all, delete-orphan")
    reports = db.relationship('Report', backref='album', lazy=True, cascade="all, delete-orphan")

class Media(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)

class Tag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    author = db.relationship('User', backref='comments')
    reports = db.relationship('CommentReport', backref='comment', lazy='dynamic', cascade="all, delete-orphan")

class Follow(db.Model):
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    followed_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)

class AlbumLike(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)

class SavedAlbum(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)

class Report(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(255), nullable=False)

class CommentReport(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    reporter = db.relationship('User', backref='reported_comments')


# =========================================================================
#  4. FUNCIONES DE AYUDA (HELPERS)
# =========================================================================
def allowed_file(filename):
    """Verifica si la extensión de un archivo está permitida."""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_public_url(path):
    """Genera una URL pública para un archivo de Supabase si existe."""
    return supabase.storage.from_(BUCKET_NAME).get_public_url(path) if path and supabase else None

def handle_supabase_upload(user_username, file, object_path):
    """Sube un archivo a Supabase Storage y devuelve su ruta."""
    if not (file and allowed_file(file.filename) and supabase):
        return None
    
    file_content = file.read()
    filename = secure_filename(file.filename)
    unique_filename = f"{user_username}/{object_path}/{datetime.now().strftime('%Y%m%d%H%M%S%f')}_{filename}"
    
    supabase.storage.from_(BUCKET_NAME).upload(
        file=file_content, 
        path=unique_filename, 
        file_options={"content-type": file.content_type}
    )
    return unique_filename

def delete_from_supabase(path):
    """Elimina un archivo de Supabase Storage."""
    if path and supabase:
        try:
            supabase.storage.from_(BUCKET_NAME).remove([path])
        except Exception as e:
            print(f"Error al eliminar de Supabase: {e}")

# =========================================================================
#  5. RUTAS DE API
# =========================================================================

# --- RUTAS DE AUTENTICACIÓN Y PERFILES ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not all(k in data for k in ['username', 'email', 'password']):
        return jsonify({'error': 'Faltan datos de registro'}), 400
    if User.query.filter((User.username == data['username']) | (User.email == data['email'])).first():
        return jsonify({'error': 'El usuario o email ya existe'}), 409
    
    new_user = User(username=data['username'], email=data['email'])
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()
    return jsonify({'message': 'Usuario registrado exitosamente'}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data.get('username')).first()
    if user and user.check_password(data.get('password')):
        access_token = create_access_token(identity=str(user.id))
        return jsonify(access_token=access_token, username=user.username), 200
    return jsonify({"error": "Usuario o contraseña inválidos"}), 401
    
@app.route('/api/profiles/<username>', methods=['GET'])
def get_user_profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    
    albums_list = []
    # CORRECCIÓN CRÍTICA DE INDENTACIÓN: El bucle ahora procesa todos los álbumes
    for album in user.albums:
        thumbnail_url = get_public_url(album.thumbnail_path)
        if not thumbnail_url:
            first_media = album.media.order_by(Media.position.asc(), Media.created_at.asc()).first()
            thumbnail_url = get_public_url(first_media.file_path) if first_media else None
        
        albums_list.append({
            'id': album.id, 'title': album.title, 
            'thumbnail_url': thumbnail_url, 'views_count': album.views_count
        })

    return jsonify({
        'id': user.id, 'username': user.username, 'bio': user.bio, 
        'profile_picture_url': get_public_url(user.profile_picture_path), 
        'banner_image_url': get_public_url(user.banner_image_path), 
        'albums': albums_list,
        'followers_count': Follow.query.filter_by(followed_id=user.id).count(),
        'following_count': Follow.query.filter_by(follower_id=user.id).count()
    })

@app.route('/api/my-profile', methods=['PUT'])
@jwt_required()
def update_my_profile():
    user = User.query.get(int(get_jwt_identity()))
    data = request.get_json()
    if 'bio' in data: user.bio = data['bio']
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado'})

@app.route('/api/my-profile/picture', methods=['POST', 'DELETE'])
@jwt_required()
def handle_profile_picture():
    user = User.query.get(int(get_jwt_identity()))
    if request.method == 'POST':
        file = request.files.get('file')
        if not file: return jsonify({'error': 'No se encontró el archivo'}), 400
        
        delete_from_supabase(user.profile_picture_path)
        new_path = handle_supabase_upload(user.username, file, 'avatar')
        if new_path:
            user.profile_picture_path = new_path
            db.session.commit()
            return jsonify({'message': 'Foto de perfil actualizada', 'url': get_public_url(new_path)})
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        delete_from_supabase(user.profile_picture_path)
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
        
        delete_from_supabase(user.banner_image_path)
        new_path = handle_supabase_upload(user.username, file, 'banner')
        if new_path:
            user.banner_image_path = new_path
            db.session.commit()
            return jsonify({'message': 'Banner actualizado', 'url': get_public_url(new_path)})
        return jsonify({'error': 'Tipo de archivo no permitido'}), 400
    
    if request.method == 'DELETE':
        delete_from_supabase(user.banner_image_path)
        user.banner_image_path = None
        db.session.commit()
        return jsonify({'message': 'Banner eliminado'})

# --- RUTAS DE ÁLBUMES Y MEDIA ---

@app.route('/api/albums', methods=['GET'])
def get_all_albums():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')

    sort_column_map = {'created_at': Album.created_at, 'views_count': Album.views_count}
    sort_column = sort_column_map.get(sort_by, Album.created_at)
    query_order = sort_column.desc() if sort_order == 'desc' else sort_column.asc()
    
    pagination = Album.query.order_by(query_order).paginate(page=page, per_page=per_page, error_out=False)
    
    albums_list = []
    for album in pagination.items:
        thumbnail_url = get_public_url(album.thumbnail_path)
        if not thumbnail_url:
            first_media = album.media.order_by(Media.position.asc(), Media.created_at.asc()).first()
            thumbnail_url = get_public_url(first_media.file_path) if first_media else None

        albums_list.append({
            'id': album.id, 'title': album.title,
            'owner_username': album.owner.username,
            'views_count': album.views_count, 
            'thumbnail_url': thumbnail_url
        })
        
    return jsonify({
        'albums': albums_list, 'total_pages': pagination.pages, 'current_page': pagination.page
    })

@app.route('/api/albums', methods=['POST'])
@jwt_required()
def create_album():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get('title', '').strip(): return jsonify({'error': 'El título es obligatorio'}), 400
    
    new_album = Album(title=data['title'], description=data.get('description'), user_id=user_id)
    db.session.add(new_album)
    db.session.commit()
    return jsonify({'message': 'Álbum creado exitosamente', 'album_id': new_album.id}), 201

@app.route('/api/albums/<int:album_id>', methods=['GET'])
def get_album(album_id):
    album = Album.query.get_or_404(album_id)
    album.views_count += 1
    db.session.commit()
    
    photos_count = album.media.filter(Media.file_type.startswith('image')).count()
    videos_count = album.media.filter(Media.file_type.startswith('video')).count()

    media_items = album.media.order_by(Media.position.asc(), Media.created_at.asc()).all()
    media_list = [{'id': item.id, 'file_path': get_public_url(item.file_path), 'file_type': item.file_type} for item in media_items]
    
    comments_list = [{'id': c.id, 'text': c.text, 'author_username': c.author.username, 'author_id': c.user_id, 'created_at': c.created_at.isoformat()} for c in album.comments.order_by(Comment.created_at.desc()).all()]
    tags_list = [tag.name for tag in album.tags]
    
    is_followed, is_liked, is_saved, current_user_profile_picture = False, False, False, None
    user_is_logged_in = False
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        try:
            token = auth_header.split(None, 1)[1]
            current_user_id = int(decode_token(token)['sub'])
            user_is_logged_in = True
            is_followed = Follow.query.filter_by(follower_id=current_user_id, followed_id=album.user_id).first() is not None
            is_liked = AlbumLike.query.filter_by(user_id=current_user_id, album_id=album.id).first() is not None
            is_saved = SavedAlbum.query.filter_by(user_id=current_user_id, album_id=album.id).first() is not None
            current_user = User.query.get(current_user_id)
            current_user_profile_picture = get_public_url(current_user.profile_picture_path)
        except Exception:
            pass

    return jsonify({
        'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.user_id,
        'owner_username': album.owner.username, 'owner_profile_picture': get_public_url(album.owner.profile_picture_path),
        'owner_followers_count': Follow.query.filter_by(followed_id=album.user_id).count(),
        'owner_following_count': Follow.query.filter_by(follower_id=album.user_id).count(),
        'media': media_list, 'comments': comments_list, 'tags': tags_list,
        'views_count': album.views_count, 'photos_count': photos_count, 'videos_count': videos_count,
        'likes_count': album.likes_count, 'saves_count': album.saves_count, 'shares_count': album.shares_count,
        'user_is_logged_in': user_is_logged_in, 'is_followed': is_followed, 
        'is_liked': is_liked, 'is_saved': is_saved, 'current_user_profile_picture': current_user_profile_picture,
        'thumbnail_path': album.thumbnail_path
    })

@app.route('/api/albums/<int:album_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_album_update_delete(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id:
        return jsonify({'error': 'No tienes permiso'}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if 'title' in data: album.title = data['title']
        if 'description' in data: album.description = data['description']
        if 'tags' in data:
            album.tags.clear()
            tag_names = [tag.strip().lower() for tag in data['tags'].split(',') if tag.strip()]
            for name in tag_names:
                tag = Tag.query.filter_by(name=name).first() or Tag(name=name)
                if tag not in album.tags:
                    album.tags.append(tag)
        db.session.commit()
        return jsonify({'message': 'Álbum actualizado'})
    
    if request.method == 'DELETE':
        for media in album.media:
            delete_from_supabase(media.file_path)
        db.session.delete(album)
        db.session.commit()
        return jsonify({'message': 'Álbum eliminado'})

@app.route('/api/albums/<int:album_id>/media', methods=['POST'])
@jwt_required()
def upload_media_to_album(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify(error="No tienes permiso"), 403
    
    file = request.files.get('file')
    if not file: return jsonify(error="No se encontró el archivo"), 400

    path = handle_supabase_upload(album.owner.username, file, f"album_{album.id}")
    if path:
        new_media = Media(album_id=album.id, file_path=path, file_type=file.content_type)
        db.session.add(new_media)
        db.session.commit()
        return jsonify(message="Archivo subido exitosamente"), 201
    return jsonify(error="Tipo de archivo no permitido"), 400

@app.route('/api/media/<int:media_id>', methods=['DELETE'])
@jwt_required()
def delete_media_item(media_id):
    user_id = int(get_jwt_identity())
    media = Media.query.get_or_404(media_id)
    if media.album.user_id != user_id: return jsonify(error="No tienes permiso"), 403
    
    delete_from_supabase(media.file_path)
    db.session.delete(media)
    db.session.commit()
    return jsonify(message="Archivo multimedia eliminado")

@app.route('/api/albums/<int:album_id>/reorder', methods=['PUT'])
@jwt_required()
def reorder_album_media(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify({'error': 'No tienes permiso'}), 403
    
    media_ids = request.get_json().get('media_ids', [])
    for index, media_id in enumerate(media_ids):
        media_item = Media.query.get(media_id)
        if media_item and media_item.album_id == album_id:
            media_item.position = index
    db.session.commit()
    return jsonify({'message': 'Orden de los archivos actualizado'})

@app.route('/api/albums/<int:album_id>/cover', methods=['PUT'])
@jwt_required()
def set_album_cover(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify({'error': 'No tienes permiso'}), 403
    
    media_id = request.get_json().get('media_id')
    media_item = Media.query.get(media_id)
    if not media_item or media_item.album_id != album_id:
        return jsonify({'error': 'Archivo no válido'}), 404
        
    album.thumbnail_path = media_item.file_path
    db.session.commit()
    return jsonify({'message': 'Portada del álbum actualizada'})

# --- RUTAS DE INTERACCIONES Y MODERACIÓN ---
@app.route('/api/albums/<int:album_id>/comments', methods=['POST'])
@jwt_required()
def post_comment(album_id):
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or 'text' not in data or not data['text'].strip():
        return jsonify({'error': 'El comentario no puede estar vacío'}), 400

    new_comment = Comment(text=data['text'], user_id=user_id, album_id=album_id)
    db.session.add(new_comment)
    db.session.commit()
    return jsonify({'message': 'Comentario añadido'}), 201

@app.route('/api/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    current_user_id = int(get_jwt_identity())
    comment = Comment.query.get_or_404(comment_id)
    if current_user_id == comment.user_id or current_user_id == comment.album.user_id:
        db.session.delete(comment)
        db.session.commit()
        return jsonify({'message': 'Comentario eliminado'}), 200
    return jsonify({'error': 'No tienes permiso para eliminar este comentario'}), 403

@app.route('/api/comments/<int:comment_id>/report', methods=['POST'])
@jwt_required()
def report_comment(comment_id):
    reporter_id = int(get_jwt_identity())
    comment = Comment.query.get_or_404(comment_id)
    if reporter_id == comment.user_id:
        return jsonify({'error': 'No puedes reportar tu propio comentario'}), 403
    if CommentReport.query.filter_by(reporter_id=reporter_id, comment_id=comment_id, status='pending').first():
        return jsonify({'message': 'Ya has reportado este comentario.'}), 409
    
    reason = request.get_json().get('reason')
    if not reason: return jsonify({'error': 'La razón del reporte es obligatoria.'}), 400

    new_report = CommentReport(comment_id=comment_id, reporter_id=reporter_id, reason=reason)
    db.session.add(new_report)
    db.session.commit()
    return jsonify({'message': 'Comentario reportado. Gracias.'}), 201

@app.route('/api/users/<int:user_id>/follow', methods=['POST'])
@jwt_required()
def toggle_follow(user_id):
    follower_id = int(get_jwt_identity())
    if follower_id == user_id: return jsonify({'error': 'No puedes seguirte a ti mismo.'}), 400

    follow = Follow.query.filter_by(follower_id=follower_id, followed_id=user_id).first()
    if follow:
        db.session.delete(follow)
        message, is_followed = 'Has dejado de seguir a este usuario.', False
    else:
        new_follow = Follow(follower_id=follower_id, followed_id=user_id)
        db.session.add(new_follow)
        message, is_followed = 'Ahora sigues a este usuario.', True
    db.session.commit()
    return jsonify({'message': message, 'is_followed': is_followed}), 200

@app.route('/api/albums/<int:album_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    like = AlbumLike.query.filter_by(user_id=user_id, album_id=album_id).first()
    if like:
        db.session.delete(like)
        album.likes_count = max(0, album.likes_count - 1)
        message, is_liked = 'Se ha quitado el "Me gusta".', False
    else:
        new_like = AlbumLike(user_id=user_id, album_id=album_id)
        db.session.add(new_like)
        album.likes_count += 1
        message, is_liked = '¡Me gusta añadido!', True
    db.session.commit()
    return jsonify({'message': message, 'is_liked': is_liked, 'likes_count': album.likes_count}), 200

@app.route('/api/albums/<int:album_id>/save', methods=['POST'])
@jwt_required()
def toggle_save(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    saved = SavedAlbum.query.filter_by(user_id=user_id, album_id=album_id).first()
    if saved:
        db.session.delete(saved)
        album.saves_count = max(0, album.saves_count - 1)
        message, is_saved = 'Álbum quitado de guardados.', False
    else:
        new_save = SavedAlbum(user_id=user_id, album_id=album_id)
        db.session.add(new_save)
        album.saves_count += 1
        message, is_saved = 'Álbum guardado.', True
    db.session.commit()
    return jsonify({'message': message, 'is_saved': is_saved, 'saves_count': album.saves_count}), 200

@app.route('/api/albums/<int:album_id>/report', methods=['POST'])
@jwt_required()
def report_album(album_id):
    reporter_id = int(get_jwt_identity())
    reason = request.get_json().get('reason')
    if not reason: return jsonify({'error': 'La razón del reporte es obligatoria.'}), 400
    
    if Report.query.filter_by(reporter_id=reporter_id, album_id=album_id).first():
        return jsonify({'message': 'Ya has reportado este álbum.'}), 409

    new_report = Report(album_id=album_id, reporter_id=reporter_id, reason=reason)
    db.session.add(new_report)
    db.session.commit()
    return jsonify({'message': 'Álbum reportado. Gracias.'}), 201

# =========================================================================
#  6. PUNTO DE ENTRADA PRINCIPAL
# =========================================================================
if __name__ == '__main__':
    app.run(debug=True)