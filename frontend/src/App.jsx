
import React, { useEffect, useState } from 'react';
import {
  Activity, BrainCircuit, Building2, CheckCircle2,
  ChevronRight, CloudUpload, Database, FileSpreadsheet,
  Globe2, GraduationCap, LayoutDashboard, LogOut,
  LockKeyhole, Network, RefreshCw, ShieldCheck,
  Users, BarChart3
} from 'lucide-react';
import './style.css';

const API = 'http://127.0.0.1:8000';

async function api(path, token, options = {}) {
  const headers = { ...(options.headers || {}) };

  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'Something went wrong');
  }

  return data;
}

function formatMetric(value) {
  if (value == null || value === '') return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return number <= 1
    ? Number((number * 100).toFixed(2))
    : Number(number.toFixed(2));
}

function getMetrics(data) {
  if (!data) return null;

  return (
    data.metrics ||
    data.local_metrics ||
    data.performance_metrics ||
    null
  );
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('fedlearn_token') || ''
  );

  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    api('/api/auth/me', token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('fedlearn_token');
        setToken('');
      })
      .finally(() => setChecking(false));
  }, [token]);

  function handleLogin(data) {
    localStorage.setItem('fedlearn_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem('fedlearn_token');
    setToken('');
    setUser(null);
  }

  if (checking) {
    return <div className="loading-screen">Loading FedLearn...</div>;
  }

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Dashboard
      token={token}
      user={user}
      onLogout={logout}
    />
  );
}


// --------------------------------------------------
// LOGIN
// --------------------------------------------------

function Login({ onLogin }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await api('/api/auth/login', null, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <BrainCircuit size={30} />
        </div>

        <div className="login-brand">FedLearn</div>

        <div className="login-subtitle">
          PRIVACY-PRESERVING COLLABORATIVE LEARNING
        </div>

        <h1>Welcome back</h1>

        <p className="muted">
          Sign in to your institution or admin workspace.
        </p>

        <form onSubmit={submit}>
          <label>Username</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter username"
            required
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />

          {error && <div className="error-box">{error}</div>}

          <button
            className="primary-btn login-button"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
            <ChevronRight size={17} />
          </button>
        </form>

        <div className="demo-accounts">
          <strong>Demo accounts</strong>
          <p>Admin: admin / admin123</p>
          <p>Institute A: institute_a / insta123</p>
          <p>Institute B: institute_b / instb123</p>
          <p>Institute C: institute_c / instc123</p>
        </div>

        <div className="login-privacy">
          <ShieldCheck size={16} />
          Institution-specific workspace
        </div>
      </div>
    </div>
  );
}


// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

