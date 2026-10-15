// src/app/services/integration.service.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

/* Outgoing message statuses, as stored. */
export type IntegrationStatus =
  'QUEUED' | 'SENT' | 'ACKNOWLEDGED' | 'REJECTED' | 'FAILED' | 'OVERDUE' | 'SUPERSEDED' | 'CANCELLED';

export interface IntegrationSummaryRow {
  domain: string;
  destination: string;
  displayName: string;
  isActive: boolean;
  queued: number;
  awaitingAnswer: number;
  overdue: number;
  rejected: number;
  failed: number;
  acknowledgedToday: number;
}

export interface IntegrationMessageRow {
  messageId: number;
  correlationId: string;
  domain: string;
  entityId: string;
  entityLabel?: string | null;
  destination: string;
  operation: string;
  status: IntegrationStatus;
  attempts: number;
  createdAt: string;
  createdBy: string;
  sentAt?: string | null;
  dueBy?: string | null;
  respondedAt?: string | null;
  externalId?: string | null;
  lastError?: string | null;
}

export interface IntegrationResponseRow {
  responseId: number;
  responseType: string;
  result?: string | null;
  reasonCode?: string | null;
  message?: string | null;
  externalId?: string | null;
  respondedAt: string;
  receivedAt: string;
  body: string;
}

export interface IntegrationEventRow {
  eventId: number;
  eventType: string;
  actor: string;
  reason?: string | null;
  at: string;
}

export interface IntegrationMessageDetail extends IntegrationMessageRow {
  contractVersion: string;
  payload: string;
  payloadSha256: string;
  nextAttemptAt?: string | null;
  responses: IntegrationResponseRow[];
  events: IntegrationEventRow[];
}

export interface IntegrationSearch {
  domain?: string;
  destination?: string;
  status?: string;   // empty = everything that needs a person
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface IntegrationActionResult {
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class IntegrationService {
  constructor(private api: ApiService) {}

  summary(): Observable<IntegrationSummaryRow[]> {
    return this.api.get<IntegrationSummaryRow[]>('api/integration/summary');
  }

  search(s: IntegrationSearch): Observable<{ total: number; rows: IntegrationMessageRow[] }> {
    const p = new URLSearchParams();
    if (s.domain) p.set('domain', s.domain);
    if (s.destination) p.set('destination', s.destination);
    if (s.status) p.set('status', s.status);
    if (s.q) p.set('q', s.q);
    p.set('page', String(s.page ?? 1));
    p.set('pageSize', String(s.pageSize ?? 50));
    return this.api.get(`api/integration/messages?${p.toString()}`);
  }

  get(messageId: number): Observable<IntegrationMessageDetail> {
    return this.api.get<IntegrationMessageDetail>(`api/integration/messages/${messageId}`);
  }

  resend(messageId: number, reason: string): Observable<IntegrationActionResult> {
    return this.api.post<IntegrationActionResult>(`api/integration/messages/${messageId}/resend`, { reason });
  }

  cancel(messageId: number, reason: string): Observable<IntegrationActionResult> {
    return this.api.post<IntegrationActionResult>(`api/integration/messages/${messageId}/cancel`, { reason });
  }

  dispatchNow(): Observable<{ sent: number }> {
    return this.api.post<{ sent: number }>('api/integration/dispatch', {});
  }
}
