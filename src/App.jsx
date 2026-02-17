import { Routes, Route, Link, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import ArrayPage from "./pages/ArrayPage";
import LinkedListPage from "./pages/LinkedListPage";
import StackPage from "./pages/StackPage";
import QueuePage from "./pages/QueuePage";
import "./App.css";

function App() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo-link">
          <h1>EDUAR</h1>
        </Link>
        {isHome && (
          <p>
            Augmented Reality System for Interactive Learning of Algorithms and
            Data Structures
          </p>
        )}
      </header>

      {!isHome && (
        <nav className="main-nav">
          <Link
            to="/array"
            className={location.pathname === "/array" ? "active" : ""}
          >
            📦 Array
          </Link>
          <Link
            to="/linked-list"
            className={location.pathname === "/linked-list" ? "active" : ""}
          >
            🚂 Linked List
          </Link>
          <Link
            to="/stack"
            className={location.pathname === "/stack" ? "active" : ""}
          >
            📚 Stack
          </Link>
          <Link
            to="/queue"
            className={location.pathname === "/queue" ? "active" : ""}
          >
            🚶 Queue
          </Link>
        </nav>
      )}

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/array" element={<ArrayPage />} />
          <Route path="/linked-list" element={<LinkedListPage />} />
          <Route path="/stack" element={<StackPage />} />
          <Route path="/queue" element={<QueuePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
