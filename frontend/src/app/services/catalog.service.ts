import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Categoria,
  ComparacaoResponse,
  DashboardData,
  Equivalencia,
  Fabricante,
  Produto,
  ProdutoDetailResponse,
} from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3001/api';

  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${this.apiUrl}/dashboard`);
  }

  getFabricantes(): Observable<Fabricante[]> {
    return this.http.get<Fabricante[]>(`${this.apiUrl}/fabricantes`);
  }

  getCategorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${this.apiUrl}/categorias`);
  }

  getProdutos(filters: {
    search?: string;
    fabricante?: string;
    categoria?: string;
    status_do_produto?: string;
    status_da_coleta?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<{ total: number; page: number; limit: number; items: Produto[] }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<{ total: number; page: number; limit: number; items: Produto[] }>(
      `${this.apiUrl}/produtos`,
      { params }
    );
  }

  getProdutoById(id: string): Observable<ProdutoDetailResponse> {
    return this.http.get<ProdutoDetailResponse>(`${this.apiUrl}/produtos/${encodeURIComponent(id)}`);
  }

  getEquivalencias(filters: {
    search?: string;
    status?: string;
    categoria?: string;
  } = {}): Observable<{ total: number; items: Equivalencia[] }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<{ total: number; items: Equivalencia[] }>(
      `${this.apiUrl}/equivalencias`,
      { params }
    );
  }

  createEquivalencia(payload: Partial<Equivalencia>): Observable<Equivalencia> {
    return this.http.post<Equivalencia>(`${this.apiUrl}/equivalencias`, payload);
  }

  updateEquivalencia(id: string, payload: Partial<Equivalencia>): Observable<Equivalencia> {
    return this.http.patch<Equivalencia>(
      `${this.apiUrl}/equivalencias/${encodeURIComponent(id)}`,
      payload
    );
  }

  compararProdutos(concorrente: string, candidato: string): Observable<ComparacaoResponse> {
    const params = new HttpParams()
      .set('concorrente', concorrente)
      .set('candidato', candidato);
    return this.http.get<ComparacaoResponse>(`${this.apiUrl}/comparar`, { params });
  }
}
