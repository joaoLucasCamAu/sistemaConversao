import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProdutosComponent } from './pages/produtos/produtos.component';
import { EquivalenciasComponent } from './pages/equivalencias/equivalencias.component';
import { ComparadorComponent } from './pages/comparador/comparador.component';
import { TaxonomiaComponent } from './pages/taxonomia/taxonomia.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'produtos', component: ProdutosComponent },
  { path: 'equivalencias', component: EquivalenciasComponent },
  { path: 'comparador', component: ComparadorComponent },
  { path: 'taxonomia', component: TaxonomiaComponent },
  { path: '**', redirectTo: 'dashboard' },
];
