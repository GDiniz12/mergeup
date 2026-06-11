"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { getRoomConfig, type RoomConfig } from '@/utils/generateRoomId';

type Board = number[][];

function makeEmpty(): Board {
  return Array(4).fill(null).map(() => Array(4).fill(0));
}

function placeRandom(board: Board): { board: Board; idx: number } {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (board[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return { board, idx: -1 };
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  const next = board.map(row => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return { board: next, idx: r * 4 + c };
}

function init(): { board: Board; keys: number[] } {
  const e = makeEmpty();
  const { board: b1, idx: i1 } = placeRandom(e);
  const { board: b2, idx: i2 } = placeRandom(b1);
  const keys = Array(16).fill(0);
  if (i1 >= 0) keys[i1] = 1;
  if (i2 >= 0) keys[i2] = 1;
  return { board: b2, keys };
}

function mergeRow(row: number[]): { row: number[]; pts: number } {
  const vals = row.filter(Boolean);
  let pts = 0;
  const out: number[] = [];
  let i = 0;
  while (i < vals.length) {
    if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
      const m = vals[i] * 2;
      out.push(m); pts += m; i += 2;
    } else {
      out.push(vals[i++]);
    }
  }
  while (out.length < 4) out.push(0);
  return { row: out, pts };
}

const tp = (b: Board): Board => b[0].map((_, i) => b.map(r => r[i]));
const rv = (b: Board): Board => b.map(r => [...r].reverse());

function applyShift(board: Board, dir: 'left' | 'right' | 'up' | 'down'): { board: Board; pts: number } {
  let b = board;
  if (dir === 'right') b = rv(b);
  else if (dir === 'up') b = tp(b);
  else if (dir === 'down') b = rv(tp(b));

  let pts = 0;
  const moved = b.map(row => { const { row: r, pts: p } = mergeRow(row); pts += p; return r; });

  let res = moved;
  if (dir === 'right') res = rv(res);
  else if (dir === 'up') res = tp(res);
  else if (dir === 'down') res = tp(rv(res));

  return { board: res, pts };
}

function boardsEq(a: Board, b: Board) {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

function isDead(b: Board) {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (!b[r][c]) return false;
      if (r < 3 && b[r][c] === b[r + 1][c]) return false;
      if (c < 3 && b[r][c] === b[r][c + 1]) return false;
    }
  return true;
}

// ─── Estilos Neo-Brutalistas dos Tiles ───────────────────────
interface TileStyle { bg: string; fg: string; shadow?: string }
const TILES: Record<number, TileStyle> = {
  0:    { bg: '#ffffff', fg: 'transparent', shadow: 'none' },
  2:    { bg: '#e7d9b4', fg: '#000', shadow: '2px 2px 0px #000' },
  4:    { bg: '#9ed1b7', fg: '#000', shadow: '2px 2px 0px #000' },
  8:    { bg: '#78a890', fg: '#000', shadow: '2px 2px 0px #000' },
  16:   { bg: '#09738a', fg: '#fff', shadow: '2px 2px 0px #000' },
  32:   { bg: '#0a5e7c', fg: '#fff', shadow: '2px 2px 0px #000' },
  64:   { bg: '#0a4670', fg: '#fff', shadow: '2px 2px 0px #000' },
  128:  { bg: '#092b5a', fg: '#fff', shadow: '2px 2px 0px #000' },
  256:  { bg: '#061630', fg: '#fff', shadow: '2px 2px 0px #000' },
  512:  { bg: '#ff6b6b', fg: '#000', shadow: '2px 2px 0px #000' },
  1024: { bg: '#e7d9b4', fg: '#000', shadow: '4px 4px 0px #000' },
  2048: { bg: '#000000', fg: '#9ed1b7', shadow: '4px 4px 0px #9ed1b7' },
};

const tileStyle = (v: number): TileStyle =>
  TILES[v] ?? { bg: '#000', fg: '#fff', shadow: '4px 4px 0px #fff' };

const tileFont = (v: number): string => {
  if (v >= 10000) return '1rem';
  if (v >= 1000)  return '1.2rem';
  if (v >= 100)   return '1.5rem';
  return '2rem';
};

let socket: Socket;

interface PageProps {
  params: Promise<{ id: string }>
}

export default function App({ params }: PageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'ended'>('waiting');
  const [endState, setEndState] = useState<{ result: 'win' | 'loss' | 'tie', reason: string } | null>(null);
  
  const [board, setBoard] = useState<Board>(() => init().board);
  const [animKeys, setAnimKeys] = useState<number[]>(() => init().keys);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  
  const [opponentBoard, setOpponentBoard] = useState<Board>(() => makeEmpty());
  const [opponentAnimKeys, setOpponentAnimKeys] = useState<number[]>(() => Array(16).fill(0));
  const [opponentScore, setOpponentScore] = useState(0);
  
  const scoreRef = useRef(score);
  const opponentScoreRef = useRef(opponentScore);

  const [opponentConnected, setOpponentConnected] = useState(false);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [rematchStatus, setRematchStatus] = useState<'none' | 'voted' | 'opponent_voted' | 'both'>('none');
  
  const [gameEndTime, setGameEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [copied, setCopied] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    scoreRef.current = score;
    opponentScoreRef.current = opponentScore;
  }, [score, opponentScore]);

  const move = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (gameState !== 'playing') return;

    let newScoreVal = score;
    let newBoard = board;

    const { board: next, pts } = applyShift(board, dir);
    if (boardsEq(board, next)) return;

    const { board: placed, idx } = placeRandom(next);
    newBoard = placed;
    newScoreVal = score + pts;

    setBoard(placed);
    setScore(newScoreVal);
    setBest(b => Math.max(b, newScoreVal));

    if (idx >= 0) {
      setAnimKeys(ak => { const n = [...ak]; n[idx]++; return n; });
    }

    socket.emit("game_state", { gameboard: placed, score: newScoreVal });

    if (isDead(placed)) {
      setGameState('ended');
      setEndState({ result: 'loss', reason: 'Ficou sem movimentos!' });
      socket.emit("game_over", { reason: 'died' });
    } else if (roomConfig?.mode === 'score' && newScoreVal >= (roomConfig.scoreTarget || 0)) {
      setGameState('ended');
      setEndState({ result: 'win', reason: 'Alcançou a pontuação alvo!' });
      socket.emit("game_over", { reason: 'score_reached' });
    }
  }, [gameState, roomConfig, board, score]);

  useEffect(() => {
    if (gameState !== 'playing' || !roomConfig || roomConfig.mode !== 'time' || !gameEndTime) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((gameEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setGameState('ended');
        const finalScore = scoreRef.current;
        const finalOppScore = opponentScoreRef.current;
        
        if (finalScore > finalOppScore) {
          setEndState({ result: 'win', reason: 'Tempo esgotado! Fez mais pontos.' });
        } else if (finalScore < finalOppScore) {
          setEndState({ result: 'loss', reason: 'Tempo esgotado! O oponente fez mais pontos.' });
        } else {
          setEndState({ result: 'tie', reason: 'Tempo esgotado! Empate técnico.' });
        }
      }
      return remaining;
    };

    const initial = updateTimer();
    if (initial <= 0) return;

    const timer = setInterval(() => {
      const remaining = updateTimer();
      if (remaining <= 0) clearInterval(timer);
    }, 200);

    return () => clearInterval(timer);
  }, [gameState, roomConfig, gameEndTime]);

  useEffect(() => {
    // CORREÇÃO: Utiliza dinamicamente o IP da máquina atual, prevenindo o erro do 'localhost' no celular
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;
    socket = io(socketUrl, { query: { id } });

    socket.on("connect", () => {
      const localConfig = getRoomConfig(id);
      socket.emit("join_room", { isCreator: !!localConfig, config: localConfig });
    });

    socket.on("error", (msg) => {
      alert(msg);
      router.push('/menu');
    });

    socket.on("require_password", () => setShowPasswordPrompt(true));
    socket.on("wrong_password", () => setPasswordError('Senha incorreta! Tente novamente.'));

    socket.on("waiting", () => {
      setGameState('waiting');
      setOpponentConnected(false);
      setShowPasswordPrompt(false);
    });

    socket.on("room_config", (config: RoomConfig) => setRoomConfig(config));

    socket.on("opponent_connected", (data?: { endTime?: number }) => {
      setOpponentConnected(true);
      setShowPasswordPrompt(false);
      setGameState('playing');
      setOpponentBoard(makeEmpty());
      setOpponentScore(0);
      setScore(0);
      setRematchStatus('none');
      const { board: b, keys } = init();
      setBoard(b); setAnimKeys(keys);
      if (data?.endTime) setGameEndTime(data.endTime);
    });

    socket.on("opponent_game_state", (data: { gameboard: Board, score: number }) => {
      setOpponentBoard(data.gameboard);
      setOpponentScore(data.score);
    });

    socket.on("opponent_game_over", (data: { reason: string }) => {
      setGameState('ended');
      if (data.reason === 'died') {
        setEndState({ result: 'win', reason: 'O seu oponente ficou sem movimentos!' });
      } else if (data.reason === 'score_reached') {
        setEndState({ result: 'loss', reason: 'O oponente alcançou o alvo primeiro!' });
      }
    });

    socket.on("opponent_rematch_vote", () => setRematchStatus(prev => prev === 'voted' ? 'both' : 'opponent_voted'));

    socket.on("rematch_start", (data: { newRoomId: string, config: RoomConfig }) => {
      if (data.config) {
        const newConfig = { ...data.config, id: data.newRoomId, createdAt: Date.now() };
        sessionStorage.setItem(`room_${data.newRoomId}`, JSON.stringify(newConfig)); // Usando sessionStorage
      }
      router.push(`/game/${data.newRoomId}`);
    });

    socket.on("opponent_disconnected", () => {
      setOpponentConnected(false);
      setGameState('waiting');
    });

    return () => { socket.disconnect(); };
  }, [id, router]);

  const submitPassword = () => {
    setPasswordError('');
    socket.emit("join_room", { isCreator: false, password: roomPassword });
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (showPasswordPrompt) return;
      const MAP: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (MAP[e.key]) { e.preventDefault(); move(MAP[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move, showPasswordPrompt]);

  const copyRoomLink = () => {
    const link = `${window.location.origin}/game/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const flat = board.flat();
  const opponentFlat = opponentBoard.flat();

  const boardComponent = (boardData: number[], animKeys: number[], isOpponent: boolean = false) => (
    <div style={{
      position: 'relative', padding: 16,
      background: 'var(--color-mint)',
      border: '4px solid #000',
      boxShadow: '8px 8px 0px #000',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {boardData.map((value, i) => {
          const ts = tileStyle(value);
          return (
            <div
              key={`${i}-${animKeys[i]}`}
              className={value > 0 ? 'tile-pop' : ''}
              style={{
                width: 76, height: 76,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: ts.bg, color: ts.fg, fontWeight: 900, fontSize: tileFont(value),
                userSelect: 'none',
                border: '3px solid #000',
                boxShadow: ts.shadow,
                transition: 'all 0.1s ease', position: 'relative'
              }}
            >
              {value > 0 ? value : ''}
            </div>
          );
        })}
      </div>

      {isOpponent && !opponentConnected && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255, 255, 255, 0.95)', border: '4px solid #000'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔌</div>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: '#000', textAlign: 'center', textTransform: 'uppercase' }}>
            {gameState === 'waiting' ? 'Aguardando Oponente' : 'Desconectado'}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes tileAppear {
          0%   { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .tile-pop { animation: tileAppear 0.1s ease-out both; }
        
        .btn-brutal {
          background: #fff;
          border: 3px solid #000;
          color: #000;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.1s ease;
          text-transform: uppercase;
          box-shadow: 4px 4px 0px #000;
        }
        .btn-brutal:hover { transform: translate(2px, 2px); box-shadow: 2px 2px 0px #000; }
        .btn-brutal:disabled { opacity: 0.6; cursor: not-allowed; }
        
        @media (max-width: 900px) { .boards-container { flex-direction: column !important; } }
      `}</style>

      {showPasswordPrompt && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.8)'
        }}>
          <div style={{
            background: 'var(--color-cream)', padding: '40px', border: '4px solid #000',
            width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '20px',
            boxShadow: '12px 12px 0px #000'
          }}>
            <h2 style={{ color: '#000', margin: 0, textAlign: 'center', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>Sala Fechada</h2>
            <input
              type="password"
              value={roomPassword}
              onChange={e => setRoomPassword(e.target.value)}
              placeholder="Digite a senha"
              style={{
                padding: '16px', border: '3px solid #000', background: '#fff', color: '#000',
                outline: 'none', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '4px 4px 0px #000'
              }}
              onKeyDown={e => e.key === 'Enter' && submitPassword()}
            />
            {passwordError && <div style={{ color: 'red', fontWeight: 900, textAlign: 'center' }}>{passwordError}</div>}
            <button
              onClick={submitPassword}
              className="btn-brutal"
              style={{ background: 'var(--color-teal)', color: '#fff', padding: '16px' }}
            >
              Entrar
            </button>
          </div>
        </div>
      )}

      <div
        className="size-full flex items-center justify-center"
        style={{
          background: 'var(--color-cream)',
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
          touchAction: 'none' // CORREÇÃO: Isso impede que a tela seja arrastada quando você faz o swipe no celular
        }}
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (!touch.current || showPasswordPrompt) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
          move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, padding: '24px 16px', width: '100%' }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', maxWidth: 1000, gap: 20 }}>
            <div>
              <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: '#000', textTransform: 'uppercase', borderBottom: '4px solid #000', paddingBottom: '8px' }}>
                MergeUp
              </div>
            </div>

            <button onClick={copyRoomLink} className="btn-brutal" style={{ padding: '12px 20px', fontSize: '1rem' }}>
              {copied ? '✓ COPIADO!' : '📋 LINK DA SALA'}
            </button>
          </div>

          {roomConfig && (
            <div style={{ background: '#fff', padding: '16px 32px', border: '4px solid #000', boxShadow: '6px 6px 0px #000', display: 'flex', gap: 20 }}>
              {roomConfig.mode === 'time' && (
                <div style={{ color: '#000', fontWeight: 900, fontSize: '1.5rem', textTransform: 'uppercase' }}>
                  ⏳ {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                </div>
              )}
              {roomConfig.mode === 'score' && (
                <div style={{ color: '#000', fontWeight: 900, fontSize: '1.5rem', textTransform: 'uppercase' }}>
                  🎯 Alvo: <span style={{ color: 'var(--color-teal)' }}>{roomConfig.scoreTarget} pts</span>
                </div>
              )}
            </div>
          )}

          <div className="boards-container" style={{ display: 'flex', gap: 48, width: '100%', maxWidth: 1000, justifyContent: 'center' }}>
            
            <div className="player-section" style={{ width: 'fit-content', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: '#fff', border: '3px solid #000', padding: '12px 16px', boxShadow: '4px 4px 0px #000' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#000' }}>VOCÊ</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-teal)' }}>{score} PTS</span>
              </div>
              
              {boardComponent(flat, animKeys, false)}

              {gameState === 'ended' && endState && (
                <div style={{
                  position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 16, background: '#fff',
                  padding: 32, border: '4px solid #000', boxShadow: '12px 12px 0px #000', zIndex: 10
                }}>
                  <div style={{ fontSize: '4rem' }}>
                    {endState.result === 'win' ? '🏆' : endState.result === 'loss' ? '💀' : '🤝'}
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000', textTransform: 'uppercase', textAlign: 'center' }}>
                    {endState.result === 'win' ? 'Vitória!' : endState.result === 'loss' ? 'Derrota!' : 'Empate!'}
                  </div>
                  <div style={{ color: '#000', fontSize: '1.2rem', fontWeight: 'bold', textAlign: 'center' }}>
                    {endState.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                    <button
                      onClick={() => {
                        socket.emit("rematch_vote");
                        setRematchStatus(prev => prev === 'opponent_voted' ? 'both' : 'voted');
                      }}
                      disabled={rematchStatus === 'voted' || rematchStatus === 'both'}
                      className="btn-brutal"
                      style={{ background: 'var(--color-mint)' }}
                    >
                      {rematchStatus === 'voted' ? 'Aguardando...' : rematchStatus === 'opponent_voted' ? 'Aceitar Revanche' : 'Revanche'}
                    </button>
                    <button
                      onClick={() => router.push('/menu')}
                      className="btn-brutal"
                    >
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="player-section" style={{ width: 'fit-content', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', background: '#000', border: '3px solid #000', padding: '12px 16px', boxShadow: '4px 4px 0px #000' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>OPONENTE</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--color-mint)' }}>{opponentScore} PTS</span>
              </div>
              {boardComponent(opponentFlat, opponentAnimKeys, true)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}