import axiosClient from '../api/axiosClient';

const draftingApi = {
  processDocument: async (title, contentHtml, draftId = null) => {
    try {
      const payload = {
        title,
        content_html: contentHtml,
        content_text: contentHtml.replace(/<[^>]*>?/gm, ''), // Basic HTML to text conversion
      };
      if (draftId) {
        payload.draft_id = String(draftId);
      }
      const response = await axiosClient.post('/draft/process', payload);
      return response.data;
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  },

  sendChat: async (message, documentContext, draftId = null) => {
    try {
      const payload = {
        message,
        document_context: documentContext,
      };
      if (draftId) {
        payload.draft_id = String(draftId);
      }
      const response = await axiosClient.post('/draft/chat', payload, {
        timeout: 120000 // 120 seconds for complex legal drafting
      });
      return response.data;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  },

  getChatHistory: async (draftId) => {
    try {
      const response = await axiosClient.get(`/draft/history/${draftId}/messages`);
      return response.data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  },

  getDraftHistory: async () => {
    try {
      const response = await axiosClient.get('/draft/history');
      return response.data;
    } catch (error) {
      console.error('Error fetching draft history:', error);
      throw error;
    }
  },

  getDraftContent: async (draftId) => {
    try {
      const response = await axiosClient.get(`/draft/history/${draftId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching draft content:', error);
      throw error;
    }
  },

  getDraftVersions: async (draftId) => {
    try {
      const response = await axiosClient.get(`/draft/history/${draftId}/versions`);
      return response.data;
    } catch (error) {
      console.error('Error fetching draft versions:', error);
      throw error;
    }
  },

  restoreDraftVersion: async (draftId, versionId) => {
    try {
      const response = await axiosClient.post(`/draft/history/${draftId}/restore/${versionId}`);
      return response.data;
    } catch (error) {
      console.error('Error restoring draft version:', error);
      throw error;
    }
  },

  renameDraft: async (draftId, newTitle) => {
    try {
      const response = await axiosClient.patch(`/draft/history/${draftId}`, {
        title: newTitle,
      });
      return response.data;
    } catch (error) {
      console.error('Error renaming draft:', error);
      throw error;
    }
  },
  
  deleteDraft: async (draftId) => {
    try {
      const response = await axiosClient.delete(`/draft/history/${draftId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  },

  getTemplates: async () => {
    try {
      const response = await axiosClient.get('/draft/templates');
      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  },

  getTemplateContent: async (templateId) => {
    try {
      const response = await axiosClient.get(`/draft/templates/${templateId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching template content:', error);
      throw error;
    }
  },
};

export default draftingApi;
