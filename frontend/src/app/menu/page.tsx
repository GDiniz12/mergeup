'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomId, saveRoomConfig, type RoomConfig } from '@/utils/generateRoomId';

export default function Menu() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'time' | 'score'>('time');
  const [timeLimit, setTimeLimit] = useState(60);
  const [scoreTarget, setScoreTarget] = useState(10000);
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState('');

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
          padding: 12px 32px;
          font-size: 1rem;
        }
        .btn-glass:hover { 
          background: rgba(9,115,138,0.45);
          border-color: rgba(158,209,183,0.35);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-content {
          background: linear-gradient(135deg, rgba(9,43,90,0.95) 0%, rgba(9,115,138,0.85) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(158,209,183,0.2);
          border-radius: 20px;
          padding: 32px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          animation: slideUp 0.3s ease-out;
        }

        .modal-title {
          font-size: 1.8rem;
          font-weight: 900;
          color: #e7d9b4;
          margin-bottom: 24px;
          text-align: center;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 0.9rem;
          font-weight: 700;
          color: #9ed1b7;
          margin-bottom: 8px;
          letter-spacing: 0.05em;
        }

        .mode-selector {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .mode-btn {
          flex: 1;
          padding: 12px 16px;
          border: 2px solid rgba(158,209,183,0.2);
          border-radius: 10px;
          background: rgba(9,43,90,0.4);
          color: rgba(158,209,183,0.7);
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.95rem;
        }

        .mode-btn.active {
          border-color: #9ed1b7;
          background: rgba(9,115,138,0.5);
          color: #e7d9b4;
        }

        .input-field {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid rgba(158,209,183,0.2);
          border-radius: 10px;
          background: rgba(9,43,90,0.5);
          color: #e7d9b4;
          font-size: 0.95rem;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .input-field:focus {
          outline: none;
          border-color: #9ed1b7;
          background: rgba(9,43,90,0.7);
          box-shadow: 0 0 12px rgba(158,209,183,0.2);
        }

        .input-field::placeholder {
          color: rgba(158,209,183,0.4);
        }

        .checkbox-group {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(9,43,90,0.3);
          border-radius: 10px;
          border: 1px solid rgba(158,209,183,0.1);
          cursor: pointer;
        }

        .checkbox-group input {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          margin-top: 28px;
        }

        .modal-buttons button {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          font-size: 0.95rem;
          transition: all 0.2s ease;
        }

        .btn-cancel {
          background: rgba(158,209,183,0.1);
          color: #9ed1b7;
          border: 1px solid rgba(158,209,183,0.2);
        }

        .btn-cancel:hover {
          background: rgba(158,209,183,0.15);
        }

        .btn-create {
          background: linear-gradient(135deg, #09738a, #0a5e7c);
          color: #e7d9b4;
          box-shadow: 0 0 20px rgba(9,115,138,0.4);
        }

        .btn-create:hover {
          box-shadow: 0 0 30px rgba(9,115,138,0.6);
          transform: translateY(-2px);
        }
      `}</style>

      <div
        style={{
          background: 'linear-gradient(135deg, #092b5a 0%, #09738a 30%, #78a890 58%, #9ed1b7 80%, #e7d9b4 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '3.5rem',
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '-4px',
                color: '#e7d9b4',
                textShadow: '0 3px 20px rgba(9,43,90,0.7), 0 0 50px rgba(9,115,138,0.35)',
                marginBottom: 12,
              }}
            >
              MergeUp
            </div>
            <div
              style={{
                color: 'rgba(158,209,183,0.8)',
                fontSize: '1rem',
                letterSpacing: '0.05em',
                fontWeight: 600,
              }}
            >
              Combine os blocos com um amigo!
            </div>
          </div>

          {/* Button */}
          <button onClick={() => setShowModal(true)} className="btn-glass">
            🎮 Criar Sala
          </button>

          {/* Decorative elements */}
          <div
            style={{
              fontSize: '4rem',
              opacity: 0.4,
              animation: 'float 3s ease-in-out infinite',
            }}
          >
            🎲 🎲 🎲
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Criar Nova Sala</div>

            {/* Mode Selection */}
            <div className="form-group">
              <label className="form-label">Modo de Jogo</label>
              <div className="mode-selector">
                <button
                  className={`mode-btn ${mode === 'time' ? 'active' : ''}`}
                  onClick={() => setMode('time')}
                >
                  ⏱️ Com Tempo
                </button>
                <button
                  className={`mode-btn ${mode === 'score' ? 'active' : ''}`}
                  onClick={() => setMode('score')}
                >
                  ⭐ Com Pontuação
                </button>
              </div>
            </div>

            {/* Time Input */}
            {mode === 'time' && (
              <div className="form-group">
                <label className="form-label">Tempo Limite (segundos)</label>
                <input
                  type="number"
                  min="30"
                  max="3600"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Math.max(30, parseInt(e.target.value) || 30))}
                  className="input-field"
                  placeholder="Ex: 60"
                />
              </div>
            )}

            {/* Score Input */}
            {mode === 'score' && (
              <div className="form-group">
                <label className="form-label">Pontuação Alvo</label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  value={scoreTarget}
                  onChange={(e) => setScoreTarget(Math.max(1000, parseInt(e.target.value) || 1000))}
                  className="input-field"
                  placeholder="Ex: 10000"
                />
              </div>
            )}

            {/* Password Toggle */}
            <div className="form-group">
              <label
                className="checkbox-group"
                style={{ marginBottom: '12px' }}
              >
                <input
                  type="checkbox"
                  checked={hasPassword}
                  onChange={(e) => setHasPassword(e.target.checked)}
                />
                <span style={{ color: '#9ed1b7' }}>Proteger com senha</span>
              </label>
            </div>

            {/* Password Input */}
            {hasPassword && (
              <div className="form-group">
                <label className="form-label">Senha da Sala</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  placeholder="Digite uma senha"
                  maxLength={20}
                />
              </div>
            )}

            {/* Buttons */}
            <div className="modal-buttons">
              <button
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-create"
                onClick={handleCreateRoom}
              >
                Criar Sala
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </>
  );
}
