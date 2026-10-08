/**
 * TRES EN RAYA (TIC-TAC-TOE)
 * Lógica robusta del juego, IA Minimax, Efectos de Audio y Confeti
 */

(() => {
  'use strict';

  // --- Constantes del Juego ---
  const WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
    [0, 4, 8], [2, 4, 6]             // Diagonales
  ];

  // --- Elementos del DOM ---
  const cells = document.querySelectorAll('.cell');
  const boardEl = document.getElementById('board');
  const statusMessageEl = document.getElementById('statusMessage');
  const restartBtn = document.getElementById('restartBtn');
  const quickRestartBtn = document.getElementById('quickRestartBtn');
  const resetScoresBtn = document.getElementById('resetScoresBtn');
  const resetScoresBtnFooter = document.getElementById('resetScoresBtnFooter');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIconEl = document.getElementById('soundIcon');
  const gameModeSelect = document.getElementById('gameMode');
  const aiDifficultySelect = document.getElementById('aiDifficulty');
  const difficultyGroup = document.getElementById('difficultyGroup');
  const firstTurnSelect = document.getElementById('firstTurn');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreTieEl = document.getElementById('scoreTie');
  const nameOEl = document.getElementById('nameO');
  const cardXEl = document.getElementById('cardX');
  const cardOEl = document.getElementById('cardO');
  const strikeSvg = document.getElementById('strikeSvg');
  const strikeLine = document.getElementById('strikeLine');
  const confettiCanvas = document.getElementById('confettiCanvas');

  // --- Estado de la Partida ---
  let board = Array(9).fill('');
  let currentPlayer = 'X';
  let isGameActive = true;
  let isAiThinking = false;
  let aiTimeoutId = null;
  let isMuted = false;
  let scores = { X: 0, O: 0, tie: 0 };

  // Cargar preferencias guardadas con manejo de errores
  try {
    const savedScores = localStorage.getItem('tictactoe_scores');
    if (savedScores) scores = JSON.parse(savedScores);
    const savedMute = localStorage.getItem('tictactoe_muted');
    if (savedMute !== null) isMuted = JSON.parse(savedMute);
  } catch (e) {
    console.warn('LocalStorage no disponible:', e);
  }

  // --- Sistema de Audio Sintetizado (Web Audio API) ---
  const AudioEngine = {
    ctx: null,

    init() {
      try {
        if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.ctx = new AudioContextClass();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      } catch (e) {}
    },

    playTone(freq, type = 'sine', duration = 0.12, gainLevel = 0.15) {
      if (isMuted) return;
      try {
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainLevel, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (err) {}
    },

    playMove(player) {
      try {
        if (player === 'X') {
          this.playTone(523.25, 'sine', 0.14, 0.2);
        } else {
          this.playTone(392.00, 'triangle', 0.16, 0.25);
        }
      } catch (e) {}
    },

    playVictory() {
      if (isMuted) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            this.playTone(freq, 'triangle', 0.22, 0.2);
          }, idx * 90);
        });
      } catch (e) {}
    },

    playTie() {
      if (isMuted) return;
      try {
        this.playTone(350, 'sawtooth', 0.18, 0.1);
        setTimeout(() => {
          this.playTone(280, 'sawtooth', 0.25, 0.1);
        }, 140);
      } catch (e) {}
    },

    playClick() {
      try {
        this.playTone(700, 'sine', 0.05, 0.1);
      } catch (e) {}
    }
  };

  // --- Sistema de Confeti ---
  const Confetti = {
    particles: [],
    animId: null,
    ctx: null,

    init() {
      if (!this.ctx && confettiCanvas) {
        this.ctx = confettiCanvas.getContext('2d');
      }
    },

    resize() {
      if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
      }
    },

    stop() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this.particles = [];
      this.init();
      if (this.ctx && confettiCanvas) {
        this.ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      }
      if (confettiCanvas) {
        confettiCanvas.style.display = 'none';
      }
    },

    launch() {
      this.stop();
      if (!confettiCanvas) return;
      confettiCanvas.style.display = 'block';
      this.resize();
      this.init();

      const colors = ['#00f0ff', '#ff2a85', '#f5a623', '#4f46e5', '#10b981', '#ffffff'];

      for (let i = 0; i < 70; i++) {
        this.particles.push({
          x: confettiCanvas.width / 2 + (Math.random() * 200 - 100),
          y: confettiCanvas.height / 2 - 50,
          vx: (Math.random() - 0.5) * 14,
          vy: Math.random() * -12 - 4,
          size: Math.random() * 7 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotSpeed: (Math.random() - 0.5) * 10,
          gravity: 0.35,
          opacity: 1
        });
      }

      this.animate();
    },

    animate() {
      if (!this.ctx || !confettiCanvas) return;
      this.ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      let alive = false;

      for (let p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.rotation += p.rotSpeed;
        p.opacity -= 0.01;

        if (p.opacity > 0 && p.y < confettiCanvas.height) {
          alive = true;
          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rotation * Math.PI) / 180);
          this.ctx.globalAlpha = Math.max(0, p.opacity);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          this.ctx.restore();
        }
      }

      if (alive) {
        this.animId = requestAnimationFrame(() => this.animate());
      } else {
        this.stop();
      }
    }
  };

  window.addEventListener('resize', () => Confetti.resize());

  // --- Algoritmo de Inteligencia Artificial (Minimax Optimizado) ---
  const AI = {
    checkWinner(b) {
      for (const [a, c, d] of WINNING_COMBINATIONS) {
        if (b[a] && b[a] === b[c] && b[a] === b[d]) {
          return b[a];
        }
      }
      if (b.every(cell => cell !== '')) return 'tie';
      return null;
    },

    minimax(newBoard, depth, isMaximizing) {
      const winner = this.checkWinner(newBoard);
      if (winner === 'O') return 10 - depth;
      if (winner === 'X') return depth - 10;
      if (winner === 'tie') return 0;

      if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
          if (newBoard[i] === '') {
            newBoard[i] = 'O';
            const score = this.minimax(newBoard, depth + 1, false);
            newBoard[i] = '';
            bestScore = Math.max(score, bestScore);
          }
        }
        return bestScore;
      } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
          if (newBoard[i] === '') {
            newBoard[i] = 'X';
            const score = this.minimax(newBoard, depth + 1, true);
            newBoard[i] = '';
            bestScore = Math.min(score, bestScore);
          }
        }
        return bestScore;
      }
    },

    getBestMove(b) {
      const emptyIndices = b.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
      if (emptyIndices.length === 0) return -1;

      // Optimización 1: Tablero vacío (apertura IA en 0ms)
      if (emptyIndices.length === 9) {
        return 4;
      }

      // Optimización 2: Segundo movimiento (8 casillas libres en 0ms)
      if (emptyIndices.length === 8) {
        if (b[4] === '') return 4;
        const corners = [0, 2, 6, 8];
        return corners[Math.floor(Math.random() * corners.length)];
      }

      // Con 7 o menos casillas libres, minimax ejecuta en < 2 ms
      let bestScore = -Infinity;
      let move = emptyIndices[0];

      for (let idx of emptyIndices) {
        b[idx] = 'O';
        const score = this.minimax(b, 0, false);
        b[idx] = '';
        if (score > bestScore) {
          bestScore = score;
          move = idx;
        }
      }
      return move;
    },

    getMediumMove(b) {
      const emptyIndices = b.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
      if (emptyIndices.length === 0) return -1;

      // 1. Ganar de inmediato si es posible
      for (let idx of emptyIndices) {
        b[idx] = 'O';
        if (this.checkWinner(b) === 'O') {
          b[idx] = '';
          return idx;
        }
        b[idx] = '';
      }

      // 2. Bloquear victoria inminente de X
      for (let idx of emptyIndices) {
        b[idx] = 'X';
        if (this.checkWinner(b) === 'X') {
          b[idx] = '';
          return idx;
        }
        b[idx] = '';
      }

      // 3. Tomar el centro si está libre
      if (b[4] === '' && Math.random() < 0.5) {
        return 4;
      }

      // 4. Con 60% usar Minimax, 40% aleatorio
      if (Math.random() < 0.6) {
        return this.getBestMove(b);
      }
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    },

    getEasyMove(b) {
      const emptyIndices = b.map((val, idx) => val === '' ? idx : null).filter(val => val !== null);
      if (emptyIndices.length === 0) return -1;
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    },

    computeMove(b, difficulty) {
      if (difficulty === 'easy') return this.getEasyMove(b);
      if (difficulty === 'medium') return this.getMediumMove(b);
      return this.getBestMove(b);
    }
  };

  // --- Cancelación de Temporizadores ---
  function clearAiTimeout() {
    if (aiTimeoutId) {
      clearTimeout(aiTimeoutId);
      aiTimeoutId = null;
    }
  }

  // --- Lógica Principal del Juego ---
  function initGame() {
    updateScoresUI();
    updateAudioIcon();
    setupEventListeners();
    resetGame();
  }

  function resetGame() {
    // 1. Cancelar cualquier timer pendiente de la IA y detener confeti
    clearAiTimeout();
    Confetti.stop();
    isAiThinking = false;
    isGameActive = true;

    // 2. Limpiar estado lógico del tablero
    board = Array(9).fill('');

    // 3. Ocultar y reiniciar línea de victoria SVG usando setAttribute (seguro en SVG)
    if (strikeSvg) {
      strikeSvg.style.display = 'none';
      strikeSvg.setAttribute('class', 'strike-line-svg');
    }
    if (strikeLine) {
      strikeLine.setAttribute('x1', '0');
      strikeLine.setAttribute('y1', '0');
      strikeLine.setAttribute('x2', '0');
      strikeLine.setAttribute('y2', '0');
    }

    // 4. Limpiar casillas en el DOM
    cells.forEach(cell => {
      cell.textContent = '';
      cell.setAttribute('class', 'cell');
      cell.removeAttribute('disabled');
    });

    // 5. Determinar turno inicial
    const turnPreference = firstTurnSelect ? firstTurnSelect.value : 'X';
    if (turnPreference === 'random') {
      currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    } else {
      currentPlayer = turnPreference || 'X';
    }

    // 6. Actualizar mensaje de turno en interfaz
    updateTurnDisplay();

    // 7. Si arranca la IA en modo pve
    if (gameModeSelect && gameModeSelect.value === 'pve' && currentPlayer === 'O') {
      triggerAiMove();
    }
  }

  function handleCellClick(e) {
    const cell = e.currentTarget;
    const index = parseInt(cell.dataset.index, 10);

    // Validar si la celda se puede marcar
    if (board[index] !== '' || !isGameActive || isAiThinking) return;

    AudioEngine.init();
    makeMove(index, currentPlayer);

    // Si la partida sigue activa y es turno de la IA
    if (isGameActive && gameModeSelect.value === 'pve' && currentPlayer === 'O') {
      triggerAiMove();
    }
  }

  function makeMove(index, player) {
    if (index < 0 || index > 8 || board[index] !== '') return;

    board[index] = player;
    const cell = cells[index];
    if (cell) {
      cell.textContent = player;
      cell.setAttribute('class', `cell taken ${player.toLowerCase()}`);
    }

    AudioEngine.playMove(player);

    const winCombo = checkWin(player);
    if (winCombo) {
      endGame(player, winCombo);
    } else if (board.every(c => c !== '')) {
      endGame('tie');
    } else {
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      updateTurnDisplay();
    }
  }

  function triggerAiMove() {
    clearAiTimeout();
    isAiThinking = true;

    if (statusMessageEl) {
      statusMessageEl.innerHTML = `IA pensando... <span class="highlight-player o-color">O</span>`;
    }

    const difficulty = aiDifficultySelect ? aiDifficultySelect.value : 'hard';
    const delay = difficulty === 'hard' ? 400 : 350;

    aiTimeoutId = setTimeout(() => {
      aiTimeoutId = null;
      if (!isGameActive) {
        isAiThinking = false;
        return;
      }

      const aiMoveIndex = AI.computeMove([...board], difficulty);
      isAiThinking = false;

      if (aiMoveIndex !== -1 && aiMoveIndex !== undefined && board[aiMoveIndex] === '') {
        makeMove(aiMoveIndex, 'O');
      }
    }, delay);
  }

  function checkWin(player) {
    return WINNING_COMBINATIONS.find(combo => {
      return combo.every(idx => board[idx] === player);
    });
  }

  function endGame(winner, winCombo = null) {
    isGameActive = false;
    clearAiTimeout();
    isAiThinking = false;

    try {
      if (winner === 'tie') {
        scores.tie = (scores.tie || 0) + 1;
        if (statusMessageEl) {
          statusMessageEl.innerHTML = `
            <div class="result-text"><span class="highlight-player tie-color">¡Empate!</span> Bien jugado</div>
            <button id="playAgainBtn" class="play-again-btn" type="button">🎮 Jugar de nuevo</button>
          `;
        }
        if (cardXEl) cardXEl.classList.remove('active-turn');
        if (cardOEl) cardOEl.classList.remove('active-turn');
        AudioEngine.playTie();
      } else {
        scores[winner] = (scores[winner] || 0) + 1;
        const isVsAI = gameModeSelect && gameModeSelect.value === 'pve';
        const winnerLabel = winner === 'X' ? '¡Victoria de X!' : (isVsAI ? '¡Victoria de la IA!' : '¡Victoria de O!');

        if (statusMessageEl) {
          statusMessageEl.innerHTML = `
            <div class="result-text"><span class="highlight-player ${winner.toLowerCase()}-color">${winnerLabel}</span> 🎉</div>
            <button id="playAgainBtn" class="play-again-btn" type="button">🎮 Jugar de nuevo</button>
          `;
        }

        if (winCombo) {
          winCombo.forEach(idx => {
            if (cells[idx]) cells[idx].classList.add('winning');
          });
          drawStrikeLine(winCombo, winner);
        }

        AudioEngine.playVictory();
        if (!isVsAI || winner === 'X') {
          Confetti.launch();
        }
      }
    } catch (e) {
      console.warn('Error en endGame:', e);
    }

    saveScores();
    updateScoresUI();
  }

  function drawStrikeLine(combo, winner) {
    try {
      if (!strikeSvg || !strikeLine || !boardEl) return;

      const boardRect = boardEl.getBoundingClientRect();
      const firstCell = cells[combo[0]].getBoundingClientRect();
      const lastCell = cells[combo[2]].getBoundingClientRect();

      const x1 = firstCell.left + firstCell.width / 2 - boardRect.left;
      const y1 = firstCell.top + firstCell.height / 2 - boardRect.top;
      const x2 = lastCell.left + lastCell.width / 2 - boardRect.left;
      const y2 = lastCell.top + lastCell.height / 2 - boardRect.top;

      strikeSvg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
      strikeLine.setAttribute('x1', x1);
      strikeLine.setAttribute('y1', y1);
      strikeLine.setAttribute('x2', x2);
      strikeLine.setAttribute('y2', y2);

      strikeSvg.setAttribute('class', `strike-line-svg strike-${winner.toLowerCase()}`);
      strikeSvg.style.display = 'block';
    } catch (e) {
      console.warn('Error dibujando línea de victoria:', e);
    }
  }

  function updateTurnDisplay() {
    if (!statusMessageEl) return;

    const isPve = gameModeSelect && gameModeSelect.value === 'pve';
    const playerLabel = currentPlayer === 'X' ? 'X' : (isPve ? 'IA (O)' : 'O');
    const colorClass = currentPlayer === 'X' ? 'x-color' : 'o-color';

    statusMessageEl.innerHTML = `Turno de <span class="highlight-player ${colorClass}">${playerLabel}</span>`;

    if (cardXEl && cardOEl) {
      if (currentPlayer === 'X') {
        cardXEl.classList.add('active-turn');
        cardOEl.classList.remove('active-turn');
      } else {
        cardOEl.classList.add('active-turn');
        cardXEl.classList.remove('active-turn');
      }
    }
  }

  function updateScoresUI() {
    if (scoreXEl) scoreXEl.textContent = scores.X || 0;
    if (scoreOEl) scoreOEl.textContent = scores.O || 0;
    if (scoreTieEl) scoreTieEl.textContent = scores.tie || 0;
  }

  function saveScores() {
    try {
      localStorage.setItem('tictactoe_scores', JSON.stringify(scores));
    } catch (e) {}
  }

  function resetScores() {
    scores = { X: 0, O: 0, tie: 0 };
    saveScores();
    updateScoresUI();
    AudioEngine.playClick();
    resetGame();
  }

  function toggleSound() {
    isMuted = !isMuted;
    try {
      localStorage.setItem('tictactoe_muted', JSON.stringify(isMuted));
    } catch (e) {}
    updateAudioIcon();
    if (!isMuted) AudioEngine.playClick();
  }

  function updateAudioIcon() {
    if (soundIconEl) {
      soundIconEl.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  function handleModeChange() {
    const isPve = gameModeSelect && gameModeSelect.value === 'pve';
    if (difficultyGroup) {
      difficultyGroup.style.display = isPve ? 'flex' : 'none';
    }
    if (nameOEl) {
      nameOEl.textContent = isPve ? 'IA (PC)' : 'Jugador O';
    }
    AudioEngine.playClick();
    resetGame();
  }

  // --- Listeners de Eventos y Delegación ---
  function setupEventListeners() {
    // 1. Clic en las casillas del tablero
    cells.forEach(cell => {
      cell.addEventListener('click', handleCellClick);
    });

    // 2. Botón principal de Iniciar / Reiniciar Juego
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        AudioEngine.playClick();
        resetGame();
      });
    }

    // 3. Botón rápido de reinicio en cabecera (🔄)
    if (quickRestartBtn) {
      quickRestartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        AudioEngine.playClick();
        resetGame();
      });
    }

    // 4. Delegación de eventos para el botón "Jugar de nuevo" del banner
    document.addEventListener('click', (e) => {
      if (e.target && (e.target.id === 'playAgainBtn' || e.target.closest('#playAgainBtn'))) {
        e.preventDefault();
        AudioEngine.playClick();
        resetGame();
      }
    });

    // 5. Botones de reiniciar marcador
    if (resetScoresBtn) {
      resetScoresBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetScores();
      });
    }

    if (resetScoresBtnFooter) {
      resetScoresBtnFooter.addEventListener('click', (e) => {
        e.preventDefault();
        resetScores();
      });
    }

    // 6. Alternar sonido
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSound();
      });
    }

    // 7. Selectores de configuración
    if (gameModeSelect) {
      gameModeSelect.addEventListener('change', handleModeChange);
    }
    if (aiDifficultySelect) {
      aiDifficultySelect.addEventListener('change', () => {
        AudioEngine.playClick();
        resetGame();
      });
    }
    if (firstTurnSelect) {
      firstTurnSelect.addEventListener('change', () => {
        AudioEngine.playClick();
        resetGame();
      });
    }
  }

  // Inicializar juego al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
})();
