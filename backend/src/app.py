# =========================================================================
#  app.py (Versión con Búsqueda, Notificaciones y Chat)
# =========================================================================
import os
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import or_, and_, desc, distinct
from flask_migrate import Migrate
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager, jwt_required, create_access_token, 
    get_jwt_identity, decode_token
)
from flask_socketio import SocketIO, emit, join_room
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# --- 1. Inicialización de la Aplicación y Extensiones ---
app = Flask(__name__)

# --- 2. Configuración ---
DATABASE_URL = os.environ.get("DATABASE_URL", "").replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY")

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://exponiendotacna.netlify.app"
]
CORS(app, resources={r"/api/*": {"origins": origins}})
socketio = SocketIO(app, cors_allowed_origins=origins)

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
    __tablename__ = 'user'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    bio = db.Column(db.Text, nullable=True)
    profile_picture_path = db.Column(db.String(255), nullable=True)
    banner_image_path = db.Column(db.String(255), nullable=True)
    is_admin = db.Column(db.Boolean, default=False)
    albums = db.relationship('Album', back_populates='owner', cascade="all, delete-orphan")
    comments = db.relationship('Comment', back_populates='author', cascade="all, delete-orphan")
    reported_albums = db.relationship('Report', back_populates='reporter', cascade="all, delete-orphan")
    reported_comments = db.relationship('CommentReport', back_populates='reporter', cascade="all, delete-orphan")
    def set_password(self, password): self.password_hash = generate_password_hash(password)
    def check_password(self, password): return check_password_hash(self.password_hash, password)

class Album(db.Model):
    __tablename__ = 'album'
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
    owner = db.relationship('User', back_populates='albums')
    media = db.relationship('Media', back_populates='album', lazy='dynamic', cascade="all, delete-orphan")
    tags = db.relationship('Tag', secondary=album_tags, back_populates='albums')
    comments = db.relationship('Comment', back_populates='album', lazy='dynamic', cascade="all, delete-orphan")
    likes = db.relationship('AlbumLike', back_populates='album', cascade="all, delete-orphan")
    saved_by = db.relationship('SavedAlbum', back_populates='album', cascade="all, delete-orphan")
    reports = db.relationship('Report', back_populates='album', cascade="all, delete-orphan")

class Media(db.Model):
    __tablename__ = 'media'
    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)
    album = db.relationship('Album', back_populates='media')

class Tag(db.Model):
    __tablename__ = 'tag'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    albums = db.relationship('Album', secondary=album_tags, back_populates='tags')

class Comment(db.Model):
    __tablename__ = 'comment'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=True)
    author = db.relationship('User', back_populates='comments')
    album = db.relationship('Album', back_populates='comments')
    reports = db.relationship('CommentReport', back_populates='comment', cascade="all, delete-orphan")
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), cascade="all, delete-orphan")
    

class Follow(db.Model):
    __tablename__ = 'follow'
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    followed_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)

class AlbumLike(db.Model):
    __tablename__ = 'album_like'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)
    album = db.relationship('Album', back_populates='likes')

class SavedAlbum(db.Model):
    __tablename__ = 'saved_album'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), primary_key=True)
    album = db.relationship('Album', back_populates='saved_by')

class Report(db.Model):
    __tablename__ = 'report'
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.Integer, db.ForeignKey('album.id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    album = db.relationship('Album', back_populates='reports')
    reporter = db.relationship('User', back_populates='reported_albums')

class CommentReport(db.Model):
    __tablename__ = 'comment_report'
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=False)
    reporter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(255), nullable=False)
    comment = db.relationship('Comment', back_populates='reports')
    reporter = db.relationship('User', back_populates='reported_comments')

class Notification(db.Model):
    __tablename__ = 'notification'
    id = db.Column(db.Integer, primary_key=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False) # 'new_follower', 'new_like'
    related_entity_id = db.Column(db.Integer, nullable=True) # ID del álbum, etc.
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    recipient = db.relationship('User', foreign_keys=[recipient_id])
    actor = db.relationship('User', foreign_keys=[actor_id])

