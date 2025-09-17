import React, { useState, useEffect } from 'react';
import nlpService from '../services/nlpService';

const { ipcRenderer } = window.require('electron');

function AddServiceForm({ onSubmit, onCancel, initialData, initialError, onDataUsed }) {
  const [inputMode, setInputMode] = useState('natural'); // 'natural', 'manual', or 'screenshot'
  const [naturalInput, setNaturalInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasStoredApiKey, setHasStoredApiKey] = useState(false);
  
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
    loadStoredApiKey();
    
    // Handle initial data from drag-and-drop
    if (initialData) {
      setFormData(initialData);
      setInputMode('manual'); // Switch to manual to show the parsed data
      if (onDataUsed) {
        onDataUsed(); // Mark the data as used
      }
    }
    
    // Handle initial error from drag-and-drop
    if (initialError) {
      setErrors({ screenshot: initialError });
      setInputMode('screenshot'); // Switch to screenshot tab to show the error
      if (onDataUsed) {
        onDataUsed(); // Mark the error as handled
      }
    }
  }, [initialData, initialError, onDataUsed]);

  const loadStoredApiKey = async () => {
    try {
      const storedKey = await ipcRenderer.invoke('get-setting', 'openai_api_key');
      if (storedKey) {
        setApiKey(storedKey);
        setHasStoredApiKey(true);
      }
    } catch (error) {
      console.error('Error loading stored API key:', error);
    }
  };

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

  const handleImageUpload = (file) => {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ screenshot: 'Please upload a PNG, JPEG, JPG, or WEBP file' });
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setErrors({ screenshot: 'File size must be less than 50MB' });
      return;
    }

    // Convert to base64 for OpenAI API
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage({
        file,
        dataUrl: e.target.result,
        name: file.name
      });
      setErrors({});
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleImageUpload(files[0]);
    }
  };

  const handleScreenshotParse = async () => {
    if (!uploadedImage) {
      setErrors({ screenshot: 'Please upload a screenshot first' });
      return;
    }

    if (!apiKey.trim()) {
      setErrors({ apiKey: 'OpenAI API key is required for screenshot processing' });
      return;
    }

    setIsProcessing(true);
    setErrors({});

    try {
      // Parse the screenshot using OpenAI Vision API
      const parsedData = await nlpService.parseScreenshot(uploadedImage.dataUrl, apiKey);
      
      // Fill the form with parsed data
      setFormData(parsedData);
      setInputMode('manual'); // Switch to manual mode to show parsed data
      
    } catch (error) {
      setErrors({ screenshot: error.message });
      // Fall back to natural language input
      setInputMode('natural');
    } finally {
      setIsProcessing(false);
    }
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
    
    if (inputMode === 'screenshot') {
      handleScreenshotParse();
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
      
      {/* Success message for drag-and-drop */}
      {initialData && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          borderRadius: '6px',
          backgroundColor: '#f0fff4',
          border: '1px solid #28a745',
          fontSize: '14px',
          color: '#28a745'
        }}>
          ✅ Screenshot processed successfully! Review the details below and click "Add Service" to save.
        </div>
      )}
      
      {/* Error message for drag-and-drop */}
      {initialError && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          borderRadius: '6px',
          backgroundColor: '#fff5f5',
          border: '1px solid #dc3545',
          fontSize: '14px',
          color: '#dc3545'
        }}>
          ❌ Screenshot processing failed: {initialError}. Please try using the natural language input below.
        </div>
      )}
      
      {/* Mode Toggle */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid #e0e0e0', paddingBottom: '15px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setInputMode('screenshot')}
            style={{
              padding: '8px 16px',
              border: '1px solid #007AFF',
              background: inputMode === 'screenshot' ? '#007AFF' : 'transparent',
              color: inputMode === 'screenshot' ? 'white' : '#007AFF',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Upload Screenshot
          </button>
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
              {hasStoredApiKey ? (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #007AFF',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#007AFF'
                }}>
                  ✓ Using stored API key from Settings
                </div>
              ) : (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="form-input"
                  placeholder="sk-... (or set in Settings)"
                />
              )}
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
        ) : inputMode === 'screenshot' ? (
          <>
            {/* API Key Input */}
            <div className="form-group">
              <label className="form-label">OpenAI API Key</label>
              {hasStoredApiKey ? (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #007AFF',
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: '#007AFF'
                }}>
                  ✓ Using stored API key from Settings
                </div>
              ) : (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="form-input"
                  placeholder="sk-... (or set in Settings)"
                />
              )}
              {errors.apiKey && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.apiKey}</div>}
            </div>

            {/* Screenshot Upload Area */}
            <div className="form-group">
              <label className="form-label">Upload Receipt Screenshot</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${isDragOver ? '#007AFF' : '#ccc'}`,
                  borderRadius: '8px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  backgroundColor: isDragOver ? '#f0f8ff' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => document.getElementById('screenshot-upload').click()}
              >
                {uploadedImage ? (
                  <div>
                    <div style={{ marginBottom: '15px' }}>
                      <img 
                        src={uploadedImage.dataUrl} 
                        alt="Uploaded screenshot" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px', 
                          objectFit: 'contain',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }} 
                      />
                    </div>
                    <div style={{ fontSize: '14px', color: '#333', marginBottom: '5px' }}>
                      📷 {uploadedImage.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Click to replace or drag a new image here
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
                    <div style={{ fontSize: '16px', color: '#333', marginBottom: '5px' }}>
                      Drop your receipt screenshot here
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '10px' }}>
                      or click to browse files
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      Supports PNG, JPEG, WEBP up to 50MB
                    </div>
                  </div>
                )}
              </div>
              <input
                id="screenshot-upload"
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              {errors.screenshot && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '4px' }}>{errors.screenshot}</div>}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Upload a screenshot of your subscription receipt. AI will extract service name, cost, renewal date, and other details automatically.
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
            {(inputMode === 'natural' || inputMode === 'screenshot') && !formData.name ? 
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