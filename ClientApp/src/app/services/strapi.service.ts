// src/app/services/strapi.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ProUser } from '../models/pro-user'

@Injectable({
  providedIn: 'root',
})

export class StrapiService {
  private apiUrl = 'https://strapiportal.promaster.com/api/staff-members?populate=*'; // Replace with your Strapi URL

  constructor(private http: HttpClient) { }

  getStaffMember(): Observable<ProUser[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response =>
        response.data.map((item: any) => ({
          id: item.id,
          name: item.attributes.name ,
          title: item.attributes.title,
          imageUrl: item.attributes.photo?.data?.attributes?.url
            ? item.attributes.photo.data.attributes.url
            : 'assets/default-avatar.png',
          department: item.attributes.department?.data?.attributes?.name || 'N/A'
        }))
      )
    );
  }
}

