import React, { useState, useEffect } from 'react';

function EditServiceModal({ service, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    currency: 'USD',
    renewalDate: '',
    frequency: 'monthly',
    tags: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (service && isOpen) {
      setFormData({
        name: service.name || '',
        cost: service.cost?.toString() || '',
        currency: service.currency || 'USD',
        renewalDate: service.renewal_date || '',
        frequency: service.frequency || 'monthly',
        tags: service.tags || ''
      });
      setErrors({});
    }
  }, [service, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Service name is required';
    }

    if (!formData.cost || isNaN(formData.cost) || parseFloat(formData.cost) <= 0) {
      newErrors.cost = 'Valid cost is required';
    }

    if (!formData.renewalDate) {
      newErrors.renewalDate = 'Renewal date is required';
    }

    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const updatedService = {
      ...service,
      name: formData.name.trim(),
      cost: parseFloat(formData.cost),
      currency: formData.currency,
      renewal_date: formData.renewalDate,
      frequency: formData.frequency,
      tags: formData.tags.trim(),
      status: service.status // Preserve the current status
    };

    onSave(updatedService);
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Service</h3>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Service Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., Netflix"
            />
            {errors.name && <div className="form-error">{errors.name}</div>}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: '2' }}>
              <label className="form-label">Cost</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                className="form-input"
                placeholder="15.99"
                step="0.01"
                min="0"
              />
              {errors.cost && <div className="form-error">{errors.cost}</div>}
            </div>

            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Currency</label>
              <select
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="form-input"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Renewal Date</label>
              <input
                type="date"
                name="renewalDate"
                value={formData.renewalDate}
                onChange={handleChange}
                className="form-input"
              />
              {errors.renewalDate && <div className="form-error">{errors.renewalDate}</div>}
            </div>

            <div className="form-group" style={{ flex: '1' }}>
              <label className="form-label">Frequency</label>
              <select
                name="frequency"
                value={formData.frequency}
                onChange={handleChange}
                className="form-input"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tags (optional)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., #entertainment #streaming"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditServiceModal;