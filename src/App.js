import React, { useState, useEffect } from 'react';
import ActiveServices from './components/ActiveServices';
import InactiveServices from './components/InactiveServices';

const { ipcRenderer } = window.require('electron');

function App() {
  const [activeTab, setActiveTab] = useState('active');
  const [services, setServices] = useState([]);
  const [totals, setTotals] = useState({ USD: 0, EUR: 0 });

  useEffect(() => {
    // Load initial data
    loadServices();
    loadTotals();

    // Set up IPC listeners for data updates
    ipcRenderer.on('services-updated', () => {
      loadServices();
      loadTotals();
    });

    return () => {
      ipcRenderer.removeAllListeners('services-updated');
    };
  }, []);

  const loadServices = async () => {
    try {
      const allServices = await ipcRenderer.invoke('get-all-services');
      setServices(allServices);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const loadTotals = async () => {
    try {
      const monthlyTotals = await ipcRenderer.invoke('get-monthly-totals');
      const totalsObj = { USD: 0, EUR: 0 };
      
      monthlyTotals.forEach(total => {
        totalsObj[total.currency] = total.monthly_total;
      });
      
      setTotals(totalsObj);
    } catch (error) {
      console.error('Failed to load totals:', error);
    }
  };

  const handleServiceUpdate = () => {
    loadServices();
    loadTotals();
  };

  const activeServices = services.filter(service => service.status === 'active');
  const inactiveServices = services.filter(service => service.status === 'inactive');

  return (
    <div className="app">
      <div className="totals">
        <div className="total-item">
          <div className="total-label">USD Monthly</div>
          <div className="total-amount">${totals.USD?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="total-item">
          <div className="total-label">EUR Monthly</div>
          <div className="total-amount">€{totals.EUR?.toFixed(2) || '0.00'}</div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Services ({activeServices.length})
        </button>
        <button 
          className={`tab ${activeTab === 'inactive' ? 'active' : ''}`}
          onClick={() => setActiveTab('inactive')}
        >
          Inactive Services ({inactiveServices.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'active' && (
          <ActiveServices 
            services={activeServices} 
            onServiceUpdate={handleServiceUpdate}
          />
        )}
        {activeTab === 'inactive' && (
          <InactiveServices 
            services={inactiveServices} 
            onServiceUpdate={handleServiceUpdate}
          />
        )}
      </div>
    </div>
  );
}

export default App;