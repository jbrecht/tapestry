import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Project {
  id: string;
  name: string;
  updated_at: string;
  data?: any;
  nodes?: any[];
  edges?: any[];
  messages?: any[];
  activePerspective?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = 'http://localhost:3000/projects';

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders() {
    const token = this.authService.getToken();
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }

  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  createProject(name: string, data: any = {}): Observable<Project> {
    return this.http.post<Project>(this.apiUrl, { name, data }, { headers: this.getHeaders() });
  }

  getProject(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  updateProject(id: string, name: string | undefined, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, { name, data }, { headers: this.getHeaders() });
  }

  deleteProject(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }
}
