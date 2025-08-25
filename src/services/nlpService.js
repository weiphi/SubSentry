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
}

// Export singleton instance
const nlpService = new NLPService();
export default nlpService;