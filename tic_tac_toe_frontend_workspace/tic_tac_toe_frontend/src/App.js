import React, { useState } from 'react';
import './App.css';

// Color palette (from requirements)
const COLORS = {
  primary: '#1976d2',
  secondary: '#424242',
  accent: '#ff5722',
};

// Square component for the board
function Square({ value, onClick, disabled }) {
  return (
    <button
      className="ttt-square"
      onClick={onClick}
      disabled={disabled || value}
      style={{
        color: value === 'X' ? COLORS.primary : value === 'O' ? COLORS.accent : COLORS.secondary,
        cursor: value ? 'default' : 'pointer',
        background: 'var(--background-light, #fafafa)',
        border: `2px solid ${COLORS.secondary}`,
      }}
      aria-label={value ? `Square with ${value}` : 'Empty Square'}
    >
      {value}
    </button>
  );
}

// Board rendering
function Board({ squares, onSquareClick, disabled }) {
  return (
    <div className="ttt-board">
      {squares.map((row, i) => (
        <div className="ttt-row" key={i}>
          {row.map((val, j) => (
            <Square
              key={j}
              value={val}
              onClick={() => onSquareClick(i, j)}
              disabled={disabled}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Status/Panel
function StatusPanel({ currentPlayer, winner, draw }) {
  let message;
  if (winner) {
    message = (
      <span>
        <span style={{ color: winner === 'X' ? COLORS.primary : COLORS.accent, fontWeight: 700 }}>{winner}</span> wins!
      </span>
    );
  } else if (draw) {
    message = (
      <span style={{ color: COLORS.secondary, fontWeight: 600 }}>It's a Draw!</span>
    );
  } else {
    message = (
      <span>
        Next move: <span style={{ color: currentPlayer === 'X' ? COLORS.primary : COLORS.accent, fontWeight: 700 }}>{currentPlayer}</span>
      </span>
    );
  }
  return (
    <div className="status-panel">
      {message}
    </div>
  );
}

// Helpers
function getWinner(board) {
  const lines = [
    // Rows
    [[0,0],[0,1],[0,2]],
    [[1,0],[1,1],[1,2]],
    [[2,0],[2,1],[2,2]],
    // Cols
    [[0,0],[1,0],[2,0]],
    [[0,1],[1,1],[2,1]],
    [[0,2],[1,2],[2,2]],
    // Diags
    [[0,0],[1,1],[2,2]],
    [[0,2],[1,1],[2,0]],
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    const v1 = board[a[0]][a[1]];
    if (v1 && v1 === board[b[0]][b[1]] && v1 === board[c[0]][c[1]]) {
      return v1;
    }
  }
  return null;
}

function isDraw(board) {
  return !getWinner(board) && board.flat().every(Boolean);
}

// PUBLIC_INTERFACE
function App() {
  // Local state for UI; replace with API-backed logic when backend is ready
  const emptyBoard = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  const [board, setBoard] = useState(emptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const winner = getWinner(board);
  const draw = isDraw(board);

  // Handle user clicks (simulate moves)
  function handleSquareClick(i, j) {
    if (board[i][j] || winner) return;
    const updated = board.map((row, x) => row.map((cell, y) => (x === i && y === j ? currentPlayer : cell)));
    setBoard(updated);
    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
  }

  // Restart the game
  function restartGame() {
    setBoard(emptyBoard);
    setCurrentPlayer('X');
  }

  return (
    <div className="app ttt-app light-bg">
      <nav className="navbar" style={{ background: '#fff', borderBottom: `1px solid ${COLORS.primary}` }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div className="logo" style={{ color: COLORS.primary }}>
              <span className="logo-symbol" style={{ color: COLORS.accent, fontWeight: 900, fontSize: 24 }}>●</span> Tic Tac Toe
            </div>
            <a className="btn ttt-nav-btn" href="https://kavia.ai/" rel="noopener noreferrer" target="_blank" style={{ background: COLORS.primary }}>
              Powered by KAVIA
            </a>
          </div>
        </div>
      </nav>
      <main style={{ background: '#fafbfc', minHeight: 600 }}>
        <div className="container">
          <div className="ttt-game-shell">
            <StatusPanel currentPlayer={currentPlayer} winner={winner} draw={draw} />
            <Board squares={board} onSquareClick={handleSquareClick} disabled={Boolean(winner || draw)} />
            <div className="ttt-controls">
              <button className="btn btn-large ttt-ctrl-btn" style={{ background: COLORS.accent, color: '#fff' }} onClick={restartGame}>
                {winner || draw ? 'Play Again' : 'Restart'}
              </button>
            </div>
          </div>
        </div>
      </main>
      <footer className="ttt-footer">
        <div className="container">
          <span style={{ color: COLORS.secondary, opacity: 0.7, fontSize: 14 }}>
            Modern minimal Tic Tac Toe &mdash; React / {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
