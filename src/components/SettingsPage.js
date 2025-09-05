import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

function SettingsPage({ onBack }) {
  const [apiKey, setApiKey] = useState('');
  const [maskedApiKey, setMaskedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load API key
      const storedApiKey = await ipcRenderer.invoke('get-setting', 'openai_api_key');
      if (storedApiKey) {
        setHasApiKey(true);
        setMaskedApiKey(maskApiKey(storedApiKey));
        setApiKey(storedApiKey);
      }

      // Load auto-launch setting
      const autoLaunchStatus = await ipcRenderer.invoke('get-auto-launch-status');
      setAutoLaunch(autoLaunchStatus);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const maskApiKey = (key) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 7) + '*'.repeat(Math.max(8, key.length - 7));
  };

  const handleApiKeyChange = async (newKey) => {
    setApiKey(newKey);
    setTestResult(null);

    if (newKey.trim()) {
      // Auto-save and test the key
      try {
        await ipcRenderer.invoke('set-setting', 'openai_api_key', newKey.trim());
        setHasApiKey(true);
        setMaskedApiKey(maskApiKey(newKey.trim()));
        
        // Test the API key
        await testApiKey(newKey.trim());
      } catch (error) {
        console.error('Error saving API key:', error);
      }
    } else {
      // Clear the API key
      try {
        await ipcRenderer.invoke('delete-setting', 'openai_api_key');
        setHasApiKey(false);
        setMaskedApiKey('');
        setTestResult(null);
      } catch (error) {
        console.error('Error deleting API key:', error);
      }
    }
  };

  const testApiKey = async (keyToTest) => {
    setIsTestingApi(true);
    try {
      const result = await ipcRenderer.invoke('test-api-key', keyToTest);
      setTestResult({
        success: true,
        message: 'API key is working!',
        haiku: result.haiku
      });
    } catch (error) {
      let errorMessage = 'API key test failed.';
      let showBillingLink = false;
      
      if (error.message.includes('insufficient_quota') || error.message.includes('billing')) {
        errorMessage = 'Your OpenAI account needs credits to use the API.';
        showBillingLink = true;
      } else if (error.message.includes('invalid_api_key')) {
        errorMessage = 'Invalid API key. Please check your key and try again.';
      }
      
      setTestResult({
        success: false,
        message: errorMessage,
        showBillingLink
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  const handleAutoLaunchToggle = async (enabled) => {
    try {
      await ipcRenderer.invoke('set-auto-launch', enabled);
      setAutoLaunch(enabled);
    } catch (error) {
      console.error('Error setting auto-launch:', error);
    }
  };

  const handleDeleteApiKey = async () => {
    try {
      await ipcRenderer.invoke('delete-setting', 'openai_api_key');
      setApiKey('');
      setMaskedApiKey('');
      setHasApiKey(false);
      setTestResult(null);
      setShowApiKey(false);
    } catch (error) {
      console.error('Error deleting API key:', error);
    }
  };

  return (
    <div className="settings-page" style={{ padding: '20px', height: '100vh', overflow: 'auto' }}>
      {/* Back button */}
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: '#007AFF',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0'
          }}
        >
          ← Back
        </button>
      </div>

      {/* Page Title */}
      <h2 style={{ marginBottom: '30px', fontSize: '24px' }}>Settings</h2>

      {/* API Configuration Section */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          marginBottom: '15px',
          borderBottom: '1px solid #e0e0e0',
          paddingBottom: '8px'
        }}>
          API Configuration
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            OpenAI API Key
          </label>
          
          {hasApiKey && !showApiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                value={maskedApiKey}
                readOnly
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: '#f5f5f5',
                  flex: 1
                }}
              />
              <button
                onClick={() => setShowApiKey(true)}
                style={{
                  padding: '8px 12px',
                  background: '#007AFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Edit
              </button>
              <button
                onClick={handleDeleteApiKey}
                style={{
                  padding: '8px 12px',
                  background: '#ff3b30',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Delete
              </button>
            </div>
          ) : (
            <div>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="sk-..."
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '100%',
                  marginBottom: '8px'
                }}
              />
              {hasApiKey && (
                <button
                  onClick={() => {
                    setShowApiKey(false);
                    setApiKey('');
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          )}
          
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Used for parsing subscription details from natural language and screenshots
          </div>

          {/* API Test Results */}
          {isTestingApi && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: '#f0f8ff',
              border: '1px solid #007AFF'
            }}>
              <div style={{ fontSize: '14px', color: '#007AFF' }}>
                Testing API key...
              </div>
            </div>
          )}

          {testResult && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: testResult.success ? '#f0fff4' : '#fff5f5',
              border: `1px solid ${testResult.success ? '#28a745' : '#dc3545'}`
            }}>
              <div style={{ 
                fontSize: '14px', 
                color: testResult.success ? '#28a745' : '#dc3545',
                marginBottom: testResult.success ? '8px' : '0'
              }}>
                {testResult.message}
              </div>
              
              {testResult.success && testResult.haiku && (
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  fontStyle: 'italic',
                  whiteSpace: 'pre-line'
                }}>
                  {testResult.haiku}
                </div>
              )}
              
              {testResult.showBillingLink && (
                <div style={{ marginTop: '8px' }}>
                  <a 
                    href="https://platform.openai.com/settings/organization/billing/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#007AFF', fontSize: '12px' }}
                  >
                    Add credits to your OpenAI account →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Application Settings Section */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ 
          fontSize: '18px', 
          marginBottom: '15px',
          borderBottom: '1px solid #e0e0e0',
          paddingBottom: '8px'
        }}>
          Application Settings
        </h3>
        
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                Launch app on startup
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>
                Automatically start SubSentry when you log in
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px' }}>
              <input
                type="checkbox"
                checked={autoLaunch}
                onChange={(e) => handleAutoLaunchToggle(e.target.checked)}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: autoLaunch ? '#007AFF' : '#ccc',
                borderRadius: '24px',
                transition: '0.2s'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '',
                  height: '18px',
                  width: '18px',
                  left: autoLaunch ? '26px' : '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.2s'
                }} />
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;