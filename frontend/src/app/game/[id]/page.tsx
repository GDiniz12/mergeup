"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'next/navigation';
import { getRoomConfig, type RoomConfig } from '@/utils/generateRoomId';

// ─── Game Logic ───────────────────────────────────────────────
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

// ─── Tile Design ──────────────────────────────────────────────
interface TileStyle { bg: string; fg: string; glow?: string }
const TILES: Record<number, TileStyle> = {
  0:    { bg: 'rgba(9,43,90,0.20)', fg: 'transparent' },
  2:    { bg: '#e7d9b4', fg: '#6b5230' },
  4:    { bg: '#c6ead2', fg: '#155a35' },
  8:    { bg: '#9ed1b7', fg: '#0b3d26' },
  16:   { bg: '#6ec0a4', fg: '#fff' },
  32:   { bg: '#35ad8e', fg: '#fff' },
  64:   { bg: '#09738a', fg: '#e7d9b4', glow: 'rgba(9,115,138,0.6)' },
  128:  { bg: 'linear-gradient(140deg,#0a5e7c,#09738a)', fg: '#9ed1b7', glow: 'rgba(9,115,138,0.55)' },
  256:  { bg: 'linear-gradient(140deg,#0a4670,#0a5e7c)', fg: '#9ed1b7', glow: 'rgba(9,115,138,0.65)' },
  512:  { bg: 'linear-gradient(140deg,#092b5a,#0a4670)', fg: '#9ed1b7', glow: 'rgba(158,209,183,0.45)' },
  1024: { bg: 'linear-gradient(140deg,#061630,#092b5a)', fg: '#e7d9b4', glow: 'rgba(231,217,180,0.65)' },
  2048: { bg: 'linear-gradient(140deg,#061630 0%,#092b5a 45%,#09738a 100%)', fg: '#e7d9b4', glow: 'rgba(231,217,180,0.85)' },
};

const tileStyle = (v: number): TileStyle =>
  TILES[v] ?? { bg: 'linear-gradient(140deg,#030c1a,#061630)', fg: '#e7d9b4', glow: 'rgba(231,217,180,0.9)' };

const tileFont = (v: number): string => {
  if (v >= 10000) return '0.8rem';
  if (v >= 1000)  return '1rem';
  if (v >= 100)   return '1.2rem';
  return '1.5rem';
};

let socket: Socket;

interface PageProps {
  params: Promise<{ id: string }>
}

