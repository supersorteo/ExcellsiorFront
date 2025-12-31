import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Report } from '../../models/autolavado.model';
import { AutolavadoService } from '../../services/autolavado.service';



@Component({
  selector: 'app-reports-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports-list.component.html',
  styleUrl: './reports-list.component.scss'
})
export class ReportsListComponent implements OnInit{

  reports: Report[] = [];
  //private apiBase = 'http://localhost:8080/api';

   private apiBase = 'https://excellsiorback-production.up.railway.app/api'

   constructor(private http: HttpClient, private autolavadoService:AutolavadoService) {}

   ngOnInit(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.http.get<Report[]>(`${this.apiBase}/reports`).subscribe({
      next: (data) => {
        this.reports = data;
        console.log('Reportes recibidos:', data);
      },
      error: (error) => {
        console.error('Error loading reports', error);
      alert('Error al cargar reportes: ' + error.message + '. Verifica backend.');
      this.reports = [];
      }
    });
  }

  viewReport0(id: number): void {
    this.http.get<Report>(`${this.apiBase}/reports/${id}`).subscribe({
      next: (report) => {
        // Aquí puedes mostrar detalles o descargar (ej. generar HTML como en generateReport)
        console.log('Reporte detallado:', report);
        alert('Reporte ID ' + id + ' cargado. Implementa visualización.');
      },
      error: (error) => {
        console.error('Error viewing report', error);
      }
    });
  }

  viewReport(id: number): void {
  this.http.get<Report>(`${this.apiBase}/reports/${id}`).subscribe({
    next: (report) => {
      console.log('Reporte detallado:', report);
      const detailHtml = this.autolavadoService.generateReportDetailHtml(report); // Llama servicio para HTML detallado
      const blob = new Blob([detailHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank'); // Abre new tab dinámica
      URL.revokeObjectURL(url);
    },
    error: (error) => {
      console.error('Error viewing report', error);
      alert('Error al ver reporte');
    }
  });
}



  deleteReport(id: number): void {
    if (confirm('¿Eliminar reporte ID ' + id + '?')) {
      this.http.delete<void>(`${this.apiBase}/reports/${id}`).subscribe({
        next: () => {
          this.loadReports(); // Reload list
          alert('Reporte eliminado.');
        },
        error: (error) => {
          console.error('Error deleting report', error);
          alert('Error al eliminar.');
        }
      });
    }
  }

  refreshReports(): void {
  this.loadReports();
}

}
