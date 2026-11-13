# FedLearn – Privacy-Preserving Collaborative Learning

**FedLearn** is a federated learning-based educational analytics platform that enables multiple educational institutions to collaboratively analyze student academic performance, learning approaches, teaching methods, and engagement patterns without centralizing their raw student datasets.

The system allows institutions to train local machine learning models independently. An administrator aggregates their model updates using Federated Averaging (FedAvg) to create a global model, which can then be evaluated by individual institutions.

---

## Project Objectives

- Enable collaborative learning across multiple educational institutions.
- Keep individual institution datasets separate.
- Train machine learning models locally at each institution.
- Aggregate local model updates using Federated Averaging.
- Analyze student engagement, learning patterns, and academic performance.
- Compare local and global model performance using Accuracy, Precision, Recall, and F1-score.

## Key Features

### 1. Separate Institution Login
- Individual login for each participating institution.
- Separate institution workspaces.
- Isolated student datasets.

### 2. Student Dataset Management
- Upload student datasets in CSV format.
- Analyze academic and engagement information.
- Display student records, subjects, marks, and CGPA.

### 3. Local Model Training
- Train machine learning models using institution-specific data.
- Generate local model updates.
- Share model updates for federated aggregation rather than transferring raw student records.

### 4. Global Federated Learning
- Administrator monitors institution participation.
- Collects local model updates.
- Aggregates model updates using Federated Averaging (FedAvg).
- Publishes the global model for participating institutions.

### 5. Model Analysis Dashboard

Visualize and compare:

- Accuracy
- Precision
- Recall
- F1-score
- Student learning approaches
- Teaching approaches
- Attendance and study hours
- Assignment completion
- Average marks and CGPA
- Student performance distribution

### 6. Local vs Global Comparison
Institutions can evaluate the global model using their own local data and compare its performance with their local model.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Backend | Python, FastAPI |
| Machine Learning | Scikit-learn / PyTorch |
| Federated Learning | FedAvg |
| Data Processing | Pandas, NumPy |
| API Testing | Swagger UI |
| Development Environment | VS Code |

---

## Project Architecture

```text
              FedLearn Platform
                     |
          -----------------------
          |          |          |
     Institute A Institute B Institute C
          |          |          |
     Local Data  Local Data  Local Data
          |          |          |
     Local Model Local Model Local Model
          |          |          |
     Model Update Model Update Model Update
          |          |          |
          -----------------------
                     |
              Admin Server
                     |
             FedAvg Aggregation
                     |
               Global Model
                     |
          -----------------------
          |          |          |
     Institute A Institute B Institute C
          |          |          |
       Evaluation and Model Comparison
```

**Privacy principle:** Raw student datasets remain within their respective institution workspaces. Only model updates are intended for federated aggregation. This prototype does not automatically guarantee formal privacy; techniques such as Differential Privacy and Secure Aggregation can be added and evaluated separately.

---

## Dataset Format

FedLearn uses CSV files containing student academic and engagement information.

Expected columns:

| Column | Description |
|---|---|
| student_id | Unique student identifier |
| section | Student section |
| semester | Current semester |
| subject | Subject name |
| marks | Subject marks |
| cgpa | Student CGPA |
| attendance_percent | Attendance percentage |
| learning_approach | Student learning method |
| teaching_approach | Teaching method |
| study_hours_per_day | Daily study hours |
| class_participation_level_1_to_5 | Participation score |
| assignment_completion_percent | Assignment completion |
| assessment_type | Assessment category |
| performance_level | Academic performance category |

Sample datasets are provided for three simulated institutions:

- Institution A
- Institution B
- Institution C

These datasets contain synthetic demonstration records.

---

## Installation and Setup

### Prerequisites

- Python 3.10+
- Node.js and npm
- Git
- Visual Studio Code

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/FedLearn.git
cd FedLearn
```

### 2. Backend Setup

Open a terminal in the backend folder:

```bash
cd backend
python -m venv venv
```

Activate the virtual environment on Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

Backend API:

```text
http://127.0.0.1:8000
```

Swagger API documentation:

```text
http://127.0.0.1:8000/docs
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Demonstration Accounts

| Account | Username | Password |
|---|---|---|
| Admin | admin | admin123 |
| Institution A | institute_a | insta123 |
| Institution B | institute_b | instb123 |
| Institution C | institute_c | instc123 |

These are prototype demonstration credentials. Replace them with secure authentication before deployment.

---

## Application Workflow

1. Each institution logs in separately.
2. Institutions upload their own student CSV datasets.
3. Each institution trains its local model.
4. Local model updates are made available to the administrator.
5. The administrator performs global FedAvg aggregation.
6. The global model is made available to institutions.
7. Each institution evaluates the global model using its own dataset.
8. The dashboard displays local and global model comparisons and student learning insights.

---

## Model Evaluation

The system uses the following metrics:

- **Accuracy:** Overall prediction correctness.
- **Precision:** Correct positive predictions among positive predictions.
- **Recall:** Correctly identified positive cases.
- **F1-score:** Harmonic mean of precision and recall.

Model performance should be evaluated on appropriate held-out test data. Local and global results should use the same evaluation data for a meaningful comparison.

---

## Future Enhancements

- Differential Privacy for stronger privacy protection.
- Secure Aggregation for protecting individual model updates.
- Explainable AI for understanding student performance patterns.
- Support for more educational institutions.
- Real-time analytics and monitoring.
- Cloud deployment and scalable federated learning infrastructure.

---

## Project Status

**Phase 1 – Working Prototype**

The current prototype demonstrates separate institution workspaces, CSV dataset uploads, local model training, administrator-controlled federated aggregation, and local/global analysis.

---

## Contributors

Developed as an academic project focused on privacy-preserving collaborative learning in educational institutions.

**Project Name:** FedLearn  
**Domain:** Artificial Intelligence, Machine Learning, Federated Learning  
**Application Area:** Educational Analytics
# FedLearn