class Message(db.Model):
    __tablename__ = 'message'
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_read = db.Column(db.Boolean, default=False)
    expires_at = db.Column(db.DateTime, nullable=True) # Para mensajes que se autodestruyen

    sender = db.relationship('User', foreign_keys=[sender_id])
    recipient = db.relationship('User', foreign_keys=[recipient_id])


# =========================================================================
#  4. FUNCIONES DE AYUDA (HELPERS)
# =========================================================================
def allowed_file(filename):
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_public_url(path):
    return supabase.storage.from_(BUCKET_NAME).get_public_url(path) if path and supabase else None

def handle_supabase_upload(user_username, file, object_path):
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
    if path and supabase:
        try:
            supabase.storage.from_(BUCKET_NAME).remove([path])
        except Exception as e:
            print(f"Error al eliminar de Supabase: {e}")

def create_notification(recipient_id, actor_id, ntype, related_id=None):
    if recipient_id == actor_id:
        return
    
    notification = Notification(
        recipient_id=recipient_id,
        actor_id=actor_id,
        notification_type=ntype,
        related_entity_id=related_id
    )
    db.session.add(notification)
    db.session.commit()
    # Emitir evento para notificar al usuario en tiempo real
    socketio.emit('new_notification', {'message': 'Tienes una nueva notificación'}, room=f'user_{recipient_id}')


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
    is_followed = False
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        try:
            token = auth_header.split(None, 1)[1]
            current_user_id = int(decode_token(token)['sub'])
            if Follow.query.filter_by(follower_id=current_user_id, followed_id=user.id).first():
                is_followed = True
        except Exception:
            pass 
    
    albums_list = []
    for album in user.albums:
        thumbnail_url = get_public_url(album.thumbnail_path)
        if not thumbnail_url:
            first_media = album.media.order_by(Media.position.asc(), Media.created_at.asc()).first()
            thumbnail_url = get_public_url(first_media.file_path) if first_media else None
        
        albums_list.append({
            'id': album.id, 'title': album.title, 
            'thumbnail_url': thumbnail_url, 'views_count': album.views_count,
            'owner_username': user.username
        })

    return jsonify({
        'id': user.id, 'username': user.username, 'bio': user.bio, 
        'profile_picture_url': get_public_url(user.profile_picture_path), 
        'banner_image_url': get_public_url(user.banner_image_path), 
        'albums': albums_list,
        'followers_count': Follow.query.filter_by(followed_id=user.id).count(),
        'following_count': Follow.query.filter_by(follower_id=user.id).count(),
        'is_followed': is_followed
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

# --- RUTAS DE BÚSQUEDA, NOTIFICACIONES Y GUARDADOS ---
@app.route('/api/search', methods=['GET'])
def search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'users': [], 'albums': []})

    search_term = f"%{query}%"
    
    users = User.query.filter(User.username.ilike(search_term)).limit(10).all()
    albums = Album.query.filter(Album.title.ilike(search_term)).limit(10).all()

    users_list = [{
        'username': u.username,
        'profile_picture_url': get_public_url(u.profile_picture_path)
    } for u in users]
    
    albums_list = [{
        'id': a.id,
        'title': a.title,
        'owner_username': a.owner.username,
        'thumbnail_url': get_public_url(a.thumbnail_path)
    } for a in albums]

    return jsonify({'users': users_list, 'albums': albums_list})

@app.route('/api/me/saved-albums', methods=['GET'])
@jwt_required()
def get_saved_albums_route():
    user_id = int(get_jwt_identity())
    saved_album_relations = SavedAlbum.query.filter_by(user_id=user_id).all()
    
    albums_list = []
    for rel in saved_album_relations:
        album = rel.album
        albums_list.append({
            'id': album.id, 'title': album.title,
            'owner_username': album.owner.username, 'user_id': album.user_id,
            'views_count': album.views_count, 
            'thumbnail_url': get_public_url(album.thumbnail_path)
        })
    return jsonify({'albums': albums_list})

