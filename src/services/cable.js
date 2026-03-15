// src/services/cable.js
import { BASE_URL } from '../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WS_URL = BASE_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/cable';

// Stable JSON key order so subscribe() and perform() always produce the same identifier string
function stableIdentifier(channelName, params = {}) {
  const keys   = Object.keys(params).sort();
  const sorted = keys.reduce((acc, k) => { acc[k] = params[k]; return acc; }, {});
  return JSON.stringify({ channel: channelName, ...sorted });
}

class CableManager {
  constructor() {
    this.ws             = null;
    this.subscriptions  = {};   // identifierString → { callbacks: [] }
    this.connected      = false;
    this.reconnectTimer = null;
    this.pingTimer      = null;
  }

  async connect() {
    if (this.ws && this.ws.readyState <= 1) return;   // already open or connecting

    const token  = await AsyncStorage.getItem('access-token');
    const client = await AsyncStorage.getItem('client');
    const uid    = await AsyncStorage.getItem('uid');

    const url = `${WS_URL}?access-token=${encodeURIComponent(token || '')}&client=${encodeURIComponent(client || '')}&uid=${encodeURIComponent(uid || '')}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('[Cable] Connected');
      this.connected = true;
      clearTimeout(this.reconnectTimer);
      // Re-subscribe everything on reconnect
      Object.keys(this.subscriptions).forEach((identifier) => {
        this._send({ command: 'subscribe', identifier });
      });
      this.pingTimer = setInterval(() => this._send({ type: 'ping' }), 30_000);
    };

    this.ws.onmessage = (event) => {
      try { this._dispatch(JSON.parse(event.data)); } catch {}
    };

    this.ws.onclose = () => {
      console.log('[Cable] Disconnected, reconnecting in 3s…');
      this.connected = false;
      clearInterval(this.pingTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 3_000);
    };

    this.ws.onerror = (e) => {
      console.error('[Cable] Error:', e.message);
    };
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingTimer);
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected     = false;
    this.subscriptions = {};
  }

  // Subscribe to channelName with params, call onMessage for every broadcast.
  // Returns an unsubscribe function.
  subscribe(channelName, params = {}, onMessage) {
    const identifier = stableIdentifier(channelName, params);

    if (!this.subscriptions[identifier]) {
      this.subscriptions[identifier] = { callbacks: [] };
      if (this.connected) {
        this._send({ command: 'subscribe', identifier });
      }
    }
    this.subscriptions[identifier].callbacks.push(onMessage);

    return () => {
      if (!this.subscriptions[identifier]) return;
      this.subscriptions[identifier].callbacks =
        this.subscriptions[identifier].callbacks.filter((cb) => cb !== onMessage);
      if (this.subscriptions[identifier].callbacks.length === 0) {
        this._send({ command: 'unsubscribe', identifier });
        delete this.subscriptions[identifier];
      }
    };
  }

  // Perform a server-side action on an already-subscribed channel.
  perform(channelName, params = {}, action, data = {}) {
    const identifier = stableIdentifier(channelName, params);
    this._send({
      command:    'message',
      identifier,
      data: JSON.stringify({ action, ...data }),
    });
  }

  _send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _dispatch(msg) {
    // Ignore protocol frames
    if (['ping', 'welcome', 'confirm_subscription', 'reject_subscription'].includes(msg.type)) return;
    // Must have identifier + message payload
    if (!msg.identifier || msg.message == null) return;

    const sub = this.subscriptions[msg.identifier];
    if (sub) {
      sub.callbacks.forEach((cb) => {
        try { cb(msg.message); } catch (e) { console.error('[Cable] callback error:', e); }
      });
    }
  }
}

export const cable = new CableManager();

// // src/services/cable.js
// // ActionCable WebSocket client
// import { BASE_URL } from '../api/client';
// import AsyncStorage from '@react-native-async-storage/async-storage';

// // Convert https:// → wss:// for WebSocket
// const WS_URL = BASE_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/cable';

// class CableManager {
//   constructor() {
//     this.ws          = null;
//     this.subscriptions = {}; // channelKey → { callbacks: [], identifier }
//     this.connected   = false;
//     this.reconnectTimer = null;
//     this.pingTimer   = null;
//   }

//   async connect() {
//     if (this.ws && this.ws.readyState <= 1) return;

//     const token  = await AsyncStorage.getItem('access-token');
//     const client = await AsyncStorage.getItem('client');
//     const uid    = await AsyncStorage.getItem('uid');

//     const url = `${WS_URL}?access-token=${encodeURIComponent(token || '')}&client=${encodeURIComponent(client || '')}&uid=${encodeURIComponent(uid || '')}`;

//     this.ws = new WebSocket(url);

//     this.ws.onopen = () => {
//       console.log('[Cable] Connected');
//       this.connected = true;
//       clearTimeout(this.reconnectTimer);
//       // Resubscribe all existing subscriptions on reconnect
//       Object.values(this.subscriptions).forEach(({ identifier }) => {
//         this._send({ command: 'subscribe', identifier });
//       });
//       // Ping every 30s
//       this.pingTimer = setInterval(() => this._send({ type: 'ping' }), 30000);
//     };

//     this.ws.onmessage = (event) => {
//       try {
//         const msg = JSON.parse(event.data);
//         this._dispatch(msg);
//       } catch (e) {}
//     };

//     this.ws.onclose = () => {
//       console.log('[Cable] Disconnected, reconnecting in 3s...');
//       this.connected = false;
//       clearInterval(this.pingTimer);
//       this.reconnectTimer = setTimeout(() => this.connect(), 3000);
//     };

//     this.ws.onerror = (e) => {
//       console.error('[Cable] Error:', e.message);
//     };
//   }

//   disconnect() {
//     clearTimeout(this.reconnectTimer);
//     clearInterval(this.pingTimer);
//     if (this.ws) { this.ws.close(); this.ws = null; }
//     this.connected = false;
//     this.subscriptions = {};
//   }

//   // Subscribe to a channel (e.g. ChatChannel with room_id)
//   subscribe(channelName, params = {}, onMessage) {
//     const identifier = JSON.stringify({ channel: channelName, ...params });
//     const key = identifier;

//     if (!this.subscriptions[key]) {
//       this.subscriptions[key] = { identifier, callbacks: [] };
//       if (this.connected) {
//         this._send({ command: 'subscribe', identifier });
//       }
//     }

//     this.subscriptions[key].callbacks.push(onMessage);

//     // Return unsubscribe function
//     return () => {
//       if (!this.subscriptions[key]) return;
//       this.subscriptions[key].callbacks = this.subscriptions[key].callbacks.filter((cb) => cb !== onMessage);
//       if (this.subscriptions[key].callbacks.length === 0) {
//         this._send({ command: 'unsubscribe', identifier });
//         delete this.subscriptions[key];
//       }
//     };
//   }

//   // Perform an action on a channel (e.g. send a message)
//   perform(channelName, params = {}, action, data = {}) {
//     const identifier = JSON.stringify({ channel: channelName, ...params });
//     this._send({
//       command: 'message',
//       identifier,
//       data: JSON.stringify({ action, ...data }),
//     });
//   }

//   _send(payload) {
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//       this.ws.send(JSON.stringify(payload));
//     }
//   }

//   _dispatch(msg) {
//     if (msg.type === 'ping' || msg.type === 'welcome' || msg.type === 'confirm_subscription') return;
//     if (!msg.identifier || !msg.message) return;

//     const sub = this.subscriptions[msg.identifier];
//     if (sub) {
//       sub.callbacks.forEach((cb) => cb(msg.message));
//     }
//   }
// }

// export const cable = new CableManager();