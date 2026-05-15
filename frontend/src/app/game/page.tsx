"use client"

import { useState, useCallback, useRef, useEffect } from 'react';

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

// ─── Component ────────────────────────────────────────────────

export default function App() {
  const [board, setBoard]     = useState<Board>(() => init().board);
  const [animKeys, setAnimKeys] = useState<number[]>(() => init().keys);
  const [score, setScore]     = useState(0);
  const [best, setBest]       = useState(0);
  const [won, setWon]         = useState(false);
  const [over, setOver]       = useState(false);
  const [keep, setKeep]       = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const move = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
    if (over || (won && !keep)) return;
    setBoard(prev => {
      const { board: next, pts } = applyShift(prev, dir);
      if (boardsEq(prev, next)) return prev;

      const { board: placed, idx } = placeRandom(next);

      if (idx >= 0) {
        setAnimKeys(ak => { const n = [...ak]; n[idx]++; return n; });
      }

      setScore(s => { const ns = s + pts; setBest(b => Math.max(b, ns)); return ns; });
      if (!won && placed.some(row => row.some(v => v >= 2048))) setWon(true);
      if (isDead(placed)) setOver(true);
      return placed;
    });
  }, [over, won, keep]);

  const reset = () => {
    const { board: b, keys } = init();
    setBoard(b); setAnimKeys(keys); setScore(0); setWon(false); setOver(false); setKeep(false);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const MAP: Record<string, 'left' | 'right' | 'up' | 'down'> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down'
      };
      if (MAP[e.key]) { e.preventDefault(); move(MAP[e.key]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move]);

  const showOverlay = over || (won && !keep);
  const flat = board.flat();

  return (
    <>
      <style>{`
        @keyframes tileAppear {
          0%   { transform: scale(0.5) rotate(-6deg); opacity: 0; }
          70%  { transform: scale(1.08) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        .tile-pop { animation: tileAppear 0.18s cubic-bezier(.34,1.56,.64,1) both; }

        @keyframes overlayIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
        .overlay-in { animation: overlayIn 0.22s ease-out both; }

        .btn-glass {
          background: rgba(9,43,90,0.42);
          backdrop-filter: blur(14px);
          border: 1px solid rgba(158,209,183,0.2);
          color: #e7d9b4;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          letter-spacing: 0.04em;
        }
        .btn-glass:hover { background: rgba(9,115,138,0.45); border-color: rgba(158,209,183,0.35); }
      `}</style>

            {/* Full-screen gradient background */}
      <div
        className="size-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #092b5a 0%, #09738a 30%, #78a890 58%, #9ed1b7 80%, #e7d9b4 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={e => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
          move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: '0 16px', width: '100%', maxWidth: 400 }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', width: '100%', maxWidth: 340 }}>
            <div>
              <div style={{
                fontSize: '2.5rem', fontWeight: 900, lineHeight: 1,
                letterSpacing: '-3px', color: '#e7d9b4',
                textShadow: '0 3px 20px rgba(9,43,90,0.7), 0 0 50px rgba(9,115,138,0.35)',
              }}>MergeUp</div>
              <div style={{ color: 'rgba(158,209,183,0.75)', fontSize: '0.68rem', marginTop: 2, letterSpacing: '0.05em' }}>
                Combine os blocos!
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {[{ l: 'PONTOS', v: score }, { l: 'MELHOR', v: best }].map(({ l, v }) => (
                <div key={l} style={{
                  borderRadius: 14, padding: '8px 14px', textAlign: 'center', minWidth: 68,
                  background: 'rgba(9,43,90,0.48)', backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(158,209,183,0.14)',
                  boxShadow: '0 4px 16px rgba(9,43,90,0.3)',
                }}>
                  <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#78a890', letterSpacing: '0.12em' }}>{l}</div>
                  <div style={{ fontWeight: 800, color: '#e7d9b4', fontSize: '1.05rem', marginTop: 1 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Board ── */}
          <div style={{
            position: 'relative',
            borderRadius: 22,
            padding: 12,
            background: 'rgba(9,43,90,0.35)',
            backdropFilter: 'blur(28px)',
            border: '1px solid rgba(158,209,183,0.13)',
            boxShadow: [
              '0 32px 80px rgba(9,43,90,0.6)',
              '0 8px 24px rgba(9,43,90,0.4)',
              'inset 0 1px 0 rgba(231,217,180,0.08)',
              'inset 0 -1px 0 rgba(9,43,90,0.5)',
            ].join(', '),
          }}>

            {/* Cell grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
              {flat.map((value, i) => {
                const ts = tileStyle(value);
                return (
                  <div
                    key={`${i}-${animKeys[i]}`}
                    className={value > 0 ? 'tile-pop' : ''}
                    style={{
                      width: 72, height: 72,
                      borderRadius: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: ts.bg,
                      color: ts.fg,
                      fontWeight: 900,
                      fontSize: tileFont(value),
                      userSelect: 'none',
                      boxShadow: ts.glow
                        ? `0 0 24px ${ts.glow}, 0 4px 14px rgba(0,0,0,0.22)`
                        : '0 4px 14px rgba(0,0,0,0.14)',
                      transition: 'background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Shine on higher tiles */}
                    {value >= 64 && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0,
                        height: '40%', borderRadius: '13px 13px 0 0',
                        background: 'linear-gradient(180deg,rgba(255,255,255,0.08),transparent)',
                        pointerEvents: 'none',
                      }} />
                    )}
                    {value > 0 ? value : ''}
                  </div>
                );
              })}
            </div>

            {/* ── Win / Game Over Overlay ── */}
            {showOverlay && (
              <div
                className="overlay-in"
                style={{
                  position: 'absolute', inset: 0, borderRadius: 22,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: 'rgba(6,22,52,0.9)', backdropFilter: 'blur(10px)',
                }}
              >
                <div style={{
                  fontSize: won && !over ? '3rem' : '2.2rem',
                  marginBottom: 2,
                  filter: won && !over ? 'drop-shadow(0 0 18px rgba(231,217,180,0.6))' : 'none',
                }}>
                  {won && !over ? '✨' : '😔'}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#e7d9b4' }}>
                  {won && !over ? 'Você Ganhou!' : 'Game Over!'}
                </div>
                <div style={{ color: '#78a890', fontSize: '0.85rem' }}>Pontuação: {score}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  {won && !over && (
                    <button
                      onClick={() => setKeep(true)}
                      style={{
                        padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
                        background: '#09738a', color: '#e7d9b4', border: 'none', cursor: 'pointer',
                        boxShadow: '0 0 18px rgba(9,115,138,0.5)',
                      }}
                    >
                      Continuar
                    </button>
                  )}
                  <button
                    onClick={reset}
                    style={{
                      padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
                      background: '#e7d9b4', color: '#092b5a', border: 'none', cursor: 'pointer',
                    }}
                  >
                    Novo Jogo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── New Game button ── */}
          <button onClick={reset} className="btn-glass" style={{ padding: '10px 30px', fontSize: '0.875rem' }}>
            Novo Jogo
          </button>
        
          <div style={{ color: 'rgba(231,217,180,0.4)', fontSize: '0.68rem', letterSpacing: '0.03em' }}>
            Setas do teclado ou deslize para jogar
          </div>
        </div>
      </div>
    </>
  );
}