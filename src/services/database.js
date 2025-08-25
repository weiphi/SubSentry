const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'subsentry.db');
    
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  initializeDatabase() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cost REAL NOT NULL,
        currency TEXT NOT NULL,
        renewal_date DATE NOT NULL,
        frequency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        tags TEXT,
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.exec(createTableSQL);

    // Create indexes for better performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_renewal_date ON services(renewal_date)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_status ON services(status)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_currency ON services(currency)');
  }

  // Service CRUD operations
  addService(serviceData) {
    const {
      name,
      cost,
      currency,
      renewalDate,
      frequency,
      status = 'active',
      tags = ''
    } = serviceData;

    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO services 
      (id, name, cost, currency, renewal_date, frequency, status, tags, added_date, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(id, name, cost, currency, renewalDate, frequency, status, tags, now, now);
  }

  getAllServices() {
    const stmt = this.db.prepare('SELECT * FROM services ORDER BY renewal_date ASC');
    return stmt.all();
  }

  getActiveServices() {
    const stmt = this.db.prepare('SELECT * FROM services WHERE status = ? ORDER BY renewal_date ASC');
    return stmt.all('active');
  }

  getInactiveServices() {
    const stmt = this.db.prepare('SELECT * FROM services WHERE status = ? ORDER BY name ASC');
    return stmt.all('inactive');
  }

  updateService(id, updates) {
    const {
      name,
      cost,
      currency,
      renewal_date: renewalDate,
      frequency,
      status,
      tags
    } = updates;

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE services 
      SET name = ?, cost = ?, currency = ?, renewal_date = ?, 
          frequency = ?, status = ?, tags = ?, last_modified = ?
      WHERE id = ?
    `);

    return stmt.run(name, cost, currency, renewalDate, frequency, status, tags, now, id);
  }

  deleteService(id) {
    const stmt = this.db.prepare('DELETE FROM services WHERE id = ?');
    return stmt.run(id);
  }

  searchServices(query) {
    const stmt = this.db.prepare(`
      SELECT * FROM services 
      WHERE name LIKE ? OR tags LIKE ?
      ORDER BY renewal_date ASC
    `);
    const searchPattern = `%${query}%`;
    return stmt.all(searchPattern, searchPattern);
  }

  // Utility methods for notifications and calculations
  getServicesRenewingSoon() {
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const stmt = this.db.prepare(`
      SELECT * FROM services 
      WHERE status = 'active' AND (
        (frequency = 'monthly' AND renewal_date <= ?) OR
        (frequency = 'annual' AND renewal_date <= ?)
      )
      ORDER BY renewal_date ASC
    `);

    return stmt.all(
      threeDaysFromNow.toISOString().split('T')[0],
      thirtyDaysFromNow.toISOString().split('T')[0]
    );
  }

  // Get services that need renewal date updates (past renewal dates)
  getServicesNeedingRenewalUpdate() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      SELECT * FROM services 
      WHERE status = 'active' AND renewal_date < ?
      ORDER BY renewal_date ASC
    `);

    return stmt.all(today);
  }

  // Update renewal date to next occurrence
  updateRenewalDate(serviceId) {
    const service = this.db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    
    if (!service) return null;

    const currentRenewalDate = new Date(service.renewal_date);
    let nextRenewalDate;

    if (service.frequency === 'monthly') {
      nextRenewalDate = new Date(currentRenewalDate);
      nextRenewalDate.setMonth(nextRenewalDate.getMonth() + 1);
    } else if (service.frequency === 'annual') {
      nextRenewalDate = new Date(currentRenewalDate);
      nextRenewalDate.setFullYear(nextRenewalDate.getFullYear() + 1);
    } else {
      return null;
    }

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE services 
      SET renewal_date = ?, last_modified = ?
      WHERE id = ?
    `);

    return stmt.run(
      nextRenewalDate.toISOString().split('T')[0],
      now,
      serviceId
    );
  }

  // Auto-update past renewal dates
  autoUpdatePastRenewalDates() {
    const servicesNeedingUpdate = this.getServicesNeedingRenewalUpdate();
    const updatedServices = [];

    servicesNeedingUpdate.forEach(service => {
      const result = this.updateRenewalDate(service.id);
      if (result && result.changes > 0) {
        updatedServices.push(service.id);
      }
    });

    return updatedServices;
  }

  getMonthlyTotals() {
    const stmt = this.db.prepare(`
      SELECT 
        currency,
        SUM(CASE 
          WHEN frequency = 'monthly' THEN cost 
          WHEN frequency = 'annual' THEN cost / 12 
          ELSE 0 
        END) as monthly_total
      FROM services 
      WHERE status = 'active'
      GROUP BY currency
    `);

    return stmt.all();
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseService;