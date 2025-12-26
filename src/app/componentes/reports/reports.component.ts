import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, combineLatest, catchError, of } from 'rxjs';
import { Client, Report, Space, Subsuelo } from '../../models/autolavado.model';
import { AutolavadoService } from '../../services/autolavado.service';
import { HttpClient } from '@angular/common/http';
import { ReportsListComponent } from "../reports-list/reports-list.component";

declare const bootstrap: any;
@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, ReportsListComponent],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  subsuelos: Subsuelo[] = [];
  spaces: { [key: string]: Space } = {};
  clients: { [key: string]: Client } = {};
  filteredClients: any[] = [];
  searchTerm = '';

  totalSpaces = 0;
  occupiedSpaces = 0;
  freeSpaces = 0;
  occupancyRate = 0;

  subsueloStats: any[] = [];
  timeStats = {
    under1h: 0,
    between1h3h: 0,
    over3h: 0
  };

  pageSize = 5;
  currentPage = 1;
  currentClients!: Client[];

  private API_BASE = 'http://localhost:8080/api'
  //private API_BASE = 'https://talented-connection-production.up.railway.app/api'
  showReportsList = false;

scheduledTime: string = ''; // Hora guardada (ej. "23:30")
private dailyInterval: any;

  constructor(private autolavadoService: AutolavadoService, private cdr: ChangeDetectorRef, private http: HttpClient) {}


  ngOnInit(): void {
    combineLatest([
      this.autolavadoService.subsuelos$,
      this.autolavadoService.spaces$,
      this.autolavadoService.clients$,
      this.autolavadoService.filteredClients$
    ]).pipe(takeUntil(this.destroy$))
    .subscribe(([subsuelos, spaces, clients, filteredClients]) => {
      this.subsuelos = subsuelos;
      this.spaces = spaces;
      this.clients = clients;
      this.filteredClients = filteredClients;
      console.log('Filtered Clients cargados:', filteredClients);
      this.calculateStats();
      this.cdr.detectChanges();
    });

    setInterval(() => {
      this.calculateStats();
      this.cdr.detectChanges();
    }, 60000);



    const saved = localStorage.getItem('dailyReportTime');
  if (saved) {
    this.scheduledTime = saved;
    this.startDailyScheduler();
  }

/*const saved = localStorage.getItem('dailyReportTime');
  if (saved) {
    this.scheduledTime = saved;
    this.checkIfShouldGenerateDailyReport();
  }

  // Verificar cada minuto si ya pasó la hora programada
  setInterval(() => {
    this.checkIfShouldGenerateDailyReport();
  }, 60 * 1000);*/


  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

toggleReportsList(): void {
  this.showReportsList = !this.showReportsList;
  if (this.showReportsList) {
    this.refreshStats(); // Actualiza stats al abrir
  }
}

toggleReportsList0(): void {
  const reportHtml = this.autolavadoService.generateReportsListHtml(); // Genera HTML dinámico
  const blob = new Blob([reportHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank'); // Abre new tab
  URL.revokeObjectURL(url);
}



  private calculateStats(): void {
    const spacesArray = Object.values(this.spaces);

    // Estadísticas generales
    this.totalSpaces = spacesArray.length;
    this.occupiedSpaces = spacesArray.filter(s => s.occupied).length;
    this.freeSpaces = this.totalSpaces - this.occupiedSpaces;
    this.occupancyRate = this.totalSpaces > 0 ? Math.round((this.occupiedSpaces / this.totalSpaces) * 100) : 0;

    // Estadísticas por subsuelo
    this.subsueloStats = this.subsuelos.map(sub => {
      const subSpaces = spacesArray.filter(s => s.subsueloId === sub.id);
      const subOccupied = subSpaces.filter(s => s.occupied).length;
      const subTotal = subSpaces.length;
      const subFree = subTotal - subOccupied;
      const subOccupancyRate = subTotal > 0 ? Math.round((subOccupied / subTotal) * 100) : 0;

      return {
        id: sub.id,
        label: sub.label,
        total: subTotal,
        occupied: subOccupied,
        free: subFree,
        occupancyRate: subOccupancyRate
      };


    });

       this.currentClients = Object.values(this.clients).filter(client => {
      const space = this.spaces[client.spaceKey];
      return space && space.occupied;
    });

    // Estadísticas de tiempo
    const now = Date.now();
    this.timeStats = {
      under1h: 0,
      between1h3h: 0,
      over3h: 0
    };

    spacesArray.filter(s => s.occupied).forEach(space => {
      if (!space.startTime) return;

      const elapsedMs = now - space.startTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);

      if (elapsedHours < 1) {
        this.timeStats.under1h++;
      } else if (elapsedHours <= 3) {
        this.timeStats.between1h3h++;
      } else {
        this.timeStats.over3h++;
      }
    });
  }

  getProgressBarClass(rate: number): string {
    if (rate < 50) return 'bg-success';
    if (rate < 80) return 'bg-warning';
    return 'bg-danger';
  }

  getElapsedTime(spaceKey: string): string {
    const space = this.spaces[spaceKey];
    return this.autolavadoService.elapsedFrom(space?.startTime);
  }

  onSearchClients(): void {
    this.autolavadoService.setSearchTerm(this.searchTerm);
    this.currentPage = 1;
  }

  get paginatedClients(): Client[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredClients.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredClients.length / this.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const maxPages = 5;
    let start = Math.max(1, current - Math.floor(maxPages / 2));
    let end = Math.min(total, start + maxPages - 1);

    if (end - start + 1 < maxPages) {
      start = Math.max(1, end - maxPages + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  refreshStats(): void {
    this.calculateStats();
    this.cdr.detectChanges();
  }

  exportData(): void {
    const data = {
      timestamp: new Date().toISOString(),
      subsuelos: this.subsuelos,
      spaces: this.spaces,
      clients: this.clients,
      stats: {
        total: this.totalSpaces,
        occupied: this.occupiedSpaces,
        free: this.freeSpaces,
        occupancyRate: this.occupancyRate
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `exellssior_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }


  saveScheduledTime1(): void {
  localStorage.setItem('dailyReportTime', this.scheduledTime);
  if (this.dailyInterval) clearInterval(this.dailyInterval);
  this.startDailyScheduler();
  alert(`Reporte programado diariamente a las ${this.scheduledTime}`);
}

saveScheduledTime(): void {
  localStorage.setItem('dailyReportTime', this.scheduledTime);
  this.startDailyScheduler(); // Reinicia el scheduler con la nueva hora
  this.showSuccessToast(`Reporte programado a las ${this.scheduledTime}`);
}

// Programar ejecución diaria
startDailyScheduler0(): void {
  if (!this.scheduledTime) return;

  const [hours, minutes] = this.scheduledTime.split(':').map(Number);
  const now = new Date();
  let nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);

  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNext = nextRun.getTime() - now.getTime();

  setTimeout(() => {
    this.generateAndSaveReport();
    this.dailyInterval = setInterval(() => {
      this.generateAndSaveReport();
    }, 24 * 60 * 60 * 1000); // Cada 24h
  }, msUntilNext);
}

private startDailyScheduler(): void {
  if (!this.scheduledTime) return;

  // Limpiar cualquier intervalo anterior
  if (this.dailyInterval) {
    clearInterval(this.dailyInterval);
  }

  // Verificar cada minuto si ya pasó la hora programada hoy
  this.dailyInterval = setInterval(() => {
    this.checkAndGenerateDailyReport();
  }, 60 * 1000); // Cada minuto

  // Verificar inmediatamente al iniciar
  this.checkAndGenerateDailyReport();
}

private checkIfShouldGenerateDailyReport0(): void {
  if (!this.scheduledTime) return;

  const [targetHour, targetMinute] = this.scheduledTime.split(':').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute);

  // Verificar si ya pasó la hora hoy y no se generó aún
  const lastRun = localStorage.getItem('lastDailyReportDate');
  const todayKey = now.toDateString();

  if (now >= today && lastRun !== todayKey) {
    console.log('Generando reporte diario automático...');
    this.generateAndSaveReport(false);
    localStorage.setItem('lastDailyReportDate', todayKey);
  }
}

checkIfShouldGenerateDailyReport(): void {
  if (!this.scheduledTime) return;

  const [hour, minute] = this.scheduledTime.split(':').map(Number);
  const now = new Date();
  const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  // Si ya pasó la hora hoy
  if (now > scheduled) {
    const lastRun = localStorage.getItem('lastDailyReportDate');
    const today = now.toDateString();

    if (lastRun !== today) {
      this.generateAndSaveReport(false);
      localStorage.setItem('lastDailyReportDate', today);
      console.log('Reporte diario automático generado a las', this.scheduledTime);
    }
  }
}

private checkAndGenerateDailyReport(): void {
  if (!this.scheduledTime) return;

  const [hour, minute] = this.scheduledTime.split(':').map(Number);
  const now = new Date();
  const todayScheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);

  // Clave única para hoy (para no repetir)
  const todayKey = now.toDateString();
  const lastRun = localStorage.getItem('lastDailyReportDate');

  // Si ya pasó la hora programada hoy y no se generó aún
  if (now >= todayScheduled && lastRun !== todayKey) {
    console.log('Generando reporte automático diario a las', this.scheduledTime);
    this.generateAndSaveReport(false); // false = automático
    localStorage.setItem('lastDailyReportDate', todayKey);
  }
}


generateAndSaveReport(isManual: boolean = false): void {
  const reportData = {
    timestamp: new Date().toISOString(),
    totalSpaces: this.totalSpaces,
    occupiedSpaces: this.occupiedSpaces,
    freeSpaces: this.freeSpaces,
    occupancyRate: this.occupancyRate,
    subsueloStats: JSON.stringify(this.subsueloStats),
    timeStats: JSON.stringify(this.timeStats),
    filteredClients: JSON.stringify(this.filteredClients)
  };

  console.log('Generando y guardando reporte...', reportData);

  this.http.post<Report>(`${this.API_BASE}/reports`, reportData).subscribe({
    next: (savedReport) => {
      console.log('Reporte guardado en backend:', savedReport);

      // Generar HTML detallado
      const detailHtml = this.autolavadoService.generateReportDetailHtml({
        ...reportData,
        id: savedReport.id,
        timestamp: savedReport.timestamp,
        subsueloStats: reportData.subsueloStats,
        timeStats: reportData.timeStats,
        filteredClients: reportData.filteredClients
      } as Report);

      // Descargar automáticamente
      const blob = new Blob([detailHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_exellsior_${new Date().toISOString().split('T')[0]}_${isManual ? 'manual' : 'automatico'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Mostrar toast de éxito
      this.showSuccessToast(
        isManual
          ? 'Reporte manual generado y descargado'
          : 'Reporte diario automático generado y descargado'
      );
    },
    error: (error) => {
      console.error('Error al generar reporte', error);
      this.showErrorToast('Error al generar el reporte');
    }
  });
}

// En reports.component.ts - Métodos de Toast (CORREGIDOS)

showSuccessToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-bg-success border-0 position-fixed bottom-0 end-0 p-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body text-white">
        ✓ ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.body.appendChild(toast);

  const bsToast = new (window as any).bootstrap.Toast(toast, { delay: 4000 });
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

showErrorToast(message: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast align-items-center text-bg-danger border-0 position-fixed bottom-0 end-0 p-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body text-white">
        ✗ ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.body.appendChild(toast);

  const bsToast = new (window as any).bootstrap.Toast(toast, { delay: 5000 });
  bsToast.show();

  toast.addEventListener('hidden.bs.toast.toast', () => toast.remove());
}




generateReport0(): void {


  const reportHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Exellsior - ${new Date().toLocaleString()}</title>
   <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 20px; }
    h1 { color: #0ea5e9; text-align: center; }
    .section { margin-bottom: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #0ea5e9; }
    .stat-number { font-size: 2em; font-weight: bold; color: #0ea5e9; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #16213e; font-weight: bold; color: #0ea5e9; }
    tr:hover { background: #2d446a; }
    .progress { background: #374151; border-radius: 4px; height: 20px; overflow: hidden; }
    .progress-bar { height: 100%; line-height: 20px; text-align: center; font-size: 0.875em; }
    .time-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .time-card { background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #0ea5e9; }
    .time-number { font-size: 1.5em; font-weight: bold; }
    .no-data { text-align: center; color: #94a3b8; font-style: italic; padding: 40px; }
  </style>
</head>
<body>
  <h1>Reporte Exellssior - ${new Date().toLocaleString()}</h1>

  <div class="section">
    <h2>Resumen General</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${this.totalSpaces}</div>
        <div>Total Espacios</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #10b981;">${this.occupiedSpaces}</div>
        <div>Ocupados</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #3b82f6;">${this.freeSpaces}</div>
        <div>Libres</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #f59e0b;">${this.occupancyRate}%</div>
        <div>Ocupación</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Detalle por Subsuelo</h2>
    <table>
      <thead>
        <tr>
          <th>Subsuelo</th>
          <th>Total</th>
          <th>Ocupados</th>
          <th>Libres</th>
          <th>% Ocupación</th>
        </tr>
      </thead>
      <tbody>
        ${this.subsueloStats.map(stat => `
          <tr>
            <td>${stat.label}</td>
            <td>${stat.total}</td>

            <td><span class="badge bg-danger">${stat.occupied}</span></td>
            <td><span class="badge bg-success">${stat.free}</span></td>
            <td>
              <div class="progress">
                <div class="progress-bar bg-${this.getProgressBarClass(stat.occupancyRate)}" style="width: ${stat.occupancyRate}%">
                  ${stat.occupancyRate}%
                </div>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Distribución por Tiempo</h2>
    <div class="time-stats">
      <div class="time-card">
        <div class="time-number" style="color: #10b981;">${this.timeStats.under1h}</div>
        <div>Menos de 1h</div>
      </div>
      <div class="time-card">
        <div class="time-number" style="color: #f59e0b;">${this.timeStats.between1h3h}</div>
        <div>1h - 3h</div>
      </div>
      <div class="time-card">
        <div class="time-number" style="color: #ef4444;">${this.timeStats.over3h}</div>
        <div>Más de 3h</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Clientes Activos (${this.filteredClients.length})</h2>
    ${this.filteredClients.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Espacio</th>
            <th>Teléfono</th>
            <th>Vehículo</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          ${this.filteredClients.map(client => `
            <tr>
              <td><span style="background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${client.code}</span></td>
              <td>${client.name}</td>
              <td style="color: #3b82f6;">${client.spaceDisplayName}</td>
              <td>+${client.phoneIntl}</td>
              <td>${client.vehicle || '-'}</td>
              <td style="color: #f59e0b;">${this.getElapsedTime(client.spaceKey)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="no-data">No hay clientes actualmente</div>'}
  </div>

  <script>
    // Auto-imprimir al cargar
    window.onload = function() { window.print(); };
  </script>
</body>
</html>
  `;

  const blob = new Blob([reportHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_exellssior_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

generateReport(): void {
  // Preparar datos para backend
  const reportData = {
    timestamp: new Date().toISOString(),
    totalSpaces: this.totalSpaces,
    occupiedSpaces: this.occupiedSpaces,
    freeSpaces: this.freeSpaces,
    occupancyRate: this.occupancyRate,
    subsueloStats: JSON.stringify(this.subsueloStats), // String JSON
    timeStats: JSON.stringify(this.timeStats), // String JSON
    filteredClients: JSON.stringify(this.filteredClients) // String JSON
  };

  console.log('Enviando reporte al backend:', reportData);

  // POST al backend
  this.http.post<any>(`${this.API_BASE}/reports`, reportData).pipe(
    catchError(error => {
      console.error('Error saving report to backend', error);
      alert('Reporte descargado localmente, pero error al guardar en backend: ' + error.message);
      return of(null);
    })
  ).subscribe(response => {
    console.log('Reporte guardado en backend:', response);
  });

  // Generación y descarga HTML local (tu código original)
  const reportHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Exellsior - ${new Date().toLocaleString()}</title>
   <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
  <style>
    body { font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; margin: 20px; }
    h1 { color: #0ea5e9; text-align: center; }
    .section { margin-bottom: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .stat-card { background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #0ea5e9; }
    .stat-number { font-size: 2em; font-weight: bold; color: #0ea5e9; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #16213e; font-weight: bold; color: #0ea5e9; }
    tr:hover { background: #2d446a; }
    .progress { background: #374151; border-radius: 4px; height: 20px; overflow: hidden; }
    .progress-bar { height: 100%; line-height: 20px; text-align: center; font-size: 0.875em; }
    .time-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
    .time-card { background: #1e293b; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #0ea5e9; }
    .time-number { font-size: 1.5em; font-weight: bold; }
    .no-data { text-align: center; color: #94a3b8; font-style: italic; padding: 40px; }
  </style>
</head>
<body>
  <h1>Reporte Exellssior - ${new Date().toLocaleString()}</h1>

  <div class="section">
    <h2>Resumen General</h2>
    <div class="stats">
      <div class="stat-card">
        <div class="stat-number">${this.totalSpaces}</div>
        <div>Total Espacios</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #10b981;">${this.occupiedSpaces}</div>
        <div>Ocupados</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #3b82f6;">${this.freeSpaces}</div>
        <div>Libres</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #f59e0b;">${this.occupancyRate}%</div>
        <div>Ocupación</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Detalle por Subsuelo</h2>
    <table>
      <thead>
        <tr>
          <th>Subsuelo</th>
          <th>Total</th>
          <th>Ocupados</th>
          <th>Libres</th>
          <th>% Ocupación</th>
        </tr>
      </thead>
      <tbody>
        ${this.subsueloStats.map(stat => `
          <tr>
            <td>${stat.label}</td>
            <td>${stat.total}</td>
            <td><span class="badge bg-danger">${stat.occupied}</span></td>
            <td><span class="badge bg-success">${stat.free}</span></td>
            <td>
              <div class="progress">
                <div class="progress-bar bg-${this.getProgressBarClass(stat.occupancyRate)}" style="width: ${stat.occupancyRate}%">
                  ${stat.occupancyRate}%
                </div>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Distribución por Tiempo</h2>
    <div class="time-stats">
      <div class="time-card">
        <div class="time-number" style="color: #10b981;">${this.timeStats.under1h}</div>
        <div>Menos de 1h</div>
      </div>
      <div class="time-card">
        <div class="time-number" style="color: #f59e0b;">${this.timeStats.between1h3h}</div>
        <div>1h - 3h</div>
      </div>
      <div class="time-card">
        <div class="time-number" style="color: #ef4444;">${this.timeStats.over3h}</div>
        <div>Más de 3h</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Clientes Activos (${this.filteredClients.length})</h2>
    ${this.filteredClients.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Espacio</th>
            <th>Teléfono</th>
            <th>Vehículo</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          ${this.filteredClients.map(client => `
            <tr>
              <td><span style="background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${client.code}</span></td>
              <td>${client.name}</td>
              <td style="color: #3b82f6;">${client.spaceDisplayName}</td>
              <td>+${client.phoneIntl}</td>
              <td>${client.vehicle || '-'}</td>
              <td style="color: #f59e0b;">${this.getElapsedTime(client.spaceKey)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="no-data">No hay clientes actualmente</div>'}
  </div>

  <script>
    // Auto-imprimir al cargar
    window.onload = function() { window.print(); };
  </script>
</body>
</html>
  `;

  const blob = new Blob([reportHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `reporte_exellssior_${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}



}
