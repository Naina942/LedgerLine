import React, {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import api, { getErrorMessage } from "./api.js";
import { formatMoney } from "./money.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "balancevault-token";

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("Authentication context is unavailable.");
  return context;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(sessionStorage.getItem(TOKEN_KEY)));
  const [authNotice, setAuthNotice] = useState("");

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const token = sessionStorage.getItem(TOKEN_KEY);

    const handleUnauthorized = () => {
      if (active) {
        clearSession();
        setAuthNotice("Your session has expired. Please sign in again.");
        setLoading(false);
      }
    };

    window.addEventListener("balancevault:unauthorized", handleUnauthorized);
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
        window.removeEventListener("balancevault:unauthorized", handleUnauthorized);
      };
    }

    api.get("/api/auth/me")
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch((reason) => {
        if (active) {
          clearSession();
          setAuthNotice(getErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener("balancevault:unauthorized", handleUnauthorized);
    };
  }, [clearSession]);

  const login = useCallback(async (loginValue, password) => {
    const { data } = await api.post("/api/auth/login", {
      login: loginValue,
      password,
    });
    if (!data?.accessToken || !data?.user) {
      throw new Error("The server returned an incomplete sign-in response.");
    }
    sessionStorage.setItem(TOKEN_KEY, data.accessToken);
    setAuthNotice("");
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username, email, password) => {
    await api.post("/api/auth/register", { username, email, password });
    return login(email, password);
  }, [login]);

  const logout = useCallback(async () => {
    let logoutError = "";
    try {
      if (sessionStorage.getItem(TOKEN_KEY)) await api.post("/api/auth/logout");
    } catch (error) {
      logoutError = getErrorMessage(error);
    } finally {
      clearSession();
    }
    return logoutError;
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, authNotice, login, register, logout }),
    [user, loading, authNotice, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="center-state">
          <span>!</span>
          <h1>BalanceVault could not display this page</h1>
          <p>Refresh the page. If the problem continues, sign out and try again.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Refresh page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

function Brand({ light = false }) {
  return (
    <Link className={`brand${light ? " brand-light" : ""}`} to="/">
      <span className="brand-mark">B</span>
      <span>BalanceVault</span>
    </Link>
  );
}

function Message({ error, success }) {
  if (!error && !success) return null;
  return (
    <div className={`notice ${error ? "error" : "success"}`} role={error ? "alert" : "status"}>
      {error || success}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

function Loading({ label = "Loading securely..." }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, loading, authNotice, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authNotice) setNotice(authNotice);
  }, [authNotice]);

  if (loading) return <Loading />;
  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (isRegister) {
        await register(form.username.trim(), form.email.trim(), form.password);
      } else {
        await login(form.email.trim(), form.password);
      }
      navigate("/", { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand light />
        <div>
          <p className="eyebrow">BANKING BUILT AROUND YOU</p>
          <h1>Clarity and control for every transaction.</h1>
          <p className="auth-story-copy">
            Manage your accounts and follow every posted transaction from one secure place.
          </p>
          <div className="auth-proof">
            <span className="proof-icon">✓</span>
            Protected account access
          </div>
        </div>
        <p className="auth-foot">BalanceVault · Secure digital banking</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <Brand />
          <p className="eyebrow">{isRegister ? "GET STARTED" : "WELCOME BACK"}</p>
          <h2>{isRegister ? "Create your account" : "Sign in to BalanceVault"}</h2>
          <p className="muted">
            {isRegister
              ? "Your account is protected with secure sign-in."
              : "Enter your credentials to continue."}
          </p>
          <Message error={error} success={notice} />
          <form className="form-stack" onSubmit={submit}>
            {isRegister && (
              <label>
                Username
                <input
                  autoComplete="username"
                  minLength={3}
                  maxLength={50}
                  required
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              </label>
            )}
            <label>
              {isRegister ? "Email address" : "Email or username"}
              <input
                type={isRegister ? "email" : "text"}
                autoComplete={isRegister ? "email" : "username"}
                maxLength={254}
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 12 : 1}
                maxLength={72}
                required
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
              {isRegister && <small>Use at least 12 characters.</small>}
            </label>
            <button className="button primary wide" type="submit" disabled={busy}>
              {busy ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            {isRegister ? "Already have an account? " : "New to BalanceVault? "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="security-note"><span>●</span> Your session is protected and revocable.</p>
        </div>
      </section>
    </main>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

function CustomerOnly({ children }) {
  const { user } = useAuth();
  if (user?.role !== "CUSTOMER") return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === "ADMIN") return <Navigate to="/admin/accounts" replace />;
  if (user?.role === "AUDITOR") return <Navigate to="/transactions" replace />;
  return <Dashboard />;
}

const customerNavigation = [
  { title: "OVERVIEW", links: [{ to: "/", label: "Dashboard", icon: "⌂" }, { to: "/accounts", label: "My accounts", icon: "▣" }] },
  { title: "MONEY MOVEMENT", links: [{ to: "/transactions/transfer", label: "Transfer", icon: "⇄" }, { to: "/transactions/withdraw", label: "Withdraw", icon: "↗" }, { to: "/transactions/deposit", label: "Deposits", icon: "↙" }, { to: "/transactions", label: "Activity", icon: "◷" }] },
];

function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = location.pathname === "/"
    ? "Dashboard"
    : location.pathname.startsWith("/accounts")
      ? "Accounts"
      : location.pathname.startsWith("/admin")
        ? "Administration"
        : location.pathname.startsWith("/audit")
          ? "Audit trail"
          : "Transactions";

  const handleLogout = async () => {
    const warning = await logout();
    navigate("/login", {
      replace: true,
      state: { notice: warning ? `Signed out locally. The server could not revoke the session: ${warning}` : "" },
    });
  };

  const sections = user.role === "CUSTOMER"
    ? customerNavigation
    : user.role === "ADMIN"
      ? [{ title: "ADMINISTRATION", links: [{ to: "/admin/accounts", label: "Accounts", icon: "▣" }, { to: "/admin/users", label: "Users", icon: "♙" }, { to: "/transactions", label: "Transactions", icon: "◷" }, { to: "/audit", label: "Audit trail", icon: "≡" }] }]
      : [{ title: "AUDIT", links: [{ to: "/transactions", label: "Transactions", icon: "◷" }, { to: "/audit", label: "Audit trail", icon: "≡" }] }];

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className="app-shell">
      <button className="mobile-menu" type="button" aria-label="Toggle navigation" onClick={() => setMenuOpen((open) => !open)}>
        ☰
      </button>
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <Brand />
        <p className="workspace-label">PERSONAL WORKSPACE</p>
        <nav className="side-nav">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              {section.links.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon">i</span>
            <strong>Need help?</strong>
            <small>Your account activity is securely recorded.</small>
          </div>
          <div className="profile">
            <span className="avatar">{(user.username || "U").slice(0, 1).toUpperCase()}</span>
            <span className="profile-info">
              <strong>{user.username}</strong>
              <small>{user.role?.toLowerCase()}</small>
            </span>
            <button className="icon-button logout-button" type="button" aria-label="Sign out" title="Sign out" onClick={handleLogout}>↪</button>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb"><span>BalanceVault</span><span>/</span><strong>{title}</strong></div>
          <div className="top-actions">
            <span className="secure-pill"><i /> Secure session</span>
            <span className="avatar small">{(user.username || "U").slice(0, 1).toUpperCase()}</span>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="footer">
          <span>BalanceVault · Secure account management</span>
          <span>Transactions are subject to server-side verification.</span>
        </footer>
      </div>
    </div>
  );
}

function Dashboard() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountResponse, transactionResponse] = await Promise.all([
        api.get("/api/accounts"),
        api.get("/api/transactions/my", { params: { page: 1, pageSize: 5 } }),
      ]);
      setAccounts(accountResponse.data.accounts);
      setTransactions(transactionResponse.data.items);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPaise = accounts.reduce((total, account) => total + BigInt(account.balancePaise), 0n);
  return (
    <>
      <PageHeader
        eyebrow="ACCOUNT OVERVIEW"
        title="Your dashboard"
        description="A clear view of your accounts and recent activity."
        action={<Link className="button primary" to="/accounts/new">Open an account <span>＋</span></Link>}
      />
      <Message error={error} />
      {loading ? <Loading /> : (
        <>
          <section className="stats-grid" aria-label="Account summary">
            <article className="stat-card">
              <div className="stat-top"><span>Total balance</span><span className="stat-icon">₹</span></div>
              <strong>{formatMoney(totalPaise.toString())}</strong>
              <small>Across {accounts.length} account{accounts.length === 1 ? "" : "s"}</small>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Accounts</span><span className="stat-icon purple">▣</span></div>
              <strong>{accounts.length}</strong>
              <small>Your accounts</small>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Recent activity</span><span className="stat-icon green">◷</span></div>
              <strong>{transactions.length}</strong>
              <small>Latest transactions shown below</small>
            </article>
          </section>

          <div className="section-heading">
            <div><h2>Your accounts</h2><p>Balances and account status.</p></div>
            <Link className="text-link" to="/accounts">View all <span>→</span></Link>
          </div>
          {accounts.length ? (
            <div className="account-grid">
              {accounts.slice(0, 4).map((account) => <AccountCard key={account.id} account={account} />)}
            </div>
          ) : (
            <EmptyState title="No accounts yet" description="Open an account to start managing your BalanceVault activity." action={<Link className="button primary" to="/accounts/new">Open an account</Link>} />
          )}

          <div className="section-heading recent-heading">
            <div><h2>Recent activity</h2><p>Your latest posted transactions.</p></div>
            <Link className="text-link" to="/transactions">View activity <span>→</span></Link>
          </div>
          <TransactionTable items={transactions} />
        </>
      )}
    </>
  );
}

function EmptyState({ title, description, action }) {
  return (
    <div className="empty-card">
      <span className="empty-icon">▣</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function AccountCard({ account }) {
  return (
    <Link className={`account-card${account.accountType === "CURRENT" ? " account-current" : ""}`} to={`/accounts/${encodeURIComponent(account.accountNumber)}`}>
      <div className="account-card-top">
        <span className="account-type">{account.accountType} ACCOUNT</span>
        <span className={`status-chip ${account.status.toLowerCase()}`}>{account.status}</span>
      </div>
      <div className="account-number">•••• •••• •••• {account.accountNumber.slice(-4)}</div>
      <small>Available balance</small>
      <strong>{formatMoney(account.balancePaise)}</strong>
      <div className="account-card-bottom"><span>INR · BalanceVault</span><span>Open account →</span></div>
    </Link>
  );
}

function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/api/accounts")
      .then(({ data }) => { if (active) setAccounts(data.accounts); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="YOUR ACCOUNTS"
        title="My accounts"
        description="View account balances and status. Your account number is shown in masked form."
        action={<Link className="button primary" to="/accounts/new">Open account <span>＋</span></Link>}
      />
      <Message error={error} />
      {loading ? <Loading /> : accounts.length ? (
        <div className="account-grid account-grid-wide">
          {accounts.map((account) => <AccountCard key={account.id} account={account} />)}
        </div>
      ) : (
        <EmptyState title="No accounts yet" description="Create an account to view it here." action={<Link className="button primary" to="/accounts/new">Open an account</Link>} />
      )}
    </>
  );
}

function CreateAccountPage() {
  const [accountType, setAccountType] = useState("SAVINGS");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/api/accounts", { accountType });
      if (!data?.account?.accountNumber) throw new Error("The server returned an incomplete account response.");
      navigate(`/accounts/${encodeURIComponent(data.account.accountNumber)}`, { replace: true });
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="NEW ACCOUNT" title="Open an account" description="Choose the account type you want to open." />
      <Message error={error} />
      <div className="form-layout">
        <form className="panel action-form" onSubmit={submit}>
          <label>
            Account type
            <select value={accountType} onChange={(event) => setAccountType(event.target.value)} disabled={busy}>
              <option value="SAVINGS">Savings</option>
              <option value="CURRENT">Current</option>
            </select>
          </label>
          <p className="muted">Your account is created by the server and will start with the actual recorded balance.</p>
          <button className="button primary wide" type="submit" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>
        <aside className="panel safety-panel">
          <div className="safety-icon">✓</div>
          <h3>Account security</h3>
          <ul><li>Only you can access your customer accounts.</li><li>Account balances are provided by the backend.</li></ul>
        </aside>
      </div>
    </>
  );
}

function AccountDetailPage() {
  const { accountNumber } = useParams();
  const [account, setAccount] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get(`/api/accounts/${encodeURIComponent(accountNumber)}`)
      .then(({ data }) => { if (active) setAccount(data.account); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountNumber]);

  if (loading) return <Loading />;
  if (error) return <><PageHeader eyebrow="ACCOUNT" title="Account details" /><Message error={error} /></>;
  if (!account) return <EmptyState title="Account unavailable" description="This account could not be loaded." />;
  return (
    <>
      <PageHeader eyebrow="ACCOUNT DETAILS" title={`${account.accountType} account`} description="Account information returned by BalanceVault." action={<Link className="button secondary" to="/accounts">Back to accounts</Link>} />
      <section className="detail-balance">
        <div><span>Available balance</span><strong>{formatMoney(account.balancePaise)}</strong><small>INR · {account.status}</small></div>
      </section>
      <div className="panel transaction-detail">
        <div className="detail-list">
          <div><span>Account number</span><strong className="mono">{account.accountNumber}</strong></div>
          <div><span>Account type</span><strong>{account.accountType}</strong></div>
          <div><span>Status</span><strong>{account.status}</strong></div>
          <div><span>Currency</span><strong>{account.currency}</strong></div>
          <div><span>Opened</span><strong>{formatDate(account.createdAt)}</strong></div>
        </div>
        <div className="quick-grid">
          <QuickLink to="/transactions/withdraw" icon="↗" title="Withdraw" description="Withdraw from an active account." />
          <QuickLink to="/transactions/transfer" icon="⇄" title="Transfer" description="Move money between your accounts." />
          <QuickLink to="/transactions" icon="◷" title="Activity" description="Review recorded transactions." />
        </div>
      </div>
    </>
  );
}

function QuickLink({ to, icon, title, description }) {
  return <Link className="quick-card" to={to}><span className="quick-icon">{icon}</span><strong>{title}</strong><small>{description}</small><span className="quick-arrow">→</span></Link>;
}

function idempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure random generation is unavailable in this browser.");
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function TransactionForm({ type }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pendingRequest = React.useRef(null);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({ accountNumber: "", fromAccountNumber: "", toAccountNumber: "", amount: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const depositDisabled = type === "deposit";

  useEffect(() => {
    let active = true;
    api.get("/api/accounts")
      .then(({ data }) => {
        if (!active) return;
        const available = (Array.isArray(data.accounts) ? data.accounts : [])
          .filter((account) => account.status === "ACTIVE");
        setAccounts(available);
        if (available.length) {
          setForm((previous) => ({
            ...previous,
            accountNumber: available[0].accountNumber,
            fromAccountNumber: available[0].accountNumber,
          }));
        }
      })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoadingAccounts(false); });
    return () => { active = false; };
  }, []);

  const title = type === "deposit" ? "Deposit funds" : type === "withdraw" ? "Withdraw funds" : "Transfer money";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (depositDisabled) {
      setError("Deposits are unavailable until a verified payment settlement provider is configured.");
      return;
    }
    if (busy) return;

    const amount = form.amount.trim();
    if (!/^(0|[1-9]\d{0,15})(\.\d{1,2})?$/.test(amount) || !/[1-9]/.test(amount)) {
      setError("Enter a positive amount with up to two decimal places.");
      return;
    }
    if (type === "transfer") {
      if (!form.fromAccountNumber || !form.toAccountNumber) {
        setError("Please select both accounts.");
        return;
      }
      if (form.fromAccountNumber === form.toAccountNumber) {
        setError("Source and destination accounts must be different.");
        return;
      }
    } else if (!form.accountNumber) {
      setError("Please select an account.");
      return;
    }
    if (!window.confirm(`Confirm this ${type} request?\nAmount: ₹${amount}`)) return;

    setBusy(true);
    try {
      const body = type === "transfer"
        ? { fromAccountNumber: form.fromAccountNumber, toAccountNumber: form.toAccountNumber, amount }
        : { accountNumber: form.accountNumber, amount };
      const requestFingerprint = JSON.stringify(body);
      if (pendingRequest.current?.fingerprint !== requestFingerprint) {
        pendingRequest.current = {
          fingerprint: requestFingerprint,
          key: idempotencyKey(),
        };
      }
      const { data } = await api.post(`/api/transactions/${type}`, body, {
        headers: { "Idempotency-Key": pendingRequest.current.key },
      });
      if (!data?.transaction?.id) throw new Error("Transaction response was incomplete.");
      pendingRequest.current = null;
      navigate(`/transactions/${encodeURIComponent(data.transaction.id)}`);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const destinations = accounts.filter((account) => account.accountNumber !== form.fromAccountNumber);
  return (
    <>
      <PageHeader eyebrow="SECURE MONEY MOVEMENT" title={title} description="Transactions are checked by the server and recorded in the ledger." />
      {depositDisabled && <Message error="Deposits are disabled until a verified payment settlement provider is configured. No funds will be credited by this form." />}
      <Message error={error} />
      <div className="form-layout">
        <form className="panel action-form" onSubmit={submit}>
          {type === "transfer" ? (
            <>
              <label>
                From account
                <select required value={form.fromAccountNumber} onChange={(event) => setForm((previous) => ({ ...previous, fromAccountNumber: event.target.value, toAccountNumber: "" }))} disabled={loadingAccounts || busy}>
                  <option value="">Select source account</option>
                  {accounts.map((account) => <AccountOption key={account.id} account={account} />)}
                </select>
              </label>
              <label>
                To account
                <select required value={form.toAccountNumber} onChange={(event) => setForm((previous) => ({ ...previous, toAccountNumber: event.target.value }))} disabled={loadingAccounts || busy || destinations.length === 0}>
                  <option value="">Select destination account</option>
                  {destinations.map((account) => <AccountOption key={account.id} account={account} />)}
                </select>
              </label>
            </>
          ) : (
            <label>
              Account
              <select required value={form.accountNumber} onChange={(event) => setForm((previous) => ({ ...previous, accountNumber: event.target.value }))} disabled={loadingAccounts || busy}>
                <option value="">Select your account</option>
                {accounts.map((account) => <AccountOption key={account.id} account={account} />)}
              </select>
            </label>
          )}
          <label>
            Amount (INR)
            <div className="amount-input">
              <span>₹</span>
              <input required inputMode="decimal" pattern="(?:0|[1-9][0-9]{0,15})(?:\.[0-9]{1,2})?" maxLength={20} value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))} placeholder="0.00" disabled={busy || depositDisabled} />
            </div>
            <small>Use up to two decimal places.</small>
          </label>
          <div className="confirm-note"><span>◆</span> {user?.username}, verify the account and amount before confirming.</div>
          <button type="submit" className="button primary wide" disabled={depositDisabled || busy || loadingAccounts || accounts.length === 0 || (type === "transfer" && destinations.length === 0)}>
            {depositDisabled ? "Deposits unavailable" : loadingAccounts ? "Loading accounts..." : busy ? "Processing securely..." : `Confirm ${type}`}
            {!depositDisabled && !busy && !loadingAccounts && <span> →</span>}
          </button>
          {!loadingAccounts && accounts.length === 0 && <small>No active accounts are available for this transaction.</small>}
          {type === "transfer" && accounts.length > 0 && destinations.length === 0 && <small>You need at least two active accounts to make a transfer.</small>}
        </form>
        <aside className="panel safety-panel">
          <div className="safety-icon">✓</div>
          <h3>Protected by design</h3>
          <ul><li>Transactions are recorded in the ledger.</li><li>Duplicate requests use idempotency keys.</li><li>Ownership and available funds are checked by the server.</li></ul>
        </aside>
      </div>
    </>
  );
}

