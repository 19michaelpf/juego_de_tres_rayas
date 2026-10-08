/**
 * CONFIGURACIÓN DE SUPABASE
 * Puedes ingresar tus credenciales directamente aquí o guardarlas
 * desde la interfaz del juego mediante la ventana "⚙️ Configurar Supabase".
 */

const SUPABASE_CONFIG = {
  // Pega aquí la URL de tu proyecto Supabase (ej: 'https://xxxxxxxxxxxx.supabase.co')
  DEFAULT_URL: '',

  // Pega aquí la clave pública anónima (anon public key)
  DEFAULT_ANON_KEY: '',

  // Claves de almacenamiento local
  STORAGE_KEY_URL: 'tictactoe_supabase_url',
  STORAGE_KEY_KEY: 'tictactoe_supabase_key',

  // Obtener credenciales activas (prioriza localStorage si el usuario las configuró en la interfaz)
  getCredentials() {
    let url = this.DEFAULT_URL;
    let anonKey = this.DEFAULT_ANON_KEY;

    try {
      const storedUrl = localStorage.getItem(this.STORAGE_KEY_URL);
      const storedKey = localStorage.getItem(this.STORAGE_KEY_KEY);
      if (storedUrl && storedUrl.trim()) url = storedUrl.trim();
      if (storedKey && storedKey.trim()) anonKey = storedKey.trim();
    } catch (e) {
      console.warn('LocalStorage inaccesible para credenciales:', e);
    }

    return {
      url: url || '',
      anonKey: anonKey || ''
    };
  },

  // Guardar credenciales desde la interfaz de usuario
  saveCredentials(url, anonKey) {
    try {
      if (url) localStorage.setItem(this.STORAGE_KEY_URL, url.trim());
      else localStorage.removeItem(this.STORAGE_KEY_URL);

      if (anonKey) localStorage.setItem(this.STORAGE_KEY_KEY, anonKey.trim());
      else localStorage.removeItem(this.STORAGE_KEY_KEY);

      return true;
    } catch (e) {
      console.error('Error guardando credenciales en LocalStorage:', e);
      return false;
    }
  },

  // Borrar credenciales guardadas en LocalStorage
  clearCredentials() {
    try {
      localStorage.removeItem(this.STORAGE_KEY_URL);
      localStorage.removeItem(this.STORAGE_KEY_KEY);
    } catch (e) {}
  },

  // Verificar si hay credenciales configuradas
  isConfigured() {
    const creds = this.getCredentials();
    return Boolean(
      creds.url && 
      creds.url.startsWith('http') && 
      creds.anonKey && 
      creds.anonKey.length > 20
    );
  }
};
