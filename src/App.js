import React, { useState, useEffect } from 'react';
import ActiveServices from './components/ActiveServices';
import InactiveServices from './components/InactiveServices';
import SettingsPage from './components/SettingsPage';

const { ipcRenderer } = window.require('electron');

function App() {
  const [activeTab, setActiveTab] = useState('active');
  const [services, setServices] = useState([]);
  const [totals, setTotals] = useState({ USD: 0, EUR: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [dragDropData, setDragDropData] = useState(null);
  const [dragDropError, setDragDropError] = useState(null);

  useEffect(() => {
    // Load initial data
    loadServices();
    loadTotals();

    // Set up IPC listeners for data updates
    ipcRenderer.on('services-updated', () => {
      loadServices();
      loadTotals();
    });

    // Listen for settings page requests
    ipcRenderer.on('show-settings', () => {
      setShowSettings(true);
    });

    // Listen for drag-and-drop parsed data
    ipcRenderer.on('show-add-service-with-data', (event, parsedData) => {
      setActiveTab('active'); // Switch to active tab
      setShowSettings(false); // Make sure we're not in settings
      setDragDropData(parsedData);
      setDragDropError(null);
    });

    // Listen for drag-and-drop errors
    ipcRenderer.on('show-add-service-with-error', (event, errorMessage) => {
      setActiveTab('active'); // Switch to active tab
      setShowSettings(false); // Make sure we're not in settings
      setDragDropError(errorMessage);
      setDragDropData(null);
    });

    // Listen for show Add New Service dialog request
    ipcRenderer.on('show-add-service-dialog', () => {
      setActiveTab('active'); // Switch to active tab
      setShowSettings(false); // Make sure we're not in settings
      setDragDropData({ showDialog: true }); // Signal to show the dialog
      setDragDropError(null);
    });

    return () => {
      ipcRenderer.removeAllListeners('services-updated');
      ipcRenderer.removeAllListeners('show-settings');
      ipcRenderer.removeAllListeners('show-add-service-with-data');
      ipcRenderer.removeAllListeners('show-add-service-with-error');
      ipcRenderer.removeAllListeners('show-add-service-dialog');
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

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

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
            dragDropData={dragDropData}
            dragDropError={dragDropError}
            onDragDropDataUsed={() => {
              setDragDropData(null);
              setDragDropError(null);
            }}
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