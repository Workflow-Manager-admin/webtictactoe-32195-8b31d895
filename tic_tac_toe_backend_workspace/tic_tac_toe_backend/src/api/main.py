from fastapi import FastAPI, HTTPException, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import uuid

app = FastAPI(
    title="Tic Tac Toe Backend",
    description="Handles game logic and state management for the Tic Tac Toe game.",
    version="1.0.0",
    openapi_tags=[
        {"name": "Game", "description": "Endpoints for Tic Tac Toe game management"}
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tic Tac Toe core logic


class GameState(str):
    IN_PROGRESS = "in_progress"
    DRAW = "draw"
    WON = "won"
    RESTARTED = "restarted"


class Player(str):
    """Player type constants, avoid ambiguous single-letter names for linter."""
    X = "X"
    O_ = "O"  # Use O_ internally to avoid E741, but still represent as 'O'


# Helper functions
def check_winner(board: List[List[Optional[str]]]) -> Optional[str]:
    # Rows, columns and diagonals
    lines = []

    # Rows
    lines.extend(board)
    # Columns
    lines.extend([[board[r][c] for r in range(3)] for c in range(3)])
    # Diagonals
    lines.append([board[i][i] for i in range(3)])
    lines.append([board[i][2 - i] for i in range(3)])

    for line in lines:
        if line[0] is not None and all(cell == line[0] for cell in line):
            return line[0]
    return None


def is_draw(board: List[List[Optional[str]]]) -> bool:
    return all(cell for row in board for cell in row) and check_winner(board) is None


# Models for API

class NewGameResponse(BaseModel):
    game_id: str = Field(..., description="Game ID")
    board: List[List[Optional[str]]] = Field(..., description="Initial 3x3 board")
    next_turn: str = Field(..., description="Player to make the next move")
    state: str = Field(..., description="Current game state")


class MoveRequest(BaseModel):
    row: int = Field(..., ge=0, le=2, description="Row for the move, 0-based")
    col: int = Field(..., ge=0, le=2, description="Column for the move, 0-based")
    player: str = Field(..., description="Player making the move (X or O)")


class MoveResponse(BaseModel):
    board: List[List[Optional[str]]] = Field(..., description="Current board after move")
    next_turn: Optional[str] = Field(None, description="Player to make the next move")
    state: str = Field(..., description="Updated game state")
    winner: Optional[str] = Field(None, description="Winner if there is one.")


class GameStateResponse(BaseModel):
    game_id: str = Field(..., description="Game ID")
    board: List[List[Optional[str]]] = Field(..., description="Current board")
    next_turn: Optional[str] = Field(None, description="Player to move next")
    state: str = Field(..., description="Game state (in_progress, draw, won)")
    winner: Optional[str] = Field(None, description="Winner if applicable.")


# In-memory store for all active games
class TicTacToeGame:
    def __init__(self):
        self.board = [[None for _ in range(3)] for _ in range(3)]  # type: List[List[Optional[str]]]
        self.state = GameState.IN_PROGRESS
        self.next_turn = Player.X  # X always starts
        self.winner = None

    def as_dict(self) -> Dict:
        # Expose O instead of O_ in API responses
        def safe(x):
            if x == Player.O_:
                return "O"
            if x == Player.X:
                return "X"
            return x

        board_public = [[safe(cell) for cell in row] for row in self.board]
        next_turn_public = safe(self.next_turn) if self.state == GameState.IN_PROGRESS else None
        winner_public = safe(self.winner)
        return {
            "board": board_public,
            "next_turn": next_turn_public,
            "state": self.state,
            "winner": winner_public,
        }

    # PUBLIC_INTERFACE
    def make_move(self, row: int, col: int, player: str) -> None:
        """Process a move and update the board, state, and next turn."""
        if self.state != GameState.IN_PROGRESS:
            raise ValueError("Game is not in progress.")

        if player not in (Player.X, Player.O_):
            raise ValueError("Player must be 'X' or 'O'.")

        # Internally, treat 'O' as Player.O_
        effective_player = player
        if player == "O":
            effective_player = Player.O_

        if self.next_turn != effective_player:
            raise ValueError(f"It is not {player}'s turn.")

        if self.board[row][col] is not None:
            raise ValueError("Cell already occupied.")

        self.board[row][col] = effective_player

        winner = check_winner(self.board)
        if winner is not None:
            self.state = GameState.WON
            self.winner = "O" if winner == Player.O_ else winner
            self.next_turn = None
        elif is_draw(self.board):
            self.state = GameState.DRAW
            self.winner = None
            self.next_turn = None
        else:
            # Alternate turn
            self.next_turn = Player.O_ if effective_player == Player.X else Player.X

    # PUBLIC_INTERFACE
    def restart(self) -> None:
        """Restart the game and reset all state."""
        self.__init__()


games_store: Dict[str, TicTacToeGame] = {}


# REST Endpoints

@app.get("/", tags=["Game"])
def health_check():
    """Health check endpoint."""
    return {"message": "Healthy"}


# PUBLIC_INTERFACE
@app.post("/game", response_model=NewGameResponse, tags=["Game"], summary="Start a new game")
def start_game():
    """
    Start a new Tic Tac Toe game and return its ID and initial board.
    """
    game_id = str(uuid.uuid4())
    game = TicTacToeGame()
    games_store[game_id] = game
    # Use as_dict to expose public 'X'/'O'
    data = game.as_dict()
    return {
        "game_id": game_id,
        "board": data["board"],
        "next_turn": data["next_turn"],
        "state": data["state"],
    }


# PUBLIC_INTERFACE
@app.get(
    "/game/{game_id}",
    response_model=GameStateResponse,
    tags=["Game"],
    summary="Get the state of a game",
    responses={
        404: {"description": "Game not found."},
    }
)
def get_game_state(
    game_id: str = Path(..., description="Game ID")
):
    """
    Retrieve the state and board of a particular Tic Tac Toe game.
    """
    game = games_store.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    return {
        "game_id": game_id,
        **game.as_dict(),
    }


# PUBLIC_INTERFACE
@app.post(
    "/game/{game_id}/move",
    response_model=MoveResponse,
    tags=["Game"],
    summary="Make a move in a game",
    responses={404: {"description": "Game not found."}, 400: {"description": "Invalid move."}}
)
def make_move(
    game_id: str = Path(..., description="Game ID"),
    move: MoveRequest = Body(..., description="Move details (row, col, player)")
):
    """
    Make a move in an existing game.
    """
    game = games_store.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    try:
        game.make_move(move.row, move.col, move.player)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = game.as_dict()
    return {
        "board": data["board"],
        "next_turn": data["next_turn"],
        "state": data["state"],
        "winner": data["winner"],
    }


# PUBLIC_INTERFACE
@app.post(
    "/game/{game_id}/restart",
    response_model=GameStateResponse,
    tags=["Game"],
    summary="Restart an existing game",
    responses={404: {"description": "Game not found."}}
)
def restart_game(
    game_id: str = Path(..., description="Game ID")
):
    """
    Restart an existing Tic Tac Toe game.
    """
    game = games_store.get(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found.")
    game.restart()
    return {
        "game_id": game_id,
        **game.as_dict(),
    }
