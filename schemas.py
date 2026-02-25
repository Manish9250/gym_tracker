from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str 

class UserResponse(UserBase):
    id: int
    
    class Config:
        from_attributes = True 

# --- Exercise Schemas ---
class ExerciseBase(BaseModel):
    name: str
    muscle_group: str
    image_url: Optional[str] = None 

class ExerciseCreate(ExerciseBase):
    pass

class ExerciseResponse(ExerciseBase):
    id: int
    owner_id: Optional[int] = None # Fixed for Global Exercises

    class Config:
        from_attributes = True

# --- Workout Set Schemas ---
class WorkoutSetBase(BaseModel):
    exercise_id: int
    set_number: int
    weight: float
    reps: int
    start_time: datetime # NEW
    end_time: datetime   # NEW

class WorkoutSetCreate(WorkoutSetBase):
    pass

class WorkoutSetResponse(WorkoutSetBase):
    id: int
    workout_id: int

    class Config:
        from_attributes = True

# --- Workout Schemas ---
class WorkoutBase(BaseModel):
    start_time: datetime
    end_time: Optional[datetime] = None

class WorkoutCreate(WorkoutBase):
    sets: List[WorkoutSetCreate] 

class WorkoutResponse(WorkoutBase):
    id: int
    user_id: int
    sets: List[WorkoutSetResponse] = []

    class Config:
        from_attributes = True

# --- Body Metric Schemas ---
class BodyMetricBase(BaseModel):
    body_weight: float
    date: Optional[datetime] = None

class BodyMetricCreate(BodyMetricBase):
    pass

class BodyMetricResponse(BodyMetricBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True