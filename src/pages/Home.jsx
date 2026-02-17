import React from "react";
import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Welcome to EDUAR! 🎓</h1>
        <p className="subtitle">
          Augmented Reality System for Interactive Learning of Algorithms and
          Data Structures
        </p>
        <p className="description">
          Experience data structures in a whole new way through immersive AR
          visualization. Select a topic below to begin your learning journey.
        </p>
      </div>

      <div className="topics-grid">
        <Link to="/array" className="topic-card">
          <div className="topic-icon">📦</div>
          <h3>Array</h3>
          <p>Linear indexing, random access, element manipulation</p>
          <ul className="scenarios">
            <li>🛒 Grocery Shelf</li>
            <li>💺 Student Seat Viewer</li>
            <li>✅ To-Do List</li>
          </ul>
        </Link>

        <Link to="/linked-list" className="topic-card">
          <div className="topic-icon">🚂</div>
          <h3>Linked List</h3>
          <p>Node-pointer relationships, dynamic memory</p>
          <ul className="scenarios">
            <li>🚃 Train Cars</li>
            <li>👥 People in Line</li>
            <li>🎯 Domino Nodes</li>
          </ul>
        </Link>

        <Link to="/stack" className="topic-card">
          <div className="topic-icon">📚</div>
          <h3>Stack</h3>
          <p>LIFO principle, push/pop operations</p>
          <ul className="scenarios">
            <li>📖 Book Stack</li>
            <li>🍽️ Plate Stack</li>
            <li>📦 Storage Boxes</li>
          </ul>
        </Link>

        <Link to="/queue" className="topic-card">
          <div className="topic-icon">🚶</div>
          <h3>Queue</h3>
          <p>FIFO principle, enqueue/dequeue flow</p>
          <ul className="scenarios">
            <li>👨‍🎓 Student Attendance</li>
            <li>🎫 Ticket Queue</li>
            <li>🚗 Car Toll Gate</li>
          </ul>
        </Link>
      </div>
    </div>
  );
}

export default Home;
