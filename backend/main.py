
from pathlib import Path
from uuid import uuid4
from typing import Optional

import numpy as np
import pandas as pd

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FedLearn API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path("institution_data")
DATA_DIR.mkdir(exist_ok=True)

INSTITUTIONS = {
    "institute_a": {"name": "Institution A", "password": "insta123"},
    "institute_b": {"name": "Institution B", "password": "instb123"},
    "institute_c": {"name": "Institution C", "password": "instc123"},
}

ADMIN = {"username": "admin", "password": "admin123"}

SESSIONS = {}
LOCAL_MODELS = {}
LOCAL_ANALYSIS = {}
GLOBAL_ANALYSIS = {}

GLOBAL_MODEL = None
GLOBAL_VERSION = 0
TRAINING_ROUNDS = 0

# Fixed feature vocabulary so all institutes use the same model structure.
LEARNING_TYPES = [
    "visual", "auditory", "reading", "practical",
    "collaborative", "online", "other", "not provided"
]

TEACHING_TYPES = [
    "lecture", "project based", "discussion", "blended",
    "demonstration", "flipped classroom", "other", "not provided"
]

NUMERIC_FEATURES = [
    "attendance_percent",
    "study_hours_per_day",
    "class_participation_level_1_to_5",
    "assignment_completion_percent",
]

REQUIRED_COLUMNS = {
    "student_id", "subject", "marks", "cgpa", "section"
}


def institute_file(username):
    return DATA_DIR / username / "students.csv"


def get_user(authorization):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Please log in.")

    token = authorization.replace("Bearer ", "", 1)
    user = SESSIONS.get(token)

    if not user:
        raise HTTPException(status_code=401, detail="Session expired.")

    return user


def require_admin(authorization):
    user = get_user(authorization)

    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    return user


def load_institute_data(username):
    path = institute_file(username)

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="No dataset uploaded for this institution."
        )

    return pd.read_csv(path)


def normalize_category(value, allowed):
    if pd.isna(value) or not str(value).strip():
        return "not provided"

    value = str(value).strip().lower().replace("_", " ").replace("-", " ")

    if value in allowed:
        return value

    return "other"


def prepare_features(df):
    data = df.copy()

    defaults = {
        "attendance_percent": 75,
        "study_hours_per_day": 2,
        "class_participation_level_1_to_5": 3,
        "assignment_completion_percent": 75,
    }

    for col, default in defaults.items():
        if col not in data.columns:
            data[col] = default

        data[col] = pd.to_numeric(
            data[col], errors="coerce"
        ).fillna(default)

    # Scale numerical features consistently across institutes.
    attendance = data["attendance_percent"].clip(0, 100) / 100
    study = data["study_hours_per_day"].clip(0, 12) / 12
    participation = (
        data["class_participation_level_1_to_5"].clip(1, 5) / 5
    )
    assignments = (
        data["assignment_completion_percent"].clip(0, 100) / 100
    )

    numeric = np.column_stack([
        attendance,
        study,
        participation,
        assignments,
    ])

    learning_col = (
        data["learning_approach"]
        if "learning_approach" in data.columns
        else pd.Series(["not provided"] * len(data), index=data.index)
    )

    teaching_col = (
        data["teaching_approach"]
        if "teaching_approach" in data.columns
        else pd.Series(["not provided"] * len(data), index=data.index)
    )

    learning = [
        normalize_category(v, LEARNING_TYPES)
        for v in learning_col
    ]

    teaching = [
        normalize_category(v, TEACHING_TYPES)
        for v in teaching_col
    ]

    learning_encoded = np.array([
        [1.0 if value == category else 0.0 for category in LEARNING_TYPES]
        for value in learning
    ])

    teaching_encoded = np.array([
        [1.0 if value == category else 0.0 for category in TEACHING_TYPES]
        for value in teaching
    ])

    X = np.column_stack([
        np.ones(len(data)),
        numeric,
        learning_encoded,
        teaching_encoded,
    ])

    marks = pd.to_numeric(
        data["marks"], errors="coerce"
    ).fillna(0).clip(0, 100)

    # 0 = Low, 1 = Medium, 2 = High
    y = np.where(
        marks >= 75, 2,
        np.where(marks >= 50, 1, 0)
    ).astype(int)

    return X, y


