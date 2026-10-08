/**
 * TRES EN RAYA (TIC-TAC-TOE) CON SUPABASE Y RANKING
 * Lógica robusta del juego, IA Minimax, Audio, Confeti, Persistencia de Apodos y Leaderboard
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
  const nameXEl = document.getElementById('nameX');
  const nameOEl = document.getElementById('nameO');
  const cardXEl = document.getElementById('cardX');
  const cardOEl = document.getElementById('cardO');
  const strikeSvg = document.getElementById('strikeSvg');
  const strikeLine = document.getElementById('strikeLine');
  const confettiCanvas = document.getElementById('confettiCanvas');

  // Elementos de Supabase, Ranking y Modal
  const playerXNameInput = document.getElementById('playerXNameInput');
  const playerONameInput = document.getElementById('playerONameInput');
  const supabaseBadge = document.getElementById('supabaseBadge');
  const badgeText = document.getElementById('badgeText');
  const rankingBtn = document.getElementById('rankingBtn');
  const cloudModalBtn = document.getElementById('cloudModalBtn');
  const cloudModal = document.getElementById('cloudModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTabs = document.querySelectorAll('.modal-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const rankingCount = document.getElementById('rankingCount');
  const refreshRankingBtn = document.getElementById('refreshRankingBtn');
  const myNicknameDisplay = document.getElementById('myNicknameDisplay');
  const rankingTableBody = document.getElementById('rankingTableBody');
  const historyCount = document.getElementById('historyCount');
  const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
  const historyTableBody = document.getElementById('historyTableBody');
  const statTotalMatches = document.getElementById('statTotalMatches');
  const statXWins = document.getElementById('statXWins');
  const statOWins = document.getElementById('statOWins');
  const statTies = document.getElementById('statTies');
  const statAvgDuration = document.getElementById('statAvgDuration');
  const supabaseConfigForm = document.getElementById('supabaseConfigForm');
  const cfgSupabaseUrl = document.getElementById('cfgSupabaseUrl');
  const cfgSupabaseAnonKey = document.getElementById('cfgSupabaseAnonKey');
  const testConnBtn = document.getElementById('testConnBtn');
  const clearConnBtn = document.getElementById('clearConnBtn');
  const configStatusMsg = document.getElementById('configStatusMsg');
  const toastNotification = document.getElementById('toastNotification');

  // --- Estado de la Partida ---
  let board = Array(9).fill('');
  let currentPlayer = 'X';
  let isGameActive = true;
  let isAiThinking = false;
  let aiTimeoutId = null;
  let matchStartTime = Date.now();
  let currentMatchMoves = [];
  let isMuted = false;
  let scores = { X: 0, O: 0, tie: 0 };
  let toastTimeout = null;

  // Cargar preferencias guardadas con manejo de errores
  try {
    const savedScores = localStorage.getItem('tictactoe_scores');
    if (savedScores) scores = JSON.parse(savedScores);
    const savedMute = localStorage.getItem('tictactoe_muted');
    if (savedMute !== null) isMuted = JSON.parse(savedMute);
  } catch (e) {
    console.warn('LocalStorage no disponible:', e);
  }

  // --- Sistema de Notificación Toast ---
  function showToast(text, duration = 3200) {
    if (!toastNotification) return;
    toastNotification.textContent = text;
    toastNotification.style.display = 'flex';
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotification.style.display = 'none';
    }, duration);
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
    // 1. Cargar apodos guardados previamente en LocalStorage
    try {
      const savedNickX = localStorage.getItem('tictactoe_nickname_x');
      if (savedNickX && playerXNameInput) {
        playerXNameInput.value = savedNickX;
      }
      const savedNickO = localStorage.getItem('tictactoe_nickname_o');
      if (savedNickO && playerONameInput) {
        playerONameInput.value = savedNickO;
      }
    } catch (e) {
      console.warn('Error leyendo apodos de LocalStorage:', e);
    }

    updateScoresUI();
    updateAudioIcon();
    syncPlayerNames();
    updateSupabaseBadge();
    setupEventListeners();
    resetGame();
  }

  function resetGame() {
    clearAiTimeout();
    Confetti.stop();
    isAiThinking = false;
    isGameActive = true;
    matchStartTime = Date.now();
    currentMatchMoves = [];

    board = Array(9).fill('');

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

    cells.forEach(cell => {
      cell.textContent = '';
      cell.setAttribute('class', 'cell');
      cell.removeAttribute('disabled');
    });

    const turnPreference = firstTurnSelect ? firstTurnSelect.value : 'X';
    if (turnPreference === 'random') {
      currentPlayer = Math.random() < 0.5 ? 'X' : 'O';
    } else {
      currentPlayer = turnPreference || 'X';
    }

    updateTurnDisplay();

    if (gameModeSelect && gameModeSelect.value === 'pve' && currentPlayer === 'O') {
      triggerAiMove();
    }
  }

  function handleCellClick(e) {
    const cell = e.currentTarget;
    const index = parseInt(cell.dataset.index, 10);

    if (board[index] !== '' || !isGameActive || isAiThinking) return;

    AudioEngine.init();
    makeMove(index, currentPlayer);

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

    // Registrar jugada para la tabla relacional match_moves
    currentMatchMoves.push({
      move_number: currentMatchMoves.length + 1,
      player: player,
      cell_index: index,
      created_at: new Date().toISOString()
    });

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

  async function endGame(winner, winCombo = null) {
    isGameActive = false;
    clearAiTimeout();
    isAiThinking = false;

    const durationSeconds = Math.max(1, Math.round((Date.now() - matchStartTime) / 1000));
    const totalMoves = board.filter(c => c !== '').length;

    const nameX = (playerXNameInput && playerXNameInput.value.trim()) || 'Jugador X';
    const isPve = gameModeSelect && gameModeSelect.value === 'pve';
    const nameO = (playerONameInput && playerONameInput.value.trim()) || (isPve ? 'IA (PC)' : 'Jugador O');

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
        const winnerName = winner === 'X' ? nameX : nameO;
        const winnerLabel = `¡Victoria de ${winnerName}!`;

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
        if (!isPve || winner === 'X') {
          Confetti.launch();
        }
      }
    } catch (e) {
      console.warn('Error en endGame:', e);
    }

    saveScores();
    updateScoresUI();

    // Guardar partida en Supabase (si está configurado)
    if (typeof SupabaseClient !== 'undefined') {
      const matchData = {
        gameMode: isPve ? 'pve' : 'pvp',
        aiDifficulty: isPve ? (aiDifficultySelect ? aiDifficultySelect.value : 'hard') : null,
        winner: winner,
        playerXName: nameX,
        playerOName: nameO,
        totalMoves: totalMoves,
        finalBoard: board.join(''),
        boardState: [...board],
        winningCombo: winCombo || null,
        durationSeconds: durationSeconds
      };

      SupabaseClient.saveMatch(matchData, currentMatchMoves).then(res => {
        if (res && res.ok) {
          showToast('☁️ Partida y jugadas guardadas en Supabase');
          // Si el modal está abierto en Ranking o Historial, actualizar automáticamente
          if (cloudModal && cloudModal.style.display === 'flex') {
            loadRanking();
            loadHistory();
          }
        }
      }).catch(err => {
        console.warn('No se pudo guardar la partida en Supabase:', err);
      });
    }
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
    const nameX = (playerXNameInput && playerXNameInput.value.trim()) || 'X';
    const nameO = (playerONameInput && playerONameInput.value.trim()) || (isPve ? 'IA (O)' : 'O');
    const playerLabel = currentPlayer === 'X' ? nameX : nameO;
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

  function syncPlayerNames() {
    const isPve = gameModeSelect && gameModeSelect.value === 'pve';

    if (playerXNameInput && nameXEl) {
      const nickX = playerXNameInput.value.trim() || 'Jugador X';
      nameXEl.textContent = nickX;
      try {
        localStorage.setItem('tictactoe_nickname_x', nickX);
      } catch (e) {}
      if (myNicknameDisplay) {
        myNicknameDisplay.textContent = nickX;
      }
    }

    if (playerONameInput && nameOEl) {
      if (isPve && (!playerONameInput.value || playerONameInput.value === 'Jugador O')) {
        playerONameInput.value = 'IA (PC)';
      } else if (!isPve && playerONameInput.value === 'IA (PC)') {
        playerONameInput.value = 'Jugador O';
      }
      const nickO = playerONameInput.value.trim() || (isPve ? 'IA (PC)' : 'Jugador O');
      nameOEl.textContent = nickO;
      try {
        if (!isPve) {
          localStorage.setItem('tictactoe_nickname_o', nickO);
        }
      } catch (e) {}
    }
  }

  function handleModeChange() {
    const isPve = gameModeSelect && gameModeSelect.value === 'pve';
    if (difficultyGroup) {
      difficultyGroup.style.display = isPve ? 'flex' : 'none';
    }
    syncPlayerNames();
    AudioEngine.playClick();
    resetGame();
  }

  // --- Integración con Supabase, Ranking y Modal ---
  function updateSupabaseBadge() {
    if (!supabaseBadge || !badgeText) return;

    if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.isConfigured()) {
      supabaseBadge.className = 'supabase-badge connected';
      badgeText.textContent = 'Supabase Conectado';
      supabaseBadge.title = 'Conectado a la base de datos en Supabase. Clic para ver ranking e historial.';
    } else {
      supabaseBadge.className = 'supabase-badge local';
      badgeText.textContent = 'Modo Local';
      supabaseBadge.title = 'Supabase no configurado. Clic para configurar credenciales.';
    }
  }

  function openCloudModal(tabName = 'rankingTab') {
    if (!cloudModal) return;
    cloudModal.style.display = 'flex';
    switchTab(tabName);
  }

  function closeCloudModal() {
    if (!cloudModal) return;
    cloudModal.style.display = 'none';
  }

  function switchTab(targetTabId) {
    modalTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === targetTabId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetTabId);
    });

    if (targetTabId === 'rankingTab') {
      loadRanking();
    } else if (targetTabId === 'historyTab') {
      loadHistory();
    } else if (targetTabId === 'statsTab') {
      loadStats();
    } else if (targetTabId === 'configTab') {
      loadConfigTab();
    }
  }

  // Cargar tabla de Ranking / Leaderboard
  async function loadRanking() {
    if (!rankingTableBody) return;
    if (rankingCount) rankingCount.textContent = 'Cargando clasificación...';
    rankingTableBody.innerHTML = `<tr><td colspan="7" class="empty-state">Consultando ranking en Supabase...</td></tr>`;

    if (myNicknameDisplay && playerXNameInput) {
      myNicknameDisplay.textContent = playerXNameInput.value.trim() || 'Jugador X';
    }

    if (!SUPABASE_CONFIG.isConfigured()) {
      if (rankingCount) rankingCount.textContent = 'Sin conexión a Supabase';
      rankingTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            ⚠️ Supabase no está configurado.<br>
            Ve a la pestaña <strong>Configuración</strong> para conectar tu base de datos y activar el ranking global.
          </td>
        </tr>`;
      return;
    }

    const myNick = (playerXNameInput ? playerXNameInput.value.trim() : 'Jugador X').toLowerCase();
    const res = await SupabaseClient.getLeaderboard(25);

    if (!res.ok || !res.data || res.data.length === 0) {
      if (rankingCount) rankingCount.textContent = '0 jugadores en el ranking';
      rankingTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            ${res.message ? `Error: ${res.message}` : 'Aún no hay jugadores registrados en el ranking. ¡Juega una partida para ser el primero!'}
          </td>
        </tr>`;
      return;
    }

    if (rankingCount) rankingCount.textContent = `Top ${res.data.length} Jugadores`;

    rankingTableBody.innerHTML = res.data.map((player, idx) => {
      let medal = `<span class="rank-number">#${idx + 1}</span>`;
      if (idx === 0) medal = `<span class="rank-badge" title="Primer Lugar">🥇</span>`;
      else if (idx === 1) medal = `<span class="rank-badge" title="Segundo Lugar">🥈</span>`;
      else if (idx === 2) medal = `<span class="rank-badge" title="Tercer Lugar">🥉</span>`;

      const playerNick = player.nickname || player.player_name || 'Anónimo';
      const isMe = playerNick.toLowerCase() === myNick;
      const rowClass = isMe ? 'current-user-row' : '';
      const meBadge = isMe ? ' <small style="color:#3ecf8e;font-size:0.75rem;font-weight:700;">(Tú)</small>' : '';
      const gamesPlayed = player.games_played !== undefined ? player.games_played : (player.matches_played || 0);
      const winRate = gamesPlayed > 0 
        ? Math.round((player.wins / gamesPlayed) * 100) + '%' 
        : '0%';

      return `
        <tr class="${rowClass}">
          <td style="text-align: center;">${medal}</td>
          <td><strong>${escapeHtml(playerNick)}</strong>${meBadge}</td>
          <td style="text-align: center; color: var(--color-x); font-weight: 700;">${player.wins || 0}</td>
          <td style="text-align: center; color: var(--color-o);">${player.losses || 0}</td>
          <td style="text-align: center; color: var(--color-tie);">${player.ties || 0}</td>
          <td style="text-align: center;">${gamesPlayed}</td>
          <td style="text-align: center; font-weight: 700;">${winRate}</td>
        </tr>
      `;
    }).join('');
  }

  // Cargar tabla de Historial
  async function loadHistory() {
    if (!historyTableBody) return;
    if (historyCount) historyCount.textContent = 'Cargando partidas...';
    historyTableBody.innerHTML = `<tr><td colspan="5" class="empty-state">Conectando con Supabase...</td></tr>`;

    if (!SUPABASE_CONFIG.isConfigured()) {
      if (historyCount) historyCount.textContent = 'Sin conexión a Supabase';
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            ⚠️ Supabase no está configurado.<br>
            Ve a la pestaña <strong>Configuración</strong> para añadir tu URL y Anon Key.
          </td>
        </tr>`;
      return;
    }

    const res = await SupabaseClient.getRecentMatches(15);
    if (!res.ok || !res.data || res.data.length === 0) {
      if (historyCount) historyCount.textContent = '0 partidas registradas';
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            ${res.message ? `Error: ${res.message}` : 'No hay partidas registradas en la nube aún. ¡Juega una partida para registrarla!'}
          </td>
        </tr>`;
      return;
    }

    if (historyCount) historyCount.textContent = `Mostrando ${res.data.length} partidas recientes`;

    historyTableBody.innerHTML = res.data.map(m => {
      const date = new Date(m.created_at).toLocaleDateString('es-ES', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const modeLabel = m.game_mode === 'pve' ? `IA (${m.ai_difficulty || 'PC'})` : '2 Jugadores';
      const winBadge = m.winner === 'tie'
        ? `<span class="win-badge-table tie">Empate</span>`
        : `<span class="win-badge-table ${m.winner.toLowerCase()}">Gana ${m.winner}</span>`;

      return `
        <tr>
          <td>${date}</td>
          <td>${modeLabel}</td>
          <td>${winBadge}</td>
          <td>${escapeHtml(m.player_x_name || 'X')} vs ${escapeHtml(m.player_o_name || 'O')}</td>
          <td>${m.duration_seconds || 0}s</td>
        </tr>
      `;
    }).join('');
  }

  // Cargar estadísticas globales
  async function loadStats() {
    if (!statTotalMatches) return;

    if (!SUPABASE_CONFIG.isConfigured()) {
      statTotalMatches.textContent = scores.X + scores.O + scores.tie;
      if (statXWins) statXWins.textContent = scores.X;
      if (statOWins) statOWins.textContent = scores.O;
      if (statTies) statTies.textContent = scores.tie;
      if (statAvgDuration) statAvgDuration.textContent = 'Local';
      return;
    }

    const stats = await SupabaseClient.getGlobalStats();
    if (!stats) return;

    statTotalMatches.textContent = stats.total;
    if (statXWins) statXWins.textContent = stats.xWins;
    if (statOWins) statOWins.textContent = stats.oWins;
    if (statTies) statTies.textContent = stats.ties;
    if (statAvgDuration) statAvgDuration.textContent = stats.avgDuration;
  }

  function loadConfigTab() {
    const creds = SUPABASE_CONFIG.getCredentials();
    if (cfgSupabaseUrl) cfgSupabaseUrl.value = creds.url;
    if (cfgSupabaseAnonKey) cfgSupabaseAnonKey.value = creds.anonKey;
    if (configStatusMsg) configStatusMsg.style.display = 'none';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
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

    // 8. Nombres / Apodos de jugadores con persistencia en LocalStorage
    if (playerXNameInput) {
      playerXNameInput.addEventListener('input', () => {
        syncPlayerNames();
        updateTurnDisplay();
      });
      playerXNameInput.addEventListener('change', () => {
        syncPlayerNames();
        showToast(`💾 Apodo guardado: ${playerXNameInput.value.trim() || 'Jugador X'}`);
      });
    }
    if (playerONameInput) {
      playerONameInput.addEventListener('input', () => {
        syncPlayerNames();
        updateTurnDisplay();
      });
    }

    // 9. Botón directo de Ranking (🏆) y Nube (☁️)
    if (rankingBtn) {
      rankingBtn.addEventListener('click', () => openCloudModal('rankingTab'));
    }
    if (cloudModalBtn) {
      cloudModalBtn.addEventListener('click', () => openCloudModal('historyTab'));
    }
    if (supabaseBadge) {
      supabaseBadge.addEventListener('click', () => {
        openCloudModal(SUPABASE_CONFIG.isConfigured() ? 'rankingTab' : 'configTab');
      });
    }
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeCloudModal);
    }
    if (cloudModal) {
      cloudModal.addEventListener('click', (e) => {
        if (e.target === cloudModal) closeCloudModal();
      });
    }

    // Pestañas del modal
    modalTabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    if (refreshRankingBtn) {
      refreshRankingBtn.addEventListener('click', loadRanking);
    }

    if (refreshHistoryBtn) {
      refreshHistoryBtn.addEventListener('click', loadHistory);
    }

    // Formulario de configuración de Supabase
    if (supabaseConfigForm) {
      supabaseConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = (cfgSupabaseUrl && cfgSupabaseUrl.value.trim()) || '';
        const key = (cfgSupabaseAnonKey && cfgSupabaseAnonKey.value.trim()) || '';

        SUPABASE_CONFIG.saveCredentials(url, key);
        updateSupabaseBadge();

        if (configStatusMsg) {
          configStatusMsg.textContent = 'Verificando conexión con Supabase...';
          configStatusMsg.className = 'config-status-msg';
          configStatusMsg.style.display = 'block';
        }

        const res = await SupabaseClient.testConnection();
        if (res.ok) {
          if (configStatusMsg) {
            configStatusMsg.textContent = '✅ ¡Credenciales guardadas y conexión exitosa!';
            configStatusMsg.className = 'config-status-msg success';
          }
          showToast('🟢 Supabase conectado con éxito');
        } else {
          if (configStatusMsg) {
            configStatusMsg.textContent = `⚠️ Guardado, pero prueba falló: ${res.message}`;
            configStatusMsg.className = 'config-status-msg error';
          }
        }
      });
    }

    if (testConnBtn) {
      testConnBtn.addEventListener('click', async () => {
        const url = (cfgSupabaseUrl && cfgSupabaseUrl.value.trim()) || '';
        const key = (cfgSupabaseAnonKey && cfgSupabaseAnonKey.value.trim()) || '';

        if (!url || !key) {
          if (configStatusMsg) {
            configStatusMsg.textContent = 'Introduce la URL y Anon Key para probar.';
            configStatusMsg.className = 'config-status-msg error';
          }
          return;
        }

        SUPABASE_CONFIG.saveCredentials(url, key);
        if (configStatusMsg) {
          configStatusMsg.textContent = 'Probando conexión...';
          configStatusMsg.className = 'config-status-msg';
          configStatusMsg.style.display = 'block';
        }

        const res = await SupabaseClient.testConnection();
        if (res.ok) {
          if (configStatusMsg) {
            configStatusMsg.textContent = '✅ ¡Conexión con Supabase verificada correctamente!';
            configStatusMsg.className = 'config-status-msg success';
          }
          updateSupabaseBadge();
          showToast('🟢 Conexión verificada');
        } else {
          if (configStatusMsg) {
            configStatusMsg.textContent = `❌ Error de conexión: ${res.message}`;
            configStatusMsg.className = 'config-status-msg error';
          }
        }
      });
    }

    if (clearConnBtn) {
      clearConnBtn.addEventListener('click', () => {
        SUPABASE_CONFIG.clearCredentials();
        loadConfigTab();
        updateSupabaseBadge();
        if (configStatusMsg) {
          configStatusMsg.textContent = 'Credenciales eliminadas. El juego vuelve a Modo Local.';
          configStatusMsg.className = 'config-status-msg';
          configStatusMsg.style.display = 'block';
        }
        showToast('⚪ Desconectado de Supabase');
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
