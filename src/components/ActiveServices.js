import React, { useState, useMemo } from 'react';
import ServiceList from './ServiceList';
import AddServiceForm from './AddServiceForm';
import EditServiceModal from './EditServiceModal';
import SearchFilterBar from './SearchFilterBar';

const { ipcRenderer } = window.require('electron');

function ActiveServices({ services, onServiceUpdate }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const handleAddService = async (serviceData) => {
    try {
      await ipcRenderer.invoke('add-service', serviceData);
      setShowAddForm(false);
      onServiceUpdate();
    } catch (error) {
      console.error('Failed to add service:', error);
    }
  };

  const handleDeactivateService = async (serviceId) => {
    try {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        await ipcRenderer.invoke('update-service', serviceId, {
          ...service,
          status: 'inactive'
        });
        onServiceUpdate();
      }
    } catch (error) {
      console.error('Failed to deactivate service:', error);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('Are you sure you want to delete this service?')) {
      try {
        await ipcRenderer.invoke('delete-service', serviceId);
        onServiceUpdate();
      } catch (error) {
        console.error('Failed to delete service:', error);
      }
    }
  };

  const handleEditService = (serviceId, service) => {
    setEditingService(service);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (updatedService) => {
    try {
      await ipcRenderer.invoke('update-service', updatedService.id, updatedService);
      setShowEditModal(false);
      setEditingService(null);
      onServiceUpdate();
    } catch (error) {
      console.error('Failed to update service:', error);
    }
  };

  const handleCloseEdit = () => {
    setShowEditModal(false);
    setEditingService(null);
  };

  // Extract available tags from services
  const availableTags = useMemo(() => {
    const tagSet = new Set();
    services.forEach(service => {
      if (service.tags) {
        const tags = service.tags.split(' ').filter(tag => tag.startsWith('#'));
        tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [services]);

  // Filter and sort services
  const filteredAndSortedServices = useMemo(() => {
    let filtered = [...services];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(query) ||
        (service.tags && service.tags.toLowerCase().includes(query))
      );
    }

    // Apply currency filter
    if (currencyFilter !== 'all') {
      filtered = filtered.filter(service => service.currency === currencyFilter);
    }

    // Apply tag filter
    if (tagFilter !== 'all') {
      filtered = filtered.filter(service =>
        service.tags && service.tags.includes(tagFilter)
      );
    }

    // Sort by renewal date (soonest first)
    return filtered.sort((a, b) => 
      new Date(a.renewal_date) - new Date(b.renewal_date)
    );
  }, [services, searchQuery, currencyFilter, tagFilter]);

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
          Active Subscriptions ({filteredAndSortedServices.length})
        </h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {showAddForm && (
        <AddServiceForm 
          onSubmit={handleAddService}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {services.length > 0 && (
        <SearchFilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currencyFilter={currencyFilter}
          onCurrencyFilterChange={setCurrencyFilter}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          availableTags={availableTags}
        />
      )}

      {filteredAndSortedServices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💳</div>
          <h3>{services.length === 0 ? 'No Active Subscriptions' : 'No Services Match Your Filters'}</h3>
          <p>{services.length === 0 ? 'Add your first subscription to start tracking renewal dates.' : 'Try adjusting your search or filters.'}</p>
        </div>
      ) : (
        <ServiceList 
          services={filteredAndSortedServices}
          actions={[
            {
              label: 'Edit',
              className: 'btn btn-primary',
              onClick: handleEditService
            },
            {
              label: 'Deactivate',
              className: 'btn btn-secondary',
              onClick: handleDeactivateService
            },
            {
              label: 'Delete',
              className: 'btn btn-danger',
              onClick: handleDeleteService
            }
          ]}
        />
      )}

      <EditServiceModal
        service={editingService}
        isOpen={showEditModal}
        onClose={handleCloseEdit}
        onSave={handleSaveEdit}
      />
    </div>
  );
}

export default ActiveServices;