def split_data(X, y):
    rng = np.random.default_rng(42)
    indices = rng.permutation(len(y))

    # For very small datasets, use all records for both training
    # and evaluation and explicitly flag this in the response.
    if len(y) < 5:
        return X, y, X, y, True

    split = max(1, int(len(y) * 0.8))
    split = min(split, len(y) - 1)

    train_idx = indices[:split]
    test_idx = indices[split:]

    return (
        X[train_idx], y[train_idx],
        X[test_idx], y[test_idx],
        False
    )


def softmax(logits):
    logits = logits - np.max(logits, axis=1, keepdims=True)
    exp = np.exp(np.clip(logits, -50, 50))
    return exp / np.sum(exp, axis=1, keepdims=True)


def train_classifier(X, y, epochs=500, learning_rate=0.08):
    classes = 3
    weights = np.zeros((X.shape[1], classes), dtype=float)

    targets = np.eye(classes)[y]

    for _ in range(epochs):
        probabilities = softmax(X @ weights)
        gradient = (X.T @ (probabilities - targets)) / len(y)
        weights -= learning_rate * gradient

    return weights


def classification_metrics(weights, X, y):
    probabilities = softmax(X @ weights)
    predictions = np.argmax(probabilities, axis=1)

    accuracy = float(np.mean(predictions == y))

    precisions = []
    recalls = []
    f1_scores = []

    for class_id in range(3):
        tp = int(np.sum((predictions == class_id) & (y == class_id)))
        fp = int(np.sum((predictions == class_id) & (y != class_id)))
        fn = int(np.sum((predictions != class_id) & (y == class_id)))

        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0

        f1 = (
            2 * precision * recall / (precision + recall)
            if precision + recall else 0.0
        )

        precisions.append(precision)
        recalls.append(recall)
        f1_scores.append(f1)

    return {
        "accuracy": round(accuracy * 100, 2),
        "precision": round(float(np.mean(precisions)) * 100, 2),
        "recall": round(float(np.mean(recalls)) * 100, 2),
        "f1_score": round(float(np.mean(f1_scores)) * 100, 2),
        "predictions": predictions.tolist(),
    }


def get_institute_insights(df):
    data = df.copy()

    marks = pd.to_numeric(data["marks"], errors="coerce")
    cgpa = pd.to_numeric(data["cgpa"], errors="coerce")

    def average_column(column, default):
        if column not in data.columns:
            return None
        values = pd.to_numeric(data[column], errors="coerce").dropna()
        return round(float(values.mean()), 2) if len(values) else None

    def distribution(column, allowed):
        if column not in data.columns:
            return []

        values = [
            normalize_category(v, allowed)
            for v in data[column]
        ]

        counts = pd.Series(values).value_counts()

        return [
            {
                "name": str(name).title(),
                "count": int(count),
                "percentage": round(float(count / len(values) * 100), 1),
            }
            for name, count in counts.items()
        ]

    performance = {
        "low": int((marks < 50).sum()),
        "medium": int(((marks >= 50) & (marks < 75)).sum()),
        "high": int((marks >= 75).sum()),
    }

    return {
        "records": int(len(data)),
        "students": int(data["student_id"].nunique()),
        "subjects": int(data["subject"].nunique()),
        "average_marks": (
            round(float(marks.mean()), 2)
            if marks.notna().any() else None
        ),
        "average_cgpa": (
            round(float(cgpa.mean()), 2)
            if cgpa.notna().any() else None
        ),
        "average_attendance": average_column("attendance_percent", None),
        "average_study_hours": average_column("study_hours_per_day", None),
        "average_participation": average_column(
            "class_participation_level_1_to_5", None
        ),
        "average_assignment_completion": average_column(
            "assignment_completion_percent", None
        ),
        "learning_approaches": distribution(
            "learning_approach", LEARNING_TYPES
        ),
        "teaching_approaches": distribution(
            "teaching_approach", TEACHING_TYPES
        ),
        "performance_distribution": performance,
    }


def train_and_evaluate(X, y):
    X_train, y_train, X_test, y_test, reused = split_data(X, y)

    if len(y_train) == 0:
        raise HTTPException(status_code=400, detail="Dataset is empty.")

    weights = train_classifier(X_train, y_train)
    metrics = classification_metrics(weights, X_test, y_test)

    return weights, metrics, reused


@app.get("/")
def root():
    return {"message": "FedLearn API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(payload: dict):
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if username == ADMIN["username"] and password == ADMIN["password"]:
        token = str(uuid4())
        SESSIONS[token] = {
            "username": "admin",
            "role": "admin",
            "name": "FedLearn Administrator",
        }
        return {"token": token, "user": SESSIONS[token]}

    institute = INSTITUTIONS.get(username)

    if not institute or institute["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = str(uuid4())
    SESSIONS[token] = {
        "username": username,
        "role": "institute",
        "name": institute["name"],
    }

    return {"token": token, "user": SESSIONS[token]}


@app.get("/api/auth/me")
def me(authorization: Optional[str] = Header(None)):
    return get_user(authorization)


@app.post("/api/institute/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    user = get_user(authorization)

    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file.")

    try:
        df = pd.read_csv(file.file)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read CSV file.")

    df.columns = [
        str(c).strip().lower().replace(" ", "_")
        for c in df.columns
    ]

    missing = sorted(REQUIRED_COLUMNS - set(df.columns))

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    folder = DATA_DIR / user["username"]
    folder.mkdir(parents=True, exist_ok=True)
    df.to_csv(folder / "students.csv", index=False)

    LOCAL_MODELS.pop(user["username"], None)
    LOCAL_ANALYSIS.pop(user["username"], None)
    GLOBAL_ANALYSIS.pop(user["username"], None)

    return {
        "message": "Dataset uploaded successfully.",
        "institution": user["name"],
        "records": int(len(df)),
        "subjects": int(df["subject"].nunique()),
    }


@app.get("/api/institute/summary")
def institute_summary(authorization: Optional[str] = Header(None)):
    user = get_user(authorization)
    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    df = load_institute_data(user["username"])
    insights = get_institute_insights(df)

    return {
        "institution": user["name"],
        **insights,
        "preview": df.head(10).where(
            pd.notna(df.head(10)), None
        ).to_dict(orient="records"),
    }


@app.post("/api/institute/train-local")
def train_local(authorization: Optional[str] = Header(None)):
    user = get_user(authorization)
    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    df = load_institute_data(user["username"])
    X, y = prepare_features(df)

    weights, metrics, reused = train_and_evaluate(X, y)

    LOCAL_MODELS[user["username"]] = {
        "weights": weights,
        "records": len(df),
        "metrics": metrics,
    }

    LOCAL_ANALYSIS[user["username"]] = {
        "metrics": metrics,
        "insights": get_institute_insights(df),
        "evaluation_reused_training_data": reused,
        "global_metrics": None,
        "global_version": None,
    }

    GLOBAL_ANALYSIS.pop(user["username"], None)

    return {
        "message": "Local classification model trained successfully.",
        "institution": user["name"],
        "records_used": len(df),
        "metrics": metrics,
        "evaluation_reused_training_data": reused,
        "update_ready": True,
    }


@app.get("/api/institute/global-model")
def get_global_model(authorization: Optional[str] = Header(None)):
    user = get_user(authorization)
    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    if GLOBAL_MODEL is None:
        return {
            "available": False,
            "message": "No global model has been published yet."
        }

    return {
        "available": True,
        "version": GLOBAL_VERSION,
        "message": "Global model is available."
    }


@app.get("/api/admin/overview")
def admin_overview(authorization: Optional[str] = Header(None)):
    require_admin(authorization)

    institution_stats = []

    for username, info in INSTITUTIONS.items():
        path = institute_file(username)

        if path.exists():
            df = pd.read_csv(path)
            insights = get_institute_insights(df)

            institution_stats.append({
                "username": username,
                "name": info["name"],
                "uploaded": True,
                "records": insights["records"],
                "students": insights["students"],
                "average_marks": insights["average_marks"],
                "average_cgpa": insights["average_cgpa"],
                "model_trained": username in LOCAL_MODELS,
            })
        else:
            institution_stats.append({
                "username": username,
                "name": info["name"],
                "uploaded": False,
                "records": 0,
                "students": 0,
                "average_marks": None,
                "average_cgpa": None,
                "model_trained": False,
            })

    return {
        "institutions": institution_stats,
        "global_model_version": GLOBAL_VERSION,
        "training_rounds": TRAINING_ROUNDS,
        "updates_received": len(LOCAL_MODELS),
    }


@app.post("/api/admin/train-global")
def train_global(authorization: Optional[str] = Header(None)):
    global GLOBAL_MODEL, GLOBAL_VERSION, TRAINING_ROUNDS

    require_admin(authorization)

    if len(LOCAL_MODELS) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least two institutions must train local models first."
        )

    total_records = sum(
        model["records"] for model in LOCAL_MODELS.values()
    )

    aggregated = sum(
        model["weights"] * model["records"]
        for model in LOCAL_MODELS.values()
    ) / total_records

    GLOBAL_MODEL = aggregated
    GLOBAL_VERSION += 1
    TRAINING_ROUNDS += 1

    GLOBAL_ANALYSIS.clear()

    for result in LOCAL_ANALYSIS.values():
        result["global_metrics"] = None
        result["global_version"] = None

    return {
        "message": "Global model aggregated successfully using FedAvg.",
        "global_model_version": GLOBAL_VERSION,
        "training_round": TRAINING_ROUNDS,
        "participating_institutions": len(LOCAL_MODELS),
        "total_records_represented": total_records,
        "aggregation": "Federated Averaging (FedAvg)",
    }


@app.post("/api/institute/evaluate-global")
def evaluate_global(authorization: Optional[str] = Header(None)):
    user = get_user(authorization)

    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    if GLOBAL_MODEL is None:
        raise HTTPException(status_code=400, detail="Global model is not available.")

    if user["username"] not in LOCAL_MODELS:
        raise HTTPException(status_code=400, detail="Train your local model first.")

    df = load_institute_data(user["username"])
    X, y = prepare_features(df)
    _, _, X_test, y_test, reused = split_data(X, y)

    metrics = classification_metrics(GLOBAL_MODEL, X_test, y_test)

    result = {
        "institution": user["name"],
        "global_metrics": metrics,
        "global_version": GLOBAL_VERSION,
        "records_evaluated": len(y_test),
        "evaluation_reused_training_data": reused,
    }

    LOCAL_ANALYSIS[user["username"]]["global_metrics"] = metrics
    LOCAL_ANALYSIS[user["username"]]["global_version"] = GLOBAL_VERSION
    GLOBAL_ANALYSIS[user["username"]] = result

    return result


@app.get("/api/institute/model-analysis")
def institute_model_analysis(authorization: Optional[str] = Header(None)):
    user = get_user(authorization)

    if user["role"] != "institute":
        raise HTTPException(status_code=403, detail="Institute account required.")

    result = LOCAL_ANALYSIS.get(user["username"])

    if not result:
        return {
            "available": False,
            "message": "Train your local model to see analysis."
        }

    return {
        "available": True,
        **result,
    }


@app.get("/api/admin/global-analysis")
def admin_global_analysis(authorization: Optional[str] = Header(None)):
    require_admin(authorization)

    comparisons = []

    for username, info in INSTITUTIONS.items():
        local = LOCAL_ANALYSIS.get(username, {})
        global_result = GLOBAL_ANALYSIS.get(username, {})

        comparisons.append({
            "username": username,
            "institution": info["name"],
            "local_trained": username in LOCAL_MODELS,
            "local_metrics": local.get("metrics"),
            "global_metrics": global_result.get("global_metrics"),
            "insights": local.get("insights"),
            "global_version": global_result.get("global_version"),
        })

    evaluated = [
        item for item in comparisons
        if item["global_metrics"] is not None
    ]

    def average_metric(key):
        values = [
            item["global_metrics"][key]
            for item in evaluated
        ]
        return round(float(np.mean(values)), 2) if values else None

    return {
        "global_version": GLOBAL_VERSION,
        "training_rounds": TRAINING_ROUNDS,
        "participating_institutions": len(LOCAL_MODELS),
        "evaluated_institutions": len(evaluated),
        "average_global_metrics": {
            "accuracy": average_metric("accuracy"),
            "precision": average_metric("precision"),
            "recall": average_metric("recall"),
            "f1_score": average_metric("f1_score"),
        },
        "comparisons": comparisons,
    }
