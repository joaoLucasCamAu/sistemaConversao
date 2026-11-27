import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TextareaModule } from 'primeng/textarea';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { CatalogService } from '../../services/catalog.service';
import { Equivalencia, Produto } from '../../models/catalog.models';

@Component({
  selector: 'app-equivalencias',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DialogModule,
    TextareaModule,
    IconFieldModule,
    InputIconModule,
  ],
  template: `
    <div class="space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Conversão &amp; Equivalências</h1>
          <p class="text-sm text-slate-500">
            Mapeamento de substituição entre produtos concorrentes e candidatos LS Electric / SICK.
          </p>
        </div>
        <p-button
          label="Nova Equivalência"
          icon="pi pi-plus"
          (onClick)="openCreateDialog()"
        />
      </div>

      <!-- Filtros -->
      <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <p-iconfield>
          <p-inputicon styleClass="pi pi-search" />
          <input
            pInputText
            type="text"
            [(ngModel)]="search"
            (ngModelChange)="loadEquivalencias()"
            placeholder="Buscar código, fabricante, responsável..."
            class="w-full"
          />
        </p-iconfield>

        <p-select
          [options]="statusOptions"
          [(ngModel)]="selectedStatus"
          (ngModelChange)="loadEquivalencias()"
          placeholder="Filtrar por status"
          [showClear]="true"
          class="w-full"
        />

        <p-button
          label="Limpar filtros"
          icon="pi pi-filter-slash"
          severity="secondary"
          [outlined]="true"
          (onClick)="clearFilters()"
          styleClass="w-full"
        />
      </div>

      <!-- Tabela -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <p-table
          [value]="equivalencias()"
          [loading]="loading()"
          [tableStyle]="{ 'min-width': '72rem' }"
          styleClass="p-datatable-sm"
        >
          <ng-template #header>
            <tr>
              <th>ID</th>
              <th>Concorrente</th>
              <th>Candidato</th>
              <th>Compatibilidade (Téc / Elét / Func / Com)</th>
              <th>Status</th>
              <th>Diferenças &amp; Restrições</th>
              <th class="text-right">Ações</th>
            </tr>
          </ng-template>
          <ng-template #body let-eq>
            <tr class="hover:bg-slate-50">
              <td class="font-mono text-xs font-semibold text-slate-600">{{ eq.id_equivalencia }}</td>
              <td>
                <div class="text-xs font-bold text-slate-800">{{ eq.fabricante_concorrente }}</div>
                <div class="font-mono text-xs text-slate-600">{{ eq.codigo_concorrente }}</div>
                <div class="text-[11px] text-slate-400">{{ eq.id_produto_concorrente }}</div>
              </td>
              <td>
                <div class="text-xs font-bold text-blue-700">{{ eq.fabricante_candidato }}</div>
                <div class="font-mono text-xs text-slate-600">{{ eq.codigo_candidato }}</div>
                <div class="text-[11px] text-slate-400">{{ eq.id_produto_candidato }}</div>
              </td>
              <td>
                <div class="flex flex-wrap gap-1">
                  <p-tag [value]="'Téc: ' + eq.compatibilidade_tecnica" [severity]="compatSeverity(eq.compatibilidade_tecnica)" />
                  <p-tag [value]="'Elét: ' + eq.compatibilidade_eletrica" [severity]="compatSeverity(eq.compatibilidade_eletrica)" />
                  <p-tag [value]="'Func: ' + eq.compatibilidade_funcional" [severity]="compatSeverity(eq.compatibilidade_funcional)" />
                  <p-tag [value]="'Com: ' + eq.compatibilidade_de_comunicacao" [severity]="compatSeverity(eq.compatibilidade_de_comunicacao)" />
                </div>
              </td>
              <td>
                <p-tag [value]="eq.status_da_equivalencia" [severity]="statusSeverity(eq.status_da_equivalencia)" />
                <div class="text-[11px] text-slate-400 mt-1">{{ eq.responsavel_tecnico || '-' }}</div>
              </td>
              <td class="max-w-xs">
                <div class="text-xs text-slate-700 line-clamp-2">{{ eq.diferencas_identificadas || '-' }}</div>
                @if (eq.restricoes_de_aplicacao) {
                  <div class="text-[11px] text-amber-700 mt-0.5 line-clamp-2">
                    <strong>Restrição:</strong> {{ eq.restricoes_de_aplicacao }}
                  </div>
                }
              </td>
              <td class="text-right">
                <p-button
                  label="Comparar"
                  icon="pi pi-sliders-h"
                  size="small"
                  [outlined]="true"
                  (onClick)="comparar(eq)"
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <!-- Modal Nova Equivalência -->
    <p-dialog
      [(visible)]="createVisible"
      [modal]="true"
      [style]="{ width: 'min(95vw, 44rem)' }"
      header="Registrar Nova Equivalência"
    >
      <div class="space-y-4 pt-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Produto Concorrente</label>
            <p-select
              [options]="produtoOptions()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              [(ngModel)]="form.id_produto_concorrente"
              placeholder="Selecione o concorrente"
              class="w-full"
            />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Produto Candidato</label>
            <p-select
              [options]="produtoOptions()"
              optionLabel="label"
              optionValue="value"
              [filter]="true"
              [(ngModel)]="form.id_produto_candidato"
              placeholder="Selecione o candidato"
              class="w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Compat. Técnica</label>
            <p-select [options]="compatOptions" [(ngModel)]="form.compatibilidade_tecnica" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Compat. Elétrica</label>
            <p-select [options]="compatOptions" [(ngModel)]="form.compatibilidade_eletrica" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Compat. Funcional</label>
            <p-select [options]="compatOptions" [(ngModel)]="form.compatibilidade_funcional" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Comunicação</label>
            <p-select [options]="compatOptions" [(ngModel)]="form.compatibilidade_de_comunicacao" class="w-full" />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Status da Equivalência</label>
            <p-select [options]="statusOptions" [(ngModel)]="form.status_da_equivalencia" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Responsável Técnico</label>
            <input pInputText [(ngModel)]="form.responsavel_tecnico" class="w-full" placeholder="Ex: Eng. João Silva" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Diferenças Identificadas</label>
          <textarea pTextarea rows="2" [(ngModel)]="form.diferencas_identificadas" class="w-full"></textarea>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Restrições de Aplicação</label>
          <textarea pTextarea rows="2" [(ngModel)]="form.restricoes_de_aplicacao" class="w-full"></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="createVisible = false" />
          <p-button label="Salvar Equivalência" icon="pi pi-check" (onClick)="saveEquivalencia()" [loading]="saving()" />
        </div>
      </div>
    </p-dialog>
  `,
})
export class EquivalenciasComponent implements OnInit {
  private catalog = inject(CatalogService);
  private router = inject(Router);

  equivalencias = signal<Equivalencia[]>([]);
  loading = signal(false);
  saving = signal(false);

  produtoOptions = signal<{ label: string; value: string; raw: Produto }[]>([]);
  produtosMap = new Map<string, Produto>();

  search = '';
  selectedStatus = '';
  createVisible = false;

  statusOptions = [
    'Aprovado',
    'Aprovado com ressalvas',
    'Candidato identificado',
    'Rejeitado',
    'Não analisado',
  ];

  compatOptions = ['Alta', 'Média', 'Baixa', 'Incompatível', 'Não avaliado'];

  form = {
    id_produto_concorrente: '',
    id_produto_candidato: '',
    compatibilidade_tecnica: 'Alta',
    compatibilidade_eletrica: 'Alta',
    compatibilidade_funcional: 'Alta',
    compatibilidade_de_comunicacao: 'Não avaliado',
    status_da_equivalencia: 'Candidato identificado',
    responsavel_tecnico: '',
    diferencas_identificadas: '',
    restricoes_de_aplicacao: '',
  };

  ngOnInit(): void {
    this.loadEquivalencias();
    this.catalog.getProdutos({ limit: 500 }).subscribe((res) => {
      res.items.forEach((p) => this.produtosMap.set(p.id_produto, p));
      this.produtoOptions.set(
        res.items.map((p) => ({
          label: `${p.fabricante} | ${p.codigo_comercial} (${p.id_produto})`,
          value: p.id_produto,
          raw: p,
        }))
      );
    });
  }

  loadEquivalencias(): void {
    this.loading.set(true);
    this.catalog
      .getEquivalencias({
        search: this.search,
        status: this.selectedStatus || '',
      })
      .subscribe({
        next: (res) => {
          this.equivalencias.set(res.items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  clearFilters(): void {
    this.search = '';
    this.selectedStatus = '';
    this.loadEquivalencias();
  }

  openCreateDialog(): void {
    this.createVisible = true;
  }

  saveEquivalencia(): void {
    const conc = this.produtosMap.get(this.form.id_produto_concorrente);
    const cand = this.produtosMap.get(this.form.id_produto_candidato);
    if (!conc || !cand) return;

    this.saving.set(true);
    this.catalog
      .createEquivalencia({
        ...this.form,
        fabricante_concorrente: conc.fabricante,
        codigo_concorrente: conc.codigo_comercial,
        fabricante_candidato: cand.fabricante,
        codigo_candidato: cand.codigo_comercial,
        categoria: conc.categoria,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createVisible = false;
          this.loadEquivalencias();
        },
        error: () => this.saving.set(false),
      });
  }

  comparar(eq: Equivalencia): void {
    this.router.navigate(['/comparador'], {
      queryParams: {
        concorrente: eq.id_produto_concorrente,
        candidato: eq.id_produto_candidato,
      },
    });
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

  compatSeverity(val: string): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (val) {
      case 'Alta':
        return 'success';
      case 'Média':
        return 'warn';
      case 'Baixa':
      case 'Incompatível':
        return 'danger';
      default:
        return 'secondary';
    }
  }
}
