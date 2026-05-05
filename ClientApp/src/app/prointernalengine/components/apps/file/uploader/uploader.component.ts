import { Component, ElementRef, QueryList, ViewChildren, Output, EventEmitter } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FileAppService } from 'src/app/prointernalengine/components/apps/file/service/file.app.service';
import { DataService } from "src/app/services/data.service";
import * as XLSX from 'xlsx';
//import * as FileSaver from 'file-saver';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Input } from '@angular/core';
import { ViewChild } from '@angular/core';
import { FileUpload } from 'primeng/fileupload';


interface Image {
    name: string;
    objectURL: string;
}

@Component({
    selector: 'app-file-uploader',
    templateUrl: './uploader.component.html',
    providers: [MessageService]
})
export class UploaderComponent {



  @Input() mode: 'rebate' | 'patronage' = 'rebate';   

  @Input() issueDate: Date | null = null;

  @Input() disabled: boolean = false;

  @Output() reload = new EventEmitter<{ reloadHistorical: boolean; reloadCurrent: boolean }>();

  @ViewChild('fileUploader') fileUploader!: any;  // or FileUpload if typed

  reloadPage() {
    this.reload.emit();
  }



    uploadedFiles: any[] = [];
    public excelData: any[];
    @ViewChildren('buttonEl') buttonEl!: QueryList<ElementRef>;
    public excelDatas: any;
  constructor(
    private messageService: MessageService,
    private fileService: FileAppService,
    private dataService: DataService,
    private http: HttpClient
  ) { }

  onUpload(event: any) {
    const file = event.files[0];
    if (!file) return;

    const reader = new FileReader();
    const filename = file.name;

    reader.onload = (e: any) => {
      const data = new Uint8Array(reader.result as ArrayBuffer);

      try {
        const workbook = XLSX.read(data, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        this.excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const jsonString = JSON.stringify(this.excelData);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const fileData = new File([blob], filename, { type: 'application/json' });

        const onComplete = () => {
          this.reload.emit({ reloadHistorical: true, reloadCurrent: true });

          // ✅ Clear UI and internal state after upload
          setTimeout(() => {
            this.fileUploader.clear();
            this.uploadedFiles = [];
            this.excelData = [];
          }, 0);

          // ✅ Optional: Toast success
          this.messageService.add({
            key: 'fu',
            severity: 'success',
            summary: 'Upload Complete',
            detail: `${this.mode === 'rebate' ? 'Quarterly' : 'Patronage'} data uploaded.`,
            life: 3000
          });
        };

        if (this.mode === 'rebate') {
          this.dataService.uploadQuarterlyFile(fileData, this.issueDate!).subscribe(onComplete);

        }
        else if (this.mode === 'patronage')
        {
          this.dataService.uploadPatronageFile(fileData, this.issueDate!).subscribe(onComplete);

        }
      } catch (error) {
        console.error('Error reading file:', error);
      }
    };

    reader.readAsArrayBuffer(file);
  }


  //onUpload(event: any) {
  //  const file = event.files[0];
  //  const reader = new FileReader();
  //  var filename = file.name

  //  reader.onload = (e: any) => {
  //    const data = new Uint8Array(reader.result as ArrayBuffer);
  //    try
  //    {
  //      const workbook = XLSX.read(data, { type: 'buffer' });
  //      console.log('Workbook:', workbook);

  //      const firstSheetName = workbook.SheetNames[0];
  //      const worksheet = workbook.Sheets[firstSheetName];
  //      this.excelData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  //      console.log('Excel data:', this.excelData);

  //      var jsonString = JSON.stringify(this.excelData);
  //      console.log(jsonString)
  //      //ExcelUpload
  //      const blob = new Blob([jsonString], { type: "application/json" });
  //      const fileData = new File([blob], filename, { type: 'application/json' })

  //      if (this.mode === 'rebate') {
  //        console.log('rebate')
  //        this.dataService.uploadQuarterlyFile(fileData).subscribe(event => {
  //          this.reload.emit();
  //        });
  //      }
  //      else if (this.mode === 'patronage') {
  //        console.log('patronage')
  //        this.dataService.uploadPatronageFile(fileData).subscribe(event => {

  //          this.reload.emit({ reloadHistorical: true, reloadCurrent: true });

  //        });
  //      }
  //    }
  //    catch (error)
  //    {
  //      console.error('Error reading file:', error);
  //    }
  //  };
  //  reader.readAsArrayBuffer(file);
  //  this.reload.emit();
  //}
  


    onImageMouseOver(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'flex' : null;
        })
    }

    onImageMouseLeave(file: Image) {
        this.buttonEl.toArray().forEach(el => {
            el.nativeElement.id === file.name ? el.nativeElement.style.display = 'none' : null;
        })
    }

    removeImage(event: Event, file: any) {
        event.stopPropagation();
        this.uploadedFiles = this.uploadedFiles.filter(i => i !== file);
    }

}
