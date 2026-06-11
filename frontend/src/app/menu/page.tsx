'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId, saveRoomConfig, type RoomConfig } from "../../utils/generateRoomId";

export default function Menu() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'time' | 'score'>('time');
  const [timeLimit, setTimeLimit] = useState(60);
  const [scoreTarget, setScoreTarget] = useState(10000);
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');

  // Estados para a animação do Protótipo/Demo
  const [demoTiles, setDemoTiles] = useState([
    { val: 2, pos: [0, 0] },
    { val: 2, pos: [0, 1] },
    { val: 4, pos: [1, 2] },
    { val: 8, pos: [2, 0] }
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulação simples de movimento para a demo
      setDemoTiles(prev => {
        if (prev[0].pos[1] === 1) {
            return [
                { val: 4, pos: [0, 0] }, // Fundiu
                { val: 0, pos: [-1, -1] },
                { val: 4, pos: [1, 2] },
                { val: 8, pos: [2, 0] }
            ];
        } else {
            return [
                { val: 2, pos: [0, 0] },
                { val: 2, pos: [0, 1] },
                { val: 4, pos: [1, 2] },
                { val: 8, pos: [2, 0] }
            ];
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = () => {
    const roomId = generateRoomId();
    const config: RoomConfig = {
      id: roomId,
      mode,
      hasPassword,
      password: hasPassword ? password : undefined,
      timeLimit: mode === 'time' ? timeLimit : undefined,
      scoreTarget: mode === 'score' ? scoreTarget : undefined,
      createdAt: Date.now(),
    };
    saveRoomConfig(config);
    router.push(`/game/${roomId}`);
  };

  return (
    <>
      <style>{`
        .menu-container {
          min-height: 100vh;
          background-color: var(--color-cream);
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 40px;
          gap: 40px;
          align-items: center;
        }

        /* --- LADO ESQUERDO (AÇÃO) --- */
        .action-side {
          display: flex;
          flex-direction: column;
          gap: 32px;
          max-width: 500px;
          justify-self: center;
        }

        .hero-title {
          font-size: 6rem;
          font-weight: 900;
          line-height: 0.9;
          text-transform: uppercase;
          color: #000;
          margin: 0;
          text-shadow: 8px 8px 0px var(--color-mint);
          -webkit-text-stroke: 3px #000;
        }

        .hero-subtitle {
          font-size: 1.5rem;
          font-weight: 700;
          background: #000;
          color: var(--color-mint);
          padding: 10px 20px;
          display: inline-block;
          transform: rotate(-2deg);
          border: var(--border-thick);
          box-shadow: 6px 6px 0px #000;
        }

        .btn-create-main {
          background: var(--color-teal);
          color: white;
          border: var(--border-thick);
          padding: 24px 48px;
          font-size: 2rem;
          font-weight: 900;
          text-transform: uppercase;
          box-shadow: 10px 10px 0px #000;
          cursor: pointer;
          transition: all 0.1s ease;
          margin-top: 20px;
        }

        .btn-create-main:hover {
          transform: translate(4px, 4px);
          box-shadow: 6px 6px 0px #000;
        }

        /* --- LADO DIREITO (PROTÓTIPO) --- */
        .demo-side {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .demo-board {
          background: #fff;
          border: var(--border-thick);
          box-shadow: 15px 15px 0px #000;
          display: grid;
          grid-template-columns: repeat(4, 80px);
          grid-template-rows: repeat(4, 80px);
          gap: 12px;
          padding: 20px;
          transform: perspective(1000px) rotateY(-15deg) rotateX(10deg);
        }

        .demo-tile {
          border: 3px solid #000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 1.5rem;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .demo-badge {
          position: absolute;
          top: -20px;
          right: 20px;
          background: var(--color-mint);
          border: 3px solid #000;
          padding: 8px 16px;
          font-weight: 900;
          transform: rotate(5deg);
          box-shadow: 4px 4px 0px #000;
          z-index: 10;
        }

        /* --- MODAL (NEO-BRUTALISTA) --- */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.9);
          display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal-content {
          background: var(--color-mint); border: var(--border-thick);
          padding: 40px; width: 90%; max-width: 500px;
          box-shadow: 15px 15px 0px #000;
        }
        .form-group { margin-bottom: 24px; }
        .input-field {
          width: 100%; padding: 15px; border: var(--border-thick);
          font-weight: bold; box-shadow: 5px 5px 0px #000; outline: none;
        }

        @media (max-width: 1000px) {
          .menu-container { grid-template-columns: 1fr; }
          .hero-title { font-size: 4rem; }
          .demo-side { display: none; }
        }
      `}</style>

      <div className="menu-container">
        {/* LADO ESQUERDO: Branding e Ação */}
        <div className="action-side">
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <h1 className="hero-title">MERGE<br/>UP</h1>
            <div className="hero-subtitle">2048 MULTIPLAYER</div>
          </div>
          
          <p style={{fontSize: '1.2rem', fontWeight: 700, color: '#333'}}>
             Desafie os seus amigos em tempo real. Una os blocos, multiplique o score e domine o tabuleiro com o estilo Neo-Brutalista.
          </p>

          <button onClick={() => setShowModal(true)} className="btn-create-main">
            CRIAR SALA +
          </button>
        </div>

        {/* LADO DIREITO: Protótipo Visual */}
        <div className="demo-side">
          <div className="demo-badge">LIVE PREVIEW</div>
          <div className="demo-board">
            {/* Grid de fundo */}
            {Array(16).fill(0).map((_, i) => (
              <div key={i} style={{background: '#eee', border: '2px solid #ddd'}} />
            ))}
            
            {/* Tiles Animados */}
            {demoTiles.map((tile, i) => (
              tile.val > 0 && (
                <div
                  key={i}
                  className="demo-tile"
                  style={{
                    gridRow: tile.pos[0] + 1,
                    gridColumn: tile.pos[1] + 1,
                    background: tile.val === 2 ? 'var(--color-cream)' : 'var(--color-green)',
                    boxShadow: '4px 4px 0px #000',
                    position: 'absolute',
                    width: '80px',
                    height: '80px',
                    margin: '20px' // Compensar padding do board
                  }}
                >
                  {tile.val}
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{fontSize: '2rem', fontWeight: 900, marginBottom: '20px', textTransform: 'uppercase'}}>Configurar Partida</h2>
            
            <div className="form-group">
              <label style={{fontWeight: 900, display: 'block', marginBottom: '10px'}}>MODO</label>
              <div style={{display: 'flex', gap: '10px'}}>
                <button 
                  onClick={() => setMode('time')}
                  style={{
                    flex: 1, padding: '10px', border: '3px solid #000', 
                    background: mode === 'time' ? '#000' : '#fff',
                    color: mode === 'time' ? '#fff' : '#000',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}
                >TEMPO</button>
                <button 
                  onClick={() => setMode('score')}
                  style={{
                    flex: 1, padding: '10px', border: '3px solid #000',
                    background: mode === 'score' ? '#000' : '#fff',
                    color: mode === 'score' ? '#fff' : '#000',
                    fontWeight: 'bold', cursor: 'pointer'
                  }}
                >SCORE</button>
              </div>
            </div>

            {mode === 'time' ? (
              <div className="form-group">
                <label style={{fontWeight: 900, display: 'block', marginBottom: '10px'}}>TEMPO (SEG)</label>
                <input type="number" value={timeLimit} onChange={e => setTimeLimit(Number(e.target.value))} className="input-field" />
              </div>
            ) : (
              <div className="form-group">
                <label style={{fontWeight: 900, display: 'block', marginBottom: '10px'}}>ALVO (PTS)</label>
                <input type="number" value={scoreTarget} onChange={e => setScoreTarget(Number(e.target.value))} className="input-field" />
              </div>
            )}

            <div className="form-group">
                <label style={{fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                    <input type="checkbox" checked={hasPassword} onChange={e => setHasPassword(e.target.checked)} style={{width: '20px', height: '20px'}} />
                    USAR SENHA
                </label>
            </div>

            {hasPassword && (
                <div className="form-group">
                    <input type="password" placeholder="Senha da sala" value={password} onChange={e => setPassword(e.target.value)} className="input-field" />
                </div>
            )}

            <div style={{display: 'flex', gap: '20px', marginTop: '40px'}}>
              <button 
                onClick={handleCreateRoom}
                style={{
                    flex: 2, background: 'var(--color-teal)', color: '#fff', border: '3px solid #000',
                    padding: '15px', fontWeight: '900', fontSize: '1.2rem', boxShadow: '5px 5px 0px #000', cursor: 'pointer'
                }}
              >LANÇAR SALA</button>
              <button 
                onClick={() => setShowModal(false)}
                style={{
                    flex: 1, background: '#fff', border: '3px solid #000',
                    padding: '15px', fontWeight: '900', cursor: 'pointer'
                }}
              >SAIR</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}