from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles 
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from typing import List
from sqlalchemy import func, or_ 

import models, schemas
from database import SessionLocal, engine

# Create tables in SQLite
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Gym Tracker API")

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# 1. AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = models.User(username=user.username, password=user.password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login")
def login(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if not db_user or db_user.password != user.password:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    
    return {"message": "Login successful", "user_id": db_user.id, "username": db_user.username}

# ==========================================
# 2. PRE-WORKOUT BUILDER (EXERCISES)
# ==========================================

@app.post("/exercises/{user_id}", response_model=schemas.ExerciseResponse)
def create_exercise(user_id: int, exercise: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    new_exercise = models.Exercise(**exercise.model_dump(), owner_id=user_id)
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return new_exercise

@app.get("/exercises/{user_id}", response_model=List[schemas.ExerciseResponse])
def get_user_exercises(user_id: int, db: Session = Depends(get_db)):
    # This queries the database for exercises where the owner is EITHER the current user OR None (Global)
    return db.query(models.Exercise).filter(
        or_(
            models.Exercise.owner_id == user_id,
            models.Exercise.owner_id == None
        )
    ).all()

# ==========================================
# 3. ACTIVE SESSION & WORKOUT SYNC
# ==========================================

@app.post("/workouts/{user_id}", response_model=schemas.WorkoutResponse)
def finish_workout(user_id: int, workout: schemas.WorkoutCreate, db: Session = Depends(get_db)):
    # 1. Create the main workout entry
    db_workout = models.Workout(
        user_id=user_id, 
        start_time=workout.start_time, 
        end_time=workout.end_time or datetime.now()
    )
    db.add(db_workout)
    db.flush() # Flush to get the workout.id without committing yet
    
    # 2. Iterate through the sets and save the new granular timestamps
    for set_data in workout.sets:
        db_set = models.WorkoutSet(
            workout_id=db_workout.id,
            exercise_id=set_data.exercise_id,
            set_number=set_data.set_number,
            weight=set_data.weight,
            reps=set_data.reps,
            start_time=set_data.start_time, # NEW: Set start time
            end_time=set_data.end_time      # NEW: Set end time
        )
        db.add(db_set)
        
    db.commit()
    db.refresh(db_workout)
    return db_workout

@app.get("/prs/{user_id}/{exercise_id}")
def get_set_specific_prs(user_id: int, exercise_id: int, db: Session = Depends(get_db)):
    """
    Returns the Max Weight and Max Reps for Set 1, Set 2, Set 3, etc., 
    for a specific exercise and user.
    """
    prs = db.query(
        models.WorkoutSet.set_number,
        func.max(models.WorkoutSet.weight).label("max_weight"),
        func.max(models.WorkoutSet.reps).label("max_reps")
    ).join(models.Workout).filter(
        models.Workout.user_id == user_id,
        models.WorkoutSet.exercise_id == exercise_id
    ).group_by(
        models.WorkoutSet.set_number
    ).order_by(
        models.WorkoutSet.set_number
    ).all()
    
    # Format the response into a clean dictionary
    pr_data = {f"set_{pr.set_number}": {"max_weight": pr.max_weight, "max_reps": pr.max_reps} for pr in prs}
    return pr_data

# ==========================================
# 4. GAMIFICATION & STATS
# ==========================================

@app.get("/stats/{user_id}")
def get_rpg_stats(user_id: int, db: Session = Depends(get_db)):
    # Power: Highest single-set volume (Weight * Reps)
    # Note: SQLite doesn't natively support easy row-level multiplication in max() 
    # without subqueries, so we fetch sets and calculate in Python for simplicity here.
    all_sets = db.query(models.WorkoutSet).join(models.Workout).filter(models.Workout.user_id == user_id).all()
    
    power = 0
    if all_sets:
        power = max(s.weight * s.reps for s in all_sets)
        
    # Consistency: Count distinct days worked out (Ignoring Sundays logic can be handled in JS frontend or refined here later)
    distinct_days = db.query(func.date(models.Workout.start_time)).filter(models.Workout.user_id == user_id).distinct().count()
    
    # Stamina: Total workouts completed
    stamina = db.query(models.Workout).filter(models.Workout.user_id == user_id).count()
    
    return {
        "power": power,
        "consistency_days": distinct_days,
        "stamina": stamina
    }

# ==========================================
# 5. BODY METRICS
# ==========================================

@app.post("/metrics/{user_id}", response_model=schemas.BodyMetricResponse)
def log_body_weight(user_id: int, metric: schemas.BodyMetricCreate, db: Session = Depends(get_db)):
    new_metric = models.BodyMetric(
        user_id=user_id,
        body_weight=metric.body_weight,
        date=metric.date or datetime.now()
    )
    db.add(new_metric)
    db.commit()
    db.refresh(new_metric)
    return new_metric

@app.get("/metrics/{user_id}", response_model=List[schemas.BodyMetricResponse])
def get_body_weights(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.BodyMetric).filter(models.BodyMetric.user_id == user_id).order_by(models.BodyMetric.date).all()

# Mount the frontend folder at the root URL. 
# This must go at the BOTTOM of the file so it doesn't override your API routes!
app.mount("/", StaticFiles(directory="static", html=True), name="static")