// ─── Component ────────────────────────────────────────────────
export default function App({ params }: PageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  // States do Jogo
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'ended'>('waiting');
  const [endState, setEndState] = useState<{ result: 'win' | 'loss' | 'tie', reason: string } | null>(null);
  
  const [board, setBoard] = useState<Board>(() => init().board);
  const [animKeys, setAnimKeys] = useState<number[]>(() => init().keys);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  
  const [opponentBoard, setOpponentBoard] = useState<Board>(() => makeEmpty());
  const [opponentAnimKeys, setOpponentAnimKeys] = useState<number[]>(() => Array(16).fill(0));
  const [opponentScore, setOpponentScore] = useState(0);
  
  // Refs para Scores (necessários para checagem do timer evitar resets desnecessários no `useEffect`)
  const scoreRef = useRef(score);
  const opponentScoreRef = useRef(opponentScore);

  const [opponentConnected, setOpponentConnected] = useState(false);
  const [roomConfig, setRoomConfig] = useState<RoomConfig | null>(null);
  const [rematchStatus, setRematchStatus] = useState<'none' | 'voted' | 'opponent_voted' | 'both'>('none');
  
  // Estados de Tempo e Senha
  const [gameEndTime, setGameEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [copied, setCopied] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Atualiza Refs de Score
  useEffect(() => {
    scoreRef.current = score;
    opponentScoreRef.current = opponentScore;
  }, [score, opponentScore]);

  // Lógica de Movimento
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
      setEndState({ result: 'loss', reason: 'Você ficou sem movimentos!' });
      socket.emit("game_over", { reason: 'died' });
    } else if (roomConfig?.mode === 'score' && newScoreVal >= (roomConfig.scoreTarget || 0)) {
      setGameState('ended');
      setEndState({ result: 'win', reason: 'Você alcançou a pontuação alvo!' });
      socket.emit("game_over", { reason: 'score_reached' });
    }
  }, [gameState, roomConfig, board, score]);

  // 🕒 Hook do Timer (Sincronizado)
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
          setEndState({ result: 'win', reason: 'Tempo esgotado! Você fez mais pontos.' });
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

    // Roda a verificação de maneira mais veloz (ex. 200ms) para refletir o término o mais cravado possível
    const timer = setInterval(() => {
      const remaining = updateTimer();
      if (remaining <= 0) clearInterval(timer);
    }, 200);

    return () => clearInterval(timer);
  }, [gameState, roomConfig, gameEndTime]);

  // Setup do Socket.IO
  useEffect(() => {
    socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001", { query: { id } });

    socket.on("connect", () => {
      const localConfig = getRoomConfig(id);
      
      // Imediatamente tenta entrar na sala
      socket.emit("join_room", {
        isCreator: !!localConfig,
        config: localConfig
      });
    });

    socket.on("error", (msg) => {
      alert(msg);
      router.push('/menu');
    });

    // 🔒 Eventos de Senha
    socket.on("require_password", () => setShowPasswordPrompt(true));
    socket.on("wrong_password", () => setPasswordError('Senha incorreta! Tente novamente.'));

    socket.on("waiting", () => {
      setGameState('waiting');
      setOpponentConnected(false);
      setShowPasswordPrompt(false);
    });

    socket.on("room_config", (config: RoomConfig) => {
      setRoomConfig(config);
    });

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

      // Sincroniza o EndTime vindo do servidor
      if (data?.endTime) {
        setGameEndTime(data.endTime);
      }
    });

    socket.on("opponent_game_state", (data: { gameboard: Board, score: number }) => {
      setOpponentBoard(data.gameboard);
      setOpponentScore(data.score);
    });

    socket.on("opponent_game_over", (data: { reason: string }) => {
      setGameState('ended');
      if (data.reason === 'died') {
        setEndState({ result: 'win', reason: 'Seu oponente ficou sem movimentos!' });
      } else if (data.reason === 'score_reached') {
        setEndState({ result: 'loss', reason: 'Seu oponente alcançou o alvo de pontos primeiro!' });
      }
    });

    socket.on("opponent_rematch_vote", () => {
      setRematchStatus(prev => prev === 'voted' ? 'both' : 'opponent_voted');
    });

    socket.on("rematch_start", (data: { newRoomId: string, config: RoomConfig }) => {
      if (data.config) {
        const newConfig = { ...data.config, id: data.newRoomId, createdAt: Date.now() };
        localStorage.setItem(`room_${data.newRoomId}`, JSON.stringify(newConfig));
      }
      router.push(`/game/${data.newRoomId}`);
    });

    socket.on("opponent_disconnected", () => {
      setOpponentConnected(false);
      setGameState('waiting');
    });

    return () => socket.disconnect();
  }, [id, router]);

  const submitPassword = () => {
    setPasswordError('');
    socket.emit("join_room", { isCreator: false, password: roomPassword });
  };

  // Teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorar setas se o modal de senha estiver aberto
      if (showPasswordPrompt) return;

      const MAP: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
      };
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
      position: 'relative', borderRadius: 22, padding: 12,
      background: 'rgba(9,43,90,0.35)', backdropFilter: 'blur(28px)',
      border: '1px solid rgba(158,209,183,0.13)',
      boxShadow: '0 32px 80px rgba(9,43,90,0.6), 0 8px 24px rgba(9,43,90,0.4), inset 0 1px 0 rgba(231,217,180,0.08), inset 0 -1px 0 rgba(9,43,90,0.5)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {boardData.map((value, i) => {
          const ts = tileStyle(value);
          return (
            <div
              key={`${i}-${animKeys[i]}`}
              className={value > 0 ? 'tile-pop' : ''}
              style={{
                width: 72, height: 72, borderRadius: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: ts.bg, color: ts.fg, fontWeight: 900, fontSize: tileFont(value), userSelect: 'none',
                boxShadow: ts.glow ? `0 0 24px ${ts.glow}, 0 4px 14px rgba(0,0,0,0.22)` : '0 4px 14px rgba(0,0,0,0.14)',
                transition: 'background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease', position: 'relative', overflow: 'hidden',
              }}
            >
              {value >= 64 && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '40%', borderRadius: '13px 13px 0 0',
                  background: 'linear-gradient(180deg,rgba(255,255,255,0.08),transparent)', pointerEvents: 'none',
                }} />
              )}
              {value > 0 ? value : ''}
            </div>
          );
        })}
      </div>

      {isOpponent && !opponentConnected && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 22,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,22,52,0.85)', backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>🔌</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e7d9b4', textAlign: 'center', padding: '0 10px' }}>
            {gameState === 'waiting' ? 'Aguardando Oponente...' : 'Oponente Desconectado'}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes tileAppear {
          0%   { transform: scale(0.5) rotate(-6deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .tile-pop { animation: tileAppear 0.18s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes overlayIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .overlay-in { animation: overlayIn 0.22s ease-out both; }
        .btn-glass {
          background: rgba(9,43,90,0.42); backdrop-filter: blur(14px); border: 1px solid rgba(158,209,183,0.2);
          color: #e7d9b4; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; letter-spacing: 0.04em;
        }
        .btn-glass:hover { background: rgba(9,115,138,0.45); border-color: rgba(158,209,183,0.35); }
        .btn-glass:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 900px) { .boards-container { flex-direction: column !important; } .player-section { width: 100% !important; } }
      `}</style>

      {/* MODAL DE SENHA */}
      {showPasswordPrompt && (
        <div className="overlay-in" style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(9,43,90,0.95), rgba(9,115,138,0.85))',
            padding: '32px', borderRadius: '20px', border: '1px solid rgba(158,209,183,0.2)',
            width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <h2 style={{ color: '#e7d9b4', margin: 0, textAlign: 'center', fontSize: '1.5rem' }}>Sala Protegida</h2>
            <p style={{ color: '#9ed1b7', margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>
              Esta sala exige uma senha para entrar.
            </p>
            <input
              type="password"
              value={roomPassword}
              onChange={e => setRoomPassword(e.target.value)}
              placeholder="Digite a senha"
              style={{
                padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(158,209,183,0.3)',
                background: 'rgba(6,22,52,0.6)', color: '#e7d9b4', outline: 'none', fontSize: '1rem'
              }}
              onKeyDown={e => e.key === 'Enter' && submitPassword()}
            />
            {passwordError && <div style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center' }}>{passwordError}</div>}
            <button
              onClick={submitPassword}
              style={{
                padding: '12px', borderRadius: '10px', background: '#09738a', color: '#e7d9b4',
                fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: '8px', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0a5e7c'}
              onMouseLeave={e => e.currentTarget.style.background = '#09738a'}
            >
              Entrar
            </button>
          </div>
        </div>
      )}

      <div
        className="size-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #092b5a 0%, #09738a 30%, #78a890 58%, #9ed1b7 80%, #e7d9b4 100%)',
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '0 16px', width: '100%' }}>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', maxWidth: 900, gap: 20 }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-3px', color: '#e7d9b4', textShadow: '0 3px 20px rgba(9,43,90,0.7), 0 0 50px rgba(9,115,138,0.35)' }}>
                MergeUp
              </div>
              <div style={{ color: 'rgba(158,209,183,0.75)', fontSize: '0.68rem', marginTop: 2, letterSpacing: '0.05em' }}>
                Multiplayer • Combine os blocos!
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button onClick={copyRoomLink} className="btn-glass" style={{ padding: '8px 14px', fontSize: '0.8rem', background: copied ? 'rgba(9,115,138,0.6)' : 'rgba(9,43,90,0.42)' }}>
                {copied ? '✓ Copiado!' : '📋 Link Sala'}
              </button>
            </div>
          </div>

          {/* Banner de Status de Jogo / Modos */}
          {roomConfig && (
            <div style={{ background: 'rgba(9,43,90,0.4)', padding: '10px 24px', borderRadius: 20, border: '1px solid rgba(158,209,183,0.2)', display: 'flex', gap: 20 }}>
              {roomConfig.mode === 'time' && (
                <div style={{ color: '#e7d9b4', fontWeight: 700, fontSize: '1.2rem' }}>
                  ⏳ {timeLeft !== null ? formatTime(timeLeft) : '--:--'}
                </div>
              )}
              {roomConfig.mode === 'score' && (
                <div style={{ color: '#e7d9b4', fontWeight: 700, fontSize: '1.2rem' }}>
                  🎯 Alvo: <span style={{ color: '#9ed1b7' }}>{roomConfig.scoreTarget} pts</span>
                </div>
              )}
            </div>
          )}

          <div className="boards-container" style={{ display: 'flex', gap: 32, width: '100%', maxWidth: 1000, justifyContent: 'center' }}>
            
            {/* Você */}
            <div className="player-section" style={{ width: 'fit-content', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e7d9b4', letterSpacing: '0.05em' }}>VOCÊ</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#9ed1b7' }}>Pts: {score}</span>
              </div>
              
              {boardComponent(flat, animKeys, false)}

              {/* End Game Overlay */}
              {gameState === 'ended' && endState && (
                <div className="overlay-in" style={{
                  position: 'absolute', marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 10, background: 'rgba(6,22,52,0.92)', backdropFilter: 'blur(12px)',
                  borderRadius: 22, padding: 24, border: '1px solid rgba(158,209,183,0.2)', zIndex: 10
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: 2 }}>
                    {endState.result === 'win' ? '🏆' : endState.result === 'loss' ? '😔' : '🤝'}
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#e7d9b4', textAlign: 'center' }}>
                    {endState.result === 'win' ? 'Você Venceu!' : endState.result === 'loss' ? 'Você Perdeu!' : 'Empate!'}
                  </div>
                  <div style={{ color: '#78a890', fontSize: '0.85rem', textAlign: 'center', marginBottom: 8 }}>
                    {endState.reason}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      onClick={() => {
                        socket.emit("rematch_vote");
                        setRematchStatus(prev => prev === 'opponent_voted' ? 'both' : 'voted');
                      }}
                      disabled={rematchStatus === 'voted' || rematchStatus === 'both'}
                      style={{
                        padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
                        background: (rematchStatus === 'voted' || rematchStatus === 'both') ? 'rgba(9,115,138,0.5)' : '#09738a',
                        color: '#e7d9b4', border: 'none', cursor: (rematchStatus === 'voted') ? 'default' : 'pointer',
                      }}
                    >
                      {rematchStatus === 'voted' ? 'Aguardando...' : rematchStatus === 'opponent_voted' ? 'Aceitar Revanche' : 'Revanche'}
                    </button>
                    <button
                      onClick={() => router.push('/menu')}
                      style={{ padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', background: '#e7d9b4', color: '#092b5a', border: 'none', cursor: 'pointer' }}
                    >
                      Voltar ao Menu
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Oponente */}
            <div className="player-section" style={{ width: 'fit-content', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(158,209,183,0.7)', letterSpacing: '0.05em' }}>OPONENTE</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(158,209,183,0.7)' }}>Pts: {opponentScore}</span>
              </div>
              {boardComponent(opponentFlat, opponentAnimKeys, true)}
            </div>
          </div>
        
          <div style={{ color: 'rgba(231,217,180,0.4)', fontSize: '0.68rem', letterSpacing: '0.03em' }}>
            Setas do teclado ou deslize para jogar
          </div>
        </div>
      </div>
    </>
  );
}