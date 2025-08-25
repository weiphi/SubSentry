import React, { useState, useMemo } from 'react';
import ServiceList from './ServiceList';
import SearchFilterBar from './SearchFilterBar';

const { ipcRenderer } = window.require('electron');

function InactiveServices({ services, onServiceUpdate }) {
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const handleReactivateService = async (serviceId) => {
    try {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        await ipcRenderer.invoke('update-service', serviceId, {
          ...service,
          status: 'active'
        });
        onServiceUpdate();
      }
    } catch (error) {
      console.error('Failed to reactivate service:', error);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (window.confirm('Are you sure you want to permanently delete this service?')) {
      try {
        await ipcRenderer.invoke('delete-service', serviceId);
        onServiceUpdate();
      } catch (error) {
        console.error('Failed to delete service:', error);
      }
    }
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

    // Sort alphabetically by name
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [services, searchQuery, currencyFilter, tagFilter]);

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
          Inactive Services ({filteredAndSortedServices.length})
        </h2>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
          Previously subscribed services that can be reactivated
        </p>
      </div>

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
          <div className="empty-state-icon">📋</div>
          <h3>{services.length === 0 ? 'No Inactive Services' : 'No Services Match Your Filters'}</h3>
          <p>{services.length === 0 ? 'Deactivated services will appear here for easy reactivation.' : 'Try adjusting your search or filters.'}</p>
        </div>
      ) : (
        <ServiceList 
          services={filteredAndSortedServices}
          showRenewalStatus={false}
          actions={[
            {
              label: 'Reactivate',
              className: 'btn btn-primary',
              onClick: handleReactivateService
            },
            {
              label: 'Delete',
              className: 'btn btn-danger',
              onClick: handleDeleteService
            }
          ]}
        />
      )}
    </div>
  );
}

export default InactiveServices;