# --- INICIO: NUEVA RUTA PARA RESPONDER A UN COMENTARIO ---
@app.route('/api/comments/<int:comment_id>/reply', methods=['POST'])
@jwt_required()
def reply_to_comment(comment_id):
    parent_comment = Comment.query.get_or_404(comment_id)
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('text', '').strip():
        return jsonify({'error': 'La respuesta no puede estar vacía'}), 400

    reply = Comment(
        text=data['text'],
        user_id=user_id,
        album_id=parent_comment.album_id,
        parent_id=parent_comment.id
    )
    db.session.add(reply)
    db.session.commit()

    # Crear notificación para el autor del comentario original
    create_notification(
        recipient_id=parent_comment.user_id,
        actor_id=user_id,
        ntype='new_reply',
        related_id=parent_comment.album_id
    )

    return jsonify({'message': 'Respuesta añadida'}), 201
# --- FIN: NUEVA RUTA ---

@app.route('/api/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    user_id = int(get_jwt_identity())
    notifications = Notification.query.filter_by(recipient_id=user_id).order_by(desc(Notification.created_at)).limit(30).all()
    
    notifications_list = []
    for notif in notifications:
        actor_user = User.query.get(notif.actor_id)
        if not actor_user: continue

        data = {
            'id': notif.id,
            'actor_username': actor_user.username,
            'actor_profile_picture': get_public_url(actor_user.profile_picture_path),
            'is_read': notif.is_read,
            'created_at': notif.created_at.isoformat()
        }
        
        message = ""
        link = "#"

        if notif.notification_type == 'new_follower':
            message = f"<strong>{actor_user.username}</strong> ha comenzado a seguirte."
            link = f"/profile.html?user={actor_user.username}"
        
        elif notif.notification_type == 'new_like':
            album = Album.query.get(notif.related_entity_id)
            if album:
                message = f"A <strong>{actor_user.username}</strong> le ha gustado tu álbum <strong>{album.title}</strong>."
                link = f"/album.html?id={album.id}"
        
        elif notif.notification_type == 'new_comment':
            album = Album.query.get(notif.related_entity_id)
            if album:
                message = f"<strong>{actor_user.username}</strong> ha comentado en tu álbum <strong>{album.title}</strong>."
                link = f"/album.html?id={album.id}"
        
        elif notif.notification_type == 'new_reply':
            album = Album.query.get(notif.related_entity_id)
            if album:
                message = f"<strong>{actor_user.username}</strong> ha respondido a tu comentario en el álbum <strong>{album.title}</strong>."
                link = f"/album.html?id={album.id}"

        elif notif.notification_type == 'new_message':
            message = f"<strong>{actor_user.username}</strong> te ha enviado un nuevo mensaje."
            link = f"/chat.html" # El frontend se encargará de abrir el chat correcto

        elif notif.notification_type == 'report_received':
            message = "Hemos recibido tu reporte. Gracias por ayudar a mantener la comunidad segura."
            link = "#" # No hay un enlace para esta notificación

        data['message'] = message
        data['link'] = link
        notifications_list.append(data)
        
    return jsonify(notifications_list)

@app.route('/api/notifications/read', methods=['POST'])
@jwt_required()
def mark_notifications_as_read():
    user_id = int(get_jwt_identity())
    Notification.query.filter_by(recipient_id=user_id, is_read=False)\
        .update({'is_read': True})
    db.session.commit()
    return jsonify({'message': 'Notificaciones marcadas como leídas'})


# --- RUTAS DE ÁLBUMES Y MEDIA ---
@app.route('/api/albums', methods=['GET', 'POST'])
@jwt_required(optional=True)
def handle_albums():
    if request.method == 'POST':
        current_user_id_str = get_jwt_identity()
        if not current_user_id_str:
            return jsonify(msg="Se requiere autenticación para crear un álbum"), 401
        
        user_id = int(current_user_id_str)
        data = request.get_json()
        if not data or not data.get('title', '').strip():
            return jsonify({'error': 'El título es obligatorio'}), 400
        
        new_album = Album(title=data['title'], description=data.get('description'), user_id=user_id)
        
        if 'tags' in data:
            tag_names = [tag.strip().lower() for tag in data['tags'].split(',') if tag.strip()]
            for name in tag_names:
                tag = Tag.query.filter_by(name=name).first() or Tag(name=name)
                if tag not in new_album.tags:
                    new_album.tags.append(tag)

        db.session.add(new_album)
        db.session.commit()
        return jsonify({'message': 'Álbum creado exitosamente', 'album_id': new_album.id}), 201

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 15, type=int)
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
            'user_id': album.user_id,
            'views_count': album.views_count, 
            'thumbnail_url': thumbnail_url
        })
        
    return jsonify({
        'albums': albums_list, 'total_pages': pagination.pages, 'current_page': pagination.page
    })

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
    # --- INICIO: LÓGICA MODIFICADA PARA OBTENER COMENTARIOS Y RESPUESTAS ---
    top_level_comments = album.comments.filter_by(parent_id=None).order_by(Comment.created_at.desc()).all()
    
    def format_comment(comment):
        return {
            'id': comment.id,
            'text': comment.text,
            'author_username': comment.author.username,
            'author_id': comment.user_id,
            'created_at': comment.created_at.isoformat(),
            'replies': [format_comment(reply) for reply in comment.replies] # Recursividad para obtener respuestas
        }
    comments_list = [format_comment(c) for c in top_level_comments]
    # --- FIN: LÓGICA MODIFICADA ---

    return jsonify({
        'id': album.id, 'title': album.title, 'description': album.description, 'user_id': album.user_id,
        'owner_username': album.owner.username, 'owner_profile_picture': get_public_url(album.owner.profile_picture_path),
        'owner_followers_count': Follow.query.filter_by(followed_id=album.user_id).count(),
        'owner_following_count': Follow.query.filter_by(follower_id=album.user_id).count(),
        'media': media_list, 'comments': comments_list, 'tags': tags_list,
        'comments': comments_list,
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
def reorder_media(album_id):
    user_id = int(get_jwt_identity())
    album = Album.query.get_or_404(album_id)
    if album.user_id != user_id: return jsonify({'error': 'No tienes permiso'}), 403
    
    media_ids = request.get_json().get('media_ids', [])
    if not media_ids:
        return jsonify({'error': 'Falta la lista de IDs de media'}), 400

    for index, media_id in enumerate(media_ids):
        media_item = Media.query.get(media_id)
        if media_item and media_item.album_id == album_id:
            media_item.position = index
    
    first_media_in_order = Media.query.get(media_ids[0])
    if first_media_in_order:
        album.thumbnail_path = first_media_in_order.file_path

    db.session.commit()
    return jsonify({'message': 'Orden de los archivos y portada actualizados'})

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
    album = Album.query.get_or_404(album_id)
    data = request.get_json()
    if not data or not data.get('text', '').strip():
        return jsonify({'error': 'El comentario no puede estar vacío'}), 400

    new_comment = Comment(text=data['text'], user_id=user_id, album_id=album_id)
    db.session.add(new_comment)
    db.session.commit()
    
    # Notificar al dueño del álbum
    create_notification(
        recipient_id=album.user_id,
        actor_id=user_id,
        ntype='new_comment',
        related_id=album.id
    )
    return jsonify({'message': 'Comentario añadido'}), 201

@app.route('/api/comments/<int:comment_id>/reply', methods=['POST'])
@jwt_required()
def reply_to_comment(comment_id):
    parent_comment = Comment.query.get_or_404(comment_id)
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get('text', '').strip():
        return jsonify({'error': 'La respuesta no puede estar vacía'}), 400

    reply = Comment(text=data['text'], user_id=user_id, album_id=parent_comment.album_id, parent_id=parent_comment.id)
    db.session.add(reply)
    db.session.commit()

    create_notification(
        recipient_id=parent_comment.user_id,
        actor_id=user_id,
        ntype='new_reply',
        related_id=parent_comment.album_id
    )
    return jsonify({'message': 'Respuesta añadida'}), 201

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
    
    if CommentReport.query.filter_by(reporter_id=reporter_id, comment_id=comment_id).first():
        return jsonify({'message': 'Ya has reportado este comentario.'}), 409
    
    reason = request.get_json().get('reason')
    if not reason: return jsonify({'error': 'La razón del reporte es obligatoria.'}), 400

    new_report = CommentReport(comment_id=comment_id, reporter_id=reporter_id, reason=reason)
    db.session.add(new_report)
    db.session.commit()
    
    # Notificar al usuario que su reporte fue recibido
    create_notification(recipient_id=reporter_id, actor_id=1, ntype='report_received') # actor_id=1 podría ser un usuario "Sistema"
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
        create_notification(recipient_id=user_id, actor_id=follower_id, ntype='new_follower')
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
        create_notification(recipient_id=album.user_id, actor_id=user_id, ntype='new_like', related_id=album.id)
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
    data = request.get_json()
    reason = data.get('reason')
    description = data.get('description')
    if not reason: return jsonify({'error': 'La razón del reporte es obligatoria.'}), 400
    
    if Report.query.filter_by(reporter_id=reporter_id, album_id=album_id).first():
        return jsonify({'message': 'Ya has reportado este álbum.'}), 409

    new_report = Report(album_id=album_id, reporter_id=reporter_id, reason=reason, description=description)
    db.session.add(new_report)
    db.session.commit()
    
    # Notificar al usuario que su reporte fue recibido
    create_notification(recipient_id=reporter_id, actor_id=1, ntype='report_received') # actor_id=1 podría ser un usuario "Sistema"
    return jsonify({'message': 'Álbum reportado. Gracias.'}), 201

# --- RUTAS DE CHAT (HTTP) ---
@app.route('/api/chats', methods=['GET'])
@jwt_required()
def get_chats():
    user_id = int(get_jwt_identity())

    # Subconsulta para encontrar la fecha del último mensaje con cada otro usuario
    # Funciona agrupando por el par de usuarios ordenados para tratar (A,B) y (B,A) como la misma conversación
    subquery = db.session.query(
        db.func.greatest(Message.sender_id, Message.recipient_id).label('user1'),
        db.func.least(Message.sender_id, Message.recipient_id).label('user2'),
        db.func.max(Message.created_at).label('max_created_at')
    ).filter(or_(Message.sender_id == user_id, Message.recipient_id == user_id))\
     .group_by('user1', 'user2').subquery()

    # Unir la tabla de mensajes con la subconsulta para obtener los mensajes completos
    latest_messages_query = db.session.query(Message).join(
        subquery,
        and_(
            db.func.greatest(Message.sender_id, Message.recipient_id) == subquery.c.user1,
            db.func.least(Message.sender_id, Message.recipient_id) == subquery.c.user2,
            Message.created_at == subquery.c.max_created_at
        )
    )
    
    chats_list = []
    for last_message in latest_messages_query.all():
        other_user_id = last_message.sender_id if last_message.recipient_id == user_id else last_message.recipient_id
        other_user = User.query.get(other_user_id)
        
        unread_count = Message.query.filter_by(
            sender_id=other_user_id, 
            recipient_id=user_id, 
            is_read=False
        ).count()

        chats_list.append({
            'other_user': {
                'id': other_user.id,
                'username': other_user.username,
                'profile_picture_url': get_public_url(other_user.profile_picture_path)
            },
            'last_message': {
                'content': last_message.content,
                'created_at': last_message.created_at.isoformat(),
                'is_read': last_message.is_read or last_message.sender_id == user_id
            },
            'unread_count': unread_count
        })
    
    chats_list.sort(key=lambda x: x['last_message']['created_at'], reverse=True)
    
    return jsonify(chats_list)


@app.route('/api/chats/<int:other_user_id>', methods=['GET'])
@jwt_required()
def get_chat_history(other_user_id):
    user_id = int(get_jwt_identity())
    
    Message.query.filter(
        or_(
            and_(Message.sender_id == user_id, Message.recipient_id == other_user_id),
            and_(Message.sender_id == other_user_id, Message.recipient_id == user_id)
        )
    ).filter(Message.expires_at != None, Message.expires_at < datetime.utcnow()).delete(synchronize_session=False)
    
    messages = Message.query.filter(
        or_(
            and_(Message.sender_id == user_id, Message.recipient_id == other_user_id),
            and_(Message.sender_id == other_user_id, Message.recipient_id == user_id)
        )
    ).order_by(Message.created_at.asc()).all()
    
    Message.query.filter_by(sender_id=other_user_id, recipient_id=user_id, is_read=False).update({'is_read': True})
    db.session.commit()

    return jsonify([{
        'id': msg.id,
        'sender_id': msg.sender_id,
        'recipient_id': msg.recipient_id,
        'content': msg.content,
        'created_at': msg.created_at.isoformat()
    } for msg in messages])


# =========================================================================
#  6. LÓGICA DE SOCKET.IO PARA CHAT EN TIEMPO REAL
# =========================================================================
user_sids = {}

@socketio.on('connect')
def handle_connect():
    print(f"Cliente intentando conectar con sid={request.sid}")

@socketio.on('authenticate')
def handle_authenticate(data):
    token = data.get('token')
    if not token:
        return
    try:
        decoded_token = decode_token(token)
        user_id = int(decoded_token['sub'])
        join_room(f'user_{user_id}')
        user_sids[user_id] = request.sid
        print(f"Cliente autenticado y unido a la sala: user_id={user_id}, sid={request.sid}")
    except Exception as e:
        print(f"Fallo de autenticación de socket: {e}")

@socketio.on('disconnect')
def handle_disconnect():
    user_id_to_remove = None
    for uid, sid in user_sids.items():
        if sid == request.sid:
            user_id_to_remove = uid
            break
    if user_id_to_remove:
        del user_sids[user_id_to_remove]
    print(f"Cliente desconectado: sid={request.sid}")

@socketio.on('private_message')
def handle_private_message(data):
    token = data.get('token')
    if not token:
        return
    try:
        sender_id = int(decode_token(token)['sub'])
        recipient_id = data.get('recipient_id')
        content = data.get('content')
        auto_delete = data.get('auto_delete', False)

        if not (recipient_id and content):
            return

        expires = datetime.utcnow() + timedelta(hours=24) if auto_delete else None
        new_message = Message(
            sender_id=sender_id,
            recipient_id=recipient_id,
            content=content,
            expires_at=expires
        )
        db.session.add(new_message)
        db.session.commit()
        
        # Notificar al destinatario sobre el nuevo mensaje
        create_notification(
            recipient_id=recipient_id,
            actor_id=sender_id,
            ntype='new_message'
        )

        message_data = {
            'id': new_message.id,
            'sender_id': sender_id,
            'recipient_id': recipient_id,
            'content': content,
            'created_at': new_message.created_at.isoformat()
        }
        
        recipient_room = f'user_{recipient_id}'
        socketio.emit('new_message', message_data, room=recipient_room)
        
        socketio.emit('message_sent', message_data, room=request.sid)

    except Exception as e:
        print(f"Error al manejar mensaje privado: {e}")

# =========================================================================
#  7. PUNTO DE ENTRADA PRINCIPAL
# =========================================================================
if __name__ == '__main__':
    socketio.run(app, debug=True)