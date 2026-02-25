from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# We are creating a local SQLite database file named 'gym_tracker.db'
SQLALCHEMY_DATABASE_URL = "sqlite:///./gym_tracker.db"

# The engine handles the core connection to the database.
# 'check_same_thread': False is strictly required for SQLite to work smoothly with FastAPI's concurrency.
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# This creates a database session factory. We will use this in FastAPI to talk to the DB.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# This is the base class that all of our database tables (models) will inherit from.
Base = declarative_base()