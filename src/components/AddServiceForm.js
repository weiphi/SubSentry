import React, { useState } from 'react';
import nlpService from '../services/nlpService';

function AddServiceForm({ onSubmit, onCancel }) {
  const [inputMode, setInputMode] = useState('natural'); // 'natural' or 'manual'
  const [naturalInput, setNaturalInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    currency: 'USD',
    renewalDate: '',
    frequency: 'monthly',
    tags: ''
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
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
    } else {
      const renewalDate = new Date(formData.renewalDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (renewalDate < today) {
        newErrors.renewalDate = 'Renewal date cannot be in the past';
      }
    }

    return newErrors;
  };

  const handleNaturalLanguageParse = async () => {
    if (!naturalInput.trim()) {
      setErrors({ natural: 'Please enter a description of your subscription' });
      return;
    }

    if (!apiKey.trim()) {
      setErrors({ apiKey: 'OpenAI API key is required for natural language parsing' });
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      // Parse the natural language input
      const parsedData = await nlpService.parseServiceInput(naturalInput, apiKey);
      
      // Fill the form with parsed data
      setFormData(parsedData);
      setInputMode('manual'); // Switch to manual mode to show parsed data
      
    } catch (error) {
      setErrors({ natural: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputMode === 'natural') {
      handleNaturalLanguageParse();
      return;
    }
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const serviceData = {
      name: formData.name.trim(),
      cost: parseFloat(formData.cost),
      currency: formData.currency,
      renewalDate: formData.renewalDate,
      frequency: formData.frequency,
      tags: formData.tags.trim(),
      status: 'active'
    };

    onSubmit(serviceData);
  };

  return (
    <div className="add-service">
      <h3>Add New Service</h3>
      
      {/* Mode Toggle */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #e0e0e0', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setInputMode('natural')}
            style={{
              padding: '8px 16px',
              border: '1px solid #007AFF',
              background: inputMode === 'natural' ? '#007AFF' : 'transparent',
              color: inputMode === 'natural' ? 'white' : '#007AFF',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Natural Language
          </button>
          <button
            type="button"
            onClick={() => setInputMode('manual')}
            style={{
              padding: '8px 16px',
              border: '1px solid #007AFF',
              background: inputMode === 'manual' ? '#007AFF' : 'transparent',
              color: inputMode === 'manual' ? 'white' : '#007AFF',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Manual Form
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {inputMode === 'natural' ? (
          <>
            {/* API Key Input */}
            <div className="form-group">
              <label className="form-label">OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="form-input"
                placeholder="sk-..."
              />
              {errors.apiKey && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.apiKey}</div>}
            </div>

            {/* Natural Language Input */}
            <div className="form-group">
              <label className="form-label">Describe Your Subscription</label>
              <textarea
                value={naturalInput}
                onChange={(e) => setNaturalInput(e.target.value)}
                className="form-input"
                placeholder="e.g., Subscribe to Netflix on June 15th, 2025, paying $15.99 monthly #entertainment #streaming"
                rows={3}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
              {errors.natural && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.natural}</div>}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Include service name, cost, currency, specific renewal date, frequency, and optional hashtags
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Manual Form Fields */}
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
          {errors.name && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.name}</div>}
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
            {errors.cost && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.cost}</div>}
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
            {errors.renewalDate && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.renewalDate}</div>}
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
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isProcessing}>
            {inputMode === 'natural' && !formData.name ? 
              (isProcessing ? 'Processing...' : 'Parse') : 
              'Add Service'
            }
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddServiceForm;