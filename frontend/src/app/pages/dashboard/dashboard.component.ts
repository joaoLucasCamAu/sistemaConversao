import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { CatalogService } from '../../services/catalog.service';
import { DashboardData } from '../../models/catalog.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    TableModule,
    TagModule,
    ProgressBarModule,
    ButtonModule,
  ],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Visão Geral do Catálogo</h1>
          <p class="text-sm text-slate-500">
            Indicadores de produtos, atributos técnicos, fontes documentais e equivalências.
          </p>
        </div>
        @if (data()) {
          <p-tag
            [value]="'Fonte: ' + (data()!.source === 'postgres' ? 'PostgreSQL / Supabase' : 'CSV Local')"
            [severity]="data()!.source === 'postgres' ? 'success' : 'info'"
          />
        }
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse p-5"></div>
          }
        </div>
      } @else if (error()) {
        <div class="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <i class="pi pi-exclamation-triangle mr-2"></i>
          {{ error() }}
        </div>
      } @else if (data()) {
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Produtos</span>
              <span class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <i class="pi pi-box"></i>
              </span>
            </div>
            <div class="mt-3 text-3xl font-bold text-slate-900">{{ data()!.kpis.totalProdutos }}</div>
            <p class="mt-1 text-xs text-slate-500">
              {{ data()!.kpis.totalAtributos }} atributos técnicos mapeados
            </p>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Equivalências</span>
              <span class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <i class="pi pi-arrows-h"></i>
              </span>
            </div>
            <div class="mt-3 text-3xl font-bold text-slate-900">{{ data()!.kpis.totalEquivalencias }}</div>
            <p class="mt-1 text-xs text-emerald-600 font-medium">
              {{ data()!.kpis.equivalenciasAprovadas }} aprovadas / com ressalvas
            </p>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Fabricantes</span>
              <span class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <i class="pi pi-building"></i>
              </span>
            </div>
            <div class="mt-3 text-3xl font-bold text-slate-900">{{ data()!.kpis.totalFabricantes }}</div>
            <p class="mt-1 text-xs text-slate-500">
              {{ data()!.kpis.totalCategorias }} subcategorias industriais
            </p>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Documentação</span>
              <span class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <i class="pi pi-file-pdf"></i>
              </span>
            </div>
            <div class="mt-3 text-3xl font-bold text-slate-900">{{ data()!.kpis.totalFontes }}</div>
            <p class="mt-1 text-xs text-slate-500">Datasheets, manuais e páginas oficiais</p>
          </div>
        </div>

        <!-- Charts / Distributions -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-base font-semibold text-slate-800 mb-4">Produtos por Fabricante (Top 10)</h3>
            <div class="space-y-3">
              @for (item of data()!.produtosPorFabricante; track item.name) {
                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>{{ item.name }}</span>
                    <span>{{ item.count }}</span>
                  </div>
                  <p-progressbar
                    [value]="percent(item.count, data()!.kpis.totalProdutos)"
                    [showValue]="false"
                    styleClass="h-2"
                  />
                </div>
              }
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 class="text-base font-semibold text-slate-800 mb-4">Produtos por Categoria</h3>
            <div class="space-y-3">
              @for (item of data()!.produtosPorCategoria; track item.name) {
                <div>
                  <div class="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>{{ item.name }}</span>
                    <span>{{ item.count }}</span>
                  </div>
                  <p-progressbar
                    [value]="percent(item.count, data()!.kpis.totalProdutos)"
                    [showValue]="false"
                    styleClass="h-2"
                  />
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Recent Equivalences -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-semibold text-slate-800">Equivalências Recentes</h3>
            <a
              routerLink="/equivalencias"
              class="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Ver todas →
            </a>
          </div>
          <p-table [value]="data()!.recentEquivalencias" [tableStyle]="{ 'min-width': '48rem' }">
            <ng-template #header>
              <tr>
                <th>ID</th>
                <th>Concorrente</th>
                <th>Candidato</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Responsável</th>
              </tr>
            </ng-template>
            <ng-template #body let-eq>
              <tr>
                <td class="font-mono text-xs font-semibold">{{ eq.id_equivalencia }}</td>
                <td>
                  <div class="text-xs font-semibold text-slate-800">{{ eq.fabricante_concorrente }}</div>
                  <div class="text-xs text-slate-500 font-mono">{{ eq.codigo_concorrente }}</div>
                </td>
                <td>
                  <div class="text-xs font-semibold text-blue-700">{{ eq.fabricante_candidato }}</div>
                  <div class="text-xs text-slate-500 font-mono">{{ eq.codigo_candidato }}</div>
                </td>
                <td class="text-xs">{{ eq.categoria }}</td>
                <td>
                  <p-tag [value]="eq.status_da_equivalencia" [severity]="statusSeverity(eq.status_da_equivalencia)" />
                </td>
                <td class="text-xs text-slate-600">{{ eq.responsavel_tecnico || '-' }}</td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private catalog = inject(CatalogService);
  data = signal<DashboardData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.catalog.getDashboard().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Não foi possível conectar ao backend (http://localhost:3001). Verifique se o servidor Node.js está em execução.');
        this.loading.set(false);
      },
    });
  }

  percent(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }

  statusSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' {
    switch (status) {
      case 'Aprovado':
        return 'success';
      case 'Aprovado com ressalvas':
        return 'warn';
      case 'Rejeitado':
        return 'danger';
      case 'Candidato identificado':
        return 'info';
      default:
        return 'secondary';
    }
  }
}
