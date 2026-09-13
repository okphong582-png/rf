const fs = require('fs');
const path = require('path');
const config = require('./config');

const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const CHANNELS_FILE = path.join(__dirname, 'channels.json');

class Storage {
  constructor() {
    this.subscribers = new Set();
    this.channels = new Set(config.SEED_CREATORS);
    this.stats = {
      startTime: Date.now(),
      chestsFound: 0,
      activeConnections: 0
    };

    this.load();
  }

  load() {
    try {
      if (fs.existsSync(SUBSCRIBERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach(id => this.subscribers.add(id));
        }
      }
    } catch (err) {
      console.error('[Storage] Lỗi khi đọc subscribers.json:', err.message);
    }

    try {
      if (fs.existsSync(CHANNELS_FILE)) {
        const data = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach(ch => this.channels.add(ch.toLowerCase().replace('@', '').trim()));
        }
      }
    } catch (err) {
      console.error('[Storage] Lỗi khi đọc channels.json:', err.message);
    }
  }

  saveSubscribers() {
    try {
      fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(Array.from(this.subscribers), null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Lỗi khi ghi subscribers.json:', err.message);
    }
  }

  saveChannels() {
    try {
      fs.writeFileSync(CHANNELS_FILE, JSON.stringify(Array.from(this.channels), null, 2), 'utf8');
    } catch (err) {
      console.error('[Storage] Lỗi khi ghi channels.json:', err.message);
    }
  }

  addSubscriber(chatId) {
    if (!this.subscribers.has(chatId)) {
      this.subscribers.add(chatId);
      this.saveSubscribers();
      return true;
    }
    return false;
  }

  removeSubscriber(chatId) {
    if (this.subscribers.has(chatId)) {
      this.subscribers.delete(chatId);
      this.saveSubscribers();
      return true;
    }
    return false;
  }

  getSubscribers() {
    return Array.from(this.subscribers);
  }

  addChannel(username) {
    const clean = username.toLowerCase().replace('@', '').trim();
    if (clean && !this.channels.has(clean)) {
      this.channels.add(clean);
      this.saveChannels();
      return true;
    }
    return false;
  }

  removeChannel(username) {
    const clean = username.toLowerCase().replace('@', '').trim();
    if (this.channels.has(clean)) {
      this.channels.delete(clean);
      this.saveChannels();
      return true;
    }
    return false;
  }

  getChannels() {
    return Array.from(this.channels);
  }

  incrementChestsFound() {
    this.stats.chestsFound++;
  }

  getStats() {
    const uptimeSec = Math.floor((Date.now() - this.stats.startTime) / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    return {
      subscribersCount: this.subscribers.size,
      channelsCount: this.channels.size,
      chestsFound: this.stats.chestsFound,
      activeConnections: this.stats.activeConnections,
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      uptimeMs: Date.now() - this.stats.startTime
    };
  }
}

module.exports = new Storage();
