from sqlalchemy import Column, String, Integer, Boolean, DateTime, JSON, DECIMAL, Date, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime

from .database import Base


class Model(Base):
    __tablename__ = "models"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    model_id = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    tier = Column(String(50), default='Free')  # Free, Pro, Enterprise
    max_images = Column(Integer, default=1)
    supports_i2i = Column(Boolean, default=False)
    processing_type = Column(String(50), default='Async')  # Async, Sync
    max_wait_time = Column(String(50), default='5 min')
    capabilities = Column(JSON, default={})
    supported_sizes = Column(JSON, default=[])
    status = Column(String(50), default='active')  # active, maintenance, disabled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ModelProvider(Base):
    __tablename__ = "model_providers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey('models.id', ondelete='CASCADE'), nullable=False)
    provider_id = Column(UUID(as_uuid=True), ForeignKey('providers.id', ondelete='CASCADE'), nullable=False)
    provider_model_id = Column(String(255), nullable=False)
    provider_cost = Column(DECIMAL(10, 2), nullable=False)
    platform_price = Column(DECIMAL(10, 2), nullable=False)
    max_images_supported = Column(Integer, default=1)
    status = Column(String(50), default='active')  # active, maintenance, disabled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class ModelAnalytics(Base):
    __tablename__ = "model_analytics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey('models.id', ondelete='CASCADE'), nullable=False)
    date = Column(Date, nullable=False)
    total_generations = Column(Integer, default=0)
    total_revenue = Column(DECIMAL(10, 2), default=0)
    total_provider_cost = Column(DECIMAL(10, 2), default=0)
    profit = Column(DECIMAL(10, 2), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Provider(Base):
    __tablename__ = "providers"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    provider_type = Column(String(50), nullable=False)  # flux, openai, stability
    api_key = Column(String(500), nullable=False)
    base_url = Column(String(500))
    status = Column(String(50), default='active')  # active, maintenance, disabled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    models = relationship("ModelProvider", backref="provider", cascade="all, delete-orphan")


class GenerationJob(Base):
    __tablename__ = "generation_jobs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(String(255), unique=True, nullable=False)
    user_id = Column(String(255), nullable=False)
    model_id = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    size = Column(String(50), default="1024x1024")
    n = Column(Integer, default=1)
    status = Column(String(50), default='pending')
    result = Column(JSON)
    error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))