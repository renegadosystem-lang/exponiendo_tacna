"""Creación inicial de todas las tablas y relaciones

Revision ID: b39b4134fcc1
Revises: 
Create Date: 2025-09-04 02:13:29.581759

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b39b4134fcc1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # ### Comandos reescritos manualmente para asegurar el orden correcto ###

    # 1. Crear tablas sin dependencias externas
    op.create_table('user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=80), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('profile_picture_path', sa.String(length=255), nullable=True),
        sa.Column('banner_image_path', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    op.create_table('tag',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )

    # 2. Crear tablas que dependen de 'user'
    op.create_table('album',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('views_count', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('likes_count', sa.Integer(), nullable=False),
        sa.Column('saves_count', sa.Integer(), nullable=False),
        sa.Column('shares_count', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('follow',
        sa.Column('follower_id', sa.Integer(), nullable=False),
        sa.Column('followed_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['followed_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['follower_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('follower_id', 'followed_id')
    )

    # 3. Crear tablas que dependen de 'album' y/o 'user'
    op.create_table('media',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('comment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('album_like',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'album_id')
    )
    op.create_table('saved_album',
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('user_id', 'album_id')
    )
    op.create_table('report',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Crear tablas de asociación (Muchos-a-Muchos) al final
    op.create_table('album_tags',
        sa.Column('album_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['album.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ),
        sa.PrimaryKeyConstraint('album_id', 'tag_id')
    )
    op.create_table('media_tags',
        sa.Column('media_id', sa.Integer(), nullable=False),
        sa.Column('tag_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['media_id'], ['media.id'], ),
        sa.ForeignKeyConstraint(['tag_id'], ['tag.id'], ),
        sa.PrimaryKeyConstraint('media_id', 'tag_id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### Comandos reescritos manualmente para asegurar el orden inverso correcto ###

    # 1. Borrar tablas de asociación primero
    op.drop_table('media_tags')
    op.drop_table('album_tags')

    # 2. Borrar tablas con dependencias
    op.drop_table('report')
    op.drop_table('saved_album')
    op.drop_table('album_like')
    op.drop_table('comment')
    op.drop_table('media')
    op.drop_table('follow')
    
    # 3. Borrar tablas de las que dependían las anteriores
    op.drop_table('album')

    # 4. Borrar tablas base al final
    op.drop_table('tag')
    op.drop_table('user')
    # ### end Alembic commands ###