function AccountOption({ account }) {
  return <option value={account.accountNumber}>{account.accountType} •••• {account.accountNumber.slice(-4)} · {formatMoney(account.balancePaise)}</option>;
}

function TransactionsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [type, setType] = useState("");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const endpoint = user.role === "CUSTOMER" ? "/api/transactions/my" : "/api/transactions";
    api.get(endpoint, { params: { page, pageSize, ...(type ? { type } : {}) } })
      .then(({ data }) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, pageSize, type, user.role]);

  return (
    <>
      <PageHeader eyebrow="ACCOUNT ACTIVITY" title="Transactions" description="Review recorded account activity." />
      <Message error={error} />
      <div className="filter-row">
        <span>{total} transaction{total === 1 ? "" : "s"}</span>
        <label>Type
          <select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
            <option value="">All activity</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TRANSFER">Transfer</option>
          </select>
        </label>
      </div>
      {loading ? <Loading /> : <TransactionTable items={items} />}
      <div className="pagination">
        <button className="button secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <span>Page {page}</span>
        <button className="button secondary" type="button" disabled={loading || page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </>
  );
}

function TransactionTable({ items }) {
  if (!items?.length) {
    return <div className="panel empty-state"><span>◷</span><strong>No transactions to show</strong><p>Posted activity will appear here.</p></div>;
  }
  return (
    <div className="panel table-wrap">
      <table>
        <thead><tr><th>TRANSACTION</th><th>DATE</th><th>STATUS</th><th>AMOUNT</th><th /></tr></thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td><span className={`transaction-icon${item.type === "DEPOSIT" ? " positive" : ""}`}>{item.type === "TRANSFER" ? "⇄" : item.type === "DEPOSIT" ? "↓" : "↑"}</span><span className="transaction-name">{item.type}<small>{item.sourceAccountNumber || item.destinationAccountNumber || "Account activity"}</small></span></td>
              <td>{formatDate(item.createdAt)}</td>
              <td><span className="status-chip active">{item.status}</span></td>
              <td className={item.type === "DEPOSIT" ? "amount-positive" : ""}>{item.type === "WITHDRAWAL" ? "−" : "+"}{formatMoney(item.amountPaise)}</td>
              <td><Link className="row-link" aria-label={`View transaction ${item.id}`} to={`/transactions/${encodeURIComponent(item.id)}`}>›</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionDetailPage() {
  const { transactionId } = useParams();
  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get(`/api/transactions/${encodeURIComponent(transactionId)}`)
      .then(({ data }) => { if (active) setTransaction(data.transaction); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [transactionId]);

  if (loading) return <Loading />;
  if (error) return <><PageHeader eyebrow="TRANSACTION" title="Transaction details" /><Message error={error} /></>;
  if (!transaction) return <EmptyState title="Transaction unavailable" description="This transaction could not be loaded." />;
  return (
    <>
      <PageHeader eyebrow="POSTED ACTIVITY" title="Transaction details" description="This record is provided by the BalanceVault ledger." action={<Link className="button secondary" to="/transactions">Back to activity</Link>} />
      <div className="panel transaction-detail">
        <div className="detail-title"><span className="success-check">✓</span><div><strong>{transaction.type} recorded</strong><small>{formatDate(transaction.createdAt)}</small></div><span className="status-chip active">{transaction.status}</span></div>
        <div className="detail-amount"><small>AMOUNT · INR</small><strong>{formatMoney(transaction.amountPaise)}</strong></div>
        <div className="detail-list">
          <div><span>Transaction ID</span><strong className="mono">{transaction.id}</strong></div>
          {transaction.sourceAccountNumber && <div><span>From account</span><strong>{transaction.sourceAccountNumber}</strong></div>}
          {transaction.destinationAccountNumber && <div><span>To account</span><strong>{transaction.destinationAccountNumber}</strong></div>}
        </div>
        {transaction.ledgerEntries?.length > 0 && (
          <div className="ledger-box"><h3>Ledger entries</h3>{transaction.ledgerEntries.map((entry, index) => <div className="ledger-line" key={`${entry.side}-${index}`}><span>{entry.side}</span><strong>{formatMoney(entry.amountPaise)}</strong></div>)}</div>
        )}
      </div>
    </>
  );
}

function AdminAccountsPage() {
  const [data, setData] = useState({ items: [], page: 1, pageSize: 20, total: 0 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/api/admin/accounts", { params: { page: 1, pageSize: 50 } })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title="Customer accounts" description="Account information is read from the protected administration API." />
      <Message error={error} />
      {loading ? <Loading /> : <div className="panel table-wrap"><table><thead><tr><th>ACCOUNT</th><th>OWNER</th><th>TYPE</th><th>STATUS</th><th>BALANCE</th></tr></thead><tbody>
        {data.items.map((account) => <tr key={account.id}><td className="mono">{account.accountNumber}</td><td>{account.owner?.username ?? "—"}</td><td>{account.accountType}</td><td>{account.status}</td><td>{formatMoney(account.balancePaise)}</td></tr>)}
      </tbody></table>{!data.items.length && <EmptyState title="No customer accounts" description="Accounts will appear here when available." />}</div>}
    </>
  );
}

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get("/api/admin/users", { params: { page: 1, pageSize: 50 } })
      .then(({ data }) => { if (active) setUsers(data.items); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <>
      <PageHeader eyebrow="ADMINISTRATION" title="Users" description="User access and roles." />
      <Message error={error} />
      {loading ? <Loading /> : <div className="panel table-wrap"><table><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ACCOUNTS</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td><span className="user-cell"><span className="avatar tiny">{user.username.slice(0, 1).toUpperCase()}</span><span>{user.username}<small>{user.email}</small></span></span></td><td><span className={`role-chip ${user.role.toLowerCase()}`}>{user.role}</span></td><td>{user.isActive ? "Active" : "Inactive"}</td><td>{user._count.accounts}</td></tr>)}
      </tbody></table>{!users.length && <EmptyState title="No users" description="Users will appear here when available." />}</div>}
    </>
  );
}

function AuditPage() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api.get("/api/audit", { params: { page: 1, pageSize: 50 } })
      .then(({ data }) => { if (active) setEvents(data.items); })
      .catch((reason) => { if (active) setError(getErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <>
      <PageHeader eyebrow="AUDIT" title="Audit trail" description="Append-only events recorded by BalanceVault." />
      <Message error={error} />
      {loading ? <Loading /> : <div className="panel table-wrap"><table><thead><tr><th>EVENT</th><th>SUBJECT</th><th>ACTOR</th><th>TIME</th></tr></thead><tbody>
        {events.map((event) => <tr key={event.id}><td><span className="event-pill">{event.action}</span></td><td className="mono">{event.subjectId ?? "—"}</td><td className="mono">{event.actorId ?? "—"}</td><td>{formatDate(event.createdAt)}</td></tr>)}
      </tbody></table>{!events.length && <EmptyState title="No audit events" description="Recorded events will appear here." />}</div>}
    </>
  );
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function NotFound() {
  return (
    <main className="center-state">
      <span>404</span>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="button primary" to="/">Return to BalanceVault</Link>
    </main>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              <Route path="accounts" element={<CustomerOnly><AccountsPage /></CustomerOnly>} />
              <Route path="accounts/new" element={<CustomerOnly><CreateAccountPage /></CustomerOnly>} />
              <Route path="accounts/:accountNumber" element={<CustomerOnly><AccountDetailPage /></CustomerOnly>} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="transactions/deposit" element={<CustomerOnly><TransactionForm type="deposit" /></CustomerOnly>} />
              <Route path="transactions/withdraw" element={<CustomerOnly><TransactionForm type="withdraw" /></CustomerOnly>} />
              <Route path="transactions/transfer" element={<CustomerOnly><TransactionForm type="transfer" /></CustomerOnly>} />
              <Route path="transactions/:transactionId" element={<TransactionDetailPage />} />
              <Route path="admin/accounts" element={ <AdminOnly><AdminAccountsPage /></AdminOnly> } />
              <Route path="admin/users" element={<AdminOnly><AdminUsersPage /></AdminOnly>} />
              <Route path="audit" element={<AuditorOrAdmin><AuditPage /></AuditorOrAdmin>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" ? children : <Navigate to="/" replace />;
}

function AuditorOrAdmin({ children }) {
  const { user } = useAuth();
  return user?.role === "ADMIN" || user?.role === "AUDITOR"
    ? children
    : <Navigate to="/" replace />;
}
