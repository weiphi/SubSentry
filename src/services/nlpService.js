class NLPService {
  async parseServiceInput(inputText, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      // Use IPC to call the main process
      const { ipcRenderer } = window.require('electron');
      const parsedData = await ipcRenderer.invoke('parse-natural-language', {
        inputText,
        apiKey
      });
      
      return parsedData;
      
    } catch (error) {
      console.error('NLP parsing error:', error);
      throw new Error(error.message || 'Sorry, couldn\'t parse that. Please try again or use the manual form.');
    }
  }

  async parseScreenshot(imageDataUrl, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    if (!imageDataUrl) {
      throw new Error('Image data is required');
    }

    try {
      // Use IPC to call the main process
      const { ipcRenderer } = window.require('electron');
      const parsedData = await ipcRenderer.invoke('parse-screenshot', {
        imageDataUrl,
        apiKey
      });
      
      return parsedData;
      
    } catch (error) {
      console.error('Screenshot parsing error:', error);
      throw new Error(error.message || 'Sorry, couldn\'t parse that screenshot. Please try the natural language input instead.');
    }
  }
}

// Export singleton instance
const nlpService = new NLPService();
export default nlpService;