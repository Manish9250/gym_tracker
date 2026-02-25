from database import SessionLocal
import models

def generate_svg_filename(exercise_name):
    """Converts 'Barbell Bench Press' into 'barbell_bench_press.svg'"""
    clean_name = exercise_name.lower()
    clean_name = clean_name.replace(" ", "_").replace("-", "_")
    clean_name = clean_name.replace("(", "").replace(")", "") # Remove parentheses for RDLs
    return f"{clean_name}.svg"

# The standardized 6-day split library
exercises_to_seed = [
    # CHEST
    {"name": "Flat Barbell Bench Press", "muscle_group": "Chest"},
    {"name": "Incline Barbell Bench Press", "muscle_group": "Chest"},
    {"name": "Decline Barbell Bench Press", "muscle_group": "Chest"},
    {"name": "Flat Dumbbell Bench Press", "muscle_group": "Chest"},
    {"name": "Incline Dumbbell Bench Press", "muscle_group": "Chest"},
    {"name": "Pec Deck Fly", "muscle_group": "Chest"},
    {"name": "Cable Crossover", "muscle_group": "Chest"},
    {"name": "Incline Machine Chest Press", "muscle_group": "Chest"},
    {"name": "Dips", "muscle_group": "Chest"},

    # BACK
    {"name": "Barbell Deadlift", "muscle_group": "Back"},
    {"name": "Dumbbell Pullover", "muscle_group": "Back"},
    {"name": "Straight-Arm Cable Pulldown", "muscle_group": "Back"},
    {"name": "Wide-Grip Lat Pulldown", "muscle_group": "Back"},
    {"name": "Close-Grip Lat Pulldown", "muscle_group": "Back"},
    {"name": "Seated Cable Row", "muscle_group": "Back"},
    {"name": "Machine Seated Row", "muscle_group": "Back"},
    {"name": "Pull-ups", "muscle_group": "Back"},
    {"name": "Barbell Bent-Over Row", "muscle_group": "Back"},

    # TRICEPS
    {"name": "Tricep Rope Pushdown", "muscle_group": "Triceps"},
    {"name": "V-Bar Tricep Pushdown", "muscle_group": "Triceps"},
    {"name": "EZ-Bar Skullcrusher", "muscle_group": "Triceps"},
    {"name": "Dumbbell Overhead Tricep Extension", "muscle_group": "Triceps"},
    {"name": "Cable Overhead Tricep Extension", "muscle_group": "Triceps"},

    # BICEPS
    {"name": "Barbell Bicep Curl", "muscle_group": "Biceps"},
    {"name": "Dumbbell Hammer Curl", "muscle_group": "Biceps"},
    {"name": "Cable Rope Hammer Curl", "muscle_group": "Biceps"},
    {"name": "Dumbbell Concentration Curl", "muscle_group": "Biceps"},
    {"name": "EZ-Bar Preacher Curl", "muscle_group": "Biceps"},
    {"name": "Incline Dumbbell Curl", "muscle_group": "Biceps"},

    # SHOULDERS
    {"name": "Smith Machine Overhead Press", "muscle_group": "Shoulders"},
    {"name": "Seated Dumbbell Overhead Press", "muscle_group": "Shoulders"},
    {"name": "Dumbbell Front Raise", "muscle_group": "Shoulders"},
    {"name": "Dumbbell Lateral Raise", "muscle_group": "Shoulders"},
    {"name": "Reverse Pec Deck Fly", "muscle_group": "Shoulders"},
    {"name": "Smith Machine Behind-the-Neck Press", "muscle_group": "Shoulders"},
    {"name": "Cable Lateral Raise", "muscle_group": "Shoulders"},
    {"name": "Barbell Shrugs", "muscle_group": "Shoulders"},

    # LEGS
    {"name": "Bodyweight Squat", "muscle_group": "Legs"},
    {"name": "Barbell Back Squat", "muscle_group": "Legs"},
    {"name": "Leg Extension", "muscle_group": "Legs"},
    {"name": "Seated Leg Curl", "muscle_group": "Legs"},
    {"name": "Leg Press", "muscle_group": "Legs"},
    {"name": "Walking Lunges", "muscle_group": "Legs"},
    {"name": "Romanian Deadlift RDL", "muscle_group": "Legs"},
    {"name": "Standing Calf Raises", "muscle_group": "Legs"},

    # ABS & FOREARMS
    {"name": "Cable Crunch", "muscle_group": "Abs"},
    {"name": "Hanging Leg Raise", "muscle_group": "Abs"},
    {"name": "Dumbbell Wrist Curl", "muscle_group": "Forearms"},
    {"name": "Reverse Barbell Curl", "muscle_group": "Forearms"}
]

def seed_database():
    db = SessionLocal()
    
    # Check for existing global exercises
    existing_count = db.query(models.Exercise).filter(models.Exercise.owner_id == None).count()
    
    if existing_count > 0:
        print(f"Database already contains {existing_count} global exercises. If you want to re-seed, delete gym_tracker.db first.")
        db.close()
        return

    print("Seeding database with global exercises...")
    
    for ex_data in exercises_to_seed:
        svg_file = generate_svg_filename(ex_data["name"])
        
        new_ex = models.Exercise(
            name=ex_data["name"],
            muscle_group=ex_data["muscle_group"],
            image_url=svg_file,
            owner_id=None  # None = Global Library
        )
        db.add(new_ex)
    
    db.commit()
    print("Successfully added all global exercises!")
    print("Example filenames expected in static/svgs/:")
    print(" - flat_barbell_bench_press.svg")
    print(" - barbell_deadlift.svg")
    print(" - ez_bar_skullcrusher.svg")
    db.close()

if __name__ == "__main__":
    seed_database()