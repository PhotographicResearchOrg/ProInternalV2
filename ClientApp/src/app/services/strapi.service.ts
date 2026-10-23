// src/app/services/strapi.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProUser } from '../models/pro-user'

@Injectable({
  providedIn: 'root',
})

export class StrapiService {
  /* the same Strapi the B2B site reads its staff page from (staff-members, photo populated) */
  private readonly strapiBase = 'https://strapiportal.promaster.com';
  private apiUrl = `${this.strapiBase}/api/staff-members?populate=*`;

  constructor(private http: HttpClient) { }

  getStaffMember(): Observable<ProUser[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response =>
        response.data.map((item: any) => ({
          id: item.id,
          name: item.attributes.name ,
          title: item.attributes.title,
          email: item.attributes.email,
          /* smallest rendition that's still sharp at 52px; Strapi returns /uploads/... when files are stored locally */
          imageUrl: this.absolute(
            item.attributes.photo?.data?.attributes?.formats?.thumbnail?.url
            || item.attributes.photo?.data?.attributes?.formats?.small?.url
            || item.attributes.photo?.data?.attributes?.url) || '',
          department: item.attributes.department?.data?.attributes?.name || 'N/A'
        }))
      )
    );
  }

  private absolute(url?: string | null): string | null {
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : `${this.strapiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  }
}

