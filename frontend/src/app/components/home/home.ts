// src/app/home/home.ts
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ChatService, ChatMessage } from '../../services/chat';
 
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class Home {
  private router = inject(Router);
  private http = inject(HttpClient);
  private chatService = inject(ChatService);
 
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
 
  uploadedFiles: Array<{ originalName: string; path: string }> = [];
  uploadMessage = '';
 
  // Store selected files here as an array
  selectedFiles: File[] | null = null;

  // chat state
  showChat = false;
  activeDoc: { originalName: string; path: string; filename?: string; _id?: string } | null = null;
  indexStatus = '';
  messages: ChatMessage[] = [];
  prompt = '';
  isLoading = false;
 
  ngOnInit() {
    this.loadUserDocuments();
  }
 
  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }
 
  onFileSelected(event: any) {
    // Convert FileList to array
    this.selectedFiles = Array.from(event.target.files);
  }
 
  uploadFiles() {
    if (!this.selectedFiles || this.selectedFiles.length === 0) {
      this.uploadMessage = 'Please select PDF(s) to upload.';
      return;
    }
 
    const token = localStorage.getItem('token');
    if (!token) {
      this.uploadMessage = 'Please login first';
      this.router.navigateByUrl('/login');
      return;
    }
 
    const formData = new FormData();
    for (const file of this.selectedFiles) {
      formData.append('files', file, file.name);
    }
 
    const headers = new HttpHeaders().set('x-auth-token', token);
 
    this.http.post('http://localhost:4000/api/upload', formData, { headers }).subscribe({
      next: (res: any) => {
        this.uploadMessage = 'PDF(s) uploaded successfully!';
        this.loadUserDocuments();
        this.selectedFiles = null;
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
      },
      error: (err) => {
        this.uploadMessage = err?.error?.message || 'Error uploading PDF(s).';
        console.error('Upload error', err);
      }
    });
  }
 
  loadUserDocuments() {
    const token = localStorage.getItem('token');
    if (!token) return;
 
    const headers = new HttpHeaders().set('x-auth-token', token);
    this.http.get('http://localhost:4000/api/upload', { headers }).subscribe({
      next: (res: any) => {
        this.uploadedFiles = res.documents || [];
      },
      error: (err) => {
        console.error('Could not load documents', err);
      }
    });
  }
 
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    this.router.navigateByUrl('/login');
  }
 
  // Method to convert FileList to an array
  getSelectedFilesArray(): File[] {
    return this.selectedFiles ? this.selectedFiles : [];
  }

  async startChatWithDocument(doc: any) {
    this.showChat = true;
    this.activeDoc = { ...doc, _id: doc._id || doc.filename }; // Use _id or filename as documentId
    this.indexStatus = 'Indexing...';
    this.messages = [];
    
    const token = localStorage.getItem('token');
    if (!token) {
      this.indexStatus = 'Please login first';
      return;
    }
    
    const headers = new HttpHeaders().set('x-auth-token', token);
    // filename is last segment of path
    const parts = (doc.path || '').split('/');
    const filename = parts[parts.length - 1];
    if (this.activeDoc) {
      this.activeDoc.filename = filename;
    }
    
    this.http.post('http://localhost:4000/api/indexer/index', { filename }, { headers }).subscribe({
      next: async (res: any) => {
        this.indexStatus = `Indexed ${res.chunks} chunks`;
        // Load existing chat history after indexing
        if (this.activeDoc?._id) {
          try {
            this.messages = await this.chatService.getChatHistory(this.activeDoc._id);
          } catch (err) {
            console.error('Failed to load chat history:', err);
          }
        }
      },
      error: (err) => {
        this.indexStatus = err?.error?.message || 'Index failed';
      }
    });
  }

  async sendPrompt() {
    if (!this.prompt.trim() || !this.activeDoc?._id || this.isLoading) return;
    
    const userMessage = this.prompt.trim();
    this.prompt = '';
    this.isLoading = true;
    
    // Add user message to UI immediately
    this.messages.push({ role: 'user', content: userMessage });
    
    try {
      const response = await this.chatService.queryDocument(this.activeDoc._id, userMessage);
      
      // Add assistant response
      this.messages.push({ role: 'assistant', content: response.answer });
      
      // Update messages with the full history from server
      this.messages = response.history;
      
    } catch (err: any) {
      console.error('Chat error:', err);
      this.messages.push({ 
        role: 'assistant', 
        content: `Error: ${err?.error?.message || 'Failed to get response'}` 
      });
    } finally {
      this.isLoading = false;
    }
  }

  async clearChatHistory() {
    if (!this.activeDoc?._id) return;
    
    try {
      await this.chatService.clearChatHistory(this.activeDoc._id);
      this.messages = [];
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  }
}
 