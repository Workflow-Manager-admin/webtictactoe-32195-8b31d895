import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Color palette (from requirements)
const COLORS = {
  primary: '#1976d2',
  secondary: '#424242',
  accent: '#ff5722',
};

// Backend API URL (adjust if backend is on different host/port in deployment)
const API_URL = 'https://vscode-internal-6237-qa.qa01.cloud.kavia.ai:3001';

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

// Status panel with error display
function StatusPanel({ currentPlayer, winner, draw, status, error }) {
  let message;
  if (error) {
    message = (
      <span style={{ color: '#e53935', fontWeight: 600 }}>{error}</span>
    );
  } else if (winner) {
    message = (
      <span>
        <span style={{ color: winner === 'X' ? COLORS.primary : COLORS.accent, fontWeight: 700 }}>{winner}</span> wins!
      </span>
    );
  } else if (draw) {
    message = (
      <span style={{ color: COLORS.secondary, fontWeight: 600 }}>It's a Draw!</span>
    );
  } else if (status) {
    message = (
      <span style={{ color: COLORS.secondary, fontWeight: 500 }}>{status}</span>
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

// PUBLIC_INTERFACE
function App() {
  // Backend state
  const emptyBoard = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  const [gameId, setGameId] = useState(null);
  const [board, setBoard] = useState(emptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [winner, setWinner] = useState(null);
  const [draw, setDraw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [canInteract, setCanInteract] = useState(true);

  // Utility - parse game state and set UI state accordingly
  const updateFromGameState = useCallback((data) => {
    setGameId(data.game_id);
    setBoard(data.board.map(row => row.map(cell => cell || null)));
    setCurrentPlayer(data.next_turn || 'X');
    setWinner(data.winner || (data.state === 'won' && data.next_turn !== null ? data.next_turn : null));
    setDraw(data.state === 'draw');
    setStatus('');
  }, []);

  // Start new game (on load or restart)
  const startNewGame = useCallback(async () => {
    setLoading(true);
    setError('');
    setStatus('Starting game...');
    try {
      const res = await fetch(`${API_URL}/game`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start new game.');
      const data = await res.json();
      updateFromGameState(data);
    } catch (err) {
      setError('Could not connect to server. Please try again.');
      setBoard(emptyBoard);
      setGameId(null);
    } finally {
      setLoading(false);
      setStatus('');
      setCanInteract(true);
    }
  }, [updateFromGameState]);

  // Fetch game state (optional), e.g. if "sync" needed
  const fetchGameState = useCallback(async (gid) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/game/${gid}`, { method: 'GET' });
      if (!res.ok) throw new Error('Game not found.');
      const data = await res.json();
      updateFromGameState(data);
    } catch (err) {
      setError('Game not found or server error.');
    } finally {
      setLoading(false);
    }
  }, [updateFromGameState]);

  // Make a move
  const handleSquareClick = async (i, j) => {
    if (!canInteract || loading || !gameId || winner || draw || board[i][j]) return;
    setLoading(true);
    setError('');
    setStatus('Making move...');
    setCanInteract(false);
    try {
      const res = await fetch(`${API_URL}/game/${gameId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row: i, col: j, player: currentPlayer }),
      });
      if (res.status === 404) throw new Error('Game not found.');
      if (res.status === 400) {
        const errText = await res.text();
        setError('Invalid move. Try another square.');
        setCanInteract(true);
        setLoading(false);
        setStatus('');
        return;
      }
      if (!res.ok) throw new Error('Move error.');
      const data = await res.json();
      setBoard(data.board.map(row => row.map(cell => cell || null)));
      setCurrentPlayer(data.next_turn || currentPlayer); // If null, game over
      setWinner(data.winner || (data.state === 'won' ? currentPlayer : null));
      setDraw(data.state === 'draw');
    } catch (err) {
      setError(err.message || 'Move failed.');
    } finally {
      setLoading(false);
      setStatus('');
      setCanInteract(true);
    }
  };

  // Restart the current game (keeping the same gameId)
  const restartGame = useCallback(async () => {
    if (!gameId) {
      await startNewGame();
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Restarting...');
    setCanInteract(false);
    try {
      const res = await fetch(`${API_URL}/game/${gameId}/restart`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Restart failed.');
      const data = await res.json();
      updateFromGameState(data);
    } catch (err) {
      setError('Could not restart game. Starting new...');
      await startNewGame();
    } finally {
      setLoading(false);
      setStatus('');
      setCanInteract(true);
    }
  }, [gameId, startNewGame, updateFromGameState]);

  // On mount, start a new game
  useEffect(() => {
    startNewGame();
    // eslint-disable-next-line
  }, []);

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
            <StatusPanel
              currentPlayer={currentPlayer}
              winner={winner}
              draw={draw}
              status={status}
              error={error}
            />
            <Board
              squares={board}
              onSquareClick={handleSquareClick}
              disabled={Boolean(winner || draw || loading || !canInteract)}
            />
            <div className="ttt-controls">
              <button
                className="btn btn-large ttt-ctrl-btn"
                style={{ background: COLORS.accent, color: '#fff' }}
                onClick={restartGame}
                disabled={loading}
              >
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
