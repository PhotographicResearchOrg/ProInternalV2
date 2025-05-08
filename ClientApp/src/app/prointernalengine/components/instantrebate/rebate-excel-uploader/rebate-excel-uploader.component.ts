import { Component } from '@angular/core';

@Component({
  selector: 'app-rebate-excel-uploader',
  templateUrl: './rebate-excel-uploader.component.html',
  styleUrls: ['./rebate-excel-uploader.component.scss'] // <-- was "styleUrl"
})
export class RebateExcelUploaderComponent {
  isDragOver = false;
  selectedFile: File | null = null;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      this.handleFile(file);
    }
  }

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      this.selectedFile = file;
    }
  }

  clearFile(): void {
    this.selectedFile = null;
  }

  handleFile(file: File): void {
    if (file.name.endsWith('.xlsx')) {
      this.selectedFile = file;
      console.log('Valid file dropped:', file);
    } else {
      console.warn('Invalid file type.');
    }
  }
}
