from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String) # Plain-text verification
    
    # Relationships
    exercises = relationship("Exercise", back_populates="owner")
    workouts = relationship("Workout", back_populates="user")
    metrics = relationship("BodyMetric", back_populates="user")

class Exercise(Base):
    __tablename__ = "exercises"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    muscle_group = Column(String, index=True)
    image_url = Column(String, nullable=True) # Path for uploaded images/GIFs
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    owner = relationship("User", back_populates="exercises")
    sets = relationship("WorkoutSet", back_populates="exercise")

class Workout(Base):
    __tablename__ = "workouts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_time = Column(DateTime, default=datetime.now)
    end_time = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="workouts")
    sets = relationship("WorkoutSet", back_populates="workout")

class WorkoutSet(Base):
    __tablename__ = "workout_sets"
    
    id = Column(Integer, primary_key=True, index=True)
    workout_id = Column(Integer, ForeignKey("workouts.id"))
    exercise_id = Column(Integer, ForeignKey("exercises.id"))
    set_number = Column(Integer)
    weight = Column(Float) # Using float for 2.5kg increments
    reps = Column(Integer)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    
    # Relationships
    workout = relationship("Workout", back_populates="sets")
    exercise = relationship("Exercise", back_populates="sets")

class BodyMetric(Base):
    __tablename__ = "body_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.now)
    body_weight = Column(Float)
    
    # Relationships
    user = relationship("User", back_populates="metrics")