function Dashboard({ token, user, onLogout }) {
  const isAdmin = user.role === 'admin';

  const [active, setActive] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [summary, setSummary] = useState(null);
  const [globalModel, setGlobalModel] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [file, setFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const nav = isAdmin
    ? [
        { label: 'Overview', icon: LayoutDashboard },
        { label: 'Institutions', icon: Building2 },
        { label: 'Global Training', icon: Network },
        { label: 'Global Analysis', icon: BarChart3 }
      ]
    : [
        { label: 'Overview', icon: LayoutDashboard },
        { label: 'Student Data', icon: Database },
        { label: 'Local Training', icon: BrainCircuit },
        { label: 'Global Model', icon: Globe2 },
        { label: 'Model Analysis', icon: BarChart3 }
      ];

  async function loadDashboard() {
    setError('');

    try {
      if (isAdmin) {
        const data = await api('/api/admin/overview', token);
        setOverview(data);

        try {
          const analysisData = await api(
            '/api/admin/global-analysis',
            token
          );
          setAnalysis(analysisData);
        } catch {
          setAnalysis(null);
        }
      } else {
        try {
          const data = await api('/api/institute/summary', token);
          setSummary(data);
        } catch {
          setSummary(null);
        }

        try {
          const model = await api('/api/institute/global-model', token);
          setGlobalModel(model);
        } catch {
          setGlobalModel(null);
        }

        try {
          const analysisData = await api(
            '/api/institute/model-analysis',
            token
          );
          setAnalysis(analysisData);
        } catch {
          setAnalysis(null);
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [token, isAdmin]);

  async function uploadDataset() {
    if (!file) return;

    setBusy(true);
    setError('');
    setMessage('');

    const body = new FormData();
    body.append('file', file);

    try {
      const data = await api('/api/institute/upload', token, {
        method: 'POST',
        body
      });

      setMessage(
        `Dataset uploaded: ${data.records} records and ${data.subjects} subjects.`
      );

      setFile(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function trainLocal() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const data = await api('/api/institute/train-local', token, {
        method: 'POST'
      });

      const metrics = data.metrics || {};

      setMessage(
        `Local model trained. Accuracy: ${formatMetric(metrics.accuracy) ?? '—'}%, Precision: ${formatMetric(metrics.precision) ?? '—'}%, Recall: ${formatMetric(metrics.recall) ?? '—'}%, F1-score: ${formatMetric(metrics.f1_score) ?? '—'}%.`
      );

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function trainGlobal() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const data = await api('/api/admin/train-global', token, {
        method: 'POST'
      });

      setMessage(
        `Global model version ${data.global_model_version} created using ${data.participating_institutions} institutions.`
      );

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function evaluateGlobal() {
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const data = await api('/api/institute/evaluate-global', token, {
        method: 'POST'
      });

      const metrics = data.global_metrics || {};

      setMessage(
        `Global model evaluated. Accuracy: ${formatMetric(metrics.accuracy) ?? '—'}%, Precision: ${formatMetric(metrics.precision) ?? '—'}%, Recall: ${formatMetric(metrics.recall) ?? '—'}%, F1-score: ${formatMetric(metrics.f1_score) ?? '—'}%.`
      );

      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = isAdmin ? 'Administrator' : user.name;

  return (
    <div className="app-shell">
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">
            <BrainCircuit size={22} />
          </div>
          <div>
            <strong>FedLearn</strong>
            <span>PRIVACY-FIRST AI</span>
          </div>
        </div>

        <div className="workspace-label">
          {isAdmin ? 'ADMIN WORKSPACE' : 'INSTITUTE WORKSPACE'}
        </div>

        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${active === label ? 'active' : ''}`}
              onClick={() => {
                setActive(label);
                setMessage('');
                setError('');
                loadDashboard();
              }}
            >
              <Icon size={18} />
              <span>{label}</span>

              {active === label && (
                <ChevronRight className="nav-arrow" size={15} />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={19} />
            <strong>Data isolation</strong>
            <p>
              {isAdmin
                ? 'Admin receives aggregate metrics and model updates.'
                : 'Your institute has a separate dataset workspace.'}
            </p>
          </div>

          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">
            FedLearn <span>/</span> {active}
          </div>

          <div className="top-actions">
            <span className="connection">
              <i /> Local prototype
            </span>
            <span className="role-chip">
              {isAdmin ? 'ADMIN' : 'INSTITUTE'}
            </span>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {isAdmin
                  ? 'FEDLEARN CONTROL CENTER'
                  : 'INSTITUTION PORTAL'}
              </div>

              <h1>
                {active === 'Overview' ? `Welcome, ${title}` : active}
              </h1>

              <p>
                {isAdmin
                  ? 'Monitor institutional participation and global model training.'
                  : 'Manage your local student dataset and participate in federated learning.'}
              </p>
            </div>

            <div className="date-chip">
              <Activity size={15} />
              FedLearn
            </div>
          </div>

          {message && (
            <div className="success-box">
              <CheckCircle2 size={17} />
              {message}
            </div>
          )}

          {error && <div className="error-box">{error}</div>}

          {active === 'Overview' && (
            isAdmin
              ? <AdminOverview overview={overview} setActive={setActive} />
              : (
                <InstituteOverview
                  summary={summary}
                  globalModel={globalModel}
                  setActive={setActive}
                />
              )
          )}

          {active === 'Institutions' && isAdmin && (
            <AdminInstitutions overview={overview} />
          )}

          {active === 'Global Training' && isAdmin && (
            <section className="panel training-panel">
              <div className="training-icon">
                <Network size={26} />
              </div>

              <h2>Global federated training</h2>

              <p>
                Aggregate local model updates from participating institutions
                using Federated Averaging (FedAvg).
              </p>

              <div className="training-info">
                <div>
                  <strong>{overview?.updates_received ?? 0}</strong>
                  <span>Local updates received</span>
                </div>
                <div>
                  <strong>{overview?.institutions?.length ?? 3}</strong>
                  <span>Total institutions</span>
                </div>
                <div>
                  <strong>{overview?.global_model_version ?? 0}</strong>
                  <span>Current global version</span>
                </div>
              </div>

              <button
                className="primary-btn"
                disabled={busy || (overview?.updates_received ?? 0) < 2}
                onClick={trainGlobal}
              >
                <RefreshCw size={16} />
                {busy ? 'Aggregating...' : 'Start global FedAvg training'}
              </button>

              {(overview?.updates_received ?? 0) < 2 && (
                <p className="hint">
                  At least two institutes must train their local models first.
                </p>
              )}
            </section>
          )}

          {active === 'Student Data' && !isAdmin && (
            <section className="panel">
              <h2>Upload your student dataset</h2>

              <p className="muted">
                Your CSV is stored in your institution's separate folder.
              </p>

              <div className="upload-zone">
                <CloudUpload size={35} />
                <strong>Select student records CSV</strong>

                <p>
                  Required: student_id, subject, marks, cgpa, section
                </p>

                <input
                  type="file"
                  accept=".csv"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />

                <div className="file-hint">
                  {file ? file.name : 'No file selected'}
                </div>

                <button
                  className="primary-btn"
                  disabled={!file || busy}
                  onClick={uploadDataset}
                >
                  {busy ? 'Uploading...' : 'Upload dataset'}
                  <ChevronRight size={16} />
                </button>
              </div>

              {summary && <DatasetSummary summary={summary} />}
            </section>
          )}

          {active === 'Local Training' && !isAdmin && (
            <section className="panel training-panel">
              <div className="training-icon">
                <BrainCircuit size={26} />
              </div>

              <h2>Train your local model</h2>

              <p>
                Train using only your institution's dataset. The backend
                stores the resulting model update separately for your institute.
              </p>

              <div className="training-info">
                <div>
                  <strong>{summary?.records ?? 0}</strong>
                  <span>Local records</span>
                </div>
                <div>
                  <strong>{summary?.subjects ?? 0}</strong>
                  <span>Subjects</span>
                </div>
                <div>
                  <strong>{globalModel?.version ?? '—'}</strong>
                  <span>Global version available</span>
                </div>
              </div>

              <button
                className="primary-btn"
                disabled={busy || !summary}
                onClick={trainLocal}
              >
                <BrainCircuit size={17} />
                {busy ? 'Training...' : 'Train local model'}
              </button>

              {!summary && (
                <p className="hint">
                  Upload your dataset before training.
                </p>
              )}
            </section>
          )}

          {active === 'Global Model' && !isAdmin && (
            <section className="panel training-panel">
              <div className="training-icon">
                <Globe2 size={26} />
              </div>

              <h2>Global model distribution</h2>

              {globalModel?.available ? (
                <>
                  <div className="global-version">
                    <span>AVAILABLE MODEL</span>
                    <strong>Version {globalModel.version}</strong>
                  </div>

                  <p>
                    Your institute can access the global model produced
                    through federated aggregation.
                  </p>

                  <div className="success-box">
                    <CheckCircle2 size={17} />
                    {globalModel.message}
                  </div>
                </>
              ) : (
                <p>
                  No global model has been published yet. Train your local
                  model and wait for the administrator to aggregate updates.
                </p>
              )}
            </section>
          )}

          {active === 'Global Analysis' && isAdmin && (
            <AdminGlobalAnalysis analysis={analysis} />
          )}

          {active === 'Model Analysis' && !isAdmin && (
            <InstituteModelAnalysis
              analysis={analysis}
              globalModel={globalModel}
              busy={busy}
              evaluateGlobal={evaluateGlobal}
              setActive={setActive}
            />
          )}
        </div>
      </main>
    </div>
  );
}


// --------------------------------------------------
// ADMIN GLOBAL ANALYSIS
// --------------------------------------------------

function AdminGlobalAnalysis({ analysis }) {
  const comparisons = analysis?.comparisons || [];

  const globalMetrics =
    analysis?.average_global_metrics ||
    analysis?.global_metrics ||
    null;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Global model analysis</h3>
          <p>
            Compare academic performance, engagement and model results across institutions.
          </p>
        </div>
        <BarChart3 className="muted-icon" />
      </div>

      <div className="stats-grid">
        <Stat
          icon={Globe2}
          label="Global model version"
          value={analysis?.global_version ?? 0}
        />

        <Stat
          icon={Building2}
          label="Evaluated institutions"
          value={analysis?.evaluated_institutions ?? 0}
        />

        <Stat
          icon={Activity}
          label="Global accuracy"
          value={globalMetrics?.accuracy != null
            ? `${formatMetric(globalMetrics.accuracy)}%` : '—'}
        />

        <Stat
          icon={BrainCircuit}
          label="Global F1-score"
          value={globalMetrics?.f1_score != null
            ? `${formatMetric(globalMetrics.f1_score)}%` : '—'}
        />
      </div>

      <h3 className="analysis-heading">
        Average global model metrics
      </h3>

      <MetricChart metrics={globalMetrics} />

      <div className="analysis-note">
        Global metrics are based on institute evaluations of the global model.
        Each institute evaluates the model using its own local dataset.
      </div>

      <h3 className="analysis-heading">
        Institute performance and learning pattern comparison
      </h3>

      {comparisons.length === 0 ? (
        <div className="analysis-empty">
          <BarChart3 size={35} />
          <h3>No institute analysis available</h3>
          <p>
            Institutions must train their local models and evaluate the
            global model before their results appear here.
          </p>
        </div>
      ) : (
        comparisons.map(item => (
          <div
            className="institution-analysis-card"
            key={item.username || item.institution}
          >
            <div className="panel-head">
              <div>
                <h3>{item.institution || item.name}</h3>
                <p>
                  {item.global_metrics
                    ? `Global model version ${item.global_version ?? analysis?.global_version ?? '—'} evaluated`
                    : item.local_trained
                      ? 'Local model trained — global evaluation pending'
                      : 'Local training pending'}
                </p>
              </div>

              <span className="role-chip">
                {item.global_metrics ? 'EVALUATED' : 'PENDING'}
              </span>
            </div>

            <ComparisonChart
              localMetrics={item.local_metrics || item.metrics}
              globalMetrics={item.global_metrics}
            />

            <PatternInsights
              insights={item.insights || item.local_insights}
            />

            {item.global_insights && (
              <>
                <h4>Global model insights</h4>
                <PatternInsights insights={item.global_insights} />
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}


// --------------------------------------------------
// INSTITUTE MODEL ANALYSIS
// --------------------------------------------------

function InstituteModelAnalysis({
  analysis,
  globalModel,
  busy,
  evaluateGlobal,
  setActive
}) {
  const localMetrics = getMetrics(analysis);
  const globalMetrics = analysis?.global_metrics || null;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>Institute model analysis</h3>
          <p>
            Explore student learning patterns, engagement and academic performance.
          </p>
        </div>
        <BarChart3 className="muted-icon" />
      </div>

      {!analysis?.available && !localMetrics ? (
        <div className="analysis-empty">
          <BrainCircuit size={35} />
          <h3>No analysis available yet</h3>
          <p>
            Upload your dataset and train your local model first.
          </p>

          <button
            className="primary-btn"
            onClick={() => setActive('Local Training')}
          >
            Go to local training
          </button>
        </div>
      ) : (
        <>
          <h3 className="analysis-heading">
            Local model performance
          </h3>

          <MetricChart metrics={localMetrics} />

          <PatternInsights insights={analysis?.insights} />

          <h3 className="analysis-heading">
            Local vs global model comparison
          </h3>

          <ComparisonChart
            localMetrics={localMetrics}
            globalMetrics={globalMetrics}
          />

          {!globalMetrics && (
            <div className="analysis-note">
              The global model has not been evaluated on your institute's
              data yet. Evaluate it below after the admin has trained
              the global model.
            </div>
          )}

          {globalMetrics && (
            <div className="analysis-note">
              Global model version: {analysis?.global_version ?? '—'}.
              Both models should be evaluated on the same test data
              for a meaningful comparison.
            </div>
          )}

          <button
            className="primary-btn"
            disabled={busy || !globalModel?.available}
            onClick={evaluateGlobal}
          >
            <Activity size={16} />
            {busy
              ? 'Evaluating...'
              : 'Evaluate global model on my data'}
          </button>
        </>
      )}
    </section>
  );
}


// --------------------------------------------------
// CHART: FOUR MODEL METRICS
// --------------------------------------------------

function MetricChart({ metrics }) {
  const items = [
    { label: 'Accuracy', value: formatMetric(metrics?.accuracy) },
    { label: 'Precision', value: formatMetric(metrics?.precision) },
    { label: 'Recall', value: formatMetric(metrics?.recall) },
    { label: 'F1-score', value: formatMetric(metrics?.f1_score ?? metrics?.f1) }
  ];

  if (!metrics) {
    return <ChartEmpty message="Model metrics are not available yet." />;
  }

  return (
    <div style={chartCardStyle}>
      <h4 style={chartTitleStyle}>Model evaluation metrics</h4>
      <p style={chartSubtitleStyle}>
        Classification performance (percentage)
      </p>

      <div style={barChartContainerStyle}>
        {items.map(item => (
          <div key={item.label} style={barRowStyle}>
            <div style={barLabelStyle}>{item.label}</div>

            <div style={barTrackStyle}>
              <div
                style={{
                  ...barFillStyle,
                  width: `${Math.min(item.value ?? 0, 100)}%`
                }}
              />
            </div>

            <strong style={barValueStyle}>
              {item.value == null ? '—' : `${item.value}%`}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}


// --------------------------------------------------
// CHART: LOCAL VS GLOBAL MODEL
// --------------------------------------------------

function ComparisonChart({ localMetrics, globalMetrics }) {
  const metrics = [
    {
      label: 'Accuracy',
      local: formatMetric(localMetrics?.accuracy),
      global: formatMetric(globalMetrics?.accuracy)
    },
    {
      label: 'Precision',
      local: formatMetric(localMetrics?.precision),
      global: formatMetric(globalMetrics?.precision)
    },
    {
      label: 'Recall',
      local: formatMetric(localMetrics?.recall),
      global: formatMetric(globalMetrics?.recall)
    },
    {
      label: 'F1-score',
      local: formatMetric(localMetrics?.f1_score ?? localMetrics?.f1),
      global: formatMetric(globalMetrics?.f1_score ?? globalMetrics?.f1)
    }
  ];

  return (
    <div style={chartCardStyle}>
      <h4 style={chartTitleStyle}>Local vs global model metrics</h4>

      <div style={legendStyle}>
        <span><i style={legendLocalStyle} /> Local model</span>
        <span><i style={legendGlobalStyle} /> Global model</span>
      </div>

      {metrics.map(item => (
        <div key={item.label} style={{ marginBottom: 22 }}>
          <strong style={comparisonLabelStyle}>{item.label}</strong>

          <div style={comparisonRowStyle}>
            <span style={comparisonNameStyle}>Local</span>
            <div style={comparisonTrackStyle}>
              <div
                style={{
                  ...comparisonLocalFillStyle,
                  width: `${Math.min(item.local ?? 0, 100)}%`
                }}
              />
            </div>
            <strong style={comparisonValueStyle}>
              {item.local == null ? '—' : `${item.local}%`}
            </strong>
          </div>

          <div style={comparisonRowStyle}>
            <span style={comparisonNameStyle}>Global</span>
            <div style={comparisonTrackStyle}>
              <div
                style={{
                  ...comparisonGlobalFillStyle,
                  width: `${Math.min(item.global ?? 0, 100)}%`
                }}
              />
            </div>
            <strong style={comparisonValueStyle}>
              {item.global == null ? '—' : `${item.global}%`}
            </strong>
          </div>
        </div>
      ))}

      {!globalMetrics && (
        <p style={chartFootnoteStyle}>
          Global model results will appear after evaluation.
        </p>
      )}
    </div>
  );
}


// --------------------------------------------------
// CHART: LEARNING / TEACHING APPROACHES
// --------------------------------------------------

function ApproachChart({ title, items }) {
  const normalized = (items || []).map((item, index) => {
    if (typeof item === 'string') {
      return { name: item, percentage: null, count: null };
    }

    return {
      name: item.name || item.approach || item.method || `Pattern ${index + 1}`,
      percentage: item.percentage,
      count: item.count
    };
  });

  if (!normalized.length) {
    return <ChartEmpty message="No approach data available." />;
  }

  const maxValue = Math.max(
    ...normalized.map(item => Number(item.percentage ?? item.count ?? 0)),
    1
  );

  return (
    <div style={chartCardStyle}>
      <h4 style={chartTitleStyle}>{title}</h4>

      {normalized.map((item, index) => {
        const value = Number(item.percentage ?? item.count ?? 0);
        const width = (value / maxValue) * 100;

        return (
          <div key={`${item.name}-${index}`} style={{ marginBottom: 17 }}>
            <div style={barHeaderStyle}>
              <span>{item.name}</span>
              <strong>
                {item.percentage != null
                  ? `${item.percentage}%`
                  : item.count != null
                    ? `${item.count} students`
                    : '—'}
              </strong>
            </div>

            <div style={barTrackStyle}>
              <div
                style={{
                  ...barFillStyle,
                  width: `${width}%`
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


// --------------------------------------------------
// CHART: ENGAGEMENT AND ACADEMIC PERFORMANCE
// --------------------------------------------------

function InsightMetricChart({ title, items }) {
  const validItems = items.filter(item => item.value != null);

  if (!validItems.length) {
    return <ChartEmpty message={`${title} data is not available.`} />;
  }

  const maxValue = Math.max(
    ...validItems.map(item => Number(item.value)),
    1
  );

  return (
    <div style={chartCardStyle}>
      <h4 style={chartTitleStyle}>{title}</h4>

      {validItems.map(item => (
        <div key={item.label} style={{ marginBottom: 19 }}>
          <div style={barHeaderStyle}>
            <span>{item.label}</span>
            <strong>{item.value}{item.suffix || ''}</strong>
          </div>

          <div style={barTrackStyle}>
            <div
              style={{
                ...barFillStyle,
                width: `${Math.max(2, Number(item.value) / maxValue * 100)}%`
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


// --------------------------------------------------
// CHART: PERFORMANCE DISTRIBUTION
// --------------------------------------------------

function PerformanceDistributionChart({ distribution }) {
  const items = [
    { label: 'High performance', value: Number(distribution?.high ?? 0), color: '#16a77a' },
    { label: 'Medium performance', value: Number(distribution?.medium ?? 0), color: '#7c63ed' },
    { label: 'Low performance', value: Number(distribution?.low ?? 0), color: '#e69a42' }
  ];

  const total = items.reduce((sum, item) => sum + item.value, 0);

  let current = 0;
  const gradient = items.map(item => {
    const start = current;
    current += total ? (item.value / total) * 100 : 0;
    return `${item.color} ${start}% ${current}%`;
  }).join(', ');

  return (
    <div style={chartCardStyle}>
      <h4 style={chartTitleStyle}>Student performance distribution</h4>

      {total > 0 ? (
        <div style={distributionLayoutStyle}>
          <div
            style={{
              ...donutStyle,
              background: `conic-gradient(${gradient})`
            }}
          >
            <div style={donutInnerStyle}>
              <strong>{total}</strong>
              <span>Students</span>
            </div>
          </div>

          <div style={distributionLegendStyle}>
            {items.map(item => (
              <div key={item.label} style={distributionLegendRowStyle}>
                <span
                  style={{
                    ...distributionDotStyle,
                    background: item.color
                  }}
                />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ChartEmpty message="Performance distribution is not available." />
      )}
    </div>
  );
}


// --------------------------------------------------
// ALL STUDENT INSIGHTS AS CHARTS
// --------------------------------------------------

function PatternInsights({ insights }) {
  if (!insights) {
    return <ChartEmpty message="Student insights are not available yet." />;
  }

  const engagement = [
    {
      label: 'Attendance',
      value: insights.average_attendance,
      suffix: '%'
    },
    {
      label: 'Study hours per day',
      value: insights.average_study_hours,
      suffix: ' hrs'
    },
    {
      label: 'Class participation',
      value: insights.average_participation
    },
    {
      label: 'Assignment completion',
      value: insights.average_assignment_completion,
      suffix: '%'
    }
  ];

  const academic = [
    { label: 'Average marks', value: insights.average_marks },
    { label: 'Average CGPA', value: insights.average_cgpa },
    { label: 'Number of subjects', value: insights.subjects },
    { label: 'Number of students', value: insights.students }
  ];

  return (
    <div style={{ marginTop: 28 }}>
      <h3 className="analysis-heading">
        Learning and teaching patterns
      </h3>

      <div style={chartGridStyle}>
        <ApproachChart
          title="Student learning approaches"
          items={insights.learning_approaches}
        />

        <ApproachChart
          title="Teaching approaches"
          items={insights.teaching_approaches}
        />
      </div>

      <h3 className="analysis-heading">
        Student engagement
      </h3>

      <div style={chartGridStyle}>
        <InsightMetricChart
          title="Engagement indicators"
          items={engagement}
        />
      </div>

      <h3 className="analysis-heading">
        Academic performance
      </h3>

      <div style={chartGridStyle}>
        <InsightMetricChart
          title="Academic indicators"
          items={academic}
        />

        <PerformanceDistributionChart
          distribution={insights.performance_distribution}
        />
      </div>
    </div>
  );
}


// --------------------------------------------------
// EMPTY CHART
// --------------------------------------------------

function ChartEmpty({ message }) {
  return (
    <div style={chartCardStyle}>
      <div style={emptyChartStyle}>
        <BarChart3 size={28} />
        <p>{message}</p>
      </div>
    </div>
  );
}


// --------------------------------------------------
// CHART STYLES
// --------------------------------------------------

const chartCardStyle = {
  background: '#ffffff',
  border: '1px solid #e5e9f2',
  borderRadius: 14,
  padding: 22,
  marginBottom: 20,
  minWidth: 0
};

const chartTitleStyle = {
  fontSize: 16,
  fontWeight: 650,
  color: '#17243a',
  margin: '0 0 8px'
};

const chartSubtitleStyle = {
  fontSize: 12,
  color: '#8792a7',
  margin: '0 0 24px'
};

const barChartContainerStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 23
};

const barRowStyle = {
  display: 'grid',
  gridTemplateColumns: '85px minmax(60px, 1fr) 65px',
  alignItems: 'center',
  gap: 12
};

const barLabelStyle = {
  fontSize: 13,
  color: '#53627a'
};

const barTrackStyle = {
  width: '100%',
  height: 12,
  background: '#edf0f7',
  borderRadius: 20,
  overflow: 'hidden'
};

const barFillStyle = {
  height: '100%',
  background: 'linear-gradient(90deg, #7961ee, #a08bff)',
  borderRadius: 20,
  transition: 'width 0.5s ease'
};

const barValueStyle = {
  textAlign: 'right',
  fontSize: 13,
  color: '#273750'
};

const barHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 13,
  color: '#53627a',
  marginBottom: 8
};

const legendStyle = {
  display: 'flex',
  gap: 22,
  flexWrap: 'wrap',
  fontSize: 12,
  color: '#68758b',
  margin: '15px 0 25px'
};

const legendLocalStyle = {
  display: 'inline-block',
  width: 10,
  height: 10,
  background: '#7961ee',
  borderRadius: 3,
  marginRight: 6
};

const legendGlobalStyle = {
  display: 'inline-block',
  width: 10,
  height: 10,
  background: '#18a77b',
  borderRadius: 3,
  marginRight: 6
};

const comparisonLabelStyle = {
  display: 'block',
  color: '#26354c',
  fontSize: 13,
  marginBottom: 9
};

const comparisonRowStyle = {
  display: 'grid',
  gridTemplateColumns: '48px minmax(60px, 1fr) 60px',
  alignItems: 'center',
  gap: 10,
  marginBottom: 8
};

const comparisonNameStyle = {
  fontSize: 12,
  color: '#718096'
};

const comparisonTrackStyle = {
  height: 10,
  background: '#edf0f7',
  borderRadius: 20,
  overflow: 'hidden'
};

const comparisonLocalFillStyle = {
  height: '100%',
  background: '#7961ee',
  borderRadius: 20
};

const comparisonGlobalFillStyle = {
  height: '100%',
  background: '#18a77b',
  borderRadius: 20
};

const comparisonValueStyle = {
  fontSize: 12,
  textAlign: 'right',
  color: '#273750'
};

const chartGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
  gap: 16,
  alignItems: 'start'
};

const distributionLayoutStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  flexWrap: 'wrap',
  gap: 24,
  padding: '15px 0'
};

const donutStyle = {
  width: 160,
  height: 160,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const donutInnerStyle = {
  width: 105,
  height: 105,
  borderRadius: '50%',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#17243a'
};

const distributionLegendStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
  minWidth: 180
};

const distributionLegendRowStyle = {
  display: 'grid',
  gridTemplateColumns: '12px 1fr auto',
  alignItems: 'center',
  gap: 9,
  fontSize: 13,
  color: '#53627a'
};

const distributionDotStyle = {
  width: 10,
  height: 10,
  borderRadius: '50%'
};

const emptyChartStyle = {
  minHeight: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#8a96aa',
  textAlign: 'center',
  fontSize: 13
};

const chartFootnoteStyle = {
  color: '#8792a7',
  fontSize: 12,
  marginTop: 15
};


// --------------------------------------------------
// ADMIN OVERVIEW
// --------------------------------------------------

function AdminOverview({ overview, setActive }) {
  const institutes = overview?.institutions || [];

  return (
    <>
      <div className="stats-grid">
        <Stat icon={Building2} label="Institutions" value={institutes.length || 3} />
        <Stat
          icon={Database}
          label="Uploaded institutions"
          value={institutes.filter(x => x.uploaded).length}
        />
        <Stat
          icon={Network}
          label="Local model updates"
          value={overview?.updates_received ?? 0}
        />
        <Stat
          icon={Globe2}
          label="Global model version"
          value={overview?.global_model_version ?? 0}
        />
      </div>

      <section className="panel section-panel">
        <div className="panel-head">
          <div>
            <h3>Institution participation</h3>
            <p>Aggregate information only</p>
          </div>

          <button
            className="text-btn"
            onClick={() => setActive('Institutions')}
          >
            View all <ChevronRight size={15} />
          </button>
        </div>

        <InstitutionTable institutions={institutes} />
      </section>

      <section className="panel section-panel">
        <div className="panel-head">
          <div>
            <h3>Global training</h3>
            <p>Combine local model updates using FedAvg</p>
          </div>
          <Network className="muted-icon" />
        </div>

        <button
          className="primary-btn"
          onClick={() => setActive('Global Training')}
        >
          Open global training <ChevronRight size={16} />
        </button>
      </section>
    </>
  );
}


// --------------------------------------------------
// INSTITUTE OVERVIEW
// --------------------------------------------------

function InstituteOverview({ summary, globalModel, setActive }) {
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <div className="hero-tag">
            <LockKeyhole size={14} />
            INSTITUTE DATA WORKSPACE
          </div>

          <h2>
            Learn locally.
            <br />
            <em>Collaborate globally.</em>
          </h2>

          <p>
            Your institute trains on its own student records and contributes
            model updates to collaborative learning.
          </p>

          <button
            className="primary-btn"
            onClick={() => setActive('Student Data')}
          >
            Manage student data <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon={Users} label="Student records" value={summary?.records ?? 0} />
        <Stat icon={GraduationCap} label="Unique students" value={summary?.students ?? 0} />
        <Stat icon={BookOpenIcon} label="Subjects" value={summary?.subjects ?? 0} />
        <Stat
          icon={Globe2}
          label="Global model"
          value={globalModel?.available ? `v${globalModel.version}` : 'Pending'}
        />
      </div>

      <section className="panel section-panel">
        <div className="panel-head">
          <div>
            <h3>Local dataset</h3>
            <p>
              {summary
                ? 'Your uploaded dataset is ready.'
                : 'No dataset uploaded yet.'}
            </p>
          </div>
          <Database className="muted-icon" />
        </div>

        <button
          className="primary-btn"
          onClick={() => setActive('Student Data')}
        >
          Open student data <ChevronRight size={16} />
        </button>
      </section>

      <section className="panel section-panel">
        <div className="panel-head">
          <div>
            <h3>Global model status</h3>
            <p>
              {globalModel?.available
                ? `Global model version ${globalModel.version} is available.`
                : 'Waiting for admin aggregation.'}
            </p>
          </div>
          <Globe2 className="muted-icon" />
        </div>

        <button
          className="text-btn"
          onClick={() => setActive('Global Model')}
        >
          View global model <ChevronRight size={15} />
        </button>
      </section>
    </>
  );
}


// --------------------------------------------------
// ADMIN INSTITUTIONS
// --------------------------------------------------

function AdminInstitutions({ overview }) {
  return (
    <section className="panel section-panel">
      <div className="panel-head">
        <div>
          <h3>Registered institutions</h3>
          <p>Participation and aggregate performance information</p>
        </div>
        <Users className="muted-icon" />
      </div>

      <InstitutionTable institutions={overview?.institutions || []} />
    </section>
  );
}


// --------------------------------------------------
// INSTITUTION TABLE
// --------------------------------------------------

function InstitutionTable({ institutions }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Institution</th>
            <th>Dataset</th>
            <th>Records</th>
            <th>Average marks</th>
            <th>Average CGPA</th>
            <th>Local model</th>
          </tr>
        </thead>

        <tbody>
          {institutions.map(item => (
            <tr key={item.username}>
              <td>{item.name}</td>
              <td>{item.uploaded ? 'Uploaded' : 'Pending'}</td>
              <td>{item.records}</td>
              <td>{item.average_marks ?? '—'}</td>
              <td>{item.average_cgpa ?? '—'}</td>
              <td>{item.model_trained ? 'Ready' : 'Pending'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// --------------------------------------------------
// DATASET SUMMARY
// --------------------------------------------------

function DatasetSummary({ summary }) {
  return (
    <div className="dataset-summary">
      <h3>Dataset summary</h3>
      <p>Records: {summary.records}</p>
      <p>Unique students: {summary.students}</p>
      <p>Average marks: {summary.average_marks}</p>
      <p>Average CGPA: {summary.average_cgpa}</p>
      <p>Number of subjects: {summary.subjects}</p>
    </div>
  );
}


// --------------------------------------------------
// STAT CARD
// --------------------------------------------------

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="stat-card">
      {Icon && (
        <div className="stat-icon purple">
          <Icon size={18} />
        </div>
      )}

      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}


// --------------------------------------------------
// BOOK ICON
// --------------------------------------------------

function BookOpenIcon(props) {
  return <FileSpreadsheet {...props} />;
}
