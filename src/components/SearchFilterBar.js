import React from 'react';

function SearchFilterBar({
  searchQuery,
  onSearchChange,
  currencyFilter,
  onCurrencyFilterChange,
  statusFilter,
  onStatusFilterChange,
  tagFilter,
  onTagFilterChange,
  availableTags = []
}) {
  return (
    <div className="search-filter-bar">
      <input
        type="text"
        className="search-input"
        placeholder="Search services..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      
      <div className="filter-buttons">
        <span className="filter-label">Currency:</span>
        <button
          className={`filter-btn ${currencyFilter === 'all' ? 'active' : ''}`}
          onClick={() => onCurrencyFilterChange('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${currencyFilter === 'USD' ? 'active' : ''}`}
          onClick={() => onCurrencyFilterChange('USD')}
        >
          USD
        </button>
        <button
          className={`filter-btn ${currencyFilter === 'EUR' ? 'active' : ''}`}
          onClick={() => onCurrencyFilterChange('EUR')}
        >
          EUR
        </button>
      </div>

      {availableTags.length > 0 && (
        <div className="filter-buttons">
          <span className="filter-label">Tags:</span>
          <button
            className={`filter-btn ${tagFilter === 'all' ? 'active' : ''}`}
            onClick={() => onTagFilterChange('all')}
          >
            All
          </button>
          {availableTags.map(tag => (
            <button
              key={tag}
              className={`filter-btn ${tagFilter === tag ? 'active' : ''}`}
              onClick={() => onTagFilterChange(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchFilterBar;