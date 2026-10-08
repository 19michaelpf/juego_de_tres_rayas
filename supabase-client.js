/**
 * CLIENTE Y SERVICIOS DE SUPABASE
 * Adaptado exactamente al esquema relacional:
 * - players (Ranking y estadísticas por apodo)
 * - matches (Historial de partidas)
 * - match_moves (Jugada a jugada con relación a matches)
 */

const SupabaseClient = {
  client: null,

  getClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      console.warn('El SDK de Supabase (@supabase/supabase-js) no está disponible en la página.');
      return null;
    }

    const creds = SUPABASE_CONFIG.getCredentials();
    if (!SUPABASE_CONFIG.isConfigured()) {
      this.client = null;
      return null;
    }

    try {
      this.client = window.supabase.createClient(creds.url, creds.anonKey);
      return this.client;
    } catch (err) {
      console.error('Error instanciando cliente de Supabase:', err);
      this.client = null;
      return null;
    }
  },

  // Probar conectividad consultando la tabla matches
  async testConnection() {
    const sb = this.getClient();
    if (!sb) {
      return { ok: false, message: 'Credenciales incompletas o no configuradas.' };
    }

    try {
      const { data, error } = await sb
        .from('matches')
        .select('id')
        .limit(1);

      if (error) {
        return { ok: false, message: `Error de Supabase: ${error.message}` };
      }

      return { ok: true, message: '¡Conexión verificada con las tablas de Supabase!' };
    } catch (err) {
      return { ok: false, message: `Fallo de red o configuración: ${err.message}` };
    }
  },

  // Guardar partida completa: matches, match_moves y actualizar players
  async saveMatch(matchData, moves = []) {
    const sb = this.getClient();
    if (!sb) {
      return { ok: false, skipped: true, message: 'Supabase no configurado; partida en modo local.' };
    }

    try {
      // 1. Insertar en la tabla 'matches'
      const matchPayload = {
        game_mode: matchData.gameMode || 'pvp',
        player_x_name: matchData.playerXName || 'Jugador X',
        player_o_name: matchData.playerOName || 'Jugador O',
        winner: matchData.winner,
        total_moves: matchData.totalMoves || 0,
        duration_seconds: matchData.durationSeconds || 0,
        final_board: matchData.finalBoard || (matchData.boardState ? matchData.boardState.join('') : '')
      };

      const { data: matchResult, error: matchError } = await sb
        .from('matches')
        .insert([matchPayload])
        .select('id')
        .single();

      if (matchError || !matchResult) {
        console.error('Error insertando en tabla matches:', matchError);
        return { ok: false, message: matchError ? matchError.message : 'Error desconocido' };
      }

      const matchId = matchResult.id;

      // 2. Insertar jugadas en 'match_moves' asociadas al match_id
      if (moves && moves.length > 0) {
        const movesPayload = moves.map(m => ({
          match_id: matchId,
          move_number: m.move_number,
          player: m.player,
          cell_index: m.cell_index,
          created_at: m.created_at || new Date().toISOString()
        }));

        const { error: movesError } = await sb
          .from('match_moves')
          .insert(movesPayload);

        if (movesError) {
          console.warn('Advertencia insertando match_moves:', movesError.message);
        }
      }

      // 3. Actualizar estadísticas en la tabla 'players'
      await this.updatePlayerStats(matchPayload.player_x_name, matchPayload.winner === 'X', matchPayload.winner === 'tie');
      if (matchPayload.game_mode === 'pvp') {
        await this.updatePlayerStats(matchPayload.player_o_name, matchPayload.winner === 'O', matchPayload.winner === 'tie');
      }

      return { ok: true, matchId };
    } catch (err) {
      console.error('Excepción guardando partida en Supabase:', err);
      return { ok: false, message: err.message };
    }
  },

  // Actualizar o registrar apodo en la tabla 'players'
  async updatePlayerStats(nickname, isWinner, isTie) {
    const sb = this.getClient();
    if (!sb || !nickname) return;

    try {
      const cleanNick = nickname.trim();
      if (!cleanNick) return;

      const { data: existing, error: selectErr } = await sb
        .from('players')
        .select('*')
        .eq('nickname', cleanNick)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        await sb
          .from('players')
          .update({
            games_played: (existing.games_played || 0) + 1,
            wins: (existing.wins || 0) + (isWinner ? 1 : 0),
            losses: (existing.losses || 0) + (!isWinner && !isTie ? 1 : 0),
            ties: (existing.ties || 0) + (isTie ? 1 : 0),
            last_played_at: now
          })
          .eq('nickname', cleanNick);
      } else {
        await sb
          .from('players')
          .insert([{
            nickname: cleanNick,
            games_played: 1,
            wins: isWinner ? 1 : 0,
            losses: !isWinner && !isTie ? 1 : 0,
            ties: isTie ? 1 : 0,
            created_at: now,
            last_played_at: now
          }]);
      }
    } catch (e) {
      console.warn('Error no bloqueante en updatePlayerStats:', e);
    }
  },

  // Obtener ranking desde la tabla 'players'
  async getLeaderboard(limit = 25) {
    const sb = this.getClient();
    if (!sb) return { ok: false, data: [] };

    try {
      const { data, error } = await sb
        .from('players')
        .select('*')
        .order('wins', { ascending: false })
        .order('games_played', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error obteniendo ranking de tabla players:', error);
        return { ok: false, message: error.message, data: [] };
      }

      return { ok: true, data: data || [] };
    } catch (err) {
      console.error('Fallo cargando ranking:', err);
      return { ok: false, message: err.message, data: [] };
    }
  },

  // Obtener historial desde la tabla 'matches'
  async getRecentMatches(limit = 15) {
    const sb = this.getClient();
    if (!sb) return { ok: false, data: [] };

    try {
      const { data, error } = await sb
        .from('matches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error obteniendo historial de tabla matches:', error);
        return { ok: false, message: error.message, data: [] };
      }

      return { ok: true, data: data || [] };
    } catch (err) {
      console.error('Fallo cargando historial:', err);
      return { ok: false, message: err.message, data: [] };
    }
  },

  // Obtener estadísticas agregadas desde la tabla 'matches'
  async getGlobalStats() {
    const sb = this.getClient();
    if (!sb) return null;

    try {
      const { data: matches, error } = await sb
        .from('matches')
        .select('winner, duration_seconds');

      if (error || !matches) return null;

      const total = matches.length;
      const xWins = matches.filter(m => m.winner === 'X').length;
      const oWins = matches.filter(m => m.winner === 'O').length;
      const ties = matches.filter(m => m.winner === 'tie').length;
      const totalDur = matches.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
      const avgDuration = total > 0 ? (totalDur / total).toFixed(1) : 0;

      return { total, xWins, oWins, ties, avgDuration };
    } catch (e) {
      console.error('Error calculando estadísticas globales:', e);
      return null;
    }
  }
};
