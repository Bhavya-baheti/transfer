// src/app/services/chat.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  chunkIds?: string[];
  meta?: any;
}

export interface ChatResponse {
  answer: string;
  chunks: Array<{
    _id: string;
    text: string;
    score: number;
  }>;
  history: ChatMessage[];
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:4000/api/chat';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders().set('x-auth-token', token || '');
  }

  async queryDocument(documentId: string, query: string, topN: number = 8): Promise<ChatResponse> {
    const res: any = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/query`,
        { documentId, query, topN },
        { headers: this.getHeaders() }
      )
    );
    return res;
  }

  async getChatHistory(documentId: string): Promise<ChatMessage[]> {
    const res: any = await firstValueFrom(
      this.http.get(`${this.baseUrl}/history?documentId=${documentId}`, {
        headers: this.getHeaders()
      })
    );
    return res.messages || [];
  }

  async clearChatHistory(documentId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.baseUrl}/history?documentId=${documentId}`, {
        headers: this.getHeaders()
      })
    );
  }
}
